"""Preprocessing of retrieved Sentinel-1 data - the training conventions, reused (not re-implemented differently).

Training scenes (ecoconnect/gee/stac_acquire.sentinel1_composite + write_scene) were built as:
  linear gamma0 RTC (VV, VH) on TargetGrid.for_aoi (UTM, 10 m)  ->  values <= 0 -> NaN  ->  10*log10 (dB)
  ->  temporal nanmedian over the scenes  ->  float32 GeoTIFF, bands "s1_vv_db", "s1_vh_db", nodata -9999
The model then reads bands [0, 1] and applies the z-score normaliser stored in its checkpoint (predict_scene).
This module applies exactly those steps to Copernicus data and writes the scene with the same ``write_scene``,
so the existing predict.py / New Analysis flow can consume it unchanged.

Known, documented differences (docs/satellite/COPERNICUS_INTEGRATION.md): gamma0 terrain flattening is computed by
the CDSE processor instead of the Planetary Computer RTC product, and the default composite is the single latest
acquisition (training used a median of up to 8 acquisitions across 2020) - expect more speckle; ``composite_scenes``
> 1 takes the median of same-track acquisitions like training did.
"""
from __future__ import annotations

import json
import warnings
from pathlib import Path
from typing import Optional

import numpy as np

PREPROCESSING_VERSION = "s1grd-gamma0terrain-db-median-v1"
BAND_NAMES = ["s1_vv_db", "s1_vh_db"]            # = configs/acquisition.yaml sentinel1.bands + "_db", same order
MODEL_EXPERIMENTS = ["multi_E1_s1_b0_dev_r3", "multi_E1_s1_b0_dev_r2", "multi_E1_s1_b0_dev"]  # leakage-free r3, rebuilt r2, original
MODEL_EXPERIMENT = MODEL_EXPERIMENTS[-1]                               # reference statistics when no checkpoint exists


def model_experiment(repo_root: Optional[Path] = None) -> str:
    """SATELLITE_MODEL_EXPERIMENT, else the first known experiment whose checkpoint is on disk, else the original."""
    import os
    env = os.environ.get("SATELLITE_MODEL_EXPERIMENT", "").strip()
    if env:
        return env
    if repo_root is not None:
        for e in MODEL_EXPERIMENTS:
            if (repo_root / "outputs" / "segmentation" / e / "best_model.pth").is_file():
                return e
    return MODEL_EXPERIMENT


def to_db(linear: np.ndarray) -> np.ndarray:
    """Identical to stac_acquire.sentinel1_composite: arr[arr <= 0] = NaN; 10 * log10(arr)."""
    a = np.array(linear, dtype=np.float32, copy=True)
    a[~(a > 0)] = np.nan
    with np.errstate(divide="ignore", invalid="ignore"):
        return (10.0 * np.log10(a)).astype(np.float32)


def composite(stack_db: np.ndarray, block_rows: int = 256) -> np.ndarray:
    """(N, 2, H, W) dB -> (2, H, W) temporal nanmedian (training: np.nanmedian(stack, axis=0)).
    Computed in row blocks (identical result): one call over a whole 8-date scene blocked the API's other threads
    for seconds, so progress polls failed while a job ran."""
    out = np.empty(stack_db.shape[1:], np.float32)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        for r0 in range(0, stack_db.shape[2], block_rows):
            out[:, r0:r0 + block_rows] = np.nanmedian(stack_db[:, :, r0:r0 + block_rows], axis=0)
    return out


def training_reference(repo_root: Path, experiment: Optional[str] = None) -> Optional[dict]:
    """Band names + normaliser statistics recorded when the model was trained (experiment.json)."""
    experiment = experiment or model_experiment(repo_root)
    p = repo_root / "outputs" / "segmentation" / experiment / "experiment.json"
    if not p.exists():
        return None
    ds = json.loads(p.read_text()).get("dataset") or {}
    names = (ds.get("metadata") or {}).get("bands") or []
    idx = ds.get("bands") or list(range(len(names)))
    return {"experiment": experiment, "bands": [names[i] for i in idx if i < len(names)], "band_indices": idx,
            "nodata": ds.get("nodata"), "normalizer": ds.get("normalizer")}


def check_compatibility(band_names: list[str], ref: Optional[dict]) -> dict:
    """The model reads scene bands by index: the scene must carry the trained bands at the trained indices."""
    if not ref:
        return {"compatible": None, "reason": "training metadata (experiment.json) not found"}
    want = list(zip(ref["band_indices"], ref["bands"]))
    bad = [f"band {i} is {band_names[i] if i < len(band_names) else 'missing'}, model expects {n}"
           for i, n in want if i >= len(band_names) or band_names[i] != n]
    return {"compatible": not bad, "reason": "; ".join(bad) or "bands and order match the training scenes",
            "expected": ref["bands"]}


def distribution_check(bands_db: np.ndarray, ref: Optional[dict]) -> dict:
    """Compare the scene's dB statistics with the training normaliser (mean/std, p1/p99). A large shift means the
    model sees inputs unlike its training data - a reason for manual review, not something to silently correct."""
    out: dict = {"valid_fraction": float(np.isfinite(bands_db[0]).mean()) if bands_db.size else 0.0, "bands": []}
    norm = (ref or {}).get("normalizer") or {}
    for i, name in enumerate(BAND_NAMES):
        v = bands_db[i][np.isfinite(bands_db[i])]
        row = {"band": name, "n": int(v.size)}
        if v.size:
            row.update({"mean_db": round(float(v.mean()), 3), "std_db": round(float(v.std()), 3),
                        "p1_db": round(float(np.percentile(v, 1)), 3), "p99_db": round(float(np.percentile(v, 99)), 3)})
            if norm.get("mean") and norm.get("std") and i < len(norm["mean"]):
                m, s = float(norm["mean"][i]), float(norm["std"][i])
                row.update({"train_mean_db": round(m, 3), "train_std_db": round(s, 3),
                            "mean_shift_sd": round((row["mean_db"] - m) / s, 3) if s else None})
        out["bands"].append(row)
    shifts = [abs(b["mean_shift_sd"]) for b in out["bands"] if b.get("mean_shift_sd") is not None]
    out["max_mean_shift_sd"] = round(max(shifts), 3) if shifts else None
    out["review_recommended"] = bool(shifts and max(shifts) > 1.0) or out["valid_fraction"] < 0.5
    out["note"] = ("Input statistics are within 1 SD of the training data." if shifts and not out["review_recommended"]
                   else "Input differs from the training data or has little valid coverage - manual review recommended."
                   if shifts else "No training statistics available for comparison.")
    return out


def write_nrt_scene(path: Path, bands_db: np.ndarray, grid, info: dict) -> Path:
    """Same writer as the acquisition stage (float32, nodata -9999, band descriptions, .json sidecar)."""
    from ecoconnect.gee.stac_acquire import write_scene
    return write_scene(path, bands_db, BAND_NAMES, grid, {**info, "preprocessing_version": PREPROCESSING_VERSION})
