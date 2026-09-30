# Deployment

Vendor-neutral by design: containers + PostgreSQL + an S3-compatible bucket + (optionally) a separate worker.
Nothing in the code depends on a specific cloud. **Status: the only live deployment is a free-tier demo (Render API
+ Vercel frontend); there is no production or agency deployment.**

## 1. Local (one command)

```bash
docker compose up --build                       # API :8000 (SQLite in ./outputs) + frontend :3000
docker compose --profile postgres up --build    # + PostGIS; set ECO_DATABASE_URL in .env (see .env.example)
docker compose --profile worker up --build      # + a separate job worker
```
Without Docker: `.venv/bin/python -m uvicorn backend.main:app --port 8000` and `cd frontend && npm run dev`.

## 2. Components

| Component | What runs | Scales by | Notes |
|---|---|---|---|
| API | `uvicorn backend.main:app` (Dockerfile, no torch) | instances | stateless apart from the DB; runs an inline job worker unless `ECO_INLINE_WORKER=0` |
| Worker | `python -m backend.worker` | instances | claims jobs with an atomic UPDATE; inference jobs need an image built from `requirements.txt` (torch) |
| Database | PostgreSQL 16 + PostGIS | managed service | schema migrates itself at startup (Alembic); SQLite only for single-instance demos |
| Object storage | `ECO_STORAGE=s3` + `ECO_S3_BUCKET` (+ `ECO_S3_ENDPOINT_URL`) | — | AWS S3, Cloudflare R2, Backblaze B2, MinIO; DB keeps keys + sha256 only |
| Frontend | Next.js (`frontend/Dockerfile` or Vercel/Netlify) | CDN | `NEXT_PUBLIC_API_URL` is baked in at build time and must be browser-reachable |
| Training | Colab/Kaggle/GPU VM, on demand | — | never on the API host |

## 3. Required configuration (production)

| Variable | Why |
|---|---|
| `ECO_JWT_SECRET` (≥ 32 random bytes) | token signing; without it a per-host file secret is used |
| `ECO_DATABASE_URL=postgresql+psycopg://…` | persistent state (SQLite on an ephemeral disk loses users, tasks, audit) |
| `ECO_CORS_ORIGINS` (exact frontend origin) | avoid broad regexes such as `*.vercel.app` in production |
| `ECO_DEMO_PASSWORD` | only for demo instances; real deployments create users through the admin API |
| `ECO_ACCESS_MINUTES` (default 60), `ECO_REFRESH_DAYS` (default 14) | access-token lifetime; refresh tokens rotate and reuse revokes the family |
| `ANTHROPIC_API_KEY` (optional) | enables the evidence-grounded assistant; unset = template answers |
| `ECO_ASSISTANT_PER_HOUR` | per-user assistant limit (cost control) |

## 4. Health, readiness, observability

- `GET /api/health` — liveness (process answers, uptime). Use for container health checks.
- `GET /api/ready` — 503 unless the database is reachable **and** the schema is at the latest migration. Use for
  load-balancer readiness.
- Every response carries `X-Request-ID` (an incoming one is honoured); server errors are logged as JSON lines with
  the same id (`backend/observability.py`), so a user-reported id finds the log line.
- `/system` (admin UI) / `GET /api/admin/system` — schema state, jobs by status, failed jobs in 24 h, per-route
  request counts / 5xx / p50 / p95. Counters are in-memory per instance and reset on restart; for several instances
  ship the JSON logs to the platform's log/metrics service instead.

## 5. Cost (estimates — verify against current provider pricing before committing)

Designed to run at zero or near-zero cost for a student/research project; expensive features are optional.

| Item | Low-cost option | Cost driver | Notes |
|---|---|---|---|
| Frontend | Vercel / Netlify / Cloudflare Pages free tier | bandwidth | static + client-side; fits free tiers for demo traffic |
| API + inline worker | Render / Fly.io / Cloud Run free or smallest tier | always-on hours, RAM | free tiers sleep when idle (first request is slow) |
| PostgreSQL | Neon / Supabase free tier | storage, compute hours | tables are small (runs, jobs, audit); rasters are never stored in the DB |
| Object storage | Cloudflare R2 / Backblaze B2 | GB stored | run artefacts are KB–MB; scene/probability rasters are 10s–100s of MB per area/year — apply a lifecycle rule to delete intermediate rasters |
| Training / inference | Colab or Kaggle GPU, on demand | GPU hours | never keep a GPU instance running; B0 dev training ran on a laptop (MPS) in minutes |
| AI assistant (optional) | Claude `claude-opus-5` at $5 / $25 per million input / output tokens | questions asked | one question sends a ~3–6 k-token evidence pack and returns a few hundred tokens: roughly $0.02–0.04 per question; capped per user per hour |

Rules of thumb: keep one API instance until metrics say otherwise; turn the assistant off (`ECO_ASSISTANT_LLM=0`) for
public demos without sign-in; delete intermediate rasters after a run is registered (artefact hashes remain); run
training only on demand.

## 6. Release checklist

1. `pytest -q`, `ruff`, `tsc`, `eslint`, `next build` green (CI runs them; GitHub Actions needs the owner account's
   billing lock cleared).
2. Back up the database; migrations run automatically at startup — test them on a copy first.
3. Set the variables in §3; confirm `/api/ready` returns `ready` before switching traffic.
4. Check `/system` after deploy: schema at head, no failed jobs, no 5xx.

## 7. Data refresh

New imagery → `scripts/acquire_study_area.py` → `scripts/predict.py` (GPU/laptop) → `POST /api/segment` or
`scripts/run_graph_analysis.py` → the registry syncs the run and hashes its artefacts on next start
(`POST /api/registry/sync` does it immediately).
