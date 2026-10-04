"""Microsoft Planetary Computer `sentinel-1-rtc` as the near-real-time source (default provider).

Why this is the default: it is the SAME product the model was trained on (Sentinel-1 radiometrically terrain-corrected
gamma0, produced by Planetary Computer from each Sentinel-1 GRD scene), it is updated within about a day of each pass
(e.g. the 2026-10-03 12:19 UTC Odisha pass was listed on 2026-10-04), and it needs no account: assets are signed with
an anonymous token. Retrieval uses the training pipeline's own reader (ecoconnect.gee.stac_acquire._read_asset_to_grid,
bilinear, onto TargetGrid) - so training and near-real-time input are processed identically.
"""
from __future__ import annotations

import hashlib
import threading
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

import numpy as np
from shapely.geometry import mapping, shape

from .catalog import CACHE_TTL_S, SEARCH_DAYS, Observation, area_aoi
from .copernicus import NoObservation, SatelliteError, ServiceTimeout

STAC_URL = "https://planetarycomputer.microsoft.com/api/stac/v1"
COLLECTION = "sentinel-1-rtc"
SOURCE = "Microsoft Planetary Computer (Sentinel-1 RTC)"
PRODUCT_TYPE = "S1_RTC_IW"                  # RTC gamma0 derived from IW GRD-H; validated in catalog.validate_product

_cache: dict[tuple, tuple[float, list[Observation]]] = {}
_lock = threading.Lock()


def clear_cache() -> None:
    with _lock:
        _cache.clear()


def product_id(item_id: str) -> str:
    """Planetary Computer item ids are ~70 chars; the observations table keys are 64: a stable short id."""
    return "pc-" + hashlib.sha1(item_id.encode()).hexdigest()[:29]


def _client():
    from ecoconnect.gee.stac_acquire import _ensure_certs
    import planetary_computer
    from pystac_client import Client
    _ensure_certs()
    return Client.open(STAC_URL, modifier=planetary_computer.sign_inplace)


def parse_item(it: dict, study_area_id: str, aoi) -> Observation:
    p = it.get("properties") or {}
    fp = shape(it["geometry"]) if it.get("geometry") else None
    cov = round(float(fp.intersection(aoi).area / aoi.area), 4) if fp is not None and not fp.is_empty else 0.0
    pol = p.get("sar:polarizations") or []
    plat = str(p.get("platform") or "")
    return Observation(
        product_id=product_id(it["id"]), name=it["id"], study_area_id=study_area_id,
        platform=("Sentinel-1" + plat[-1].upper()) if plat.startswith("sentinel-1") else (plat or None),
        product_type=PRODUCT_TYPE if p.get("sar:instrument_mode", "IW") == "IW" else p.get("sar:product_type"),
        mode=p.get("sar:instrument_mode"), polarisation="&".join(pol) if pol else None,
        orbit_direction=(p.get("sat:orbit_state") or "").upper() or None, relative_orbit=p.get("sat:relative_orbit"),
        timeliness=p.get("s1:product_timeliness"), acquisition_start=p.get("start_datetime") or p.get("datetime"),
        acquisition_end=p.get("end_datetime"), published_at=p.get("s1:processing_datetime"), aoi_coverage=cov,
        footprint=mapping(fp) if fp is not None else None, provider="planetary")


def search(study_area_id: str, *, days: int = SEARCH_DAYS, top: int = 60, now: Optional[datetime] = None) -> list[Observation]:
    """Sentinel-1 RTC items intersecting the study area in the last ``days`` days, newest first (cached)."""
    _, aoi = area_aoi(study_area_id)
    key = (study_area_id, days, top)
    with _lock:
        hit = _cache.get(key)
        if hit and time.monotonic() - hit[0] < CACHE_TTL_S:
            return hit[1]
    end = now or datetime.now(timezone.utc)
    try:
        items = list(_client().search(collections=[COLLECTION], bbox=list(aoi.bounds),
                                      datetime=f"{(end - timedelta(days=days)).strftime('%Y-%m-%dT%H:%M:%SZ')}/{end.strftime('%Y-%m-%dT%H:%M:%SZ')}",
                                      sortby=[{"field": "datetime", "direction": "desc"}], max_items=top).items())
    except Exception as e:  # noqa: BLE001 - network / STAC errors become a clear message
        if "timed out" in str(e).lower():
            raise ServiceTimeout(f"Planetary Computer STAC: {type(e).__name__}") from e
        raise SatelliteError(f"Planetary Computer STAC: {type(e).__name__}: {str(e)[:120]}",
                             user_message="The Planetary Computer catalogue could not be reached. Try again later.") from e
    obs = [parse_item(i.to_dict(), study_area_id, aoi) for i in items]
    obs.sort(key=lambda o: o.acquisition_start or "", reverse=True)
    with _lock:
        _cache[key] = (time.monotonic(), obs)
    return obs


def retrieve_linear(obs: Observation, grid, on_tile=None) -> np.ndarray:
    """(2, H, W) linear gamma0 [VV, VH] on ``grid`` - read exactly like the training scenes (stac_acquire)."""
    from rasterio.enums import Resampling
    from ecoconnect.gee.stac_acquire import _read_asset_to_grid
    import planetary_computer
    try:
        item = _client().get_collection(COLLECTION).get_item(obs.name)
    except Exception as e:  # noqa: BLE001
        raise SatelliteError(f"item {obs.name}: {type(e).__name__}", user_message="The satellite scene could not be fetched.") from e
    if item is None:
        raise NoObservation(f"{obs.name} not found in {COLLECTION}")
    out = np.full((2, grid.height, grid.width), np.nan, np.float32)
    for bi, band in enumerate(("vv", "vh")):
        if band not in item.assets:
            raise SatelliteError(f"{obs.name} has no {band} asset", user_message="The scene is missing a VV or VH band.")
        out[bi] = _read_asset_to_grid(planetary_computer.sign(item.assets[band].href), grid, Resampling.bilinear)
        if on_tile:
            on_tile(bi + 1, 2)
    return out
