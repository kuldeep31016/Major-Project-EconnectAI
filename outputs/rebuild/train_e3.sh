#!/usr/bin/env bash
# 2026-10-04: E3 S1+S2 fusion on the leakage-free split (same recipe and split as multi_E1_s1_b0_dev_r3).
set -euo pipefail
cd "$(dirname "$0")/../.."
export DATA_ROOT="$PWD/data"
PY=.venv/bin/python
EXP=multi_E3_s1s2_b0_dev_r3
echo "=== $(date +%T) train";    $PY -u scripts/run_all_areas.py --stage train --config configs/train_dev_buf_s1s2.yaml --experiment-id $EXP
echo "=== $(date +%T) evaluate"; $PY -u scripts/run_all_areas.py --stage evaluate --experiment-id $EXP
echo "=== $(date +%T) sweep";    $PY -u scripts/run_all_areas.py --stage sweep --experiment-id $EXP
echo "=== $(date +%T) E3 DONE"
