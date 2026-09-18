"""EcoConnectAI backend - a thin FastAPI layer over pipeline run directories.

No database: every run is a folder under outputs/runs/<study_area>/<run_id>/ (see
ecoconnect/pipeline/analysis.py).  The API serves those files and performs the
two computations that must be interactive: exact what-if removal (Eq. 10) and
restoration re-ranking with user-supplied costs (Eq. 12).

Run:  uvicorn backend.main:app --reload --port 8000
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ecoconnect import __version__  # noqa: E402
from ecoconnect.graph import Patch, build_graph, simulate_removal, evaluate_candidates  # noqa: E402
from ecoconnect.pipeline.config import OUTPUTS_DIR, REPO_ROOT, load_study_areas, load_config  # noqa: E402

RUNS_DIR = OUTPUTS_DIR / "runs"
SEG_DIR = OUTPUTS_DIR / "segmentation"

app = FastAPI(title="EcoConnectAI API", version=__version__,
              description="Coastal habitat connectivity analysis - research outputs served from pipeline runs.")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("ECO_CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(","),
    allow_methods=["*"], allow_headers=["*"],
)


# --------------------------------------------------------------------------- helpers
def _read_json(p: Path):
    if not p.exists():
        raise HTTPException(404, f"{p.name} not found")
    return json.loads(p.read_text())


def _resolve_run(study_area: str, run_id: str) -> Path:
    base = RUNS_DIR / study_area
    if not base.exists():
        raise HTTPException(404, f"no runs for study area {study_area!r}")
    if run_id == "latest":
        ptr = base / "LATEST"
        if not ptr.exists():
            raise HTTPException(404, f"no LATEST pointer for {study_area!r}")
        run_id = ptr.read_text().strip()
    run_dir = base / run_id
    if not run_dir.exists():
        raise HTTPException(404, f"run {run_id!r} not found for {study_area!r}")
    return run_dir


def _run_summary(run_dir: Path) -> dict:
    m = _read_json(run_dir / "manifest.json")
    metrics = _read_json(run_dir / "metrics.json")
    rm = metrics["research_metrics"]
    return {
        "runId": m["run_id"], "studyAreaId": m["study_area_id"], "timestamp": m["timestamp_utc"],
        "resultKind": m["result_kind"], "resultLabel": m["result_label"],
        "dataSourceType": m["data_source"].get("type"), "nPatches": rm["n_patches"], "nEdges": rm["n_edges"],
        "nComponents": rm["n_components"], "iic": rm["iic"], "pc": rm["pc"], "ecaHa": rm["eca_ha"],
        "ecaPctOfHabitat": rm["eca_pct_of_habitat"], "habitatAreaHa": rm["habitat_area_ha"],
        "interfaceScore": metrics["interface_score"]["score"], "elapsedS": m.get("elapsed_s"),
        "sceneYear": m["data_source"].get("scene_year"), "model": m["data_source"].get("model"),
        "threshold": m["data_source"].get("threshold"),
        "criticalPatches": _count_critical(run_dir),
    }


def _count_critical(run_dir: Path, s_threshold: float = 0.10) -> Optional[int]:
    p = run_dir / "criticality.json"
    if not p.exists():
        return None
    return sum(1 for r in json.loads(p.read_text()) if r["criticality_score"] >= s_threshold)


def _load_graph(run_dir: Path):
    m = _read_json(run_dir / "manifest.json")
    inp = _read_json(run_dir / "patches_input.json")
    g = m["config"]["graph"]
    patches = [Patch(**{**p, "centroid": tuple(p["centroid"]), "bbox": tuple(p["bbox"]) if p.get("bbox") else None})
               for p in inp["patches"]]
    cands = [Patch(**{**p, "centroid": tuple(p["centroid"]), "bbox": tuple(p["bbox"]) if p.get("bbox") else None})
             for p in inp["candidates"]]
    graph = build_graph(patches, k=g["k_neighbors"], tau_km=g["tau_km"], distance_mode=g["distance_mode"])
    metric = m["config"]["connectivity"]["research_metric"]
    kw = {"p_at_tau": m["config"]["connectivity"]["pc_probability_at_tau"]} if metric == "pc" else {}
    return graph, cands, inp["landscape_area_ha"], metric, kw, m


# --------------------------------------------------------------------------- meta
@app.get("/api/health")
def health():
    return {"status": "ok", "version": __version__, "outputs_dir": str(OUTPUTS_DIR)}


@app.get("/api/study-areas")
def study_areas():
    areas = load_study_areas()
    out = []
    for sid, meta in areas.items():
        latest = None
        ptr = RUNS_DIR / sid / "LATEST"
        if ptr.exists() and (RUNS_DIR / sid / ptr.read_text().strip()).exists():
            latest = _run_summary(RUNS_DIR / sid / ptr.read_text().strip())
        out.append({"id": sid, **meta, "latestRun": latest})
    return out


@app.get("/api/runs")
def list_runs(study_area: Optional[str] = None):
    out = []
    for sa_dir in sorted(RUNS_DIR.glob("*")) if RUNS_DIR.exists() else []:
        if not sa_dir.is_dir() or (study_area and sa_dir.name != study_area):
            continue
        for run_dir in sorted(sa_dir.glob("*")):
            if (run_dir / "manifest.json").exists():
                out.append(_run_summary(run_dir))
    return sorted(out, key=lambda r: r["timestamp"], reverse=True)


@app.get("/api/scenes")
def scenes():
    """Satellite scenes downloaded by the acquisition module (data/scenes/<study_area>/*.json)."""
    scenes_dir = Path(os.environ.get("DATA_ROOT", REPO_ROOT / "data")) / "scenes"
    out = []
    for p in sorted(scenes_dir.glob("*/*.json")) if scenes_dir.exists() else []:
        try:
            out.append({"studyAreaId": p.parent.name, **json.loads(p.read_text())})
        except json.JSONDecodeError:
            continue
    return out


@app.get("/api/models")
def models():
    """Segmentation experiments found under outputs/segmentation/<exp>/ (metrics.json + config)."""
    out = []
    for d in sorted(SEG_DIR.glob("*")) if SEG_DIR.exists() else []:
        if (d / "metrics.json").exists():
            m = json.loads((d / "metrics.json").read_text())
            out.append({"experimentId": d.name, **{k: m.get(k) for k in ("mode", "model", "encoder", "best_epoch", "test", "val", "result_label")}})
    return out


# --------------------------------------------------------------------------- run artefacts
@app.get("/api/runs/{study_area}/{run_id}/manifest")
def manifest(study_area: str, run_id: str):
    return _read_json(_resolve_run(study_area, run_id) / "manifest.json")


@app.get("/api/runs/{study_area}/{run_id}/bundle")
def bundle(study_area: str, run_id: str):
    return _read_json(_resolve_run(study_area, run_id) / "frontend_bundle.json")


for _name, _file in {
    "patches": "patches.geojson", "graph": "graph.json", "metrics": "metrics.json",
    "criticality": "criticality.json", "explanations": "explanations.json",
    "restoration": "restoration.json", "tau-sensitivity": "tau_sensitivity.json",
}.items():
    def _make(fname):
        def _ep(study_area: str, run_id: str):
            return _read_json(_resolve_run(study_area, run_id) / fname)
        return _ep
    app.add_api_route(f"/api/runs/{{study_area}}/{{run_id}}/{_name}", _make(_file), methods=["GET"], name=_name)


@app.get("/api/runs/{study_area}/{run_id}/report")
def report(study_area: str, run_id: str):
    """Decision-support report composed only from the run's computed artefacts."""
    from ecoconnect.pipeline.report import build_report
    return build_report(_resolve_run(study_area, run_id), load_study_areas().get(study_area, {}))


@app.get("/api/runs/{study_area}/{run_id}/files/{name}")
def run_file(study_area: str, run_id: str, name: str):
    p = _resolve_run(study_area, run_id) / Path(name).name
    if not p.exists():
        raise HTTPException(404, f"{name} not found")
    return FileResponse(p)


# --------------------------------------------------------------------------- real timeline
def _mask_diff_ha(prob_a: str, prob_b: str, thr_a: float, thr_b: float) -> Optional[dict]:
    """Habitat lost/gained (ha) between two probability rasters on the same grid."""
    try:
        import numpy as np
        from ecoconnect.geospatial.raster_processing.io import read_raster, pixel_area_ha
        a, ma = read_raster(prob_a, bands=[1]); b, mb = read_raster(prob_b, bands=[1])
        if a.shape != b.shape or ma.transform != mb.transform:
            return None
        pa, pb = a[0], b[0]
        valid = np.isfinite(pa) & np.isfinite(pb)
        ha_row = pixel_area_ha(ma)
        area = np.broadcast_to(ha_row[:, None], pa.shape)
        ba, bb = (pa >= thr_a) & valid, (pb >= thr_b) & valid
        return {"lost_ha": float(area[ba & ~bb].sum()), "gained_ha": float(area[~ba & bb].sum()),
                "stable_ha": float(area[ba & bb].sum())}
    except Exception:
        return None


@app.get("/api/runs/{study_area}/timeline")
def timeline(study_area: str, critical_threshold: float = 0.10):
    """REAL timeline: one entry per scene year that has a pipeline run (latest run per year).
    Habitat change between consecutive years is computed from the binary masks of the two runs.
    Years without a real run are simply absent - nothing is interpolated or invented."""
    base = RUNS_DIR / study_area
    by_year: dict[int, tuple[str, dict, dict]] = {}
    for run_dir in sorted(base.glob("*")) if base.exists() else []:
        mp = run_dir / "manifest.json"
        if not mp.exists():
            continue
        m = json.loads(mp.read_text())
        y = (m.get("data_source") or {}).get("scene_year")
        if y is None or m.get("result_kind") == "synthetic":
            continue
        if y not in by_year or m["timestamp_utc"] > by_year[y][1]["timestamp_utc"]:
            by_year[int(y)] = (run_dir.name, m, json.loads((run_dir / "metrics.json").read_text()))
    years = []
    prev = None
    for y in sorted(by_year):
        run_id, m, met = by_year[y]
        crit = json.loads((base / run_id / "criticality.json").read_text())
        rm = met["research_metrics"]
        diff = None
        if prev is not None:
            _, pm, _ = by_year[prev]
            diff = _mask_diff_ha(pm["data_source"]["path"], m["data_source"]["path"],
                                 pm["data_source"].get("threshold", 0.5), m["data_source"].get("threshold", 0.5))
        years.append({
            "year": y, "runId": run_id, "resultKind": m["result_kind"], "resultLabel": m["result_label"],
            "connectivityScore": round(met["interface_score"]["score"], 1),
            "iic": rm["iic"], "pc": rm["pc"], "ecaHa": rm["eca_ha"], "ecaPctOfHabitat": rm["eca_pct_of_habitat"],
            "habitatAreaHa": round(rm["habitat_area_ha"], 1), "patchCount": rm["n_patches"],
            "nEdges": rm["n_edges"], "nComponents": rm["n_components"],
            "fragmentationIndex": round(rm["n_components"] / max(rm["n_patches"], 1), 4),
            "criticalPatches": sum(1 for r in crit if r["criticality_score"] >= critical_threshold),
            "lostHa": round(diff["lost_ha"], 1) if diff else None,
            "gainedHa": round(diff["gained_ha"], 1) if diff else None,
            "meanConfidence": round(sum(r["confidence"] * r["area_ha"] for r in crit) / max(rm["habitat_area_ha"], 1e-9), 4),
            "event": f"Pipeline run over {y} imagery", "eventType": "stable",
            "narrative": (f"{rm['n_patches']} patches, {rm['n_edges']} links, {rm['n_components']} components; "
                          f"ECA {rm['eca_ha']:.0f} ha ({rm['eca_pct_of_habitat']:.1f}% of habitat)."
                          + (f" Versus {prev}: {diff['lost_ha']:.0f} ha lost, {diff['gained_ha']:.0f} ha gained (mask difference at the run thresholds)." if diff else "")),
            "degradedPatchIds": [], "composition": [],
        })
        prev = y
    return {"sceneId": study_area, "years": years,
            "note": ("Real timeline: each year is an actual pipeline run; change = binary-mask difference between consecutive "
                     "runs at their thresholds. No interpolation. For development-mode models, prediction noise can dominate "
                     "the year-to-year difference - treat lost/gained as model output, not as measured habitat change.")}


# --------------------------------------------------------------------------- interactive computations
class WhatIfRequest(BaseModel):
    patch_ids: list[str] = Field(..., min_length=1)


@app.post("/api/runs/{study_area}/{run_id}/what-if")
def what_if(study_area: str, run_id: str, req: WhatIfRequest):
    """Exact Eq. (10): rebuild G without the patches and recompute C(G).  No heuristics."""
    graph, _, a_l, metric, kw, _ = _load_graph(_resolve_run(study_area, run_id))
    try:
        res = simulate_removal(graph, req.patch_ids, a_l, metric, **kw)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return res.to_dict()


class CandidateIn(BaseModel):
    id: str
    area_ha: float
    lat: float
    lon: float
    name: Optional[str] = None
    confidence: float = 1.0


class RestorationRequest(BaseModel):
    candidates: Optional[list[CandidateIn]] = None         # default: the run's own candidates
    costs: Optional[dict[str, float]] = None               # user-provided, keyed by candidate id
    cost_unit: Optional[str] = None


@app.post("/api/runs/{study_area}/{run_id}/restoration")
def restoration(study_area: str, run_id: str, req: RestorationRequest = Body(default=RestorationRequest())):
    """Eq. (11)-(12) with optional user-supplied costs; never invents costs."""
    graph, cands, a_l, metric, kw, m = _load_graph(_resolve_run(study_area, run_id))
    if req.candidates:
        cands = [Patch(id=c.id, area_ha=c.area_ha, centroid=(c.lat, c.lon), name=c.name,
                       confidence=c.confidence, quality=c.confidence) for c in req.candidates]
    rows, c_base = evaluate_candidates(
        graph, cands, a_l, metric, costs=req.costs, cost_unit=req.cost_unit,
        rebuild_edges=m["config"]["restoration"].get("rebuild_edges_on_insert", False), **kw)
    return {"baseline": c_base, "metric": metric, "ranking_basis": rows[0].ranking_basis if rows else "raw_gain",
            "candidates": [r.to_dict() for r in rows]}


class SegmentRequest(BaseModel):
    study_area: str
    probability_tif: Optional[str] = None      # existing probability raster to analyse
    scene_tif: Optional[str] = None            # OR a preprocessed scene to run inference on
    checkpoint: Optional[str] = None
    threshold: Optional[float] = None
    result_kind: str = "development"


@app.post("/api/segment")
def segment(req: SegmentRequest):
    """Run inference (if a scene + checkpoint are given) and then the graph analysis.
    Synchronous: fine for the AOI sizes this project uses; returns the new run summary."""
    py = sys.executable
    prob = req.probability_tif
    if req.scene_tif:
        if not req.checkpoint:
            raise HTTPException(400, "checkpoint is required to run inference on a scene")
        out = Path(req.scene_tif).with_suffix("").name + "_prob.tif"
        prob_path = SEG_DIR / "predictions" / out
        cmd = [py, str(REPO_ROOT / "scripts" / "predict.py"), "--checkpoint", req.checkpoint,
               "--input", req.scene_tif, "--output", str(prob_path)]
        r = subprocess.run(cmd, capture_output=True, text=True, cwd=REPO_ROOT)
        if r.returncode != 0:
            raise HTTPException(500, f"predict.py failed:\n{r.stderr[-2000:]}")
        prob = str(prob_path)
    if not prob:
        raise HTTPException(400, "provide probability_tif or scene_tif + checkpoint")
    cmd = [py, str(REPO_ROOT / "scripts" / "run_graph_analysis.py"), "--study-area", req.study_area,
           "--probability", prob, "--result-kind", req.result_kind]
    if req.threshold is not None:
        cmd += ["--threshold", str(req.threshold)]
    if req.checkpoint:
        cmd += ["--model-checkpoint", req.checkpoint]
    r = subprocess.run(cmd, capture_output=True, text=True, cwd=REPO_ROOT)
    if r.returncode != 0:
        raise HTTPException(500, f"run_graph_analysis.py failed:\n{r.stderr[-2000:]}")
    return _run_summary(_resolve_run(req.study_area, "latest"))
