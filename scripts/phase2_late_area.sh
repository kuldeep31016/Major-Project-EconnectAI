#!/usr/bin/env bash
# Add a study area that arrived after the multi-area model was trained: append its tiles to the dataset
# (for the next retrain) and run predict + graph analysis with the existing model.  Usage: phase2_late_area.sh sundarbans multi_E1_s1_b0_dev
set -euo pipefail
cd "$(dirname "$0")/.."
export DATA_ROOT="$PWD/data"
A="$1"; EXP="$2"; PY=.venv/bin/python
until [ -f "data/labels/$A/gmw_2020.tif" ] && [ -f "data/scenes/$A/${A}_2020_s12_10m.tif" ]; do sleep 30; done
until [ -f "outputs/segmentation/$EXP/threshold_calibration.json" ]; do sleep 30; done
echo "[late] $A acquired and model $EXP ready"
$PY scripts/build_tiles.py --image "data/scenes/$A/${A}_2020_s12_10m.tif" --label "data/labels/$A/gmw_2020.tif" --name ecoconnect_tiles \
   --tile 256 --stride 128 --bands s1_vv_db,s1_vh_db,s2_blue,s2_green,s2_red,s2_nir,s2_swir16,s2_swir22,s2_ndvi,s2_ndwi \
   --max-negative-ratio 3 --min-positive-pixels 20 --id-prefix "${A%%-*}" --append --source-note "$A 2020 (appended after $EXP)"
$PY scripts/run_all_areas.py --stage analyse --experiment-id "$EXP" --areas "$A"
echo "[late] DONE $A"
