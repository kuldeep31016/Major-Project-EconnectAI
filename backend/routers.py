"""Workflow API: auth, users, registry, alerts, detections (verification statuses), field tasks, evidence,
projects, scenarios, audit, model cards.  Every state change is written to the append-only audit log."""
from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ecoconnect.pipeline.config import OUTPUTS_DIR
from .auth import ROLES, capabilities_for, create_token, current_user, require, verify_password, hash_password
from .db import (ALERT_STATUSES, DETECTION_STATUSES, ROLE_LABELS, TASK_STATUSES, Alert, AnalysisVersion, AuditLog,
                 Detection, Evidence, FieldTask, LabelSource, Model, Project, Report, Scene, Scenario, StudyArea,
                 User, audit, get_db, utcnow)
from .alerts import generate_alerts
from .registry import sync_all

router = APIRouter(prefix="/api")
EVIDENCE_DIR = OUTPUTS_DIR / "evidence"
ALLOWED_PHOTO = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
MAX_PHOTO_BYTES = 8 * 1024 * 1024


def _user_out(u: User) -> dict:
    return {"id": u.id, "username": u.username, "fullName": u.full_name, "role": u.role,
            "roleLabel": ROLE_LABELS.get(u.role, u.role), "capabilities": capabilities_for(u.role), "orgId": u.org_id}


# --------------------------------------------------------------------------- auth / users
class LoginIn(BaseModel):
    username: str
    password: str


@router.post("/auth/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    u = db.query(User).filter_by(username=body.username).first()
    if not u or not u.active or not verify_password(body.password, u.password_hash):
        raise HTTPException(401, "invalid username or password")
    audit(db, u, "login"); db.commit()
    return {"token": create_token(u), "user": _user_out(u)}


@router.get("/auth/me")
def me(user: User = Depends(current_user)):
    return _user_out(user)


@router.get("/auth/roles")
def roles():
    return [{"role": r, "label": ROLE_LABELS[r], "capabilities": capabilities_for(r)} for r in ROLES]


@router.get("/users")
def list_users(user: User = Depends(require("assign_tasks")), db: Session = Depends(get_db)):
    return [_user_out(u) for u in db.query(User).order_by(User.role).all()]


class UserIn(BaseModel):
    username: str
    full_name: str
    role: str
    password: str
    email: Optional[str] = None


@router.post("/users")
def create_user(body: UserIn, user: User = Depends(require("manage_users")), db: Session = Depends(get_db)):
    if body.role not in ROLES:
        raise HTTPException(400, f"role must be one of {ROLES}")
    if db.query(User).filter_by(username=body.username).first():
        raise HTTPException(409, "username exists")
    u = User(username=body.username, full_name=body.full_name, role=body.role, email=body.email,
             org_id=user.org_id, password_hash=hash_password(body.password))
    db.add(u); db.flush()
    audit(db, user, "create_user", "user", u.id, new={"username": u.username, "role": u.role}); db.commit()
    return _user_out(u)


# --------------------------------------------------------------------------- registry / provenance
@router.post("/registry/sync")
def registry_sync(user: User = Depends(require("run_analysis")), db: Session = Depends(get_db)):
    out = sync_all(db)
    audit(db, user, "registry_sync", new=out); db.commit()
    return out


@router.get("/registry/{study_area}")
def registry(study_area: str, db: Session = Depends(get_db)):
    """The digital-twin index of a landscape: boundary, scenes, labels, analysis versions, models used."""
    sa = db.get(StudyArea, study_area)
    if not sa:
        raise HTTPException(404, "unknown study area")
    versions = db.query(AnalysisVersion).filter_by(study_area_id=study_area).order_by(AnalysisVersion.timestamp.desc()).all()
    return {
        "studyArea": sa.to_dict(),
        "scenes": [s.to_dict() | {"manifest": None} for s in db.query(Scene).filter_by(study_area_id=study_area).all()],
        "labels": [l.to_dict() | {"manifest": None} for l in db.query(LabelSource).filter_by(study_area_id=study_area).all()],
        "analysisVersions": [v.to_dict() | {"manifest": None} for v in versions],
        "models": [m.to_dict() for m in db.query(Model).all() if any(v.model_id == m.id for v in versions)],
    }


@router.get("/model-cards")
def model_cards(db: Session = Depends(get_db)):
    """AI model cards. Categories are never mixed: foundation-paper result / prototype / our results."""
    cards = [m.to_dict() for m in db.query(Model).all()]
    return {
        "foundationPaper": {"name": "UNB7 (Ghorbanian et al. 2025, IEEE JSTARS)", "architecture": "U-Net + EfficientNet-B7",
                            "input": "Sentinel-1 SAR VV/VH time series", "labels": "weakly supervised against an existing map",
                            "metrics": {"overall_accuracy": 0.9556, "kappa": 0.94, "f1": 0.95},
                            "label": "FOUNDATION PAPER RESULT — NOT OURS", "note": "Reported by the foundation study on their data; not reproduced here."},
        "prototype": {"name": "prototype synthetic geometry", "label": "PROTOTYPE / DEMONSTRATION DATA",
                      "note": "No model; deterministic generator. Only site metadata is real."},
        "ours": cards,
    }


# --------------------------------------------------------------------------- alerts
@router.get("/alerts")
def list_alerts(study_area: Optional[str] = None, status: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(Alert)
    if study_area:
        q = q.filter_by(study_area_id=study_area)
    if status:
        q = q.filter_by(status=status)
    return [a.to_dict() for a in q.order_by(Alert.created_at.desc()).limit(500).all()]


@router.post("/alerts/generate/{study_area}")
def alerts_generate(study_area: str, run_id: str = "latest", user: User = Depends(require("manage_alerts")), db: Session = Depends(get_db)):
    q = db.query(AnalysisVersion).filter_by(study_area_id=study_area).filter(AnalysisVersion.result_kind != "synthetic")
    run = q.filter_by(id=run_id).first() if run_id != "latest" else q.order_by(AnalysisVersion.timestamp.desc()).first()
    if not run:
        raise HTTPException(404, "no real analysis version for this study area (synthetic runs never raise alerts)")
    n = generate_alerts(db, study_area, run)
    audit(db, user, "generate_alerts", "study_area", study_area, new={"run_id": run.id, "alerts": n}); db.commit()
    return {"generated": n, "run_id": run.id}


class AlertUpdate(BaseModel):
    status: str
    reason: Optional[str] = None


@router.patch("/alerts/{alert_id}")
def update_alert(alert_id: int, body: AlertUpdate, user: User = Depends(require("manage_alerts")), db: Session = Depends(get_db)):
    if body.status not in ALERT_STATUSES:
        raise HTTPException(400, f"status must be one of {ALERT_STATUSES}")
    a = db.get(Alert, alert_id)
    if not a:
        raise HTTPException(404, "alert not found")
    old = a.status; a.status = body.status; a.updated_at = utcnow()
    audit(db, user, "update_alert", "alert", a.id, old={"status": old}, new={"status": a.status}, reason=body.reason); db.commit()
    return a.to_dict()


# --------------------------------------------------------------------------- detections (verification workflow)
class DetectionIn(BaseModel):
    study_area_id: str
    run_id: str
    object_type: str
    object_id: str
    lat: Optional[float] = None
    lon: Optional[float] = None
    summary: Optional[str] = None


@router.get("/detections")
def list_detections(study_area: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(Detection)
    if study_area:
        q = q.filter_by(study_area_id=study_area)
    return [d.to_dict() for d in q.order_by(Detection.updated_at.desc()).all()]


@router.post("/detections")
def upsert_detection(body: DetectionIn, user: User = Depends(require("review_detections")), db: Session = Depends(get_db)):
    d = db.query(Detection).filter_by(run_id=body.run_id, object_type=body.object_type, object_id=body.object_id).first()
    if not d:
        d = Detection(**body.model_dump(), status="AI_DETECTED", updated_by=user.id)
        db.add(d); db.flush()
        audit(db, user, "register_detection", "detection", d.id, new=body.model_dump())
    db.commit()
    return d.to_dict()


class StatusIn(BaseModel):
    status: str
    reason: Optional[str] = None


@router.patch("/detections/{det_id}/status")
def set_detection_status(det_id: int, body: StatusIn, user: User = Depends(require("review_detections")), db: Session = Depends(get_db)):
    if body.status not in DETECTION_STATUSES:
        raise HTTPException(400, f"status must be one of {DETECTION_STATUSES}")
    d = db.get(Detection, det_id)
    if not d:
        raise HTTPException(404, "detection not found")
    # FIELD_VERIFIED / CONFIRMED require accepted field evidence - AI output never self-verifies
    if body.status in ("FIELD_VERIFIED", "CONFIRMED"):
        ok = (db.query(Evidence).join(FieldTask, Evidence.task_id == FieldTask.id)
              .filter(FieldTask.detection_id == d.id, Evidence.verification == "ACCEPTED").count())
        if not ok:
            raise HTTPException(409, "no accepted field evidence exists for this detection; it cannot be marked verified")
    old = d.status; d.status = body.status; d.updated_by = user.id; d.updated_at = utcnow()
    audit(db, user, "detection_status", "detection", d.id, old={"status": old}, new={"status": d.status}, reason=body.reason); db.commit()
    return d.to_dict()


# --------------------------------------------------------------------------- field tasks + evidence
class TaskIn(BaseModel):
    study_area_id: str
    title: str
    reason: str
    lat: float
    lon: float
    object_type: Optional[str] = None
    object_id: Optional[str] = None
    run_id: Optional[str] = None
    assignee_id: Optional[int] = None
    project_id: Optional[int] = None
    alert_id: Optional[int] = None
    detection_id: Optional[int] = None
    evidence_required: str = "photo + observation"
    due_date: Optional[str] = None


@router.get("/field-tasks")
def list_tasks(study_area: Optional[str] = None, mine: bool = False, user: User = Depends(current_user), db: Session = Depends(get_db)):
    q = db.query(FieldTask)
    if study_area:
        q = q.filter_by(study_area_id=study_area)
    if mine or user.role == "field_officer":
        q = q.filter_by(assignee_id=user.id)
    tasks = q.order_by(FieldTask.created_at.desc()).all()
    users = {u.id: u.full_name for u in db.query(User).all()}
    return [t.to_dict() | {"assigneeName": users.get(t.assignee_id), "createdByName": users.get(t.created_by),
                           "evidenceCount": db.query(Evidence).filter_by(task_id=t.id).count()} for t in tasks]


@router.post("/field-tasks")
def create_task(body: TaskIn, user: User = Depends(require("assign_tasks")), db: Session = Depends(get_db)):
    t = FieldTask(**body.model_dump(), created_by=user.id)
    db.add(t); db.flush()
    if t.detection_id:
        d = db.get(Detection, t.detection_id)
        if d and d.status in ("AI_DETECTED", "UNDER_REVIEW"):
            d.status = "FIELD_ASSIGNED"; d.updated_by = user.id; d.updated_at = utcnow()
    elif body.object_type and body.object_id and body.run_id:
        d = db.query(Detection).filter_by(run_id=body.run_id, object_type=body.object_type, object_id=body.object_id).first()
        if not d:
            d = Detection(study_area_id=body.study_area_id, run_id=body.run_id, object_type=body.object_type,
                          object_id=body.object_id, lat=body.lat, lon=body.lon, summary=body.reason, updated_by=user.id)
            db.add(d); db.flush()
        d.status = "FIELD_ASSIGNED"; t.detection_id = d.id
    if t.alert_id:
        a = db.get(Alert, t.alert_id)
        if a:
            a.status = "ASSIGNED"; a.updated_at = utcnow()
    audit(db, user, "create_field_task", "field_task", t.id, new=body.model_dump()); db.commit()
    return t.to_dict()


@router.patch("/field-tasks/{task_id}/status")
def task_status(task_id: int, body: StatusIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if body.status not in TASK_STATUSES:
        raise HTTPException(400, f"status must be one of {TASK_STATUSES}")
    t = db.get(FieldTask, task_id)
    if not t:
        raise HTTPException(404, "task not found")
    if user.role == "field_officer" and (t.assignee_id != user.id or body.status not in ("IN_PROGRESS", "SUBMITTED")):
        raise HTTPException(403, "field officers may only progress their own tasks to IN_PROGRESS / SUBMITTED")
    if body.status in ("VERIFIED", "REJECTED") and user.role not in ("senior_officer", "range_officer", "state_admin"):
        raise HTTPException(403, "only reviewing officers may verify or reject tasks")
    old = t.status; t.status = body.status; t.updated_at = utcnow()
    audit(db, user, "field_task_status", "field_task", t.id, old={"status": old}, new={"status": t.status}, reason=body.reason); db.commit()
    return t.to_dict()


@router.get("/field-tasks/{task_id}/evidence")
def task_evidence(task_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return [e.to_dict() for e in db.query(Evidence).filter_by(task_id=task_id).order_by(Evidence.created_at).all()]


@router.post("/field-tasks/{task_id}/evidence")
async def submit_evidence(task_id: int, lat: float = Form(...), lon: float = Form(...), observed_at: str = Form(...),
                          observation: str = Form(...), notes: str = Form(""), photo: Optional[UploadFile] = File(None),
                          user: User = Depends(require("submit_evidence")), db: Session = Depends(get_db)):
    t = db.get(FieldTask, task_id)
    if not t:
        raise HTTPException(404, "task not found")
    if user.role == "field_officer" and t.assignee_id != user.id:
        raise HTTPException(403, "task is not assigned to you")
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise HTTPException(400, "invalid coordinates")
    photo_path = None
    if photo is not None:
        if photo.content_type not in ALLOWED_PHOTO:
            raise HTTPException(400, f"photo must be one of {list(ALLOWED_PHOTO)}")
        data = await photo.read()
        if len(data) > MAX_PHOTO_BYTES:
            raise HTTPException(413, "photo larger than 8 MB")
        EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
        fname = f"task{task_id}_{int(utcnow().timestamp())}{ALLOWED_PHOTO[photo.content_type]}"
        (EVIDENCE_DIR / fname).write_bytes(data)
        photo_path = fname
    e = Evidence(task_id=task_id, user_id=user.id, lat=lat, lon=lon, observed_at=observed_at,
                 observation=observation, notes=notes, photo_path=photo_path)
    db.add(e); db.flush()
    if t.status in ("PENDING", "IN_PROGRESS"):
        t.status = "SUBMITTED"; t.updated_at = utcnow()
    audit(db, user, "submit_evidence", "evidence", e.id, new={"task_id": task_id, "observation": observation, "photo": photo_path}); db.commit()
    return e.to_dict()


class VerifyIn(BaseModel):
    verification: str          # ACCEPTED | REJECTED
    reason: Optional[str] = None


@router.patch("/evidence/{evidence_id}/verify")
def verify_evidence(evidence_id: int, body: VerifyIn, user: User = Depends(require("verify_evidence")), db: Session = Depends(get_db)):
    if body.verification not in ("ACCEPTED", "REJECTED"):
        raise HTTPException(400, "verification must be ACCEPTED or REJECTED")
    e = db.get(Evidence, evidence_id)
    if not e:
        raise HTTPException(404, "evidence not found")
    old = e.verification; e.verification = body.verification
    t = db.get(FieldTask, e.task_id)
    if t:
        t.status = "VERIFIED" if body.verification == "ACCEPTED" else "REJECTED"; t.updated_at = utcnow()
        if t.detection_id:
            d = db.get(Detection, t.detection_id)
            if d:
                d.status = "FIELD_VERIFIED" if body.verification == "ACCEPTED" else "REJECTED"; d.updated_by = user.id; d.updated_at = utcnow()
        if t.alert_id:
            a = db.get(Alert, t.alert_id)
            if a:
                a.status = "RESOLVED"; a.updated_at = utcnow()
    audit(db, user, "verify_evidence", "evidence", e.id, old={"verification": old}, new={"verification": e.verification}, reason=body.reason); db.commit()
    return e.to_dict()


@router.get("/evidence/photo/{name}")
def evidence_photo(name: str, user: User = Depends(current_user)):
    from fastapi.responses import FileResponse
    p = (EVIDENCE_DIR / Path(name).name)
    if not p.exists():
        raise HTTPException(404, "photo not found")
    return FileResponse(p)


# --------------------------------------------------------------------------- projects
class ProjectIn(BaseModel):
    name: str
    study_area_id: str
    objectives: Optional[str] = None
    run_id: Optional[str] = None
    priority_patches: list[str] = Field(default_factory=list)
    candidates: list[str] = Field(default_factory=list)
    responsible: list[int] = Field(default_factory=list)


@router.get("/projects")
def list_projects(study_area: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(Project)
    if study_area:
        q = q.filter_by(study_area_id=study_area)
    out = []
    for p in q.order_by(Project.updated_at.desc()).all():
        tasks = db.query(FieldTask).filter_by(project_id=p.id).all()
        out.append(p.to_dict() | {"taskCount": len(tasks), "verifiedTasks": sum(1 for t in tasks if t.status == "VERIFIED"),
                                  "reportCount": db.query(Report).filter_by(project_id=p.id).count()})
    return out


@router.post("/projects")
def create_project(body: ProjectIn, user: User = Depends(require("manage_projects")), db: Session = Depends(get_db)):
    p = Project(**body.model_dump(), owner_id=user.id)
    db.add(p); db.flush()
    audit(db, user, "create_project", "project", p.id, new=body.model_dump()); db.commit()
    return p.to_dict()


class ProjectUpdate(BaseModel):
    status: Optional[str] = None
    objectives: Optional[str] = None
    priority_patches: Optional[list[str]] = None
    candidates: Optional[list[str]] = None
    responsible: Optional[list[int]] = None
    reason: Optional[str] = None


@router.patch("/projects/{project_id}")
def update_project(project_id: int, body: ProjectUpdate, user: User = Depends(require("manage_projects")), db: Session = Depends(get_db)):
    p = db.get(Project, project_id)
    if not p:
        raise HTTPException(404, "project not found")
    if body.status and body.status not in ("PLANNED", "ACTIVE", "UNDER_REVIEW", "COMPLETED", "ARCHIVED"):
        raise HTTPException(400, "invalid status")
    old = {k: getattr(p, k) for k in ("status", "objectives", "priority_patches", "candidates", "responsible")}
    for k, v in body.model_dump(exclude_none=True).items():
        if k != "reason":
            setattr(p, k, v)
    p.updated_at = utcnow()
    audit(db, user, "update_project", "project", p.id, old=old, new=body.model_dump(exclude_none=True), reason=body.reason); db.commit()
    return p.to_dict()


@router.get("/projects/{project_id}")
def project_detail(project_id: int, db: Session = Depends(get_db)):
    p = db.get(Project, project_id)
    if not p:
        raise HTTPException(404, "project not found")
    tasks = [t.to_dict() for t in db.query(FieldTask).filter_by(project_id=p.id).all()]
    reports = [r.to_dict() | {"content": None} for r in db.query(Report).filter_by(project_id=p.id).all()]
    return p.to_dict() | {"tasks": tasks, "reports": reports}


# --------------------------------------------------------------------------- scenarios (persisted)
class ScenarioIn(BaseModel):
    study_area_id: str
    run_id: str
    type: str
    params: dict
    result: dict


@router.get("/scenarios")
def list_scenarios(study_area: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(Scenario)
    if study_area:
        q = q.filter_by(study_area_id=study_area)
    return [s.to_dict() for s in q.order_by(Scenario.created_at.desc()).limit(200).all()]


@router.post("/scenarios")
def save_scenario(body: ScenarioIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    s = Scenario(**body.model_dump(), label="SIMULATED", created_by=user.id)
    db.add(s); db.flush()
    audit(db, user, "save_scenario", "scenario", s.id, new={"type": body.type, "params": body.params}); db.commit()
    return s.to_dict()


# --------------------------------------------------------------------------- audit
@router.get("/audit")
def audit_log(limit: int = 200, user: User = Depends(require("view_audit")), db: Session = Depends(get_db)):
    return [a.to_dict() for a in db.query(AuditLog).order_by(AuditLog.ts.desc()).limit(min(limit, 1000)).all()]
