#!/usr/bin/env python
"""Validate a checkpoint on the validation split (metrics only, no training).

    python scripts/validate.py --checkpoint outputs/segmentation/<exp>/best_model.pth
"""
import argparse, json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import torch
from ecoconnect.ml.common import resolve_training_config, prepare_data
from ecoconnect.ml.inference import load_checkpoint
from ecoconnect.ml.evaluation import build_loss
from ecoconnect.ml.training import run_eval


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--checkpoint", required=True)
    ap.add_argument("--split", default="val", choices=["val", "test", "train"])
    ap.add_argument("--threshold", type=float, default=None)
    a = ap.parse_args()
    model, _, ck, device = load_checkpoint(a.checkpoint)
    exp_dir = Path(a.checkpoint).parent
    tcfg, dcfg = resolve_training_config(exp_dir / "config.yaml")
    _, loaders, info = prepare_data(dcfg, ck["mode"])
    thr = a.threshold if a.threshold is not None else tcfg["training"].get("threshold", 0.5)
    loss_fn = build_loss(info["num_classes"], info["ignore_index"], tcfg["training"].get("loss", "bce_dice"))
    loss, m = run_eval(model, loaders[a.split], loss_fn, device, info["num_classes"], info["ignore_index"], thr)
    print(json.dumps({"split": a.split, "n_tiles": len(loaders[a.split].dataset), "loss": loss, "threshold": thr,
                      "result_label": ck["config"].get("mode"), **{k: m[k] for k in ("iou", "dice", "precision", "recall", "f1", "accuracy", "kappa")}}, indent=1))


if __name__ == "__main__":
    main()
