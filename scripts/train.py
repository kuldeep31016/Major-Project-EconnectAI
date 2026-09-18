#!/usr/bin/env python
"""Train the habitat segmentation model.

    python scripts/train.py --config configs/train_dev.yaml            # MODE A (laptop, subset)
    python scripts/train.py --config configs/train_full.yaml           # MODE B (GPU, UNB7)
    python scripts/train.py --config configs/train_dev.yaml --smoke    # 2 epochs x 3 batches sanity check
"""
import argparse, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ecoconnect.ml.common import resolve_training_config, prepare_data, output_root
from ecoconnect.ml.training import train


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--config", required=True)
    ap.add_argument("--experiment-id", default=None)
    ap.add_argument("--resume", default=None, help="path to last_model.pth")
    ap.add_argument("--smoke", action="store_true", help="2 epochs, 3 batches/epoch - verifies the pipeline only")
    a = ap.parse_args()
    tcfg, dcfg = resolve_training_config(a.config)
    if a.smoke:
        tcfg["training"].update(epochs=2, max_train_batches_per_epoch=3)
        tcfg["mode"] = "development"
    _, loaders, info = prepare_data(dcfg, tcfg["mode"])
    train(tcfg, loaders, info, mode=tcfg["mode"], out_root=output_root(tcfg), experiment_id=a.experiment_id,
          resume=Path(a.resume) if a.resume else None)


if __name__ == "__main__":
    main()
