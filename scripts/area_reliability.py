#!/usr/bin/env python
"""Per-study-area reliability of a segmentation model: agreement of its 2020 whole-scene prediction with the GMW 2020
weak label, at the experiment's calibrated threshold (and 0.5). Written to <exp>/area_reliability.json and used by the
near-real-time layer to warn where the model is not reliable and to sanity-check predicted habitat area.

    python scripts/area_reliability.py --experiment outputs/segmentation/multi_E1_s1_b0_dev_r2

The scores cover the whole study area INCLUDING training tiles (optimistic); the held-out score of the model as a
whole is the test split in metrics.json / threshold_calibration.json. Agreement with GMW is not field accuracy.
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


def level(iou: float) -> str:
    return "reliable" if iou >= 0.7 else "moderate" if iou >= 0.4 else "unreliable"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--experiment", required=True)
    ap.add_argument("--data-root", default=os.environ.get("DATA_ROOT") or str(REPO_ROOT / "data"))
    a = ap.parse_args()
    exp = Path(a.experiment)
    thr = json.loads((exp / "threshold_calibration.json").read_text())["selected_threshold"]
    out = {"experiment": exp.name, "threshold": thr, "reference": "Global Mangrove Watch v3 2020 (weak label)",
           "scope": "whole study area incl. training tiles (optimistic); not field accuracy", "areas": {}}
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
        row = {"reference_habitat_ha": round(float(ref.sum() * px), 1)}
        for t in (thr, 0.5):
            pred = (p >= t) & valid
            tp, fp, fn = int((pred & ref).sum()), int((pred & ~ref).sum()), int((~pred & ref).sum())
            row[f"t{t:.2f}"] = {"iou": round(tp / max(tp + fp + fn, 1), 3), "precision": round(tp / max(tp + fp, 1), 3),
                                "recall": round(tp / max(tp + fn, 1), 3), "predicted_ha": round(float(pred.sum() * px), 1)}
        row["level"] = level(row[f"t{thr:.2f}"]["iou"])
        out["areas"][sid] = row
        print(f"{sid:15} ref {row['reference_habitat_ha']:9.0f} ha  IoU@{thr} {row[f't{thr:.2f}']['iou']:.3f}  -> {row['level']}")
    (exp / "area_reliability.json").write_text(json.dumps(out, indent=1))
    print(f"written {exp / 'area_reliability.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
