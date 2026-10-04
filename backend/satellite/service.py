"""Near-real-time analysis orchestration: latest observation -> scene -> EXISTING model + ecological pipeline.

Nothing here re-implements science. Inference = scripts/predict.py (ecoconnect.ml.inference.predict_scene), habitat
and patches = ecoconnect.pipeline.sources.from_probability_raster, graph / IIC / criticality / what-if / restoration =
ecoconnect.pipeline.analysis.run_graph_analysis - the same functions and configs the stored runs were made with.
NRT runs are written with write_latest_pointer=False, so the study area's LATEST run (the existing dashboard
default) never changes unless a user opens the new run explicitly.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import uuid
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Optional

import numpy as np

from ecoconnect.pipeline.config import OUTPUTS_DIR, REPO_ROOT

from ..db import SatelliteAnalysis, SatelliteObservation, SessionLocal, User, audit, utcnow
from ..jobs import JobContext, handler
from ..paths import data_root
from . import catalog, preprocessing, processing
from .catalog import Observation
from .copernicus import NotConfigured, SatelliteError, credentials_configured

STAGES = ["observation", "retrieval", "preprocessing", "inference", "habitat", "patches", "connectivity",
          "criticality", "restoration"]
TIMEOUT_S = int(os.environ.get("SATELLITE_INFERENCE_TIMEOUT_S", "3600"))


# --------------------------------------------------------------------------- model + configuration
def _calibration() -> dict:
    p = REPO_ROOT / "outputs" / "segmentation" / preprocessing.model_experiment(REPO_ROOT) / "threshold_calibration.json"
    return json.loads(p.read_text()) if p.exists() else {}


def checkpoint_path() -> Path:
    env = os.environ.get("SATELLITE_MODEL_CHECKPOINT", "").strip()
    return Path(env) if env else REPO_ROOT / "outputs" / "segmentation" / preprocessing.model_experiment(REPO_ROOT) / "best_model.pth"


def inference_python() -> str:
    return os.environ.get("SATELLITE_INFERENCE_PYTHON", "").strip() or sys.executable


@lru_cache(maxsize=4)
def _torch_ok(py: str) -> bool:
    try:
        return subprocess.run([py, "-c", "import torch, segmentation_models_pytorch"], capture_output=True,
                              timeout=120).returncode == 0
    except (OSError, subprocess.SubprocessError):
        return False


def model_status() -> dict:
    """Can this server run the trained U-Net? (checkpoint file present + a Python with torch/smp)."""
    ck, py, exp = checkpoint_path(), inference_python(), preprocessing.model_experiment(REPO_ROOT)
    cal = _calibration()
    present, torch_ok = ck.is_file(), _torch_ok(py)
    reason = None
    if not present:
        reason = (f"The trained checkpoint ({exp}/best_model.pth) is not on this server. "
                  "Copy it to outputs/segmentation/<experiment>/ or set SATELLITE_MODEL_CHECKPOINT.")
    elif not torch_ok:
        reason = "PyTorch is not installed for inference here. Install requirements.txt or set SATELLITE_INFERENCE_PYTHON."
    try:
        ck_rel = str(ck.relative_to(REPO_ROOT))
    except ValueError:
        ck_rel = ck.name
    return {"experiment": exp, "model_version": f"U-Net/efficientnet-b0 {exp}",
            "checkpoint": ck_rel, "checkpoint_present": present, "torch_available": torch_ok, "available": present and torch_ok,
            "threshold": cal.get("selected_threshold"), "threshold_source": "threshold_calibration.json (selected_threshold)",
            "mmu_ha": cal.get("mmu_ha", 2.0), "reason": reason}


def area_reliability(area: str) -> Optional[dict]:
    """Per-area agreement of the selected model with GMW 2020 (scripts/area_reliability.py), or None."""
    p = REPO_ROOT / "outputs" / "segmentation" / preprocessing.model_experiment(REPO_ROOT) / "area_reliability.json"
    if not p.exists():
        return None
    d = json.loads(p.read_text())
    row = (d.get("areas") or {}).get(area)
    if not row:
        return None
    t = row.get(f"t{d['threshold']:.2f}") or {}
    return {"level": row["level"], "iou": t.get("iou"), "reference_habitat_ha": row["reference_habitat_ha"],
            "experiment": d["experiment"], "scope": d["scope"], "reference": d["reference"]}


def plausibility(area: str, habitat_ha: float) -> dict:
    """Post-inference sanity check: predicted habitat area vs the GMW 2020 reference area of the study area."""
    rel = area_reliability(area)
    ref = (rel or {}).get("reference_habitat_ha")
    if not ref or ref < 100:
        return {"ratio": None, "reference_habitat_ha": ref, "review_recommended": True,
                "note": "No usable reference area for this study area; the result needs manual review."}
    ratio = round(habitat_ha / ref, 2)
    off = ratio > 3 or ratio < 1 / 3
    return {"ratio": ratio, "reference_habitat_ha": ref, "predicted_habitat_ha": round(habitat_ha, 1), "review_recommended": off,
            "note": (f"Predicted habitat is {ratio}x the 2020 reference area - outside the plausible range (1/3x-3x); "
                     "treat this map as unreliable and review it manually.") if off else
                    f"Predicted habitat is {ratio}x the 2020 reference area (within the plausible range)."}


def graph_config() -> dict:
    from ecoconnect.pipeline.config import load_config
    return load_config("graph")


def software_version() -> str:
    from ecoconnect.pipeline.provenance import code_version
    try:
        from ecoconnect import __version__ as v
    except ImportError:
        v = "0"
    c = code_version()
    return f"ecoconnect {v}" + (f" @ {c['git_commit'][:10]}{'+dirty' if c.get('git_dirty') else ''}" if c.get("git_commit") else "")


def run_predict(cmd: list[str]) -> subprocess.CompletedProcess:
    """scripts/predict.py in a Python that has torch (SATELLITE_INFERENCE_PYTHON); the seam tests replace."""
    return subprocess.run(cmd, capture_output=True, text=True, cwd=REPO_ROOT, timeout=TIMEOUT_S)


# --------------------------------------------------------------------------- catalogue persistence
def _dt(s: Optional[str]) -> Optional[datetime]:
    return datetime.fromisoformat(s.replace("Z", "+00:00")).astimezone(timezone.utc).replace(tzinfo=None) if s else None


def remember(db, obs: list[Observation]) -> None:
    """Upsert catalogue results (observation history; cached metadata)."""
    now = utcnow()
    for o in obs:
        row = db.get(SatelliteObservation, o.product_id)
        if row is None:
            row = SatelliteObservation(id=o.product_id, study_area_id=o.study_area_id, name=o.name, first_seen_at=now)
            db.add(row)
        row.platform, row.product_type, row.mode, row.polarisation = o.platform, o.product_type, o.mode, o.polarisation
        row.orbit_direction, row.relative_orbit, row.timeliness = o.orbit_direction, o.relative_orbit, o.timeliness
        row.acquisition_start, row.acquisition_end, row.published_at = _dt(o.acquisition_start), _dt(o.acquisition_end), _dt(o.published_at)
        row.aoi_coverage, row.footprint, row.last_seen_at = o.aoi_coverage, o.footprint, now
    db.commit()


def analyses_by_product(db, study_area_id: str) -> dict[str, dict]:
    out: dict[str, dict] = {}
    rows = db.query(SatelliteAnalysis).filter(SatelliteAnalysis.study_area_id == study_area_id) \
        .order_by(SatelliteAnalysis.created_at.desc()).all()
    for r in rows:
        if r.product_ids and r.product_ids[0] not in out:
            out[r.product_ids[0]] = {"id": r.id, "status": r.status, "run_id": r.run_id, "stage": r.stage}
    return out


# --------------------------------------------------------------------------- scene cache
def scene_file(study_area_id: str, used: list[Observation]) -> Path:
    ref = used[0]
    stamp = (ref.acquisition_start or "")[:19].replace("-", "").replace(":", "")
    return data_root() / "scenes" / study_area_id / f"{study_area_id}_s1nrt_{stamp}_r{ref.relative_orbit}_n{len(used)}.tif"


def cached_scene(path: Path, used: list[Observation]) -> bool:
    side = path.with_suffix(".json")
    if not (path.is_file() and side.is_file()):
        return False
    info = json.loads(side.read_text())
    return info.get("preprocessing_version") == preprocessing.PREPROCESSING_VERSION and \
        [s.get("product_id") for s in (info.get("sources", {}).get("sentinel1", {}).get("scenes") or [])] == [o.product_id for o in used]


def _rel(p: Path) -> str:
    for base in (data_root(), REPO_ROOT):
        try:
            return str(p.relative_to(base)) if base == REPO_ROOT else "data:" + str(p.relative_to(base))
        except ValueError:
            continue
    return str(p)


def scene_abs(rel: Optional[str]) -> Optional[Path]:
    if not rel:
        return None
    return data_root() / rel[5:] if rel.startswith("data:") else REPO_ROOT / rel


# --------------------------------------------------------------------------- analysis request
def new_analysis(db, study_area_id: str, used: list[Observation], user: Optional[User]) -> SatelliteAnalysis:
    ref, ms, g = used[0], model_status(), graph_config()["graph"]
    aid = f"EC-{study_area_id}-{(ref.acquisition_start or '')[:10]}-{uuid.uuid4().hex[:6]}"
    a = SatelliteAnalysis(
        id=aid, study_area_id=study_area_id, mode="nrt", product_ids=[o.product_id for o in used],
        product_names=[o.name for o in used], satellite=ref.platform or "Sentinel-1", product_type=ref.product_type,
        acquisition_time=_dt(ref.acquisition_start), composite_scenes=len(used),
        preprocessing_version=preprocessing.PREPROCESSING_VERSION, model_version=ms["model_version"],
        model_checkpoint=ms["checkpoint"], threshold=ms["threshold"], mmu_ha=ms["mmu_ha"], tau_km=g.get("tau_km"),
        k_neighbors=g.get("k_neighbors"), software_version=software_version(), status="QUEUED", stage="queued",
        created_by=user.id if user else None)
    sp = scene_file(study_area_id, used)
    if cached_scene(sp, used):
        a.mode, a.scene_path = "cached", _rel(sp)
    db.add(a)
    db.flush()
    return a


def _get_summary(aid: str) -> Optional[dict]:
    with SessionLocal() as db:
        a = db.get(SatelliteAnalysis, aid)
        return dict(a.summary or {}) if a else None


def _update(aid: str, **kw) -> None:
    with SessionLocal() as db:
        a = db.get(SatelliteAnalysis, aid)
        for k, v in kw.items():
            setattr(a, k, v)
        db.commit()


@handler("satellite_analyze")
def satellite_analyze(ctx: JobContext, p: dict) -> dict:
    """observation -> retrieval (Processing API) -> preprocessing -> U-Net -> habitat -> patches -> graph -> criticality
    -> restoration. Progress stages are the keys of STAGES; the analysis record mirrors them."""
    aid = p["analysis_id"]
    used = [Observation(**o) for o in p["observations"]]
    area = p["study_area_id"]

    def stage(key: str, frac: float, log: Optional[str] = None) -> None:
        ctx.progress(frac, key, log)
        _update(aid, stage=key, status="RUNNING")

    try:
        stage("observation", 0.02, f"{len(used)} acquisition(s): " + ", ".join(f"{o.name} {o.acquisition_start}" for o in used))
        for o in used:
            catalog.validate_product(o)
        grid = processing.grid_for(area)
        sp = scene_file(area, used)
        ref = preprocessing.training_reference(REPO_ROOT)

        if cached_scene(sp, used):
            stage("retrieval", 0.10, f"cached scene reused: {sp.name} (no Copernicus request)")
            with __import__("rasterio").open(sp) as src:
                bands = src.read().astype(np.float32)
            bands[bands == -9999.0] = np.nan
            stage("preprocessing", 0.30, "cached scene already preprocessed")
        else:
            if not credentials_configured():
                raise NotConfigured()
            stage("retrieval", 0.05, f"grid {grid.width}x{grid.height} px @ 10 m, EPSG:{grid.crs.to_epsg()}, "
                                     f"~{processing.processing_units_estimate(grid, len(used))} processing units")
            stack = []
            for k, o in enumerate(used):
                lin = processing.retrieve_linear(o, grid, on_tile=lambda i, n, k=k: ctx.progress(
                    0.05 + 0.2 * (k + i / n) / len(used), "retrieval", f"{o.name}: tile {i}/{n}"))
                stage("preprocessing", 0.25 + 0.05 * k / len(used), f"{o.name}: linear gamma0 -> dB")
                stack.append(preprocessing.to_db(lin))
            bands = preprocessing.composite(np.stack(stack))
            info = {"study_area": area, "scene_id": sp.stem, "provider": "copernicus-dataspace-process-api",
                    "date_range": [used[-1].acquisition_start, used[0].acquisition_start],
                    "sources": {"sentinel1": {
                        "scenes": [{"product_id": o.product_id, "id": o.name, "datetime": o.acquisition_start,
                                    "orbit": o.orbit_direction, "relative_orbit": o.relative_orbit, "timeliness": o.timeliness,
                                    "platform": o.platform} for o in used],
                        "composite": "temporal median (gamma0 terrain, dB)" if len(used) > 1 else "single acquisition (gamma0 terrain, dB)",
                        "processing": processing.PROCESSING, "collection": "sentinel-1-grd"}}}
            preprocessing.write_nrt_scene(sp, bands, grid, info)
        compat = preprocessing.check_compatibility(preprocessing.BAND_NAMES, ref)
        dist = preprocessing.distribution_check(bands, ref)
        side = sp.with_suffix(".json")
        sj = json.loads(side.read_text())
        sj.update({"model_compatibility": compat, "distribution_check": dist})
        side.write_text(json.dumps(sj, indent=1, default=str))
        _update(aid, scene_path=_rel(sp), processed_at=utcnow(), status="SCENE_READY",
                summary={"distribution_check": dist, "model_compatibility": compat})
        if compat.get("compatible") is False:
            raise SatelliteError(compat["reason"], user_message="The retrieved scene does not match the model's input bands: "
                                 + compat["reason"])

        stage("inference", 0.35, "checking the trained model")
        ms = model_status()
        if not ms["available"]:
            raise SatelliteError(ms["reason"], user_message="Scene retrieved and preprocessed, but AI inference cannot run on "
                                 "this server: " + ms["reason"])
        out_dir = OUTPUTS_DIR / "satellite" / aid
        out_dir.mkdir(parents=True, exist_ok=True)
        prob = out_dir / f"{area}_prob.tif"
        cmd = [inference_python(), str(REPO_ROOT / "scripts" / "predict.py"), "--checkpoint", str(checkpoint_path()),
               "--input", str(sp), "--output", str(prob), "--threshold", str(ms["threshold"])]
        ctx.progress(0.4, "inference", "$ predict.py " + sp.name)
        try:
            r = run_predict(cmd)
        except subprocess.TimeoutExpired:
            raise SatelliteError("inference timeout", user_message=f"AI inference exceeded {TIMEOUT_S} s.")
        ctx.progress(0.55, "inference", (r.stdout or "")[-2000:] + (r.stderr or "")[-2000:])
        if r.returncode != 0 or not prob.is_file():
            raise SatelliteError(f"predict.py exit {r.returncode}", user_message="AI inference failed (see the job log).")
        return _ecology(ctx, aid, area, prob, ms, used, stage)
    except SatelliteError as e:
        _update(aid, status="FAILED", error=e.user_message, finished_at=utcnow())
        raise RuntimeError(e.user_message) from e
    except Exception as e:
        _update(aid, status="FAILED", error=f"{type(e).__name__}: {str(e)[:300]}", finished_at=utcnow())
        raise


def _ecology(ctx: JobContext, aid: str, area: str, prob: Path, ms: dict, used: list[Observation], stage) -> dict:
    """The existing ecological pipeline, called exactly as scripts/run_graph_analysis.py calls it (--no-latest)."""
    from ecoconnect.pipeline import sources
    from ecoconnect.pipeline.analysis import run_graph_analysis
    from ecoconnect.pipeline.config import load_study_areas
    from ..paths import resolve_run, run_summary

    cfg, meta = graph_config(), load_study_areas()[area]
    rcfg = cfg["restoration"]
    stage("habitat", 0.6, f"threshold {ms['threshold']} -> habitat mask -> connected components, MMU {ms['mmu_ha']} ha")
    patches, cands, a_l, src, kind = sources.from_probability_raster(
        prob, threshold=float(ms["threshold"]), mmu_ha=float(ms["mmu_ha"]), habitat_class=meta.get("primary_habitat", "mangrove"),
        candidate_threshold=rcfg["candidate_threshold"] if rcfg["candidate_source"] == "sub_threshold" else None,
        candidate_min_area_ha=rcfg["candidate_min_area_ha"], candidate_max_count=rcfg["candidate_max_count"],
        result_kind="development", model_info={"checkpoint": ms["checkpoint"]})
    stage("patches", 0.68, f"{len(patches)} habitat patches, {len(cands)} restoration candidate areas")
    plaus = plausibility(area, sum(p.area_ha for p in patches))
    _update(aid, summary={**(_get_summary(aid) or {}), "plausibility": plaus, "reliability": area_reliability(area)})
    if not patches:
        raise SatelliteError("no patches", user_message="The model found no habitat patches above the minimum mapping unit "
                             "in this observation, so no connectivity network can be built.")
    ref = used[0]
    src = {**src, "satellite": {"analysis_id": aid, "source": catalog.SOURCE, "collection": "sentinel-1-grd",
                                "product_ids": [o.product_id for o in used], "products": [o.name for o in used],
                                "acquisition_time": ref.acquisition_start, "timeliness": ref.timeliness,
                                "platform": ref.platform, "preprocessing_version": preprocessing.PREPROCESSING_VERSION,
                                "composite_scenes": len(used), "first_acquisition": used[-1].acquisition_start,
                                "reliability": area_reliability(area), "plausibility": plaus}}
    run_id = f"{area}_nrt_{(ref.acquisition_start or '')[:10].replace('-', '')}_{aid[-6:]}"
    run_dir = run_graph_analysis(study_area_id=area, study_area_meta=meta, patches=patches, landscape_area_ha=a_l, cfg=cfg,
                                 data_source=src, result_kind=kind, candidates=cands, run_id=run_id,
                                 write_latest_pointer=False,
                                 progress=lambda k: stage(k, {"connectivity": 0.75, "criticality": 0.82, "restoration": 0.92}[k]))
    summary = run_summary(resolve_run(area, run_dir.name))
    from ..registry import sync_all
    with SessionLocal() as db:
        sync_all(db)
        a = db.get(SatelliteAnalysis, aid)
        a.status, a.stage, a.run_id, a.finished_at = "COMPLETED", "done", run_dir.name, utcnow()
        a.summary = {**(a.summary or {}), "run": summary}
        audit(db, db.get(User, ctx.user_id) if ctx.user_id else None, "satellite_analysis", "analysis_version", run_dir.name,
              new={"analysis_id": aid, "products": [o.name for o in used], "job": ctx.job_id})
        db.commit()
    return {"analysis_id": aid, "run_id": run_dir.name, "study_area": area, **summary}
