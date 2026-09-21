#!/usr/bin/env bash
# EcoConnectAI — Single-Command Production & Local Runner
# Starts both FastAPI Backend (port 8000) and Next.js Frontend (port 3000)
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "=================================================="
echo "   🌱 Launching EcoConnectAI Full Stack Platform  "
echo "=================================================="

# Check Python Environment
PY=".venv/bin/python"
[ -x "$PY" ] || PY="python3"

echo "[1/3] Starting FastAPI Backend on http://127.0.0.1:8000..."
"$PY" -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

cleanup() {
  echo ""
  echo "Shutting down EcoConnectAI services..."
  kill $BACKEND_PID 2>/dev/null || true
  exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# Wait briefly for backend health
sleep 1.5

echo "[2/3] Starting Next.js Frontend on http://localhost:3000..."
cd "$ROOT_DIR/frontend"

if [ ! -d "node_modules" ]; then
  echo "Installing frontend dependencies..."
  npm install
fi

echo "[3/3] EcoConnectAI is Live!"
echo "👉 Open: http://localhost:3000"
echo "👉 Backend API: http://localhost:8000/docs"
echo "--------------------------------------------------"

npm run dev
