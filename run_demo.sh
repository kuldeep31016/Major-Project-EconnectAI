#!/usr/bin/env bash
# Complete demonstration: acquisition -> tiles -> train -> evaluate -> predict -> graph analysis.
# Usage:  ./run_demo.sh [configs/demo.yaml]
set -euo pipefail
cd "$(dirname "$0")"
PY=".venv/bin/python"; [ -x "$PY" ] || PY="python3"
exec "$PY" scripts/run_pipeline.py --config "${1:-configs/demo.yaml}"
