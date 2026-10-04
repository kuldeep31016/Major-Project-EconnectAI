#!/usr/bin/env python
"""Per-study-area reliability of a segmentation model: agreement of its 2020 whole-scene prediction with the GMW 2020
weak label, at the experiment's calibrated threshold (and 0.5). Written to <exp>/area_reliability.json and used by the
near-real-time layer to warn where the model is not reliable and to sanity-check predicted habitat area.

    python scripts/area_reliability.py --experiment outputs/segmentation/multi_E1_s1_b0_dev_r3

Two scores per area, each at the area's own calibrated threshold (threshold_calibration.json per_area, else pooled):
  - held_out: the area's TEST-split tiles only (from threshold_sweep.py per_area) - the honest number; used for the
    reliability level when the test tiles hold >= 2,000 GMW mangrove pixels (20 ha);
  - whole_scene: the whole study area INCLUDING training tiles (optimistic); used for the level only when there is too
    little held-out reference, and then flagged.
Agreement with GMW is not field accuracy.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

import numpy as np
import rasterio

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ecoconnect.pipeline.config import REPO_ROOT, load_study_areas  # noqa: E402


MIN_HELD_OUT_PX = 2000     # 20 ha of GMW mangrove on the area's test tiles


def level(iou: float) -> str:
    return "reliable" if iou >= 0.7 else "moderate" if iou >= 0.4 else "unreliable"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--experiment", required=True)
    ap.add_argument("--data-root", default=os.environ.get("DATA_ROOT") or str(REPO_ROOT / "data"))
    a = ap.parse_args()
    exp = Path(a.experiment)
    cal = json.loads((exp / "threshold_calibration.json").read_text())
    pooled, per_area = cal["selected_threshold"], cal.get("per_area") or {}
    out = {"experiment": exp.name, "threshold": pooled, "reference": "Global Mangrove Watch v3 2020 (weak label)",
           "scope": "level from the area's held-out test tiles when they hold >= 2,000 reference pixels, else from the "
                    "whole scene incl. training tiles (optimistic); not field accuracy", "areas": {}}
    for sid in load_study_areas():
        lab_p, prob_p = Path(a.data_root) / "labels" / sid / "gmw_2020.tif", exp / "predictions" / f"{sid}_prob.tif"
        if not (lab_p.exists() and prob_p.exists()):
            continue
        with rasterio.open(lab_p) as s:
            lab, px = s.read(1), abs(s.transform.a * s.transform.e) / 1e4
        with rasterio.open(prob_p) as s:
            p = s.read(1)
        valid = np.isfinite(p) & (lab != 255)
        ref = (lab == 1) & valid
        pa = per_area.get(sid) or {}
        thr = float(pa["selected_threshold"]) if pa.get("source") == "own validation tiles" else pooled
        row = {"reference_habitat_ha": round(float(ref.sum() * px), 1), "threshold": thr,
               "threshold_source": "own validation tiles" if thr != pooled or pa.get("source") == "own validation tiles"
               else "pooled"}
        for t in sorted({thr, pooled, 0.5}):
            pred = (p >= t) & valid
            tp, fp, fn = int((pred & ref).sum()), int((pred & ~ref).sum()), int((~pred & ref).sum())
            row[f"t{t:.2f}"] = {"iou": round(tp / max(tp + fp + fn, 1), 3), "precision": round(tp / max(tp + fp, 1), 3),
                                "recall": round(tp / max(tp + fn, 1), 3), "predicted_ha": round(float(pred.sum() * px), 1)}
        row["whole_scene"] = row[f"t{thr:.2f}"]
        ho = pa.get("test_at_selected")
        row["held_out"] = ({**{k: ho[k] for k in ("iou", "f1", "precision", "recall")}, "test_ref_px": pa.get("test_ref_px")}
                           if ho and pa.get("selected_threshold") == thr else None)
        enough = bool(row["held_out"]) and (pa.get("test_ref_px") or 0) >= MIN_HELD_OUT_PX
        row["level"] = level(row["held_out"]["iou"] if enough else row["whole_scene"]["iou"])
        row["level_basis"] = ("held-out test tiles" if enough else
                              "whole scene incl. training tiles (no per-area held-out score for this experiment)" if not pa else
                              f"whole scene incl. training tiles (only {pa.get('test_ref_px', 0)} reference px on held-out tiles)")
        out["areas"][sid] = row
        h = f"{row['held_out']['iou']:.3f}" if row["held_out"] else "  -  "
        print(f"{sid:15} ref {row['reference_habitat_ha']:9.0f} ha  thr {thr:.2f}  held-out IoU {h}  "
              f"whole-scene IoU {row['whole_scene']['iou']:.3f}  -> {row['level']} ({row['level_basis']})")
    (exp / "area_reliability.json").write_text(json.dumps(out, indent=1))
    print(f"written {exp / 'area_reliability.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
