"""OPTIONAL Google Earth Engine acquisition path (provider: gee in configs/acquisition.yaml).

Requires:  pip install earthengine-api  and  `earthengine authenticate`  (see docs/GEE_SETUP.md).
If authentication is unavailable this module raises a clear error and the STAC path (default)
or a user-provided dataset must be used instead.  Exports are AOI-sized only (getDownloadURL,
<= ~50 MB per request); nothing large is pulled automatically.
"""
from __future__ import annotations

import json
import urllib.request
import zipfile
from pathlib import Path

import numpy as np

from .stac_acquire import AOI, TargetGrid


def _ee():
    try:
        import ee  # noqa: WPS433
    except ImportError as e:
        raise RuntimeError("earthengine-api is not installed: pip install earthengine-api") from e
    return ee


def init(project: str | None) -> None:
    ee = _ee()
    try:
        ee.Initialize(project=project) if project else ee.Initialize()
    except Exception as e:  # pragma: no cover - depends on local auth state
        raise RuntimeError("Earth Engine is not authenticated. Run `earthengine authenticate` "
                           "(docs/GEE_SETUP.md) or use provider: stac.") from e


def s2_composite_image(aoi: AOI, cfg: dict, acq: dict):
    ee = _ee()
    region = ee.Geometry.Rectangle(list(aoi.bbox_lonlat))
    col = (ee.ImageCollection(cfg["s2_collection"]).filterBounds(region)
           .filterDate(*acq["date_range"]).filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", acq["max_cloud_cover_s2"])))

    def mask(img):
        scl = img.select("SCL")
        bad = scl.eq(3).Or(scl.eq(8)).Or(scl.eq(9)).Or(scl.eq(10)).Or(scl.eq(11)).Or(scl.eq(0)).Or(scl.eq(1))
        return img.updateMask(bad.Not()).divide(10000)

    comp = col.map(mask).select(["B2", "B3", "B4", "B8", "B11", "B12"]).median()
    ndvi = comp.normalizedDifference(["B8", "B4"]).rename("NDVI")
    ndwi = comp.normalizedDifference(["B3", "B8"]).rename("NDWI")
    return comp.addBands([ndvi, ndwi]), region


def s1_composite_image(aoi: AOI, cfg: dict, acq: dict):
    ee = _ee()
    region = ee.Geometry.Rectangle(list(aoi.bbox_lonlat))
    col = (ee.ImageCollection(cfg["s1_collection"]).filterBounds(region).filterDate(*acq["date_range"])
           .filter(ee.Filter.eq("instrumentMode", "IW"))
           .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VV"))
           .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VH")))
    if acq.get("s1_orbit", "any") != "any":
        col = col.filter(ee.Filter.eq("orbitProperties_pass", acq["s1_orbit"].upper()))
    return col.select(["VV", "VH"]).median(), region       # GRD in GEE is already in dB


def download_image(image, region, grid: TargetGrid, dest: Path, scale_m: float, log=print) -> Path:
    """Small-AOI download via getDownloadURL (GeoTIFF).  Fails loudly above the service limit."""
    url = image.getDownloadURL({"region": region, "scale": scale_m, "crs": f"EPSG:{grid.crs.to_epsg()}",
                                "format": "GEO_TIFF"})
    log(f"  GEE download -> {dest}")
    dest.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(url, timeout=300) as r, open(dest, "wb") as f:
        f.write(r.read())
    if zipfile.is_zipfile(dest):
        with zipfile.ZipFile(dest) as z:
            tifs = [n for n in z.namelist() if n.endswith(".tif")]
            z.extract(tifs[0], dest.parent)
            (dest.parent / tifs[0]).rename(dest)
    return dest
