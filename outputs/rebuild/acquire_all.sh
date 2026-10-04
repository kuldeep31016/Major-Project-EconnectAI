#!/usr/bin/env bash
# Rebuild 2026-10-04: re-acquire the 2020 training data for the 4 study areas (the original data/ was deleted).
set -uo pipefail
cd "$(dirname "$0")/../.."
export DATA_ROOT="$PWD/data" CPL_VSIL_CURL_CHUNK_SIZE=4194304
for a in kerala-coast sundarbans gulf-of-mannar odisha-coast; do
  echo "=== $(date +%T) acquire $a"
  .venv/bin/python -u scripts/acquire_study_area.py --study-area "$a" || echo "!!! $a FAILED"
done
echo "=== $(date +%T) ACQUIRE DONE"
ls -la data/scenes/*/ data/labels/*/
