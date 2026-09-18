# Deployment

## Local (demo)
```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env            # set ECO_JWT_SECRET, ECO_DEMO_PASSWORD, DATA_ROOT
.venv/bin/python -m uvicorn backend.main:app --port 8000     # creates outputs/ecoconnect.db, syncs registry, seeds demo users
cd frontend && npm install && npm run build && npm start      # http://localhost:3000  (NEXT_PUBLIC_API_URL=http://localhost:8000)
```
Sign in at `/login` (demo roles), open `/command`.

## Server
* Backend: `uvicorn backend.main:app --host 0.0.0.0 --port 8000 --workers 2` behind nginx/Caddy with TLS; set `ECO_CORS_ORIGINS` to the frontend origin.
* Database: `ECO_DATABASE_URL=postgresql+psycopg://user:pass@host/ecoconnect` (install `psycopg[binary]`); tables are created on startup.
* Storage: `DATA_ROOT` (scenes, labels, tiles) and `ECO_OUTPUTS_DIR` (runs, models, evidence photos) on persistent disk; rasters are files, never DB rows.
* GPU training happens off-box (Colab/Kaggle notebook); copy `outputs/segmentation/<exp>/` back and restart to register the model.
* Frontend: `next build` static + node, or any Next.js host; only `NEXT_PUBLIC_API_URL` is needed.

## Data refresh
`scripts/acquire_study_area.py` (new dates) → `scripts/predict.py` → `scripts/run_graph_analysis.py` → registry sync happens on backend startup or `POST /api/registry/sync` (GIS role). Alerts: `POST /api/alerts/generate/{area}`.
