"""Single place for artefact locations and run resolution (used by main, routers, scenarios, registry).
Tests may repoint ``RUNS_DIR``; every helper reads it at call time."""
from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

from fastapi import HTTPException

from ecoconnect.graph import Patch
from ecoconnect.pipeline.config import OUTPUTS_DIR, REPO_ROOT

from .security import contained, is_slug

RUNS_DIR = OUTPUTS_DIR / "runs"
SEG_DIR = OUTPUTS_DIR / "segmentation"


def data_root() -> Path:
    return Path(os.environ.get("DATA_ROOT") or REPO_ROOT / "data")


def abs_path(p: Optional[str]) -> Optional[Path]:
    """Artefact paths are stored repo-relative (ecoconnect.pipeline.config.portable_path)."""
    if not p:
        return None
    pp = Path(p)
    return pp if pp.is_absolute() else REPO_ROOT / pp


def resolve_run(study_area: str, run_id: str) -> Path:
    """outputs/runs/<study_area>/<run_id|LATEST target>, validated and contained in RUNS_DIR."""
    if not is_slug(study_area) or not is_slug(run_id):
        raise HTTPException(400, "invalid study area or run id")
    base = RUNS_DIR / study_area
    if not base.exists():
        raise HTTPException(404, f"no runs for study area {study_area!r}")
    if run_id == "latest":
        ptr = base / "LATEST"
        if not ptr.exists():
            raise HTTPException(404, f"no LATEST pointer for {study_area!r}")
        run_id = ptr.read_text().strip()
        if not is_slug(run_id):
            raise HTTPException(500, f"corrupt LATEST pointer for {study_area!r}")
    run_dir = contained(base / run_id, RUNS_DIR)
    if not run_dir.exists():
        raise HTTPException(404, f"run {run_id!r} not found for {study_area!r}")
    return run_dir


def patch_from_dict(d: dict) -> Patch:
    return Patch(**{**d, "centroid": tuple(d["centroid"]), "bbox": tuple(d["bbox"]) if d.get("bbox") else None})
