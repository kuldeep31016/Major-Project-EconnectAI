#!/usr/bin/env python
"""Evaluate a checkpoint on the TEST split, save metrics, confusion matrix, per-tile CSV and
qualitative panels (image | ground truth | probability | overlay).

    python scripts/evaluate.py --checkpoint outputs/segmentation/<exp>/best_model.pth --n-panels 8
"""
import argparse, csv, json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import numpy as np, torch
from ecoconnect.ml.common import resolve_training_config, prepare_data
from ecoconnect.ml.inference import load_checkpoint, predict_proba
from ecoconnect.ml.evaluation.metrics import ConfusionAccumulator
from ecoconnect.ml.evaluation.plots import save_prediction_panel, plot_confusion


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--checkpoint", required=True)
    ap.add_argument("--threshold", type=float, default=None)
    ap.add_argument("--n-panels", type=int, default=8)
    ap.add_argument("--tta", action="store_true")
    ap.add_argument("--rgb-bands", default=None, help="comma-separated 0-based band indices for display, e.g. 2,1,0")
    a = ap.parse_args()
    model, _, ck, device = load_checkpoint(a.checkpoint)
    exp_dir = Path(a.checkpoint).parent
    tcfg, dcfg = resolve_training_config(exp_dir / "config.yaml")
    datasets, loaders, info = prepare_data(dcfg, ck["mode"])
    thr = a.threshold if a.threshold is not None else tcfg["training"].get("threshold", 0.5)
    rgb = tuple(int(i) for i in a.rgb_bands.split(",")) if a.rgb_bands else None
    ds, loader = datasets["test"], loaders["test"]
    acc = ConfusionAccumulator(info["num_classes"], info["ignore_index"], thr)
    rows, panels = [], 0
    (exp_dir / "sample_predictions").mkdir(exist_ok=True)
    model.eval()
    with torch.no_grad():
        for x, y, ids in loader:
            x, y = x.to(device), y.to(device)
            logits = model(x)
            acc.update(logits, y)
            p = predict_proba(model, x, tta=a.tta)
            if p.ndim == 4:
                p = p[:, 1]
            for i, tid in enumerate(ids):
                per = ConfusionAccumulator(info["num_classes"], info["ignore_index"], thr)
                per.update(logits[i:i + 1], y[i:i + 1]); m = per.compute()
                rows.append({"tile_id": tid, "iou": m["iou"], "dice": m["dice"], "precision": m["precision"],
                             "recall": m["recall"], "f1": m["f1"], "n_valid_pixels": m["n_pixels"]})
                if panels < a.n_panels:
                    raw, gt, _ = ds.read_raw(ds.ids.index(tid))
                    save_prediction_panel(raw, gt, p[i].cpu().numpy(), exp_dir / "sample_predictions" / f"{tid}.png",
                                          threshold=thr, ignore_index=info["ignore_index"],
                                          title=f"{tid}  IoU={m['iou']:.3f}  [{ck['config'].get('mode')} run]", rgb_bands=rgb)
                    panels += 1
    test = acc.compute()
    with (exp_dir / "test_results.csv").open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
    plot_confusion(test["confusion_matrix"], exp_dir / "confusion_matrix.png")
    mp = exp_dir / "metrics.json"
    metrics = json.loads(mp.read_text()) if mp.exists() else {}
    metrics.update({"test": test, "test_threshold": thr, "test_tta": a.tta, "n_test_tiles": len(ds)})
    mp.write_text(json.dumps(metrics, indent=1))
    print(f"[{metrics.get('result_label', ck.get('mode'))}] test tiles={len(ds)}  "
          f"IoU={test['iou']:.4f} Dice={test['dice']:.4f} P={test['precision']:.4f} R={test['recall']:.4f} "
          f"F1={test['f1']:.4f} OA={test['accuracy']:.4f} kappa={test['kappa']:.4f}")
    print(f"outputs: {exp_dir}/metrics.json, test_results.csv, confusion_matrix.png, sample_predictions/")


if __name__ == "__main__":
    main()
