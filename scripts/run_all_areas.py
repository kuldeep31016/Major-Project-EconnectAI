#!/usr/bin/env python
"""Multi-area orchestration over every study area that has a scene + GMW label on disk.

    python scripts/run_all_areas.py --stage tiles                      # (re)build the pooled tile dataset
    python scripts/run_all_areas.py --stage train --config configs/train_dev.yaml --experiment-id all4_E1_s1_b0_dev
    python scripts/run_all_areas.py --stage evaluate --experiment-id all4_E1_s1_b0_dev
    python scripts/run_all_areas.py --stage sweep    --experiment-id all4_E1_s1_b0_dev   # pooled threshold
    python scripts/run_all_areas.py --stage analyse  --experiment-id all4_E1_s1_b0_dev   # predict + graph per area

Each stage is a thin wrapper over the single-area scripts, so nothing here computes anything on its own.
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ecoconnect.pipeline.config import load_dotenv, load_study_areas, REPO_ROOT  # noqa: E402

PY = sys.executable
BANDS = "s1_vv_db,s1_vh_db,s2_blue,s2_green,s2_red,s2_nir,s2_swir16,s2_swir22,s2_ndvi,s2_ndwi"


def sh(cmd):
    print("$ " + " ".join(str(c) for c in cmd), flush=True)
    subprocess.run([str(c) for c in cmd], check=True, cwd=REPO_ROOT)


def ready_areas(data_root: Path, year: str) -> dict[str, tuple[Path, Path]]:
    out = {}
    for sid in load_study_areas():
        scene = data_root / "scenes" / sid / f"{sid}_{year}_s12_10m.tif"
        label = data_root / "labels" / sid / "gmw_2020.tif"
        if scene.exists() and label.exists():
            out[sid] = (scene, label)
    return out


def main() -> int:
    load_dotenv()
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--stage", required=True, choices=["tiles", "train", "evaluate", "sweep", "analyse"])
    ap.add_argument("--dataset-name", default="ecoconnect_tiles")
    ap.add_argument("--year", default="2020")
    ap.add_argument("--config", default="configs/train_dev.yaml")
    ap.add_argument("--experiment-id", default=None)
    ap.add_argument("--areas", default=None, help="comma-separated subset")
    ap.add_argument("--result-kind", default="development", choices=["development", "experiment"])
    ap.add_argument("--max-negative-ratio", type=float, default=3.0)
    ap.add_argument("--threshold", type=float, default=None, help="override the calibrated threshold")
    a = ap.parse_args()
    data_root = Path(os.environ.get("DATA_ROOT") or REPO_ROOT / "data")
    areas = ready_areas(data_root, a.year)
    if a.areas:
        areas = {k: v for k, v in areas.items() if k in a.areas.split(",")}
    print(f"study areas with scene + label: {list(areas)}")
    if not areas:
        sys.exit("nothing to do")
    exp_dir = REPO_ROOT / "outputs" / "segmentation" / (a.experiment_id or "")

    if a.stage == "tiles":
        ds = data_root / a.dataset_name
        if ds.exists():
            import shutil
            shutil.rmtree(ds)
        for n, (sid, (scene, label)) in enumerate(areas.items()):
            sh([PY, "scripts/build_tiles.py", "--image", scene, "--label", label, "--name", a.dataset_name,
                "--tile", "256", "--stride", "128", "--bands", BANDS, "--max-negative-ratio", str(a.max_negative_ratio),
                "--min-positive-pixels", "20", "--id-prefix", sid.split("-")[0],
                "--source-note", f"{sid} {a.year}: S1 RTC median + S2 L2A median; GMW 2020 weak label"] + (["--append"] if n else []))
        meta = json.loads((ds / "metadata.json").read_text())
        print("split sizes:", {s: sum(1 for l in (ds / "splits" / f"{s}.txt").read_text().splitlines() if l.strip()) for s in ("train", "val", "test")})
        print("negative subsampling (last area):", meta.get("negative_subsampling"))

    elif a.stage == "train":
        sh([PY, "scripts/train.py", "--config", a.config] + (["--experiment-id", a.experiment_id] if a.experiment_id else []))

    elif a.stage == "evaluate":
        sh([PY, "scripts/evaluate.py", "--checkpoint", exp_dir / "best_model.pth", "--n-panels", "12", "--rgb-bands", "4,3,2"])

    elif a.stage in ("sweep", "analyse"):
        ck = exp_dir / "best_model.pth"
        probs = {}
        for sid, (scene, label) in areas.items():
            prob = exp_dir / "predictions" / f"{sid}_prob.tif"
            if not prob.exists():
                sh([PY, "scripts/predict.py", "--checkpoint", ck, "--input", scene, "--output", prob, "--threshold", "0.5"])
            probs[sid] = (prob, label)
        if a.stage == "sweep":
            cmd = [PY, "scripts/threshold_sweep.py", "--experiment", exp_dir]
            for prob, label in probs.values():
                cmd += ["--prob", prob, "--label", label]
            sh(cmd)
        else:
            thr = a.threshold
            if thr is None:
                tc = exp_dir / "threshold_calibration.json"
                thr = json.loads(tc.read_text())["selected_threshold"] if tc.exists() else 0.5
                print(f"threshold: {thr} ({'calibrated' if tc.exists() else 'default 0.5 - run --stage sweep first'})")
            for sid, (prob, _) in probs.items():
                sh([PY, "scripts/run_graph_analysis.py", "--study-area", sid, "--probability", prob, "--threshold", str(thr),
                    "--mmu-ha", "2.0", "--result-kind", a.result_kind, "--model-checkpoint", ck,
                    "--run-id", f"{sid}_{a.experiment_id}_t{thr:.2f}"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
