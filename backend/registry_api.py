"""Model registry (status ladder + validation workflow), experiment comparison, provenance, reproducibility."""
from __future__ import annotations

import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .auth import capabilities_for, current_user
from .db import MODEL_STATUSES, Job, Model, User, audit, get_db, utcnow
from .jobs import enqueue
from .paths import SEG_DIR, resolve_run
from .provenance import lineage

router = APIRouter(tags=["registry"])


# --------------------------------------------------------------------------- model registry
class ValidationEvidence(BaseModel):
    dataset: str = Field(min_length=3)            # independent validation data (e.g. field survey campaign), not GMW
    metrics: dict                                  # metrics measured on that data
    notes: str = Field(min_length=10)
    reference: Optional[str] = None                # report / DOI / file


class StatusIn(BaseModel):
    status: str
    reason: str = Field(min_length=3)
    validation: Optional[ValidationEvidence] = None


@router.patch("/api/models/{experiment_id}/status")
def set_model_status(experiment_id: str, body: StatusIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """DEVELOPMENT -> EXPERIMENTAL -> CANDIDATE -> VALIDATED (one step up at a time; demotion to any lower level).
    VALIDATED needs the validate_models capability AND independent validation evidence; it is never automatic."""
    if body.status not in MODEL_STATUSES:
        raise HTTPException(400, f"status must be one of {list(MODEL_STATUSES)}")
    m = db.get(Model, experiment_id)
    if not m:
        raise HTTPException(404, "model not found")
    caps = capabilities_for(user.role)
    cur, new = MODEL_STATUSES.index(m.status or "DEVELOPMENT"), MODEL_STATUSES.index(body.status)
    if new > cur + 1:
        raise HTTPException(409, f"promote one level at a time ({m.status} -> {MODEL_STATUSES[cur + 1]})")
    if body.status == "VALIDATED":
        if "validate_models" not in caps:
            raise HTTPException(403, "only a state administrator can record a validation")
        if body.validation is None:
            raise HTTPException(400, "VALIDATED requires validation evidence (independent dataset, metrics, notes)")
        if "gmw" in body.validation.dataset.lower() or "mangrove watch" in body.validation.dataset.lower():
            raise HTTPException(400, "the training reference labels (GMW) cannot serve as independent validation")
    elif "manage_models" not in caps:
        raise HTTPException(403, "requires capability 'manage_models'")
    old = m.status
    m.status, m.status_updated_at = body.status, utcnow()
    if body.status == "VALIDATED":
        m.validation = body.validation.model_dump() | {"by": user.username, "at": utcnow().isoformat()}
    elif new < MODEL_STATUSES.index("VALIDATED"):
        m.validation = None
    audit(db, user, "model_status", "model", m.id, old={"status": old}, new={"status": m.status}, reason=body.reason)
    db.commit()
    return m.to_dict()


@router.get("/api/registry-models")
def registry_models(db: Session = Depends(get_db)):
    """Registered segmentation models with status, headline test metrics (vs reference labels) and lineage."""
    out = []
    for m in db.query(Model).order_by(Model.id).all():
        t = (m.metrics or {}).get("test") or {}
        out.append({"id": m.id, "display_name": m.display_name, "version": m.version, "status": m.status,
                    "architecture": m.architecture, "encoder": m.encoder, "input_bands": m.input_bands, "mode": m.mode,
                    "dataset": m.dataset_name, "split": [m.n_train, m.n_val, m.n_test], "trained_at": m.trained_at,
                    "code_commit": m.code_commit, "calibration": m.calibration, "validation": m.validation,
                    "test": {k: t.get(k) for k in ("iou", "f1", "precision", "recall", "threshold")},
                    "limitations": (m.card or {}).get("known_limitations")})
    return out


# --------------------------------------------------------------------------- experiment comparison
@router.get("/api/experiments/compare")
def compare_experiments(ids: str = Query(..., description="comma-separated experiment ids"), db: Session = Depends(get_db)):
    """Side-by-side configuration + metrics of recorded experiments. Only what was run and stored is returned."""
    rows = []
    for eid in [x.strip() for x in ids.split(",") if x.strip()][:8]:
        m = db.get(Model, eid)
        if not m:
            raise HTTPException(404, f"experiment {eid!r} not found")
        exp = {}
        try:
            exp = json.loads((SEG_DIR / eid / "experiment.json").read_text())
        except (OSError, ValueError):
            pass
        d = exp.get("dataset") or {}
        names = (d.get("metadata") or {}).get("bands") or []
        rows.append({
            "id": eid, "display_name": m.display_name, "status": m.status, "mode": m.mode,
            "config": {"encoder": m.encoder, "architecture": m.architecture,
                       "input_bands": [names[i] for i in (m.input_bands or []) if i < len(names)] or ("all" if m.input_bands is None else m.input_bands),
                       "n_train": m.n_train, "n_val": m.n_val, "n_test": m.n_test,
                       "learning_rate": exp.get("learning_rate"), "batch_size": exp.get("batch_size"),
                       "epochs_run": exp.get("epochs_run"), "best_epoch": exp.get("best_epoch"), "seed": exp.get("seed"),
                       "loss": exp.get("loss"), "device": (exp.get("hardware") or {}).get("device"),
                       "training_time_s": exp.get("training_time_s"), "code_commit": m.code_commit},
            "calibrated_threshold": (m.calibration or {}).get("selected_threshold"),
            "val": {k: ((m.metrics or {}).get("val") or {}).get(k) for k in ("iou", "f1", "precision", "recall")},
            "test": {k: ((m.metrics or {}).get("test") or {}).get(k) for k in ("iou", "f1", "precision", "recall", "threshold")},
        })
    return {"experiments": rows,
            "note": "Metrics are agreement with Global Mangrove Watch reference labels on held-out tiles; experiments "
                    "trained on different areas/splits are not directly comparable."}


# --------------------------------------------------------------------------- provenance + reproducibility
@router.get("/api/provenance/{study_area}/{run_id}")
def provenance(study_area: str, run_id: str, object_type: Optional[str] = Query(None, pattern="^(patch|candidate)$"),
               object_id: Optional[str] = Query(None, pattern=r"^[A-Za-z0-9._-]{1,64}$"), db: Session = Depends(get_db)):
    """'Why am I seeing this result?' - the ordered evidence chain from study area to the result."""
    return lineage(db, resolve_run(study_area, run_id), object_type, object_id)


@router.post("/api/runs/{study_area}/{run_id}/reproduce", status_code=202)
def reproduce(study_area: str, run_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Queue a reproduction of a stored run (recompute from recorded inputs + config, diff every result)."""
    run_dir = resolve_run(study_area, run_id)
    busy = db.query(Job).filter(Job.type == "reproduce", Job.status.in_(("QUEUED", "RUNNING")),
                                Job.created_by == user.id).count()
    if busy >= 3:
        raise HTTPException(429, "too many reproductions queued")
    return enqueue(db, "reproduce", {"study_area": study_area, "run_id": run_dir.name}, user, study_area).to_dict()
