"""Lazy tile dataset over the canonical layout (configs/dataset.yaml, docs/DATASET_SETUP.md).

* Nothing is loaded into RAM up front: each ``__getitem__`` opens exactly one image tile and
  one mask tile with rasterio.
* Splits come from text files; DEV mode truncates them deterministically (seeded shuffle then
  head) so the same subset is used every run.
* Normalisation statistics are computed on the TRAIN split only and cached to ``stats.json``.
* Augmentation is applied to the train split only.
"""
from __future__ import annotations

import json
import os
import random
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import numpy as np
import rasterio
import torch
from torch.utils.data import Dataset, DataLoader

from ecoconnect.geospatial.preprocessing.transforms import (
    Normalizer, fit_normalizer, pad_or_crop, train_augment, handle_nodata,
)


@dataclass
class DatasetPaths:
    root: Path
    images: Path
    masks: Path
    splits: dict[str, Path]
    metadata: Path
    stats: Path

    @classmethod
    def from_config(cls, cfg: dict) -> "DatasetPaths":
        d = cfg["dataset"]
        data_root = os.path.expandvars(str(d.get("data_root", "${DATA_ROOT}")))
        if "${" in data_root or not data_root:
            data_root = os.environ.get("DATA_ROOT", "")
        if not data_root:
            raise EnvironmentError("DATA_ROOT is not set (export DATA_ROOT=/path or add it to .env)")
        root = Path(data_root) / d["name"]
        return cls(
            root=root, images=root / "tiles" / "images", masks=root / "tiles" / "masks",
            splits={k: root / v for k, v in cfg["splits"].items()},
            metadata=root / "metadata.json", stats=root / "stats.json",
        )

    def exists(self) -> bool:
        return self.images.exists() and self.masks.exists() and self.metadata.exists()


def read_split(path: Path, max_samples: Optional[int], seed: int) -> list[str]:
    ids = [l.strip() for l in path.read_text().splitlines() if l.strip() and not l.startswith("#")]
    if max_samples is not None and len(ids) > max_samples:
        rng = random.Random(seed)
        ids = sorted(ids)
        rng.shuffle(ids)
        ids = sorted(ids[:max_samples])
    return ids


class TileDataset(Dataset):
    def __init__(
        self,
        paths: DatasetPaths,
        split: str,
        *,
        image_size: int,
        bands: Optional[list[int]],
        num_classes: int,
        ignore_index: int,
        normalizer: Optional[Normalizer],
        augment_cfg: Optional[dict] = None,
        max_samples: Optional[int] = None,
        seed: int = 42,
        nodata_value: Optional[float] = None,
    ) -> None:
        self.paths = paths
        self.split = split
        self.ids = read_split(paths.splits[split], max_samples, seed)
        self.image_size = image_size
        self.bands = bands
        self.num_classes = num_classes
        self.ignore_index = ignore_index
        self.normalizer = normalizer
        self.augment_cfg = augment_cfg if split == "train" else None
        self.meta = json.loads(paths.metadata.read_text()) if paths.metadata.exists() else {}
        self.nodata = nodata_value if nodata_value is not None else self.meta.get("nodata")
        self.seed = seed
        missing = [i for i in self.ids if not (paths.images / f"{i}.tif").exists() or not (paths.masks / f"{i}.tif").exists()]
        if missing:
            raise FileNotFoundError(f"{len(missing)} tile(s) in split {split!r} missing on disk, e.g. {missing[:3]}")

    def __len__(self) -> int:
        return len(self.ids)

    def read_raw(self, idx: int) -> tuple[np.ndarray, np.ndarray, dict]:
        tid = self.ids[idx]
        with rasterio.open(self.paths.images / f"{tid}.tif") as src:
            img = src.read([b + 1 for b in self.bands]) if self.bands else src.read()
            info = {"id": tid, "crs": str(src.crs), "transform": list(src.transform)[:6]}
        with rasterio.open(self.paths.masks / f"{tid}.tif") as src:
            mask = src.read(1)
        return img.astype(np.float32), mask, info

    def __getitem__(self, idx: int):
        img, mask, info = self.read_raw(idx)
        img, valid = handle_nodata(img, self.nodata)
        mask = mask.astype(np.int64)
        mask[~valid] = self.ignore_index                       # never learn from nodata pixels
        if self.normalizer is not None:
            img = self.normalizer(img)
        img, mask = pad_or_crop(img, mask, self.image_size, pad_mask_value=self.ignore_index)
        if self.augment_cfg:
            img, mask = train_augment(img, mask, self.augment_cfg, rng=random.Random(self.seed + idx * 7919 + random.randrange(1 << 30)))
        x = torch.from_numpy(np.ascontiguousarray(img))
        if self.num_classes == 1:
            y = torch.from_numpy(np.ascontiguousarray(mask)).float()
            y[mask == self.ignore_index] = float(self.ignore_index)
        else:
            y = torch.from_numpy(np.ascontiguousarray(mask))
        return x, y, info["id"]


def build_datasets(cfg: dict, mode: str = "development") -> tuple[dict[str, TileDataset], Normalizer, DatasetPaths]:
    """Return {split: dataset}, the fitted normalizer and the resolved paths."""
    if mode not in ("development", "full"):
        raise ValueError("mode must be 'development' or 'full'")
    paths = DatasetPaths.from_config(cfg)
    if not paths.exists():
        raise FileNotFoundError(
            f"dataset not found at {paths.root}. Expected tiles/images, tiles/masks, metadata.json "
            f"(see docs/DATASET_SETUP.md).")
    d, limits, seed = cfg["dataset"], cfg[mode], cfg["loader"]["seed"]

    normalizer = None
    if d["normalization"] != "none":
        train_ids = read_split(paths.splits["train"], limits["max_train_samples"], seed)
        normalizer = fit_normalizer(
            paths, train_ids, bands=d["bands"], method=d["normalization"],
            clip_percentiles=tuple(d["clip_percentiles"]), cache=paths.stats, nodata=d.get("nodata_value"),
        )
    common = dict(image_size=d["image_size"], bands=d["bands"], num_classes=d["num_classes"],
                  ignore_index=d["ignore_index"], normalizer=normalizer, seed=seed, nodata_value=d.get("nodata_value"))
    ds = {
        "train": TileDataset(paths, "train", augment_cfg=cfg.get("augmentation"), max_samples=limits["max_train_samples"], **common),
        "val": TileDataset(paths, "val", max_samples=limits["max_val_samples"], **common),
        "test": TileDataset(paths, "test", max_samples=limits["max_test_samples"], **common),
    }
    return ds, normalizer, paths


def build_loaders(datasets: dict[str, TileDataset], cfg: dict) -> dict[str, DataLoader]:
    L = cfg["loader"]
    g = torch.Generator()
    g.manual_seed(L["seed"])
    return {
        split: DataLoader(
            ds, batch_size=L["batch_size"], shuffle=(split == "train"), num_workers=L["num_workers"],
            pin_memory=L["pin_memory"], drop_last=False, generator=g if split == "train" else None,
            persistent_workers=L["num_workers"] > 0,
        )
        for split, ds in datasets.items()
    }
