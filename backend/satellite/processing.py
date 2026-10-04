"""Image retrieval with the Copernicus Processing API (Sentinel Hub on CDSE) on the training grid.

Each request asks for exactly one Sentinel-1 acquisition (time window = that product's sensing interval) over the
study area, on the SAME target grid the training scenes used (``TargetGrid.for_aoi``: UTM zone of the AOI centre,
10 m pixels snapped to the resolution grid). Large AOIs are split into tiles below the API's 2,500 px limit and
reassembled. Backscatter is requested as linear gamma0 with terrain flattening (closest available match to the
Planetary Computer Sentinel-1 RTC gamma0 the model was trained on); the dB conversion happens in preprocessing.py
with the same code path as training.
"""
from __future__ import annotations

import io
from datetime import datetime, timedelta
from typing import Optional

import numpy as np

from .catalog import Observation
from .copernicus import PROCESS_URL, SatelliteError, request

MAX_TILE_PX = 2000                     # API limit is 2,500 px per side; stay below it

EVALSCRIPT = """//VERSION=3
function setup() {
  return { input: [{ bands: ["VV", "VH", "dataMask"] }], output: { bands: 3, sampleType: "FLOAT32" } };
}
function evaluatePixel(s) { return [s.VV, s.VH, s.dataMask]; }
"""

# Processing options of the sentinel-1-grd collection (CDSE docs: Sentinel-1 GRD "processing" block)
PROCESSING = {"backCoeff": "GAMMA0_TERRAIN", "orthorectify": True, "demInstance": "COPERNICUS_30",
              "upsampling": "BILINEAR", "downsampling": "BILINEAR"}


def _iso(s: str) -> datetime:
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def tiles(width: int, height: int, max_px: int = MAX_TILE_PX) -> list[tuple[int, int, int, int]]:
    """(col_off, row_off, w, h) windows covering the grid, each <= max_px per side."""
    out = []
    for r0 in range(0, height, max_px):
        for c0 in range(0, width, max_px):
            out.append((c0, r0, min(max_px, width - c0), min(max_px, height - r0)))
    return out


def build_request(obs: Observation, epsg: int, bounds: tuple[float, float, float, float], w: int, h: int) -> dict:
    t0 = _iso(obs.acquisition_start) - timedelta(seconds=30)
    t1 = _iso(obs.acquisition_end or obs.acquisition_start) + timedelta(seconds=30)
    flt = {"timeRange": {"from": t0.strftime("%Y-%m-%dT%H:%M:%SZ"), "to": t1.strftime("%Y-%m-%dT%H:%M:%SZ")},
           "acquisitionMode": "IW", "polarization": "DV", "resolution": "HIGH"}
    if obs.orbit_direction:
        flt["orbitDirection"] = obs.orbit_direction.upper()
    return {
        "input": {"bounds": {"bbox": list(bounds), "properties": {"crs": f"http://www.opengis.net/def/crs/EPSG/0/{epsg}"}},
                  "data": [{"type": "sentinel-1-grd", "dataFilter": flt, "processing": PROCESSING}]},
        "output": {"width": w, "height": h, "responses": [{"identifier": "default", "format": {"type": "image/tiff"}}]},
        "evalscript": EVALSCRIPT,
    }


def _decode(content: bytes, w: int, h: int) -> np.ndarray:
    import rasterio
    with rasterio.MemoryFile(io.BytesIO(content)) as mf, mf.open() as src:
        a = src.read().astype(np.float32)
    if a.shape != (3, h, w):
        raise SatelliteError(f"unexpected raster shape {a.shape}, wanted (3, {h}, {w})",
                             user_message="The satellite service returned an image with an unexpected size.")
    return a


def retrieve_linear(obs: Observation, grid, client=None, on_tile=None) -> np.ndarray:
    """(2, H, W) linear gamma0 [VV, VH] for one acquisition on ``grid``; NaN where the product has no data."""
    epsg = grid.crs.to_epsg()
    if not epsg:
        raise SatelliteError("target grid has no EPSG code")
    res = grid.transform.a
    minx, maxy = grid.transform.c, grid.transform.f
    out = np.full((2, grid.height, grid.width), np.nan, np.float32)
    windows = tiles(grid.width, grid.height)
    for i, (c0, r0, w, h) in enumerate(windows):
        b = (minx + c0 * res, maxy - (r0 + h) * res, minx + (c0 + w) * res, maxy - r0 * res)
        r = request("POST", PROCESS_URL, auth=True, client=client, json=build_request(obs, epsg, b, w, h),
                    headers={"Accept": "image/tiff"})
        a = _decode(r.content, w, h)
        valid = a[2] > 0
        out[0, r0:r0 + h, c0:c0 + w] = np.where(valid, a[0], np.nan)
        out[1, r0:r0 + h, c0:c0 + w] = np.where(valid, a[1], np.nan)
        if on_tile:
            on_tile(i + 1, len(windows))
    return out


def processing_units_estimate(grid, n_acquisitions: int) -> float:
    """Rough Sentinel Hub processing-unit estimate (512x512 px = 1 PU per 3 bands; FLOAT32 counts double).
    Informational only; the authoritative number is in the CDSE dashboard."""
    px = grid.width * grid.height
    return round(n_acquisitions * (px / (512 * 512)) * (3 / 3) * 2, 1)


def grid_for(study_area_id: str, bbox: Optional[list] = None, res_m: float = 10.0):
    """The acquisition grid of scripts/acquire_study_area.py for this area (identical construction)."""
    from ecoconnect.gee.stac_acquire import AOI, TargetGrid
    from ecoconnect.pipeline.config import load_study_areas
    bb = bbox or load_study_areas()[study_area_id]["bbox"]
    return TargetGrid.for_aoi(AOI(study_area_id, tuple(bb)), res_m)
