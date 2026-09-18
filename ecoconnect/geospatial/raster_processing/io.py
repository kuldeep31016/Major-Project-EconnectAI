"""Thin rasterio helpers: read/write GeoTIFFs and compute per-pixel areas."""
from __future__ import annotations

import math
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio.transform import Affine
from pyproj import Transformer


@dataclass
class RasterMeta:
    crs: CRS
    transform: Affine
    width: int
    height: int
    nodata: Optional[float]
    count: int
    dtype: str

    @property
    def bounds(self) -> tuple[float, float, float, float]:
        left, top = self.transform @ (0, 0)
        right, bottom = self.transform @ (self.width, self.height)
        return (min(left, right), min(bottom, top), max(left, right), max(bottom, top))


def read_raster(path: str | Path, bands: Optional[list[int]] = None) -> tuple[np.ndarray, RasterMeta]:
    """Read (bands, H, W) float32 array + metadata.  ``bands`` are 1-based."""
    with rasterio.open(path) as src:
        arr = src.read(bands) if bands else src.read()
        meta = RasterMeta(src.crs, src.transform, src.width, src.height, src.nodata, src.count, str(arr.dtype))
    return arr, meta


def write_raster(path: str | Path, arr: np.ndarray, meta: RasterMeta, *, dtype=None, nodata=None,
                 compress: str = "deflate") -> Path:
    """Write a (bands, H, W) or (H, W) array as a GeoTIFF with the given georeferencing."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    if arr.ndim == 2:
        arr = arr[None]
    dtype = dtype or arr.dtype
    with rasterio.open(
        path, "w", driver="GTiff", height=arr.shape[1], width=arr.shape[2], count=arr.shape[0],
        dtype=dtype, crs=meta.crs, transform=meta.transform, nodata=nodata, compress=compress, tiled=True,
    ) as dst:
        dst.write(arr.astype(dtype))
    return path


def pixel_area_ha(meta: RasterMeta) -> np.ndarray:
    """Per-row pixel area in hectares, shape (H,).

    * Projected CRS (metres): |a * e| / 10 000, constant for all rows.
    * Geographic CRS (degrees): dx = |a| * 111 320 m * cos(lat_row), dy = |e| * 110 574 m.
      Area varies with latitude, so pixel counts are never converted with a
      single constant.
    """
    a, e = abs(meta.transform.a), abs(meta.transform.e)
    if meta.crs is not None and meta.crs.is_projected:
        units = meta.crs.linear_units_factor[1] if hasattr(meta.crs, "linear_units_factor") else 1.0
        area_m2 = a * e * units * units
        return np.full(meta.height, area_m2 / 10_000.0, dtype=np.float64)
    rows = np.arange(meta.height) + 0.5
    _, lats = meta.transform @ (np.zeros_like(rows), rows)
    dx_m = a * 111_320.0 * np.cos(np.radians(lats))
    dy_m = e * 110_574.0
    return (dx_m * dy_m) / 10_000.0


def to_wgs84(meta: RasterMeta):
    """Return a callable (x, y) -> (lon, lat) for this raster's CRS."""
    if meta.crs is None or meta.crs.to_epsg() == 4326:
        return lambda x, y: (x, y)
    tr = Transformer.from_crs(meta.crs, CRS.from_epsg(4326), always_xy=True)
    return lambda x, y: tr.transform(x, y)


def utm_epsg_for(lon: float, lat: float) -> int:
    """EPSG code of the WGS84 UTM zone containing (lon, lat) - used for metric geometry ops."""
    zone = int(math.floor((lon + 180) / 6) + 1)
    return (32600 if lat >= 0 else 32700) + zone
