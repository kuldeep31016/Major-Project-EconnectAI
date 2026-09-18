"""Shared helpers for the CLI scripts: resolve configs, build data, describe the dataset."""
from __future__ import annotations

from pathlib import Path

from ecoconnect.ml.datasets import build_datasets, build_loaders
from ecoconnect.pipeline.config import load_config, REPO_ROOT


def _deep_update(base: dict, upd: dict) -> dict:
    for k, v in (upd or {}).items():
        if isinstance(v, dict) and isinstance(base.get(k), dict):
            _deep_update(base[k], v)
        else:
            base[k] = v
    return base


def resolve_training_config(path: str | Path) -> tuple[dict, dict]:
    """Return (train_cfg, dataset_cfg) with dataset_overrides applied."""
    tcfg = load_config(path)
    dcfg = load_config(tcfg.get("dataset_config", "configs/dataset.yaml"))
    _deep_update(dcfg, tcfg.get("dataset_overrides", {}))
    return tcfg, dcfg


def prepare_data(dcfg: dict, mode: str):
    datasets, normalizer, paths = build_datasets(dcfg, mode)
    loaders = build_loaders(datasets, dcfg)
    x, _, _ = datasets["train"][0]
    info = {
        "name": dcfg["dataset"]["name"], "root": str(paths.root), "mode": mode,
        "in_channels": int(x.shape[0]), "image_size": dcfg["dataset"]["image_size"],
        "bands": dcfg["dataset"]["bands"], "num_classes": dcfg["dataset"]["num_classes"],
        "ignore_index": dcfg["dataset"]["ignore_index"], "nodata": datasets["train"].nodata,
        "n_train": len(datasets["train"]), "n_val": len(datasets["val"]), "n_test": len(datasets["test"]),
        "normalizer": normalizer.to_dict() if normalizer else None,
        "metadata": datasets["train"].meta,
    }
    return datasets, loaders, info


def output_root(tcfg: dict) -> Path:
    p = Path(tcfg.get("output_root", "outputs/segmentation"))
    return p if p.is_absolute() else REPO_ROOT / p
