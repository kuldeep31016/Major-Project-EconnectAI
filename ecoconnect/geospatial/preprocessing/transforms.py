"""Preprocessing operations applied to tiles.  Every operation is documented in
docs/PREPROCESSING.md; nothing here resizes geospatial data by interpolation -
tiles are padded or cropped so pixel geometry is preserved.
"""
from __future__ import annotations

import json
import random
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Optional

import numpy as np
import rasterio


# --------------------------------------------------------------------------- nodata
def handle_nodata(img: np.ndarray, nodata: Optional[float]) -> tuple[np.ndarray, np.ndarray]:
    """Return (img with invalid pixels set to 0, valid mask (H, W)).
    A pixel is invalid if any band equals ``nodata`` or is non-finite."""
    finite = np.isfinite(img).all(axis=0)
    if nodata is not None:
        valid = finite & ~(img == nodata).any(axis=0)
    else:
        valid = finite
    img = np.where(np.isfinite(img), img, 0.0).astype(np.float32)
    img[:, ~valid] = 0.0
    return img, valid


# --------------------------------------------------------------------------- normalisation
@dataclass
class Normalizer:
    method: str                     # zscore | minmax
    mean: list[float]
    std: list[float]
    vmin: list[float]
    vmax: list[float]
    clip_percentiles: tuple[float, float]
    n_tiles: int

    def __call__(self, img: np.ndarray) -> np.ndarray:
        c = img.shape[0]
        if self.method == "zscore":
            m = np.asarray(self.mean[:c], np.float32)[:, None, None]
            s = np.asarray(self.std[:c], np.float32)[:, None, None]
            return ((img - m) / np.maximum(s, 1e-6)).astype(np.float32)
        if self.method == "minmax":
            lo = np.asarray(self.vmin[:c], np.float32)[:, None, None]
            hi = np.asarray(self.vmax[:c], np.float32)[:, None, None]
            return np.clip((img - lo) / np.maximum(hi - lo, 1e-6), 0, 1).astype(np.float32)
        raise ValueError(self.method)

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> "Normalizer":
        d = dict(d)
        d["clip_percentiles"] = tuple(d["clip_percentiles"])
        return cls(**d)


def fit_normalizer(paths, train_ids: list[str], *, bands: Optional[list[int]], method: str,
                   clip_percentiles=(1, 99), cache: Optional[Path] = None, nodata=None,
                   max_tiles: int = 400, seed: int = 42) -> Normalizer:
    """Per-band statistics on the TRAIN split only (never val/test -> no leakage).
    Uses a seeded sample of at most ``max_tiles`` tiles so this stays cheap on large datasets."""
    if cache is not None and cache.exists():
        d = json.loads(cache.read_text())
        if d.get("method") == method and tuple(d.get("clip_percentiles", ())) == tuple(clip_percentiles):
            return Normalizer.from_dict(d)
    rng = random.Random(seed)
    ids = list(train_ids)
    if len(ids) > max_tiles:
        ids = rng.sample(ids, max_tiles)
    per_band: list[list[np.ndarray]] = []
    meta_nodata = nodata
    if paths.metadata.exists() and meta_nodata is None:
        meta_nodata = json.loads(paths.metadata.read_text()).get("nodata")
    for tid in ids:
        with rasterio.open(paths.images / f"{tid}.tif") as src:
            img = (src.read([b + 1 for b in bands]) if bands else src.read()).astype(np.float32)
        img, valid = handle_nodata(img, meta_nodata)
        if not per_band:
            per_band = [[] for _ in range(img.shape[0])]
        for b in range(img.shape[0]):
            v = img[b][valid]
            if v.size:
                per_band[b].append(v[:: max(1, v.size // 20000)])   # subsample pixels
    mean, std, vmin, vmax = [], [], [], []
    for b, chunks in enumerate(per_band):
        v = np.concatenate(chunks) if chunks else np.zeros(1, np.float32)
        lo, hi = np.percentile(v, clip_percentiles)
        vc = np.clip(v, lo, hi)
        mean.append(float(vc.mean())); std.append(float(vc.std() + 1e-6))
        vmin.append(float(lo)); vmax.append(float(hi))
    norm = Normalizer(method, mean, std, vmin, vmax, tuple(clip_percentiles), len(ids))
    if cache is not None:
        cache.parent.mkdir(parents=True, exist_ok=True)
        cache.write_text(json.dumps(norm.to_dict(), indent=1))
    return norm


# --------------------------------------------------------------------------- geometry-preserving size
def pad_or_crop(img: np.ndarray, mask: np.ndarray, size: int, *, pad_mask_value: int = 255,
                rng: Optional[random.Random] = None) -> tuple[np.ndarray, np.ndarray]:
    """Bring (C,H,W)/(H,W) to size x size WITHOUT resampling: pad (reflect image, ignore mask)
    when smaller, centre-crop when larger.  Pixel spacing is untouched."""
    c, h, w = img.shape
    if h < size or w < size:
        ph, pw = max(0, size - h), max(0, size - w)
        img = np.pad(img, ((0, 0), (0, ph), (0, pw)), mode="reflect" if min(h, w) > 1 else "edge")
        mask = np.pad(mask, ((0, ph), (0, pw)), mode="constant", constant_values=pad_mask_value)
        h, w = img.shape[1:]
    if h > size or w > size:
        top = (h - size) // 2
        left = (w - size) // 2
        img = img[:, top: top + size, left: left + size]
        mask = mask[top: top + size, left: left + size]
    return img, mask


# --------------------------------------------------------------------------- augmentation (train only)
def train_augment(img: np.ndarray, mask: np.ndarray, cfg: dict, rng: random.Random) -> tuple[np.ndarray, np.ndarray]:
    """Geometric flips / 90-degree rotations (label-preserving) + optional brightness jitter."""
    if rng.random() < cfg.get("hflip", 0):
        img, mask = img[:, :, ::-1], mask[:, ::-1]
    if rng.random() < cfg.get("vflip", 0):
        img, mask = img[:, ::-1, :], mask[::-1, :]
    if rng.random() < cfg.get("rot90", 0):
        k = rng.choice([1, 2, 3])
        img, mask = np.rot90(img, k, axes=(1, 2)), np.rot90(mask, k)
    bj = cfg.get("brightness_jitter", 0)
    if bj:
        img = img * (1.0 + rng.uniform(-bj, bj))
    return np.ascontiguousarray(img), np.ascontiguousarray(mask)
