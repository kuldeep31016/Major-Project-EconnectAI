"""Weak labels from Global Mangrove Watch v3.0 (Bunting et al. 2022, CC-BY-4.0, Zenodo 6894273).

The yearly GeoTIFF zip (~66 MB, global) is downloaded ONCE into ${DATA_ROOT}/raw/gmw and only
the 1-degree tiles intersecting the AOI are extracted, mosaicked and reprojected (nearest) onto
the scene grid:  1 = mangrove, 0 = not mangrove, 255 = outside GMW tile coverage.

GMW is an existing, imperfect map -> this is weak supervision, as in the foundation study.
"""
from __future__ import annotations

import json
import math
import os
import re
import urllib.request
import zipfile
from pathlib import Path

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.merge import merge
from rasterio.warp import reproject

from .stac_acquire import AOI, TargetGrid, _ensure_certs

ZENODO_API = "https://zenodo.org/api/records/{record}"


def _download(url: str, dest: Path, log=print) -> Path:
    _ensure_certs()
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 0:
        log(f"  cached {dest.name} ({dest.stat().st_size/1e6:.1f} MB)")
        return dest
    log(f"  downloading {url} -> {dest}")
    req = urllib.request.Request(url, headers={"User-Agent": "ecoconnect/0.1"})
    with urllib.request.urlopen(req, timeout=120) as r, open(dest.with_suffix(".part"), "wb") as f:
        total = int(r.headers.get("Content-Length") or 0)
        done = 0
        while chunk := r.read(1 << 20):
            f.write(chunk)
            done += len(chunk)
            if total:
                print(f"\r  {done/1e6:6.1f}/{total/1e6:.1f} MB", end="")
        print()
    dest.with_suffix(".part").rename(dest)
    return dest


def gmw_tile_names(aoi: AOI) -> list[str]:
    """GMW tiles are 1-degree cells named by their NORTHERN edge latitude and WESTERN edge longitude
    (verified on the v3 archive: N00E008 spans lat -1..0, N01E006 spans 0..1, S01E008 spans -2..-1,
    N09E076 spans 8..9)."""
    min_lat, min_lon, max_lat, max_lon = aoi.bbox
    names = []
    for lat in range(math.floor(min_lat), math.ceil(max_lat)):      # lat = southern edge of the band
        top = lat + 1
        lat_tag = f"N{top:02d}" if top >= 0 else f"S{-top:02d}"
        for lon in range(math.floor(min_lon), math.ceil(max_lon)):  # lon = western edge
            lon_tag = f"E{lon:03d}" if lon >= 0 else f"W{-lon:03d}"
            names.append(f"{lat_tag}{lon_tag}")
    return names


def gmw_labels_for_grid(aoi: AOI, grid: TargetGrid, cfg: dict, log=print) -> tuple[np.ndarray, dict]:
    cache = Path(os.path.expandvars(cfg["cache_dir"]))
    if "${" in str(cache):
        cache = Path(os.environ["DATA_ROOT"]) / "raw" / "gmw"
    zip_path = cache / cfg["gmw_file"]
    if not zip_path.exists():
        _ensure_certs()
        rec = json.loads(urllib.request.urlopen(ZENODO_API.format(record=cfg["gmw_zenodo_record"]), timeout=60).read())
        url = next(f["links"]["self"] for f in rec["files"] if f["key"] == cfg["gmw_file"])
        _download(url, zip_path, log)

    wanted = gmw_tile_names(aoi)
    tiles = []
    with zipfile.ZipFile(zip_path) as z:
        members = z.namelist()
        for name in wanted:
            hits = [m for m in members if re.search(rf"{name}_{cfg['gmw_year']}", m) and m.endswith(".tif")]
            for m in hits:
                out = cache / "tiles" / Path(m).name
                if not out.exists():
                    out.parent.mkdir(parents=True, exist_ok=True)
                    out.write_bytes(z.read(m))
                tiles.append(out)
    log(f"  GMW tiles for {wanted}: {[t.name for t in tiles] or 'NONE (no mangrove tile here)'}")

    label = np.full((grid.height, grid.width), 255, np.uint8)
    if tiles:
        srcs = [rasterio.open(t) for t in tiles]
        mosaic, mtrans = merge(srcs, nodata=0)
        crs = srcs[0].crs
        for s in srcs:
            s.close()
        mang = (mosaic[0] == 1).astype(np.uint8)
        # everything inside a GMW tile is labelled: 1 mangrove / 0 not
        dst = np.full((grid.height, grid.width), 255, np.uint8)
        reproject(mang, dst, src_transform=mtrans, src_crs=crs, src_nodata=None,
                  dst_transform=grid.transform, dst_crs=grid.crs, dst_nodata=255, resampling=Resampling.nearest)
        covered = np.zeros_like(mang, dtype=np.uint8) + 1
        cov = np.zeros((grid.height, grid.width), np.uint8)
        reproject(covered, cov, src_transform=mtrans, src_crs=crs, src_nodata=0,
                  dst_transform=grid.transform, dst_crs=grid.crs, dst_nodata=0, resampling=Resampling.nearest)
        label = np.where(cov == 1, dst, 255).astype(np.uint8)
    info = {"source": "Global Mangrove Watch v3.0", "year": cfg["gmw_year"], "zenodo_record": cfg["gmw_zenodo_record"],
            "license": "CC-BY-4.0", "tiles": [t.name for t in tiles], "classes": {"0": "non-mangrove", "1": "mangrove", "255": "outside GMW coverage"},
            "mangrove_fraction_of_labelled": float((label == 1).sum() / max((label != 255).sum(), 1)),
            "labelled_fraction": float((label != 255).mean()),
            "supervision": "WEAK - existing published map, not field ground truth"}
    return label, info
