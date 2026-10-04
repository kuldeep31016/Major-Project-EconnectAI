"""/api/satellite - near-real-time Sentinel-1 observations (Copernicus Data Space) and their analyses.

    GET  /api/satellite/status                    what is configured: catalogue, image retrieval, model inference
    GET  /api/satellite/latest?area_id=           latest VV+VH IW GRD observation over the study area (real metadata)
    GET  /api/satellite/observations?area_id=     recent observations + analysis status per observation
    POST /api/satellite/analyze                   queue: retrieve -> preprocess -> U-Net -> patches -> graph (run_analysis)
    GET  /api/satellite/runs?area_id=             analysis provenance records
    GET  /api/satellite/runs/{id}                 one record + job state + scene checks
    GET  /api/satellite/runs/{id}/scene.png       retrieved VV backscatter (WGS84 overlay, X-Bounds header)
    GET  /api/satellite/runs/{id}/mask.png        predicted habitat mask at the recorded threshold
No endpoint returns or accepts Copernicus credentials.
"""
from __future__ import annotations

import io
import json
import re
from pathlib import Path
from typing import Optional

import numpy as np
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..auth import current_user, require
from ..db import Job, SatelliteAnalysis, SatelliteObservation, User, get_db
from ..security import compute_limiter
from ..jobs import enqueue
from . import catalog, monitor, service
from .copernicus import CATALOGUE_URL, NotConfigured, SatelliteError, credentials_configured

router = APIRouter(prefix="/api/satellite", tags=["satellite"])
_ID = re.compile(r"^EC-[a-z0-9-]{3,64}$")


def _fail(e: SatelliteError) -> HTTPException:
    return HTTPException(e.status_code, e.user_message)


@router.get("/status")
def status(db: Session = Depends(get_db)):
    ms = service.model_status()
    pc = catalog.PROVIDER == "planetary"
    configured = pc or credentials_configured()
    return {"source": catalog.SOURCES.get(catalog.PROVIDER, catalog.SOURCE), "provider": catalog.PROVIDER,
            "catalogue": {"available": True, "auth": "none (public)",
                          "url": "https://planetarycomputer.microsoft.com" if pc else CATALOGUE_URL.split("/odata")[0]},
            "retrieval": {"configured": configured,
                          "api": "Planetary Computer STAC (anonymous signed URLs; same RTC product as training)" if pc
                          else "Processing API (Sentinel Hub on CDSE)",
                          "note": None if configured else NotConfigured.user_message},
            "inference": {k: ms[k] for k in ("available", "model_version", "checkpoint_present", "torch_available", "threshold",
                                             "mmu_ha", "reason")}
                         | {"area_thresholds": service.area_thresholds()},
            "monitor": monitor.status(db),
            "search_days": catalog.SEARCH_DAYS, "min_aoi_coverage": catalog.MIN_COVERAGE,
            "modes": {"stored": "Stored analyses (static data: 2020 Sentinel-1 RTC composite, Planetary Computer)",
                      "nrt": "Latest satellite observation (" + ("Microsoft Planetary Computer, Sentinel-1 RTC, about a day after each pass"
                                                                 if pc else "Copernicus Data Space, near-real-time Sentinel-1 GRD") + ")"}}


@router.get("/latest")
def latest(request: Request, area_id: str = Query(..., max_length=64), db: Session = Depends(get_db)):
    compute_limiter.hit(request)
    try:
        obs = catalog.search(area_id)
        service.remember(db, obs)
        o = catalog.pick_latest(obs)
    except SatelliteError as e:
        raise _fail(e)
    prev = [x for x in obs if x.has_vv_vh and x.aoi_coverage >= catalog.MIN_COVERAGE and x.product_id != o.product_id]
    return {"area_id": area_id, **o.to_api(), "available": True,
            "previous_acquisition": prev[0].acquisition_start if prev else None,
            "analysis": service.analyses_by_product(db, area_id).get(o.product_id),
            "model_reliability": service.area_reliability(area_id)}


@router.get("/observations")
def observations(request: Request, area_id: str = Query(..., max_length=64), days: int = Query(catalog.SEARCH_DAYS, ge=1, le=365),
                 db: Session = Depends(get_db)):
    compute_limiter.hit(request)
    try:
        obs = catalog.search(area_id, days=days)
        service.remember(db, obs)
    except SatelliteError as e:
        raise _fail(e)
    done = service.analyses_by_product(db, area_id)
    try:
        latest_id = catalog.pick_latest(obs).product_id
    except SatelliteError:
        latest_id = None
    _, aoi = catalog.area_aoi(area_id)
    return {"area_id": area_id, "aoi": {"type": "Polygon", "coordinates": [list(map(list, aoi.exterior.coords))]},
            "latest_id": latest_id, "observations": [{**o.to_api(), "analysis": done.get(o.product_id)} for o in obs]}


class AnalyzeIn(BaseModel):
    area_id: str = Field(..., max_length=64)
    product_id: Optional[str] = Field(None, max_length=64)       # default: the latest observation
    composite_scenes: int = Field(8, ge=1, le=8)    # 8 = median of the latest 8 same-track acquisitions, as in training
                                                    # (a single date over-predicted 30x on Kerala, 2026-10-04); 1 = latest only
    force: bool = False                                          # re-run even if this exact analysis completed


@router.post("/analyze", status_code=202)
def analyze(body: AnalyzeIn, user: User = Depends(require("run_analysis")), db: Session = Depends(get_db)):
    try:
        obs = catalog.search(body.area_id)
        service.remember(db, obs)
        if body.product_id:
            ref = next((o for o in obs if o.product_id == body.product_id), None)
            if ref is None:
                raise HTTPException(404, "That product is not among this study area's recent observations.")
            catalog.validate_product(ref)
            if ref.aoi_coverage < catalog.MIN_COVERAGE:
                raise HTTPException(422, f"That observation covers only {ref.aoi_coverage:.0%} of the study area.")
        else:
            ref = catalog.pick_latest(obs)
    except SatelliteError as e:
        raise _fail(e)
    used = catalog.same_track(obs, ref, body.composite_scenes)
    try:
        res = service.start_analysis(db, body.area_id, used, user, force=body.force)
    except SatelliteError as e:
        raise _fail(e)
    if res["reused"]:
        return {"analysis": res["analysis"].to_dict(), "job_id": res["job_id"], "reused": res["reused"]}
    a, j_id = res["analysis"], res["job_id"]
    return {"analysis": a.to_dict(), "job_id": j_id, "reused": None,
            "note": None if len(used) == body.composite_scenes else
            f"Only {len(used)} same-track acquisition(s) available in the search window."}


class MonitorIn(BaseModel):
    analyse: Optional[bool] = None                   # None = SATELLITE_MONITOR_ANALYSE (default on)


@router.get("/monitor")
def monitor_status(_user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Automatic monitoring: schedule, monitored areas and the last check's per-area report."""
    return monitor.status(db)


@router.post("/monitor/run", status_code=202)
def monitor_run(body: MonitorIn, user: User = Depends(require("run_analysis")), db: Session = Depends(get_db)):
    """Run a monitoring check now (new passes -> alerts -> analyses where the model can run)."""
    j = enqueue(db, "satellite_monitor", {"analyse": body.analyse}, user)
    return {"job_id": j.id}


@router.get("/runs")
def runs(area_id: Optional[str] = Query(None, max_length=64), _user: User = Depends(current_user), db: Session = Depends(get_db)):
    q = db.query(SatelliteAnalysis)
    if area_id:
        q = q.filter(SatelliteAnalysis.study_area_id == area_id)
    return [a.to_dict() for a in q.order_by(SatelliteAnalysis.created_at.desc()).limit(50).all()]


def _get(db: Session, aid: str) -> SatelliteAnalysis:
    if not _ID.match(aid):
        raise HTTPException(400, "invalid analysis id")
    a = db.get(SatelliteAnalysis, aid)
    if a is None:
        raise HTTPException(404, "analysis not found")
    return a


@router.get("/runs/{aid}")
def run(aid: str, _user: User = Depends(current_user), db: Session = Depends(get_db)):
    a = _get(db, aid)
    j = db.get(Job, a.job_id) if a.job_id else None
    sp = service.scene_abs(a.scene_path)
    side = json.loads(sp.with_suffix(".json").read_text()) if sp and sp.with_suffix(".json").is_file() else {}
    obs = [db.get(SatelliteObservation, pid) for pid in (a.product_ids or [])]
    return {**a.to_dict(), "job": {"status": j.status, "progress": j.progress, "stage": j.stage, "error": j.error} if j else None,
            "stages": service.STAGES, "scene": {"available": bool(sp and sp.is_file()), "bands": side.get("bands"),
                                                "width": side.get("width"), "height": side.get("height"), "crs": side.get("crs"),
                                                "distribution_check": side.get("distribution_check"),
                                                "model_compatibility": side.get("model_compatibility"),
                                                "processing": ((side.get("sources") or {}).get("sentinel1") or {}).get("processing")},
            "observations": [{"product_id": o.id, "name": o.name, "acquisition_start": o.acquisition_start.isoformat() + "Z"
                              if o.acquisition_start else None, "timeliness": o.timeliness, "platform": o.platform,
                              "orbit_direction": o.orbit_direction, "relative_orbit": o.relative_orbit,
                              "published_at": o.published_at.isoformat() + "Z" if o.published_at else None}
                             for o in obs if o is not None]}


def _overlay(path: Path, colorize) -> Response:
    """Band 1 of ``path`` reprojected to EPSG:4326 (~1000 px wide) and coloured; bounds in X-Bounds."""
    import rasterio
    from PIL import Image
    from rasterio.crs import CRS
    from rasterio.transform import from_bounds
    from rasterio.warp import Resampling, reproject, transform_bounds
    with rasterio.open(path) as src:
        a = src.read(1).astype(np.float32)
        if src.nodata is not None:
            a[a == src.nodata] = np.nan
        b = transform_bounds(src.crs, CRS.from_epsg(4326), *src.bounds)
        w = 1000
        h = max(1, int(w * (b[3] - b[1]) / (b[2] - b[0])))
        dst = np.full((h, w), np.nan, np.float32)
        reproject(a, dst, src_transform=src.transform, src_crs=src.crs, src_nodata=np.nan, dst_transform=from_bounds(*b, w, h),
                  dst_crs=CRS.from_epsg(4326), dst_nodata=np.nan, resampling=Resampling.nearest)
    buf = io.BytesIO()
    Image.fromarray(colorize(dst), "RGBA").save(buf, "PNG", optimize=True)
    return Response(buf.getvalue(), media_type="image/png",
                    headers={"X-Bounds": f"{b[1]},{b[0]},{b[3]},{b[2]}", "Access-Control-Expose-Headers": "X-Bounds",
                             "Cache-Control": "private, max-age=3600"})


def _grey(a: np.ndarray) -> np.ndarray:
    ok = np.isfinite(a)
    lo, hi = (np.percentile(a[ok], [2, 98]) if ok.any() else (0.0, 1.0))
    g = np.clip((np.where(ok, a, lo) - lo) / max(hi - lo, 1e-6) * 255, 0, 255).astype(np.uint8)
    return np.dstack([g, g, g, np.where(ok, 255, 0).astype(np.uint8)])


def _mask_rgba(a: np.ndarray) -> np.ndarray:
    on = a == 1
    out = np.zeros(a.shape + (4,), np.uint8)
    out[on] = (34, 197, 94, 200)
    return out


@router.get("/runs/{aid}/scene.png")
def scene_png(aid: str, db: Session = Depends(get_db)):
    a = _get(db, aid)
    sp = service.scene_abs(a.scene_path)
    if not (sp and sp.is_file()):
        raise HTTPException(404, "the scene for this analysis has not been retrieved on this server")
    return _overlay(sp, _grey)


@router.get("/runs/{aid}/mask.png")
def mask_png(aid: str, db: Session = Depends(get_db)):
    a = _get(db, aid)
    d = service.OUTPUTS_DIR / "satellite" / a.id
    hits = sorted(d.glob(f"{a.study_area_id}_binary_t*.tif")) if d.is_dir() else []
    if not hits:
        raise HTTPException(404, "no predicted mask for this analysis (inference has not completed)")
    return _overlay(hits[-1], _mask_rgba)
