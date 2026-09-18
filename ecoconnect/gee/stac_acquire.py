"""Credential-free satellite acquisition through public STAC catalogues.

* Sentinel-2 L2A  - Element84 Earth Search (AWS open data COGs).  Only the AOI window of each
                    COG is read over HTTP (rasterio /vsicurl), never whole granules.
* Sentinel-1 RTC  - Microsoft Planetary Computer.  Assets are signed with an anonymous SAS token
                    (``planetary_computer.sign``); no account is needed.

Everything is windowed and streamed: an AOI of ~22 x 22 km at 10 m is ~2200 x 2200 pixels,
so a 6-band S2 composite is ~115 MB in RAM and ~30-60 MB on disk.  Scenes are written as
one multi-band GeoTIFF in the tile's native UTM CRS with band descriptions.
"""
from __future__ import annotations

import json
import os
import warnings
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio.enums import Resampling
from rasterio.warp import reproject, transform_bounds
from rasterio.windows import from_bounds

from ecoconnect.geospatial.raster_processing.io import RasterMeta, utm_epsg_for


def _ensure_certs() -> None:
    """Python.org macOS builds ship without CA roots; point ssl at certifi if available."""
    if os.environ.get("SSL_CERT_FILE"):
        return
    try:
        import certifi
        os.environ["SSL_CERT_FILE"] = certifi.where()
        os.environ.setdefault("CURL_CA_BUNDLE", certifi.where())
        os.environ.setdefault("GDAL_HTTP_CAINFO", certifi.where())   # rasterio /vsicurl uses GDAL's curl
    except ImportError:
        pass


_ensure_certs()

GDAL_ENV = dict(
    GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif,.tiff",
    GDAL_HTTP_MULTIRANGE="YES", GDAL_HTTP_MERGE_CONSECUTIVE_RANGES="YES", VSI_CACHE="TRUE",
    GDAL_CACHEMAX=512, AWS_NO_SIGN_REQUEST="YES", CPL_VSIL_CURL_CHUNK_SIZE=4194304, CPL_VSIL_CURL_CACHE_SIZE=268435456, GDAL_HTTP_VERSION="2", GDAL_NUM_THREADS="ALL_CPUS",
)


@dataclass
class AOI:
    study_area_id: str
    bbox: tuple[float, float, float, float]      # min_lat, min_lon, max_lat, max_lon  (WGS84)

    @property
    def bbox_lonlat(self) -> tuple[float, float, float, float]:
        return (self.bbox[1], self.bbox[0], self.bbox[3], self.bbox[2])

    @property
    def center(self) -> tuple[float, float]:
        return ((self.bbox[0] + self.bbox[2]) / 2, (self.bbox[1] + self.bbox[3]) / 2)


@dataclass
class TargetGrid:
    crs: CRS
    transform: rasterio.Affine
    width: int
    height: int

    @classmethod
    def for_aoi(cls, aoi: AOI, res_m: float, crs: Optional[CRS] = None) -> "TargetGrid":
        lat, lon = aoi.center
        crs = crs or CRS.from_epsg(utm_epsg_for(lon, lat))
        minx, miny, maxx, maxy = transform_bounds(CRS.from_epsg(4326), crs, *aoi.bbox_lonlat)
        # snap to the resolution grid so every source aligns pixel-exactly
        minx, maxy = np.floor(minx / res_m) * res_m, np.ceil(maxy / res_m) * res_m
        width, height = int(np.ceil((maxx - minx) / res_m)), int(np.ceil((maxy - miny) / res_m))
        return cls(crs, rasterio.Affine(res_m, 0, minx, 0, -res_m, maxy), width, height)

    @property
    def meta(self) -> RasterMeta:
        return RasterMeta(self.crs, self.transform, self.width, self.height, None, 1, "float32")

    @property
    def bounds(self):
        return rasterio.transform.array_bounds(self.height, self.width, self.transform)


def stac_search(url: str, collection: str, aoi: AOI, date_range: tuple[str, str], *, limit: int = 50,
                query: Optional[dict] = None, sortby: Optional[list] = None) -> list[dict]:
    from pystac_client import Client
    client = Client.open(url)
    search = client.search(collections=[collection], bbox=aoi.bbox_lonlat,
                           datetime=f"{date_range[0]}/{date_range[1]}", limit=limit, query=query, sortby=sortby)
    return [item.to_dict() for item in search.items()]


def _read_asset_to_grid(href: str, grid: TargetGrid, resampling: Resampling, dtype=np.float32) -> np.ndarray:
    """Windowed read of a remote COG, reprojected/resampled onto the target grid.  Returns (H, W)."""
    out = np.full((grid.height, grid.width), np.nan, dtype=dtype)
    with rasterio.Env(**GDAL_ENV), rasterio.open(href) as src:
        # window in the source CRS covering the target extent (with a small margin)
        b = transform_bounds(grid.crs, src.crs, *grid.bounds)
        win = from_bounds(*b, transform=src.transform).round_offsets().round_lengths()
        win = win.intersection(rasterio.windows.Window(0, 0, src.width, src.height))
        if win.width <= 0 or win.height <= 0:
            return out
        data = src.read(1, window=win, masked=True).astype(np.float32)
        src_t = src.window_transform(win)
        nod = np.nan
        reproject(np.where(data.mask, nod, data.data), out, src_transform=src_t, src_crs=src.crs, src_nodata=nod,
                  dst_transform=grid.transform, dst_crs=grid.crs, dst_nodata=nod, resampling=resampling)
    return out


# --------------------------------------------------------------------------- Sentinel-2
def sentinel2_composite(aoi: AOI, grid: TargetGrid, cfg: dict, acq: dict, log=print) -> tuple[np.ndarray, list[str], dict]:
    """Cloud-masked (SCL) median composite over the least-cloudy scenes.  Returns (bands, names, info)."""
    items = stac_search(cfg["stac_url"], cfg["collection"], aoi, tuple(acq["date_range"]), limit=100,
                        query={"eo:cloud_cover": {"lt": acq["max_cloud_cover_s2"]}},
                        sortby=[{"field": "properties.eo:cloud_cover", "direction": "asc"}])
    if not items:
        raise RuntimeError("no Sentinel-2 scenes matched; widen date_range or raise max_cloud_cover_s2")
    # An AOI can straddle several MGRS granules, and a granule sliver can have ~0 % cloud simply
    # because it barely overlaps the AOI.  So: compute each item's overlap with the AOI, discard
    # slivers, and take the least-cloudy ``max_scenes_s2`` items PER MGRS tile.
    from shapely.geometry import shape as _shape, box as _box
    aoi_geom = _box(*aoi.bbox_lonlat)
    by_tile: dict[str, list[dict]] = {}
    for it in items:
        try:
            ov = _shape(it["geometry"]).intersection(aoi_geom).area / aoi_geom.area
        except Exception:
            ov = 1.0
        if ov < 0.02:
            continue
        it["_overlap"] = ov
        tile = it["properties"].get("s2:mgrs_tile") or it["properties"].get("grid:code") or it["id"].split("_")[1]
        by_tile.setdefault(tile, []).append(it)
    chosen = []
    for tile, its in by_tile.items():
        its.sort(key=lambda it: it["properties"]["eo:cloud_cover"])
        chosen += its[: acq["max_scenes_s2"]]
    if not chosen:
        raise RuntimeError("no Sentinel-2 scene overlaps the AOI by >= 2 %")
    log(f"  S2 granules covering the AOI: " + ", ".join(f"{t} ({max(i['_overlap'] for i in its):.0%})" for t, its in by_tile.items()))
    items = chosen
    names = list(cfg["bands"])
    stack = np.full((len(items), len(names), grid.height, grid.width), np.nan, np.float32)
    used = []
    for k, it in enumerate(items):
        log(f"  S2 {it['id']}  cloud={it['properties']['eo:cloud_cover']:.1f}%  AOI overlap={it.get('_overlap', 1.0):.0%}")
        scl = _read_asset_to_grid(it["assets"][cfg["scl_band"]]["href"], grid, Resampling.nearest)
        bad = np.isin(scl, cfg["scl_mask_classes"]) | np.isnan(scl)
        props = it["properties"]
        baseline = float(str(props.get("s2:processing_baseline", "0")).replace("N", "") or 0)
        offset = 1000.0 if (baseline >= 4.0 and not props.get("earthsearch:boa_offset_applied", False)) else 0.0
        for bi, name in enumerate(names):
            arr = _read_asset_to_grid(it["assets"][name]["href"], grid, Resampling.bilinear)
            arr[bad] = np.nan
            arr[arr <= 0] = np.nan                     # L2A 0 = nodata
            stack[k, bi] = arr - offset                # BOA_ADD_OFFSET (baseline >= 04.00)
        used.append({"id": it["id"], "datetime": props["datetime"], "cloud_cover": props["eo:cloud_cover"],
                     "aoi_overlap": it.get("_overlap"),
                     "processing_baseline": props.get("s2:processing_baseline"), "boa_offset_subtracted_dn": offset,
                     "href_example": it["assets"][names[0]]["href"]})
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        comp = np.nanmedian(stack, axis=0)             # (bands, H, W), reflectance * 10000
    valid_frac = float(np.isfinite(comp[0]).mean())
    comp = comp / 10000.0                              # surface reflectance in [0, 1]
    idx_bands, idx_names = [], []
    for ind in cfg.get("indices", []):
        if ind == "ndvi" and {"nir", "red"} <= set(names):
            nir, red = comp[names.index("nir")], comp[names.index("red")]
            idx_bands.append((nir - red) / np.where((nir + red) == 0, np.nan, nir + red)); idx_names.append("ndvi")
        if ind == "ndwi" and {"green", "nir"} <= set(names):
            g, nir = comp[names.index("green")], comp[names.index("nir")]
            idx_bands.append((g - nir) / np.where((g + nir) == 0, np.nan, g + nir)); idx_names.append("ndwi")
    if idx_bands:
        comp = np.concatenate([comp, np.stack(idx_bands)], axis=0)
    return comp.astype(np.float32), [f"s2_{n}" for n in names] + [f"s2_{n}" for n in idx_names], \
        {"scenes": used, "valid_fraction": valid_frac, "composite": "per-pixel median after SCL masking"}


# --------------------------------------------------------------------------- Sentinel-1
def sentinel1_composite(aoi: AOI, grid: TargetGrid, cfg: dict, acq: dict, log=print) -> tuple[np.ndarray, list[str], dict]:
    """Temporal median of RTC gamma0 backscatter (VV, VH) in dB - a time-series SAR composite."""
    items = stac_search(cfg["stac_url"], cfg["collection"], aoi, tuple(acq["date_range"]), limit=100)
    if acq.get("s1_orbit", "any") != "any":
        items = [it for it in items if it["properties"].get("sat:orbit_state") == acq["s1_orbit"]]
    if not items:
        raise RuntimeError("no Sentinel-1 RTC scenes matched the AOI/date range")
    items.sort(key=lambda it: it["properties"]["datetime"])
    # spread the selection across the year
    step = max(1, len(items) // acq["max_scenes_s1"])
    items = items[::step][: acq["max_scenes_s1"]]
    sign = None
    if cfg.get("sign_assets", True):
        import planetary_computer
        sign = planetary_computer.sign
    names = list(cfg["bands"])
    stack = np.full((len(items), len(names), grid.height, grid.width), np.nan, np.float32)
    used = []
    for k, it in enumerate(items):
        log(f"  S1 {it['id']}  {it['properties']['datetime'][:10]}  {it['properties'].get('sat:orbit_state','')}")
        for bi, name in enumerate(names):
            href = it["assets"][name]["href"]
            href = sign(href) if sign else href
            arr = _read_asset_to_grid(href, grid, Resampling.bilinear)
            arr[arr <= 0] = np.nan
            stack[k, bi] = 10.0 * np.log10(arr) if cfg.get("to_db", True) else arr
        used.append({"id": it["id"], "datetime": it["properties"]["datetime"], "orbit": it["properties"].get("sat:orbit_state")})
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        comp = np.nanmedian(stack, axis=0)
    return comp.astype(np.float32), [f"s1_{n}{'_db' if cfg.get('to_db', True) else ''}" for n in names], \
        {"scenes": used, "valid_fraction": float(np.isfinite(comp[0]).mean()), "composite": "temporal median (gamma0 RTC, dB)"}


# --------------------------------------------------------------------------- write
def write_scene(path: Path, bands: np.ndarray, names: list[str], grid: TargetGrid, info: dict) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    nod = -9999.0
    arr = np.where(np.isfinite(bands), bands, nod).astype(np.float32)
    with rasterio.open(path, "w", driver="GTiff", height=grid.height, width=grid.width, count=arr.shape[0],
                       dtype="float32", crs=grid.crs, transform=grid.transform, nodata=nod, compress="deflate",
                       tiled=True, blockxsize=256, blockysize=256) as dst:
        dst.write(arr)
        for i, n in enumerate(names, 1):
            dst.set_band_description(i, n)
    path.with_suffix(".json").write_text(json.dumps({**info, "bands": names, "nodata": nod, "crs": str(grid.crs),
                                                     "width": grid.width, "height": grid.height,
                                                     "transform": list(grid.transform)[:6]}, indent=1, default=str))
    return path
