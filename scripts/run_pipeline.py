#!/usr/bin/env python
"""One command for the complete demonstration (paper Fig. 1, all stages).

    python scripts/run_pipeline.py --config configs/demo.yaml

Stages (each can be skipped in the config when its output already exists):
    1. acquire      Sentinel-1 / Sentinel-2 scene + GMW weak labels for the study area   (STAC, no auth)
    2. tiles        cut the AOI into the canonical tile dataset (spatial-block split)
    3. train        segmentation model (DEV or FULL mode)                                 -> outputs/segmentation/<exp>/
    4. evaluate     test-split metrics + qualitative panels
    5. predict      whole-scene probability / confidence / binary maps                    -> predictions/
    6. analyse      patches -> graph -> IIC/PC/ECA -> criticality -> what-if -> explanations -> restoration
                                                                                          -> outputs/runs/<area>/<run_id>/
    7. serve        print how to start the backend + frontend that display the run

Every stage prints its result label (DEVELOPMENT-SUBSET / OUR EXPERIMENTAL / SYNTHETIC) and nothing is
fabricated: a stage that cannot run stops the pipeline with the reason.
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ecoconnect.pipeline.config import load_config, load_dotenv, REPO_ROOT  # noqa: E402

PY = sys.executable


def sh(cmd: list[str], cwd=REPO_ROOT) -> None:
    print("\n$ " + " ".join(str(c) for c in cmd), flush=True)
    r = subprocess.run([str(c) for c in cmd], cwd=cwd)
    if r.returncode != 0:
        sys.exit(f"stage failed (exit {r.returncode}) - see output above")


def main() -> int:
    load_dotenv()
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--config", default="configs/demo.yaml")
    ap.add_argument("--only", help="comma-separated subset of stages to run")
    a = ap.parse_args()
    cfg = load_config(a.config)
    d = cfg["demo"]
    area = d["study_area"]
    data_root = Path(os.environ.get("DATA_ROOT") or d.get("data_root") or (REPO_ROOT / "data"))
    os.environ["DATA_ROOT"] = str(data_root)
    stages = set((a.only.split(",") if a.only else [k for k, v in d["stages"].items() if v]))
    t0 = time.time()
    print(f"== EcoConnectAI demo pipeline ==  study area: {area}  mode: {d['mode']}  DATA_ROOT={data_root}")
    print(f"   stages: {sorted(stages)}")

    scene_glob = str(data_root / "scenes" / area / "*.tif")
    label_glob = str(data_root / "labels" / area / "*.tif")

    if "acquire" in stages:
        sh([PY, "scripts/acquire_study_area.py", "--study-area", area] +
           (["--bbox", d["bbox"]] if d.get("bbox") else []) +
           (["--date-range", d["date_range"]] if d.get("date_range") else []))
    scenes, labels = sorted(glob.glob(scene_glob)), sorted(glob.glob(label_glob))

    if "tiles" in stages:
        if not (scenes and labels):
            sys.exit(f"tiles: need a scene and a label raster under {data_root}/scenes/{area} and labels/{area} "
                     "(run the acquire stage or place your own dataset - docs/DATASET_SETUP.md)")
        sh([PY, "scripts/build_tiles.py", "--image", scenes[-1], "--label", labels[-1], "--name", d["dataset_name"],
            "--tile", str(d["tile_size"]), "--stride", str(d["tile_stride"]), "--bands", d.get("band_names", "")] +
           (["--append"] if d.get("append_tiles") else []))

    train_cfg = "configs/train_dev.yaml" if d["mode"] == "development" else "configs/train_full.yaml"
    exp_id = d.get("experiment_id") or f"{area}_{d['mode']}"
    exp_dir = REPO_ROOT / "outputs" / "segmentation" / exp_id
    ckpt = exp_dir / "best_model.pth"

    if "train" in stages:
        sh([PY, "scripts/train.py", "--config", train_cfg, "--experiment-id", exp_id] + (["--smoke"] if d.get("smoke") else []))
    if "evaluate" in stages:
        if not ckpt.exists():
            sys.exit(f"evaluate: no checkpoint at {ckpt} (run the train stage first)")
        sh([PY, "scripts/evaluate.py", "--checkpoint", ckpt, "--n-panels", str(d.get("n_panels", 8))] +
           (["--rgb-bands", d["rgb_bands"]] if d.get("rgb_bands") else []))

    prob = exp_dir / "predictions" / f"{area}_prob.tif"
    if "predict" in stages:
        if not (ckpt.exists() and scenes):
            sys.exit("predict: need best_model.pth and a scene GeoTIFF")
        sh([PY, "scripts/predict.py", "--checkpoint", ckpt, "--input", scenes[-1], "--output", prob,
            "--threshold", str(d["segmentation_threshold"])])

    if "analyse" in stages:
        if d.get("source") == "prototype":
            sh([PY, "scripts/run_graph_analysis.py", "--study-area", area, "--source", "prototype"])
        else:
            if not prob.exists():
                sys.exit(f"analyse: no probability raster at {prob} (run predict) - or set demo.source: prototype")
            sh([PY, "scripts/run_graph_analysis.py", "--study-area", area, "--probability", prob,
                "--threshold", str(d["segmentation_threshold"]), "--mmu-ha", str(d["mmu_ha"]),
                "--result-kind", "development" if d["mode"] == "development" else "experiment",
                "--model-checkpoint", str(ckpt)])

    if "serve" in stages:
        latest = (REPO_ROOT / "outputs" / "runs" / area / "LATEST")
        print("\n== done in %.0f s ==" % (time.time() - t0))
        if latest.exists():
            m = json.loads((latest.parent / latest.read_text().strip() / "manifest.json").read_text())
            print(f"latest run for {area}: {m['run_id']}   [{m['result_label']}]")
        print("start the backend :  .venv/bin/python -m uvicorn backend.main:app --port 8000")
        print("start the frontend:  cd frontend && npm run dev     ->  http://localhost:3000")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
