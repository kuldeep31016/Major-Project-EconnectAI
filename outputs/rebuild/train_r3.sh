#!/usr/bin/env bash
# 2026-10-04: multi_E1_s1_b0_dev recipe on the stratified (per-area mangrove share), boundary-buffered split (audit bug 21; scripts/resplit_buffered.py --stratify --strat-block-tiles 6) -> multi_E1_s1_b0_dev_r3.
set -euo pipefail
cd "$(dirname "$0")/../.."
export DATA_ROOT="$PWD/data"
PY=.venv/bin/python
EXP=multi_E1_s1_b0_dev_r3
echo "=== $(date +%T) train";    $PY -u scripts/run_all_areas.py --stage train --config configs/train_dev_buf.yaml --experiment-id $EXP
echo "=== $(date +%T) evaluate"; $PY -u scripts/run_all_areas.py --stage evaluate --experiment-id $EXP
echo "=== $(date +%T) sweep";    $PY -u scripts/run_all_areas.py --stage sweep --experiment-id $EXP
echo "=== $(date +%T) R3 DONE"
