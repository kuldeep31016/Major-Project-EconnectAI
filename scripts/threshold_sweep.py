#!/usr/bin/env python
"""Experiment 2 - probability-threshold calibration against the (weak) GMW reference.

For each threshold t in a grid, the whole-scene probability map is binarised (p >= t) and compared with the
label raster on the TEST-split tiles only (so the sweep does not touch training/validation pixels):
IoU, Dice, precision, recall, F1, plus the number of patches >= MMU that would result.

    python scripts/threshold_sweep.py --prob outputs/segmentation/<exp>/predictions/kerala-coast_prob.tif \
        --label data/labels/kerala-coast/gmw_2020.tif --experiment outputs/segmentation/<exp> \
        --criterion f1

The threshold with the best value of --criterion is written to <exp>/threshold_calibration.json together with
the whole table and a PNG.  It measures agreement with the reference map, not field-truth accuracy.
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import numpy as np  # noqa: E402
import rasterio  # noqa: E402
from rasterio.windows import from_bounds  # noqa: E402
from scipy import ndimage  # noqa: E402

from ecoconnect.geospatial.raster_processing.io import RasterMeta, pixel_area_ha  # noqa: E402


def test_mask_from_split(prob_meta: RasterMeta, tiles_dir: Path, test_ids: list[str]) -> np.ndarray:
    """Boolean (H, W) mask of pixels covered by TEST tiles (so the sweep is held-out)."""
    m = np.zeros((prob_meta.height, prob_meta.width), bool)
    for tid in test_ids:
        with rasterio.open(tiles_dir / f"{tid}.tif") as t:
            win = from_bounds(*t.bounds, transform=prob_meta.transform).round_offsets().round_lengths()
        r0, c0 = max(int(win.row_off), 0), max(int(win.col_off), 0)
        r1, c1 = min(r0 + int(win.height), m.shape[0]), min(c0 + int(win.width), m.shape[1])
        m[r0:r1, c0:c1] = True
    return m


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--prob", required=True); ap.add_argument("--label", required=True)
    ap.add_argument("--experiment", required=True, help="experiment dir (for output + split files)")
    ap.add_argument("--dataset-root", default=None, help="canonical dataset root; default from experiment.json")
    ap.add_argument("--thresholds", default="0.30,0.35,0.40,0.45,0.50,0.55,0.60,0.65,0.70")
    ap.add_argument("--criterion", default="f1", choices=["f1", "iou", "dice"])
    ap.add_argument("--mmu-ha", type=float, default=2.0)
    ap.add_argument("--all-pixels", action="store_true", help="evaluate on all labelled pixels instead of test tiles")
    a = ap.parse_args()
    exp = Path(a.experiment)

    with rasterio.open(a.prob) as s:
        prob = s.read(1).astype(np.float32)
        meta = RasterMeta(s.crs, s.transform, s.width, s.height, s.nodata, 1, "float32")
    with rasterio.open(a.label) as s:
        if (s.width, s.height) != (meta.width, meta.height):
            sys.exit("label raster must be on the probability grid (use the aligned label from acquisition)")
        label = s.read(1)
    valid = np.isfinite(prob) & (label != 255)

    ds_root = a.dataset_root
    if not ds_root and (exp / "experiment.json").exists():
        ds_root = json.loads((exp / "experiment.json").read_text())["dataset"]["root"]
    scope = "all labelled pixels"
    if not a.all_pixels and ds_root and (Path(ds_root) / "splits" / "test.txt").exists():
        ids = [l.strip() for l in (Path(ds_root) / "splits" / "test.txt").read_text().splitlines() if l.strip()]
        valid &= test_mask_from_split(meta, Path(ds_root) / "tiles" / "images", ids)
        scope = f"test-split tiles only ({len(ids)} tiles)"

    area = np.broadcast_to(pixel_area_ha(meta)[:, None], prob.shape)
    ref = label[valid] == 1
    rows = []
    for t in [float(x) for x in a.thresholds.split(",")]:
        pred = prob[valid] >= t
        tp = int((pred & ref).sum()); fp = int((pred & ~ref).sum()); fn = int((~pred & ref).sum())
        prec = tp / (tp + fp) if tp + fp else 0.0
        rec = tp / (tp + fn) if tp + fn else 0.0
        f1 = 2 * prec * rec / (prec + rec) if prec + rec else 0.0
        iou = tp / (tp + fp + fn) if tp + fp + fn else 0.0
        binary = np.isfinite(prob) & (prob >= t)
        lab, n = ndimage.label(binary, structure=np.ones((3, 3)))
        areas = ndimage.sum(area, lab, np.arange(1, n + 1)) if n else np.array([])
        rows.append({"threshold": t, "iou": iou, "dice": f1, "precision": prec, "recall": rec, "f1": f1,
                     "tp": tp, "fp": fp, "fn": fn, "n_components": int(n),
                     "n_patches_ge_mmu": int((areas >= a.mmu_ha).sum()), "habitat_area_ha": float(areas.sum())})
    best = max(rows, key=lambda r: r[a.criterion])
    out = {"scope": scope, "reference": "Global Mangrove Watch v3 (weak label) - agreement, not field-truth accuracy",
           "criterion": a.criterion, "selected_threshold": best["threshold"], "mmu_ha": a.mmu_ha,
           "probability_raster": str(Path(a.prob).resolve()), "rows": rows}
    (exp / "threshold_calibration.json").write_text(json.dumps(out, indent=1))
    with (exp / "threshold_calibration.csv").open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
    try:
        import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
        fig, ax = plt.subplots(figsize=(6, 4))
        for k in ("iou", "f1", "precision", "recall"):
            ax.plot([r["threshold"] for r in rows], [r[k] for r in rows], marker="o", label=k)
        ax.axvline(best["threshold"], ls="--", c="k", lw=0.8); ax.set_xlabel("threshold"); ax.set_ylim(0, 1)
        ax.set_title(f"Threshold calibration vs GMW ({scope})"); ax.legend(); ax.grid(alpha=0.3)
        fig.tight_layout(); fig.savefig(exp / "threshold_calibration.png", dpi=130)
    except Exception as e:
        print("plot skipped:", e)
    print(f"scope: {scope}")
    print(f"{'thr':>5} {'IoU':>6} {'F1':>6} {'P':>6} {'R':>6} {'#patches>=MMU':>14} {'habitat ha':>11}")
    for r in rows:
        flag = " <- selected" if r is best else ""
        print(f"{r['threshold']:5.2f} {r['iou']:6.3f} {r['f1']:6.3f} {r['precision']:6.3f} {r['recall']:6.3f} "
              f"{r['n_patches_ge_mmu']:14d} {r['habitat_area_ha']:11.0f}{flag}")
    print(f"written: {exp}/threshold_calibration.{{json,csv,png}}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
