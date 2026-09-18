"""Inference: pixel probabilities P_i(c) (paper Eq. 1) for tiles or whole scenes.

    predict_proba(model, x)              -> (B, H, W) habitat probability (binary) or (B, C, H, W)
    predict_scene(checkpoint, scene.tif) -> probability GeoTIFF (float32), confidence GeoTIFF,
                                            binary GeoTIFF at a CONFIGURABLE threshold
Whole scenes are processed with an overlapping sliding window and blended with a
Hann-like weight so tile seams do not appear.  Nodata pixels stay nodata.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

import numpy as np
import rasterio
import torch

from ecoconnect.geospatial.preprocessing.transforms import Normalizer, handle_nodata
from ecoconnect.geospatial.raster_processing.io import RasterMeta, write_raster
from ecoconnect.ml.models.unet import build_model, pick_device
from ecoconnect.pipeline.config import portable_path


def load_checkpoint(path: str | Path, device: Optional[torch.device] = None):
    device = device or pick_device()
    ck = torch.load(path, map_location=device, weights_only=False)
    meta, ds = ck["eco_meta"], ck["dataset"]
    model = build_model(meta["encoder"], meta["in_channels"], meta["num_classes"], encoder_weights=None)
    model.load_state_dict(ck["model"])
    model.to(device).eval()
    norm = Normalizer.from_dict(ds["normalizer"]) if ds.get("normalizer") else None
    return model, norm, ck, device


@torch.no_grad()
def predict_proba(model: torch.nn.Module, x: torch.Tensor, tta: bool = False) -> torch.Tensor:
    """Soft probabilities.  Binary models -> (B, H, W); multi-class -> (B, C, H, W).
    ``tta`` averages predictions over horizontal/vertical flips (as in the foundation study)."""
    def _one(inp):
        logits = model(inp)
        return torch.sigmoid(logits[:, 0]) if logits.shape[1] == 1 else torch.softmax(logits, 1)

    p = _one(x)
    if tta:
        p = p + _one(x.flip(-1)).flip(-1) + _one(x.flip(-2)).flip(-2)
        p = p / 3.0
    return p


def _window_weight(size: int) -> np.ndarray:
    w = np.hanning(size + 2)[1:-1].astype(np.float32)
    w = np.clip(w, 0.05, None)
    return np.outer(w, w)


def predict_scene(
    checkpoint: str | Path,
    scene_path: str | Path,
    out_prob: str | Path,
    *,
    tile: int = 256,
    overlap: int = 64,
    batch_size: int = 8,
    bands: Optional[list[int]] = None,
    threshold: float = 0.5,
    tta: bool = False,
    write_binary: bool = True,
    write_confidence: bool = True,
) -> dict:
    model, norm, ck, device = load_checkpoint(checkpoint)
    ds_info = ck["dataset"]
    bands = bands if bands is not None else ds_info.get("bands")
    with rasterio.open(scene_path) as src:
        img = (src.read([b + 1 for b in bands]) if bands else src.read()).astype(np.float32)
        meta = RasterMeta(src.crs, src.transform, src.width, src.height, src.nodata, src.count, "float32")
    if img.shape[0] != ck["eco_meta"]["in_channels"]:
        raise ValueError(f"scene has {img.shape[0]} bands but the model expects {ck['eco_meta']['in_channels']}")
    img, valid = handle_nodata(img, ds_info.get("nodata", meta.nodata))
    if norm is not None:
        img = norm(img)

    C, H, W = img.shape
    stride = tile - overlap
    pad_h = (-(H - tile) % stride) if H > tile else tile - H
    pad_w = (-(W - tile) % stride) if W > tile else tile - W
    imgp = np.pad(img, ((0, 0), (0, pad_h), (0, pad_w)), mode="reflect")
    Hp, Wp = imgp.shape[1:]
    acc = np.zeros((Hp, Wp), np.float32)
    wsum = np.zeros((Hp, Wp), np.float32)
    weight = _window_weight(tile)

    coords = [(r, c) for r in range(0, Hp - tile + 1, stride) for c in range(0, Wp - tile + 1, stride)]
    for i in range(0, len(coords), batch_size):
        chunk = coords[i: i + batch_size]
        x = torch.from_numpy(np.stack([imgp[:, r: r + tile, c: c + tile] for r, c in chunk])).to(device)
        p = predict_proba(model, x, tta=tta)
        if p.ndim == 4:                       # multi-class -> habitat = class 1 probability
            p = p[:, 1]
        p = p.float().cpu().numpy()
        for (r, c), pi in zip(chunk, p):
            acc[r: r + tile, c: c + tile] += pi * weight
            wsum[r: r + tile, c: c + tile] += weight
    prob = (acc / np.maximum(wsum, 1e-6))[:H, :W]
    prob = np.where(valid, prob, np.nan).astype(np.float32)

    out_prob = Path(out_prob)
    write_raster(out_prob, prob, meta, dtype="float32", nodata=np.nan)
    outputs = {"probability": str(out_prob)}
    if write_confidence:
        conf = np.where(valid, np.abs(prob - 0.5) * 2, np.nan).astype(np.float32)   # 0 = uncertain, 1 = certain
        p2 = out_prob.with_name(out_prob.stem.replace("_prob", "") + "_confidence.tif")
        write_raster(p2, conf, meta, dtype="float32", nodata=np.nan)
        outputs["confidence"] = str(p2)
    if write_binary:
        binary = np.where(valid, (prob >= threshold).astype(np.uint8), 255).astype(np.uint8)
        p3 = out_prob.with_name(out_prob.stem.replace("_prob", "") + f"_binary_t{threshold:.2f}.tif")
        write_raster(p3, binary, meta, dtype="uint8", nodata=255)
        outputs["binary"] = str(p3)
    side = {
        "checkpoint": portable_path(checkpoint), "experiment_id": ck.get("experiment_id"), "mode": ck.get("mode"),
        "model": ck["eco_meta"], "scene": portable_path(scene_path), "threshold": threshold, "tta": tta,
        "tile": tile, "overlap": overlap, "valid_fraction": float(valid.mean()),
        "habitat_fraction_at_threshold": float(np.nanmean(prob >= threshold)) if valid.any() else 0.0,
        "outputs": outputs,
    }
    out_prob.with_suffix(".json").write_text(json.dumps(side, indent=1))
    return side
