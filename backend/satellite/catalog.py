"""Copernicus catalogue search (public OData API, no credentials): Sentinel-1 IW GRD products over a study area.

Selection of the "latest observation" (``pick_latest``):
  1. Sentinel-1, product type IW_GRDH_1S (IW GRD high resolution, dual polarisation)
  2. footprint intersects the study-area bbox (configs/study_areas.yaml - the same AOI the stored runs used)
  3. polarisation VV&VH (the model input); single-pol products are rejected
  4. newest acquisition whose footprint covers >= MIN_COVERAGE of the bbox (partial strips are listed, not picked)
Every value returned is copied from the catalogue response; coverage is computed from the footprint geometry.
"""
from __future__ import annotations

import os
import re
import threading
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Optional

from shapely import wkt
from shapely.geometry import box, mapping, shape

from ecoconnect.pipeline.config import load_study_areas

from .copernicus import CATALOGUE_URL, InvalidArea, InvalidProduct, NoObservation, request

PRODUCT_TYPE = "IW_GRDH_1S"                  # Copernicus GRD-H
VALID_TYPES = {PRODUCT_TYPE, "S1_RTC_IW"}    # + Planetary Computer RTC (derived from IW GRD-H)
# planetary (default): Microsoft Planetary Computer sentinel-1-rtc - the product the model was trained on, no account.
# copernicus: Copernicus Data Space GRD + Processing API (needs COPERNICUS_CLIENT_ID / _SECRET for retrieval).
PROVIDER = os.environ.get("SATELLITE_PROVIDER", "planetary").strip().lower()
MIN_COVERAGE = float(os.environ.get("SATELLITE_MIN_AOI_COVERAGE", "0.9"))
SEARCH_DAYS = int(os.environ.get("SATELLITE_SEARCH_DAYS", "120"))
CACHE_TTL_S = float(os.environ.get("SATELLITE_CATALOGUE_TTL_S", "600"))
SOURCE = "Copernicus Data Space Ecosystem"
SOURCES = {"copernicus": SOURCE, "planetary": "Microsoft Planetary Computer (Sentinel-1 RTC)"}


@dataclass
class Observation:
    product_id: str
    name: str
    study_area_id: str
    platform: Optional[str]
    product_type: Optional[str]
    mode: Optional[str]
    polarisation: Optional[str]
    orbit_direction: Optional[str]
    relative_orbit: Optional[int]
    timeliness: Optional[str]
    acquisition_start: Optional[str]
    acquisition_end: Optional[str]
    published_at: Optional[str]
    aoi_coverage: float
    footprint: Optional[dict] = field(default=None, repr=False)
    provider: str = "copernicus"

    @property
    def has_vv_vh(self) -> bool:
        p = (self.polarisation or "").upper().replace(" ", "")
        return "VV" in p and "VH" in p

    def to_api(self) -> dict:
        d = asdict(self)
        d.update({"satellite": self.platform or "Sentinel-1", "product": "RTC" if self.provider == "planetary" else "GRD", "polarization": ["VV", "VH"] if self.has_vv_vh
                  else [x for x in re.split(r"[&+,\s]+", self.polarisation or "") if x],
                  "resolution_m": 10, "source": SOURCES.get(self.provider, SOURCE), "acquisition_time": self.acquisition_start,
                  "full_coverage": self.aoi_coverage >= MIN_COVERAGE})
        return d


def area_aoi(study_area_id: str) -> tuple[dict, "box"]:
    """(study-area metadata, shapely bbox polygon lon/lat) from configs/study_areas.yaml - the stored runs' AOI."""
    areas = load_study_areas()
    if study_area_id not in areas:
        raise InvalidArea(f"unknown study area {study_area_id!r}", user_message=f"Unknown study area '{study_area_id}'.")
    meta = areas[study_area_id]
    bb = meta.get("bbox")
    if not bb or len(bb) != 4 or not (bb[0] < bb[2] and bb[1] < bb[3]):
        raise InvalidArea(f"invalid bbox for {study_area_id}", user_message="This study area has no valid bounding box.")
    min_lat, min_lon, max_lat, max_lon = bb
    return meta, box(min_lon, min_lat, max_lon, max_lat)


def _attr(p: dict, name: str):
    for a in p.get("Attributes") or []:
        if a.get("Name") == name:
            return a.get("Value")
    return None


def _platform(p: dict) -> Optional[str]:
    serial = _attr(p, "platformSerialIdentifier")
    if serial:
        return f"Sentinel-1{serial}"
    m = re.match(r"S1([A-D])_", p.get("Name", ""))
    return f"Sentinel-1{m.group(1)}" if m else None


def _footprint(p: dict):
    if p.get("GeoFootprint"):
        return shape(p["GeoFootprint"])
    fp = p.get("Footprint") or ""                       # "geography'SRID=4326;POLYGON ((...))'"
    m = re.search(r"((?:MULTI)?POLYGON\s*\(.*\))", fp)
    return wkt.loads(m.group(1)) if m else None


def parse_product(p: dict, study_area_id: str, aoi) -> Observation:
    fp = _footprint(p)
    cov = round(float(fp.intersection(aoi).area / aoi.area), 4) if fp is not None and not fp.is_empty else 0.0
    rel = _attr(p, "relativeOrbitNumber")
    return Observation(
        product_id=p["Id"], name=p.get("Name", ""), study_area_id=study_area_id, platform=_platform(p),
        product_type=_attr(p, "productType"), mode=_attr(p, "operationalMode"), polarisation=_attr(p, "polarisationChannels"),
        orbit_direction=_attr(p, "orbitDirection"), relative_orbit=int(rel) if rel is not None else None,
        timeliness=_attr(p, "timeliness"), acquisition_start=(p.get("ContentDate") or {}).get("Start"),
        acquisition_end=(p.get("ContentDate") or {}).get("End"), published_at=p.get("PublicationDate"),
        aoi_coverage=cov, footprint=mapping(fp) if fp is not None else None)


def validate_product(o: Observation) -> None:
    if o.product_type not in VALID_TYPES or (o.mode and o.mode != "IW") or not o.has_vv_vh:
        raise InvalidProduct(f"{o.name}: type={o.product_type} mode={o.mode} pol={o.polarisation}")


def pick_latest(obs: list[Observation]) -> Observation:
    """Newest VV+VH IW GRD acquisition covering >= MIN_COVERAGE of the AOI."""
    ok = [o for o in obs if o.product_type in VALID_TYPES and o.has_vv_vh and o.aoi_coverage >= MIN_COVERAGE]
    if not ok:
        raise NoObservation(f"{len(obs)} products, none VV+VH with coverage >= {MIN_COVERAGE}")
    return max(ok, key=lambda o: o.acquisition_start or "")


_cache: dict[tuple, tuple[float, list[Observation]]] = {}
_lock = threading.Lock()


def clear_cache() -> None:
    with _lock:
        _cache.clear()
    from . import planetary
    planetary.clear_cache()


def search(study_area_id: str, *, days: int = SEARCH_DAYS, top: int = 40, now: Optional[datetime] = None,
           client=None) -> list[Observation]:
    """Sentinel-1 IW products intersecting the study area in the last ``days`` days, newest first (cached)."""
    if PROVIDER == "planetary" and client is None:
        from . import planetary
        return planetary.search(study_area_id, days=days, now=now)
    _, aoi = area_aoi(study_area_id)
    key = (study_area_id, days, top)
    with _lock:
        hit = _cache.get(key)
        if hit and time.monotonic() - hit[0] < CACHE_TTL_S:
            return hit[1]
    since = (now or datetime.now(timezone.utc)) - timedelta(days=days)
    flt = (f"Collection/Name eq 'SENTINEL-1' and OData.CSC.Intersects(area=geography'SRID=4326;{aoi.wkt}') "
           f"and Attributes/OData.CSC.StringAttribute/any(a:a/Name eq 'productType' and a/OData.CSC.StringAttribute/Value eq '{PRODUCT_TYPE}') "
           f"and ContentDate/Start gt {since.strftime('%Y-%m-%dT%H:%M:%S.000Z')}")
    r = request("GET", CATALOGUE_URL, client=client,
                params={"$filter": flt, "$orderby": "ContentDate/Start desc", "$top": top, "$expand": "Attributes"})
    obs = [parse_product(p, study_area_id, aoi) for p in r.json().get("value", [])]
    obs.sort(key=lambda o: o.acquisition_start or "", reverse=True)
    with _lock:
        _cache[key] = (time.monotonic(), obs)
    return obs


def latest(study_area_id: str, client=None) -> Observation:
    return pick_latest(search(study_area_id, client=client))


def same_track(obs: list[Observation], ref: Observation, n: int) -> list[Observation]:
    """``ref`` plus up to n-1 earlier full-coverage acquisitions from the same relative orbit (same viewing geometry),
    newest first - the inputs of a temporal-median composite."""
    pool = [o for o in obs if o.has_vv_vh and o.aoi_coverage >= MIN_COVERAGE and o.relative_orbit == ref.relative_orbit
            and o.orbit_direction == ref.orbit_direction and (o.acquisition_start or "") <= (ref.acquisition_start or "")]
    pool.sort(key=lambda o: o.acquisition_start or "", reverse=True)
    out = [ref] + [o for o in pool if o.product_id != ref.product_id]
    return out[:max(1, n)]
