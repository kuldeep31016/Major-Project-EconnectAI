"""Artifact registry: identity, content hash and lineage for every stored file (bytes stay in object storage)."""
from __future__ import annotations

import mimetypes
from pathlib import Path
from typing import Optional

from sqlalchemy.orm import Session

from ecoconnect import __version__
from ecoconnect.pipeline.config import OUTPUTS_DIR

from .db import AnalysisVersion, Artifact, Model
from .storage import get_storage, sha256_file

RUN_FILE_KINDS = {
    "manifest.json": "run_manifest", "patches.geojson": "patches_geojson", "graph.json": "graph",
    "metrics.json": "connectivity_metrics", "criticality.json": "criticality", "criticality.csv": "criticality_csv",
    "explanations.json": "explanations", "restoration.json": "restoration", "restoration.csv": "restoration_csv",
    "what_if_top1.json": "what_if", "tau_sensitivity.json": "sensitivity", "patches_input.json": "patches_input",
    "frontend_bundle.json": "frontend_bundle", "probability_overlay.png": "probability_overlay",
}
MODEL_FILE_KINDS = {"metrics.json": "model_metrics", "experiment.json": "experiment_record",
                    "threshold_calibration.json": "threshold_calibration", "best_model.pth": "model_checkpoint"}


def storage_key(path: Path) -> Optional[str]:
    try:
        return path.resolve().relative_to(OUTPUTS_DIR.resolve()).as_posix()
    except ValueError:
        return None


def register_file(db: Session, path: Path, kind: str, *, run_id: str | None = None, model_id: str | None = None,
                  job_id: str | None = None, meta: dict | None = None) -> Optional[Artifact]:
    """Upsert an artifact row for a file under OUTPUTS_DIR. Re-hashes only when the size changed."""
    key = storage_key(path)
    if key is None or not path.is_file():
        return None
    size = path.stat().st_size
    a = db.query(Artifact).filter_by(key=key).first()
    if a and a.size_bytes == size and a.sha256:
        return a
    a = a or Artifact(id=f"{kind}:{key}", key=key)
    a.kind, a.storage, a.size_bytes = kind, get_storage().name, size
    a.sha256 = sha256_file(path)
    a.content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    a.run_id = run_id if run_id and db.get(AnalysisVersion, run_id) else None
    a.model_id = model_id if model_id and db.get(Model, model_id) else None
    a.job_id, a.processing_version, a.meta = job_id, __version__, meta
    db.merge(a)
    return a


def register_run_dir(db: Session, run_dir: Path, run_id: str) -> int:
    n = 0
    for p in run_dir.iterdir():
        if p.name in RUN_FILE_KINDS and register_file(db, p, RUN_FILE_KINDS[p.name], run_id=run_id):
            n += 1
    return n


def register_model_dir(db: Session, exp_dir: Path, model_id: str) -> int:
    n = 0
    for name, kind in MODEL_FILE_KINDS.items():
        if register_file(db, exp_dir / name, kind, model_id=model_id):
            n += 1
    return n
