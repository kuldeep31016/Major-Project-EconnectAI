#!/usr/bin/env bash
# Rebuild 2026-10-04 of the lost multi-area model with the original recipe (configs/train_dev.yaml, E1 = S1 VV/VH,
# U-Net EfficientNet-B0, seed 42) under a NEW experiment id, so stored runs and their provenance stay untouched.
# No "analyse" stage: it would write runs named <area>_multi_E1_s1_b0_dev_t*.
set -euo pipefail
cd "$(dirname "$0")/../.."
export DATA_ROOT="$PWD/data"
PY=.venv/bin/python
EXP=multi_E1_s1_b0_dev_r2
until grep -q "ACQUIRE DONE" outputs/rebuild/acquire.log; do sleep 30; done
for a in kerala-coast sundarbans gulf-of-mannar odisha-coast; do
  [ -f "data/scenes/$a/${a}_2020_s12_10m.tif" ] && [ -f "data/labels/$a/gmw_2020.tif" ] || { echo "!!! missing data for $a"; exit 1; }
done
echo "=== $(date +%T) tiles";    $PY -u scripts/run_all_areas.py --stage tiles
echo "=== $(date +%T) train";    $PY -u scripts/run_all_areas.py --stage train --config configs/train_dev.yaml --experiment-id $EXP
echo "=== $(date +%T) evaluate"; $PY -u scripts/run_all_areas.py --stage evaluate --experiment-id $EXP
echo "=== $(date +%T) sweep";    $PY -u scripts/run_all_areas.py --stage sweep --experiment-id $EXP
echo "=== $(date +%T) REBUILD DONE"
