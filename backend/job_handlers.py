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


def _close(a, b, rel: float = 1e-9) -> bool:
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return abs(a - b) <= rel * max(1.0, abs(a), abs(b)) if isinstance(a, float) or isinstance(b, float) else a == b
    return a == b


@handler("reproduce")
def reproduce(ctx: JobContext, p: dict) -> dict:
    """Recompute a stored run from its recorded inputs + configuration and diff every result.

    Level "graph": patches_input.json + manifest config -> graph, IIC/PC/ECA, leave-one-out criticality,
    restoration. Level "raster": additionally re-extract patches from the probability raster when it is present
    on this machine. Never overwrites the stored run."""
    import json
    from ecoconnect.graph import build_graph, compute_criticality, evaluate_candidates, summarise
    from ecoconnect.pipeline.provenance import code_version, config_sha256
    from .paths import abs_path, patch_from_dict

    run_dir = resolve_run(p["study_area"], p["run_id"])
    m = json.loads((run_dir / "manifest.json").read_text())
    met = json.loads((run_dir / "metrics.json").read_text())["research_metrics"]
    inp = json.loads((run_dir / "patches_input.json").read_text())
    cfg, ds = m["config"], m.get("data_source") or {}
    g, metric = cfg["graph"], cfg["connectivity"]["research_metric"]
    kw = {"p_at_tau": cfg["connectivity"]["pc_probability_at_tau"]} if metric == "pc" else {}
    checks: list[dict] = []

    def check(name, stored, recomputed):
        checks.append({"name": name, "stored": stored, "recomputed": recomputed, "match": _close(stored, recomputed)})

    if m.get("config_sha256"):
        check("config_sha256", m["config_sha256"], config_sha256(cfg))
    level = "graph"
    prob = abs_path(ds.get("path")) if ds.get("type") == "probability_raster" else None
    if prob and prob.is_file() and ds.get("threshold") is not None:
        ctx.progress(0.1, "re-extracting patches from the probability raster")
        from ecoconnect.pipeline.sources import from_probability_raster
        re_p, _, a_l2, _, _ = from_probability_raster(prob, threshold=float(ds["threshold"]), mmu_ha=float(ds.get("mmu_ha", 2.0)),
                                                      connectivity=int(ds.get("connectivity", 8)), candidate_threshold=None)
        check("raster: n_patches", len(inp["patches"]), len(re_p))
        check("raster: habitat_area_ha", round(sum(x["area_ha"] for x in inp["patches"]), 6), round(sum(x.area_ha for x in re_p), 6))
        check("raster: landscape_area_ha", inp["landscape_area_ha"], a_l2)
        level = "raster+graph"

    ctx.progress(0.4, "rebuilding graph and metrics")
    patches = [patch_from_dict(x) for x in inp["patches"]]
    cands = [patch_from_dict(x) for x in inp["candidates"]]
    a_l = inp["landscape_area_ha"]
    graph = build_graph(patches, k=g["k_neighbors"], tau_km=g["tau_km"], distance_mode=g["distance_mode"])
    s = summarise(graph, a_l)
    for k in ("n_patches", "n_edges", "n_components", "iic", "pc", "eca_ha"):
        check(k, met[k], getattr(s, k))

    ctx.progress(0.6, "leave-one-out criticality")
    rows, _ = compute_criticality(graph, a_l, metric, **kw)
    stored = {r["patch_id"]: r for r in json.loads((run_dir / "criticality.json").read_text())}
    bad = [r.patch_id for r in rows if r.patch_id not in stored or r.rank != stored[r.patch_id]["rank"]
           or r.is_cut_vertex != stored[r.patch_id]["is_cut_vertex"]
           or not _close(r.criticality_score, stored[r.patch_id]["criticality_score"])]
    checks.append({"name": "criticality (rank, S, cut vertex) for every patch", "stored": len(stored),
                   "recomputed": len(rows), "match": not bad and len(rows) == len(stored), "mismatches": bad[:20]})

    ctx.progress(0.8, "restoration candidates")
    rcfg = cfg.get("restoration") or {}
    rest, _ = evaluate_candidates(graph, cands, a_l, metric, rebuild_edges=rcfg.get("rebuild_edges_on_insert", False), **kw)
    rs = {c["candidate_id"]: c for c in json.loads((run_dir / "restoration.json").read_text())["candidates"]}
    if not any(c.get("cost") is not None for c in rs.values()):         # cost-ranked runs depend on the uploaded CSV
        rbad = [r.candidate_id for r in rest if r.candidate_id not in rs or r.rank != rs[r.candidate_id]["rank"]
                or not _close(r.gain_pct, rs[r.candidate_id]["gain_pct"])]
        checks.append({"name": "restoration (rank, gain) for every candidate", "stored": len(rs), "recomputed": len(rest),
                       "match": not rbad and len(rest) == len(rs), "mismatches": rbad[:20]})

    return {"run_id": m["run_id"], "reproduced": all(c["match"] for c in checks), "level": level, "checks": checks,
            "code": {"run": m.get("code"), "now": code_version()},
            "note": ("graph stage recomputed from stored patches; the probability raster is not on this server"
                     if level == "graph" and ds.get("type") == "probability_raster" else None)}


@handler("rag_ingest")
def rag_ingest(ctx: JobContext, p: dict) -> dict:
    """Incremental, versioned RAG ingestion (backend/rag/ingest.py). Unchanged documents are skipped by content hash."""
    from .rag.ingest import ingest
    with SessionLocal() as db:
        keys = set(p.get("only_keys") or []) or None
        return ingest(db, force=bool(p.get("force")), only_keys=keys, progress=lambda f, s: ctx.progress(0.05 + 0.9 * f, "indexing"))
