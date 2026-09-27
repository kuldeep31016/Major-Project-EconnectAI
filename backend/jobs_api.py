"""Job endpoints: submit, list, inspect, cancel."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .auth import capabilities_for, current_user
from .db import Job, User, get_db
from .jobs import HANDLERS, enqueue

router = APIRouter(prefix="/api/jobs", tags=["jobs"])
# capability required to submit each job type ("" = any signed-in user)
SUBMIT_CAP = {"segment": "run_analysis", "scenario": ""}


class JobIn(BaseModel):
    type: str
    params: dict = Field(default_factory=dict)


def _visible(j: Job, user: User) -> bool:
    return j.created_by == user.id or "view_audit" in capabilities_for(user.role)


@router.post("", status_code=202)
def submit(body: JobIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if body.type not in HANDLERS or body.type not in SUBMIT_CAP:
        raise HTTPException(400, f"unknown job type; one of {sorted(SUBMIT_CAP)}")
    if body.type == "segment":
        raise HTTPException(400, "submit segmentation through POST /api/segment (validated inputs)")
    cap = SUBMIT_CAP[body.type]
    if cap and cap not in capabilities_for(user.role):
        raise HTTPException(403, f"requires capability {cap!r}")
    if body.type == "scenario" and not (isinstance(body.params.get("body"), dict) and body.params.get("study_area")):
        raise HTTPException(400, "scenario jobs need params.study_area and params.body (a Scenario Lab request)")
    return enqueue(db, body.type, body.params, user, body.params.get("study_area")).to_dict()


@router.get("")
def list_jobs(status: Optional[str] = Query(None), study_area: Optional[str] = Query(None), limit: int = Query(50, le=200),
              user: User = Depends(current_user), db: Session = Depends(get_db)):
    q = db.query(Job)
    if "view_audit" not in capabilities_for(user.role):
        q = q.filter(Job.created_by == user.id)
    if status:
        q = q.filter(Job.status == status)
    if study_area:
        q = q.filter(Job.study_area_id == study_area)
    return [j.to_dict() for j in q.order_by(Job.created_at.desc()).limit(limit).all()]


@router.get("/{job_id}")
def get_job(job_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    j = db.get(Job, job_id)
    if not j or not _visible(j, user):
        raise HTTPException(404, "job not found")
    return j.to_dict()


@router.post("/{job_id}/cancel")
def cancel(job_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    j = db.get(Job, job_id)
    if not j or not _visible(j, user):
        raise HTTPException(404, "job not found")
    if j.status not in ("QUEUED", "RUNNING"):
        raise HTTPException(409, f"job is {j.status}")
    j.status = "CANCELLED"          # a running handler stops at its next progress report
    db.commit()
    return j.to_dict()


# --------------------------------------------------------------------------- artifacts (read-only lineage)
artifacts_router = APIRouter(prefix="/api/artifacts", tags=["artifacts"])


@artifacts_router.get("")
def list_artifacts(run_id: Optional[str] = Query(None), model_id: Optional[str] = Query(None),
                   kind: Optional[str] = Query(None), limit: int = Query(200, le=1000), db: Session = Depends(get_db)):
    from .db import Artifact
    q = db.query(Artifact)
    for col, v in (("run_id", run_id), ("model_id", model_id), ("kind", kind)):
        if v:
            q = q.filter(getattr(Artifact, col) == v)
    return [a.to_dict() for a in q.order_by(Artifact.key).limit(limit).all()]
