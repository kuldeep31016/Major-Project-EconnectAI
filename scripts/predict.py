#!/usr/bin/env python
"""Run whole-scene inference -> probability / confidence / binary GeoTIFFs.

    python scripts/predict.py --checkpoint outputs/segmentation/<exp>/best_model.pth \
        --input data/scenes/kerala-coast/<scene>.tif --output outputs/segmentation/<exp>/predictions/kerala-coast_prob.tif
"""
import argparse, json, os, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ecoconnect.ml.inference import predict_scene


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--checkpoint", required=True)
    ap.add_argument("--input", required=True, help="preprocessed scene GeoTIFF (same bands as training)")
    ap.add_argument("--output", required=True, help="probability GeoTIFF path (…_prob.tif)")
    ap.add_argument("--threshold", type=float, default=float(os.environ.get("SEGMENTATION_THRESHOLD", 0.5)))
    ap.add_argument("--tile", type=int, default=256)
    ap.add_argument("--overlap", type=int, default=64)
    ap.add_argument("--batch-size", type=int, default=8)
    ap.add_argument("--tta", action="store_true")
    a = ap.parse_args()
    side = predict_scene(a.checkpoint, a.input, a.output, tile=a.tile, overlap=a.overlap, batch_size=a.batch_size,
                         threshold=a.threshold, tta=a.tta)
    print(json.dumps(side, indent=1))


if __name__ == "__main__":
    main()
