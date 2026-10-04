#!/usr/bin/env python
"""Experiment 2 - probability-threshold calibration against the (weak) GMW reference.

For each threshold t in a grid, the whole-scene probability map is binarised (p >= t) and compared with the
label raster on held-out tiles. The threshold is SELECTED on the VALIDATION split (default) and the TEST split is
then reported once at that threshold, so the reported test score is not tuned on test data (audit bug 22; before
2026-10-04 the threshold was selected and reported on the test split). IoU, Dice, precision, recall, F1, plus the
number of patches >= MMU that would result.

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
    rb = prob_meta.bounds
    for tid in test_ids:
        with rasterio.open(tiles_dir / f"{tid}.tif") as t:
            if t.crs != prob_meta.crs:
                continue                                     # tile belongs to another study area
            tb = t.bounds
            if tb.right <= rb[0] or tb.left >= rb[2] or tb.top <= rb[1] or tb.bottom >= rb[3]:
                continue                                     # outside this raster
            win = from_bounds(*t.bounds, transform=prob_meta.transform).round_offsets().round_lengths()
        r0, c0 = max(int(win.row_off), 0), max(int(win.col_off), 0)
        r1, c1 = min(r0 + int(win.height), m.shape[0]), min(c0 + int(win.width), m.shape[1])
        m[r0:r1, c0:c1] = True
    return m


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--prob", required=True, action="append", help="probability raster (repeat with --label to pool several areas)")
    ap.add_argument("--label", required=True, action="append", help="aligned label raster, one per --prob")
    ap.add_argument("--experiment", required=True, help="experiment dir (for output + split files)")
    ap.add_argument("--dataset-root", default=None, help="canonical dataset root; default from experiment.json")
    ap.add_argument("--thresholds", default="0.30,0.35,0.40,0.45,0.50,0.55,0.60,0.65,0.70,0.75,0.80,0.85,0.90")
    ap.add_argument("--select-split", default="val", choices=["val", "test"],
                    help="split the threshold is chosen on (val = held-out selection; test = legacy behaviour)")
    ap.add_argument("--criterion", default="f1", choices=["f1", "iou", "dice"])
    ap.add_argument("--mmu-ha", type=float, default=2.0)
    ap.add_argument("--all-pixels", action="store_true", help="evaluate on all labelled pixels instead of test tiles")
    a = ap.parse_args()
    exp = Path(a.experiment)

    if len(a.prob) != len(a.label):
        sys.exit("give one --label per --prob")
    ds_root = a.dataset_root
    if not ds_root and (exp / "experiment.json").exists():
        ds_root = json.loads((exp / "experiment.json").read_text())["dataset"]["root"]
    split_ids: dict[str, list[str]] = {}
    for sp in ("val", "test"):
        f = Path(ds_root) / "splits" / f"{sp}.txt" if ds_root else None
        if not a.all_pixels and f is not None and f.exists():
            split_ids[sp] = [l.strip() for l in f.read_text().splitlines() if l.strip()]
    sel = a.select_split if split_ids.get(a.select_split) else None
    scope = (f"threshold selected on {sel}-split tiles ({len(split_ids[sel])} tiles pooled over {len(a.prob)} raster(s)); "
             f"test split reported at the selected threshold") if sel else "all labelled pixels"
    thresholds = [float(x) for x in a.thresholds.split(",")]

    def blank():
        return {t: {"tp": 0, "fp": 0, "fn": 0, "n_components": 0, "n_patches_ge_mmu": 0, "habitat_area_ha": 0.0} for t in thresholds}
    aggs = {"select": blank(), "test": blank()}
    per_area: dict[str, dict] = {}            # the same tables for each raster (= study area) on its own tiles
    for prob_path, label_path in zip(a.prob, a.label):
        with rasterio.open(prob_path) as s:
            prob = s.read(1).astype(np.float32)
            meta = RasterMeta(s.crs, s.transform, s.width, s.height, s.nodata, 1, "float32")
        with rasterio.open(label_path) as s:
            if (s.width, s.height) != (meta.width, meta.height):
                sys.exit(f"{label_path} is not on the grid of {prob_path}")
            label = s.read(1)
        base = np.isfinite(prob) & (label != 255)
        tiles_dir = Path(ds_root) / "tiles" / "images" if ds_root else None
        masks = {"select": base & test_mask_from_split(meta, tiles_dir, split_ids[sel]) if sel else base,
                 "test": base & test_mask_from_split(meta, tiles_dir, split_ids["test"]) if split_ids.get("test") else None}
        area = np.broadcast_to(pixel_area_ha(meta)[:, None], prob.shape)
        for t in thresholds:
            binary = np.isfinite(prob) & (prob >= t)
            lab, n = ndimage.label(binary, structure=np.ones((3, 3)))
            areas = ndimage.sum(area, lab, np.arange(1, n + 1)) if n else np.array([])
            area_id = Path(prob_path).stem.replace("_prob", "")
            pa = per_area.setdefault(area_id, {"select": blank(), "test": blank(), "ref_px": {"select": 0, "test": 0}})
            for key, valid in masks.items():
                if valid is None:
                    continue
                ref, pred = label[valid] == 1, prob[valid] >= t
                if t == thresholds[0]:
                    pa["ref_px"][key] += int(ref.sum())
                for g in (aggs[key][t], pa[key][t]):
                    g["tp"] += int((pred & ref).sum()); g["fp"] += int((pred & ~ref).sum()); g["fn"] += int((~pred & ref).sum())
                    g["n_components"] += int(n); g["n_patches_ge_mmu"] += int((areas >= a.mmu_ha).sum())
                    g["habitat_area_ha"] += float(areas.sum())

    def table(agg):
        out = []
        for t in thresholds:
            tp, fp, fn = agg[t]["tp"], agg[t]["fp"], agg[t]["fn"]
            prec = tp / (tp + fp) if tp + fp else 0.0
            rec = tp / (tp + fn) if tp + fn else 0.0
            f1 = 2 * prec * rec / (prec + rec) if prec + rec else 0.0
            iou = tp / (tp + fp + fn) if tp + fp + fn else 0.0
            out.append({"threshold": t, "iou": iou, "dice": f1, "precision": prec, "recall": rec, "f1": f1,
                        "tp": tp, "fp": fp, "fn": fn, **{k: agg[t][k] for k in ("n_components", "n_patches_ge_mmu", "habitat_area_ha")}})
        return out
    rows = table(aggs["select"])
    test_rows = table(aggs["test"]) if split_ids.get("test") else []
    best_pooled = max(rows, key=lambda r: r[a.criterion])
    MIN_REF_PX = 2000          # < 2,000 mangrove pixels (20 ha) on the selection tiles: too few to choose a threshold
    per_area_out = {}
    for area_id, pa in per_area.items():
        prow, ptest = table(pa["select"]), table(pa["test"])
        enough = pa["ref_px"]["select"] >= MIN_REF_PX
        pb = max(prow, key=lambda r: r[a.criterion]) if enough else next(r for r in prow if r["threshold"] == best_pooled["threshold"])
        per_area_out[area_id] = {
            "selected_threshold": pb["threshold"], "source": "own validation tiles" if enough else
            f"pooled threshold (only {pa['ref_px']['select']} mangrove px on this area's {sel or 'selection'} tiles)",
            "selection_ref_px": pa["ref_px"]["select"], "test_ref_px": pa["ref_px"]["test"],
            "selection_at_selected": {k: pb[k] for k in ("iou", "f1", "precision", "recall")},
            "test_at_selected": next(({k: r[k] for k in ("iou", "f1", "precision", "recall", "tp", "fp", "fn")}
                                      for r in ptest if r["threshold"] == pb["threshold"]), None),
            "grid_edge": enough and pb["threshold"] in (thresholds[0], thresholds[-1])}
    best = max(rows, key=lambda r: r[a.criterion])
    out = {"scope": scope, "reference": "Global Mangrove Watch v3 (weak label) - agreement, not field-truth accuracy",
           "criterion": a.criterion, "selected_threshold": best["threshold"], "selected_on": sel or "all",
           "grid_edge": best["threshold"] in (thresholds[0], thresholds[-1]), "mmu_ha": a.mmu_ha,
           "test_at_selected": next((r for r in test_rows if r["threshold"] == best["threshold"]), None),
           "per_area": per_area_out,
           "probability_rasters": [str(Path(p).resolve()) for p in a.prob], "rows": rows}
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
    for area_id, v in per_area_out.items():
        t = v["test_at_selected"] or {}
        print(f"  {area_id:15} threshold {v['selected_threshold']:.2f} ({v['source']})  held-out test IoU "
              f"{t.get('iou', float('nan')):.3f} F1 {t.get('f1', float('nan')):.3f}  [test mangrove px {v['test_ref_px']}]")
    tsel = out["test_at_selected"]
    if tsel:
        print(f"held-out TEST at {best['threshold']:.2f}: IoU {tsel['iou']:.3f}  F1 {tsel['f1']:.3f}  P {tsel['precision']:.3f}  R {tsel['recall']:.3f}")
    print(f"written: {exp}/threshold_calibration.{{json,csv,png}}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
