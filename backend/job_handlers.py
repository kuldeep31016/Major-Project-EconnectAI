"""Job types. Handlers run in a worker (inline thread in dev, ``python -m backend.worker`` in deployment)."""
from __future__ import annotations

import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

from ecoconnect.pipeline.config import REPO_ROOT

from .db import SessionLocal, User, audit
from .jobs import JobContext, handler
from .paths import resolve_run, run_summary

TIMEOUT_S = int(os.environ.get("ECO_JOB_TIMEOUT_S", "7200"))


def _run(ctx: JobContext, cmd: list[str], stage: str, frac: float) -> None:
    ctx.progress(frac, stage, f"$ {' '.join(Path(c).name if i < 2 else c for i, c in enumerate(cmd))}")
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, cwd=REPO_ROOT, timeout=TIMEOUT_S)
    except subprocess.TimeoutExpired:
        raise RuntimeError(f"{stage} exceeded {TIMEOUT_S} s")
    ctx.progress(frac, stage, (r.stdout or "")[-3000:] + (r.stderr or "")[-3000:])
    if r.returncode != 0:
        raise RuntimeError(f"{stage} failed (exit {r.returncode})")


@handler("segment")
def segment(ctx: JobContext, p: dict) -> dict:
    """Inference (scene + checkpoint) -> probability raster -> patches -> graph -> criticality -> registry."""
    py, sa = sys.executable, p["study_area"]
    prob = p.get("probability_tif")
    tag = Path(p["checkpoint"]).parent.name if p.get("checkpoint") else "prob"
    run_id = f"{sa}_{tag}_ui_{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}"
    if p.get("scene_tif"):
        out = Path(p["checkpoint"]).parent / "predictions" / (Path(p["scene_tif"]).with_suffix("").name + "_prob.tif")
        _run(ctx, [py, str(REPO_ROOT / "scripts" / "predict.py"), "--checkpoint", p["checkpoint"],
                   "--input", p["scene_tif"], "--output", str(out)], "inference", 0.05)
        prob = str(out)
    cmd = [py, str(REPO_ROOT / "scripts" / "run_graph_analysis.py"), "--study-area", sa, "--probability", prob,
           "--result-kind", p.get("result_kind", "development"), "--run-id", run_id]
    if p.get("threshold") is not None:
        cmd += ["--threshold", str(p["threshold"])]
    if p.get("checkpoint"):
        cmd += ["--model-checkpoint", p["checkpoint"]]
    _run(ctx, cmd, "graph analysis", 0.6)
    ctx.progress(0.9, "registering run")
    summary = run_summary(resolve_run(sa, run_id))
    from .registry import sync_all
    with SessionLocal() as db:
        sync_all(db)
        audit(db, db.get(User, ctx.user_id) if ctx.user_id else None, "run_analysis", "analysis_version", run_id,
              new={"job": ctx.job_id, **{k: p.get(k) for k in ("scene_tif", "checkpoint", "threshold", "result_kind")}})
        db.commit()
    return {**summary, "scene": p.get("scene_tif"), "checkpoint": p.get("checkpoint"), "thresholdUsed": p.get("threshold")}


@handler("scenario")
def scenario(ctx: JobContext, p: dict) -> dict:
    """Any Scenario Lab computation (use for the heavier ones: tau / threshold sweeps, period comparison)."""
    from .scenarios import run_scenario
    run_dir = resolve_run(p["study_area"], p.get("run_id", "latest"))
    other = resolve_run(p["study_area"], p["other_run_id"]) if p.get("other_run_id") else None
    ctx.progress(0.1, f"scenario {p['body'].get('type')}")
    return run_scenario(run_dir, p["body"], other)
