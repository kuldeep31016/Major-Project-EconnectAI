"""Phase 5: restoration decision workflow (model recommendation vs human decision), field checklist,
model-disagreement register (human-in-the-loop) and its export. No automatic retraining anywhere."""
from __future__ import annotations

import json
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .auth import current_user, require
from .db import (FEASIBILITY_FACTORS, FIELD_CHECKLIST, AnalysisVersion, Evidence, FieldTask, ModelDisagreement,
                 RestorationReview, User, audit, get_db, utcnow)
from .paths import resolve_run

router = APIRouter(tags=["workflow"])


# --------------------------------------------------------------------------- field checklist
@router.get("/api/field/checklist")
def checklist_template():
    """Suggested observation checklist sent with every field task (values are the only accepted answers)."""
    return {"fields": {k: list(v) for k, v in FIELD_CHECKLIST.items()},
            "guidance": "Record what you see at the GPS point; use 'unsure' rather than guessing. Photos and notes are optional but recommended."}


def validate_checklist(raw: str | None) -> Optional[dict]:
    if not raw:
        return None
    try:
        d = json.loads(raw)
    except ValueError:
        raise HTTPException(400, "checklist must be JSON")
    if not isinstance(d, dict):
        raise HTTPException(400, "checklist must be an object")
    out = {}
    for k, v in d.items():
        if k not in FIELD_CHECKLIST:
            raise HTTPException(400, f"unknown checklist field {k!r}")
        if v not in FIELD_CHECKLIST[k]:
            raise HTTPException(400, f"{k} must be one of {list(FIELD_CHECKLIST[k])}")
        out[k] = v
    return out


# --------------------------------------------------------------------------- model disagreement (called on ACCEPTED evidence)
def record_disagreement(db: Session, ev: Evidence, task: FieldTask) -> Optional[ModelDisagreement]:
    """Accepted evidence that contradicts the model becomes an OPEN disagreement for human review.
    patch (model: mangrove) + mangrove_present=no -> false_positive; candidate (model: below threshold) +
    mangrove_present=yes -> false_negative. 'unsure' never creates one."""
    obs = (ev.checklist or {}).get("mangrove_present")
    if task.object_type not in ("patch", "candidate") or not task.object_id or not task.run_id or obs not in ("yes", "no"):
        return None
    kind = "false_positive" if task.object_type == "patch" and obs == "no" else \
           "false_negative" if task.object_type == "candidate" and obs == "yes" else None
    if kind is None or db.query(ModelDisagreement).filter_by(evidence_id=ev.id).first():
        return None
    run = db.get(AnalysisVersion, task.run_id)
    conf = None
    if run and run.path:
        try:
            inp = json.loads((__import__("pathlib").Path(run.path) / "patches_input.json").read_text())
            pool = inp["patches"] if task.object_type == "patch" else inp["candidates"]
            conf = next((p.get("confidence") for p in pool if p["id"] == task.object_id), None)
        except (OSError, ValueError, KeyError):
            pass
    d = ModelDisagreement(evidence_id=ev.id, study_area_id=task.study_area_id, run_id=task.run_id,
                          model_id=run.model_id if run else None, object_type=task.object_type, object_id=task.object_id,
                          lat=ev.lat, lon=ev.lon, observed_at=ev.observed_at, kind=kind,
                          model_prediction={"class": "mangrove" if task.object_type == "patch" else "below habitat threshold",
                                            "mean_probability": conf},
                          field_observation={"checklist": ev.checklist, "observation": ev.observation, "notes": ev.notes})
    db.add(d); db.flush()
    audit(db, None, "model_disagreement_flagged", "model_disagreement", d.id, new={"kind": kind, "evidence": ev.id})
    return d


@router.get("/api/hitl/disagreements")
def list_disagreements(status: Optional[str] = Query(None), study_area: Optional[str] = Query(None),
                       user: User = Depends(require("review_detections")), db: Session = Depends(get_db)):
    q = db.query(ModelDisagreement)
    if status:
        q = q.filter_by(status=status)
    if study_area:
        q = q.filter_by(study_area_id=study_area)
    return [d.to_dict() for d in q.order_by(ModelDisagreement.created_at.desc()).all()]


class DisagreementReview(BaseModel):
    status: Literal["INCLUDED", "EXCLUDED", "OPEN"]
    note: str = Field(min_length=3)


@router.patch("/api/hitl/disagreements/{disagreement_id}")
def review_disagreement(disagreement_id: int, body: DisagreementReview, user: User = Depends(require("review_detections")),
                        db: Session = Depends(get_db)):
    d = db.get(ModelDisagreement, disagreement_id)
    if not d:
        raise HTTPException(404, "not found")
    old = d.status
    d.status, d.review_note, d.reviewed_by = body.status, body.note, user.id
    audit(db, user, "review_disagreement", "model_disagreement", d.id, old={"status": old}, new={"status": d.status}, reason=body.note)
    db.commit()
    return d.to_dict()


@router.get("/api/hitl/export")
def export_training_candidates(user: User = Depends(require("review_detections")), db: Session = Depends(get_db)):
    """GeoJSON of INCLUDED disagreements - labelled points for a FUTURE experiment (review → approval → new
    experiment → evaluation → deployment). Exporting does not change any model."""
    feats = []
    for d in db.query(ModelDisagreement).filter_by(status="INCLUDED").order_by(ModelDisagreement.id).all():
        feats.append({"type": "Feature", "geometry": {"type": "Point", "coordinates": [d.lon, d.lat]},
                      "properties": {"label_mangrove": 1 if d.kind == "false_negative" else 0, "kind": d.kind,
                                     "source": f"field evidence #{d.evidence_id}", "observed_at": d.observed_at,
                                     "model_id": d.model_id, "run_id": d.run_id, "model_prediction": d.model_prediction}})
    audit(db, user, "export_hitl_dataset", "model_disagreement", None, new={"n": len(feats)}); db.commit()
    return {"type": "FeatureCollection", "features": feats,
            "note": "Field-verified disagreements approved for a future retraining experiment. Not used automatically."}


# --------------------------------------------------------------------------- restoration decision workflow
def _stage(r: RestorationReview, db: Session) -> str:
    if r.decision in ("APPROVED", "REJECTED"):
        return "DECIDED"
    t = db.get(FieldTask, r.field_task_id) if r.field_task_id else None
    if t and t.status == "VERIFIED":
        return "FEASIBILITY"
    if (r.gis_review or {}).get("outcome") == "PROCEED":
        return "FIELD_VERIFICATION"
    return "GIS_REVIEW"


def _out(r: RestorationReview, db: Session) -> dict:
    t = db.get(FieldTask, r.field_task_id) if r.field_task_id else None
    feas = {f: (r.feasibility or {}).get(f) for f in FEASIBILITY_FACTORS}
    return r.to_dict() | {"stage": _stage(r, db), "feasibility": feas,
                          "not_assessed": [f for f, v in feas.items() if v is None],
                          "field_task": {"id": t.id, "status": t.status} if t else None}


class ReviewIn(BaseModel):
    study_area: str
    run_id: str
    candidate_id: str = Field(pattern=r"^[A-Za-z0-9._-]{1,32}$")


@router.post("/api/restoration/reviews")
def create_review(body: ReviewIn, user: User = Depends(require("review_detections")), db: Session = Depends(get_db)):
    run_dir = resolve_run(body.study_area, body.run_id)
    rest = json.loads((run_dir / "restoration.json").read_text())
    c = next((x for x in rest["candidates"] if x["candidate_id"] == body.candidate_id), None)
    if not c:
        raise HTTPException(404, "candidate not found in this run")
    run_id = run_dir.name if db.get(AnalysisVersion, run_dir.name) else None
    if db.query(RestorationReview).filter_by(run_id=run_id, candidate_id=body.candidate_id).first():
        raise HTTPException(409, "a review for this candidate already exists")
    r = RestorationReview(study_area_id=body.study_area, run_id=run_id, candidate_id=body.candidate_id, created_by=user.id,
                          model_recommendation={k: c.get(k) for k in ("rank", "gain_pct", "area_ha", "new_links", "linked_patch_ids", "centroid")}
                          | {"ranking_basis": rest.get("ranking_basis"), "label": "MODEL RECOMMENDATION (simulated connectivity gain)"},
                          feasibility={f: None for f in FEASIBILITY_FACTORS})
    r.stage = _stage(r, db)
    db.add(r); db.flush()
    audit(db, user, "create_restoration_review", "restoration_review", r.id, new={"candidate": body.candidate_id, "run": run_id})
    db.commit()
    return _out(r, db)


@router.get("/api/restoration/reviews")
def list_reviews(study_area: Optional[str] = Query(None), run_id: Optional[str] = Query(None),
                 user: User = Depends(current_user), db: Session = Depends(get_db)):
    q = db.query(RestorationReview)
    if study_area:
        q = q.filter_by(study_area_id=study_area)
    if run_id:
        q = q.filter_by(run_id=run_id)
    return [_out(r, db) for r in q.order_by(RestorationReview.id).all()]


def _get(db: Session, review_id: int) -> RestorationReview:
    r = db.get(RestorationReview, review_id)
    if not r:
        raise HTTPException(404, "review not found")
    return r


class GisIn(BaseModel):
    outcome: Literal["PROCEED", "HOLD"]
    notes: str = Field(min_length=3)


@router.patch("/api/restoration/reviews/{review_id}/gis")
def gis_review(review_id: int, body: GisIn, user: User = Depends(require("review_detections")), db: Session = Depends(get_db)):
    r = _get(db, review_id)
    if _stage(r, db) == "DECIDED":
        raise HTTPException(409, "already decided")
    r.gis_review = {"outcome": body.outcome, "notes": body.notes, "by": user.username, "at": utcnow().isoformat()}
    r.stage, r.updated_at = _stage(r, db), utcnow()
    audit(db, user, "restoration_gis_review", "restoration_review", r.id, new=r.gis_review); db.commit()
    return _out(r, db)


class FieldTaskIn(BaseModel):
    assignee_id: Optional[int] = None
    due_date: Optional[str] = None


@router.post("/api/restoration/reviews/{review_id}/field-task")
def review_field_task(review_id: int, body: FieldTaskIn, user: User = Depends(require("assign_tasks")), db: Session = Depends(get_db)):
    r = _get(db, review_id)
    if _stage(r, db) != "FIELD_VERIFICATION":
        raise HTTPException(409, "GIS review must say PROCEED before field verification")
    if r.field_task_id:
        raise HTTPException(409, "field task already created")
    mr = r.model_recommendation or {}
    lat, lon = (mr.get("centroid") or [None, None])[:2]
    t = FieldTask(study_area_id=r.study_area_id, title=f"Restoration site check: candidate {r.candidate_id}",
                  reason=(f"Model-ranked restoration candidate (+{mr.get('gain_pct', 0):.2f} % simulated connectivity). "
                          "Record habitat/mangrove presence, water condition, disturbance, access and land use."),
                  lat=lat, lon=lon, object_type="candidate", object_id=r.candidate_id, run_id=r.run_id,
                  assignee_id=body.assignee_id, due_date=body.due_date, created_by=user.id,
                  evidence_required="checklist + photo + access notes")
    db.add(t); db.flush()
    r.field_task_id, r.updated_at = t.id, utcnow()
    audit(db, user, "restoration_field_task", "restoration_review", r.id, new={"field_task": t.id}); db.commit()
    return _out(r, db)


class FeasibilityIn(BaseModel):
    factor: Literal["ownership", "legal_status", "water_conditions", "land_use", "cost", "accessibility"]
    value: Optional[str] = Field(None, max_length=500)      # None resets to "Not assessed"
    source: Optional[str] = Field(None, max_length=300)     # document, survey, office record...


@router.patch("/api/restoration/reviews/{review_id}/feasibility")
def set_feasibility(review_id: int, body: FeasibilityIn, user: User = Depends(require("review_detections")), db: Session = Depends(get_db)):
    r = _get(db, review_id)
    if _stage(r, db) not in ("FEASIBILITY",):
        raise HTTPException(409, "feasibility is assessed after the field task is VERIFIED")
    if body.value is not None and not body.source:
        raise HTTPException(400, "every assessed factor needs a source")
    f = dict(r.feasibility or {})
    f[body.factor] = None if body.value is None else {"value": body.value, "source": body.source, "by": user.username, "at": utcnow().isoformat()}
    r.feasibility, r.updated_at = f, utcnow()
    audit(db, user, "restoration_feasibility", "restoration_review", r.id, new={body.factor: f[body.factor]}); db.commit()
    return _out(r, db)


class DecisionIn(BaseModel):
    decision: Literal["APPROVED", "REJECTED", "DEFERRED"]
    reason: str = Field(min_length=10)


@router.patch("/api/restoration/reviews/{review_id}/decision")
def decide(review_id: int, body: DecisionIn, user: User = Depends(require("decide_restoration")), db: Session = Depends(get_db)):
    """Human decision. APPROVED requires a field-verified site; REJECTED/DEFERRED are allowed at any stage."""
    r = _get(db, review_id)
    if body.decision == "APPROVED" and _stage(r, db) != "FEASIBILITY":
        raise HTTPException(409, "approval requires GIS review, a VERIFIED field task and a feasibility assessment step")
    old = r.decision
    r.decision, r.decision_reason, r.decided_by, r.updated_at = body.decision, body.reason, user.id, utcnow()
    r.stage = _stage(r, db)
    audit(db, user, "restoration_decision", "restoration_review", r.id, old={"decision": old}, new={"decision": r.decision}, reason=body.reason)
    db.commit()
    return _out(r, db)
