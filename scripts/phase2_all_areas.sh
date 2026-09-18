#!/usr/bin/env bash
# Phase 2: wait for the study-area acquisitions, then run the whole multi-area chain (dev mode).
set -euo pipefail
cd "$(dirname "$0")/.."
export DATA_ROOT="$PWD/data"
PY=.venv/bin/python
EXP="${EXP:-multi_E1_s1_b0_dev}"
AREAS="${AREAS:-odisha-coast gulf-of-mannar}"
for a in $AREAS; do
  until [ -f "data/labels/$a/gmw_2020.tif" ] && [ -f "data/scenes/$a/${a}_2020_s12_10m.tif" ]; do sleep 20; done
  echo "[phase2] $a acquired"
done
echo "[phase2] building 4-area tile dataset"
$PY scripts/run_all_areas.py --stage tiles
echo "[phase2] training $EXP (E1, S1-only, B0, dev)"
$PY scripts/run_all_areas.py --stage train --config configs/train_dev.yaml --experiment-id $EXP
$PY scripts/run_all_areas.py --stage evaluate --experiment-id $EXP
$PY scripts/run_all_areas.py --stage sweep --experiment-id $EXP
$PY scripts/run_all_areas.py --stage analyse --experiment-id $EXP
echo "[phase2] DONE"
