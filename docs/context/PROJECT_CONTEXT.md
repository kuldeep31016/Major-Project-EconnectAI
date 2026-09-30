# EcoConnectAI — Project Context (single source of truth)

_Last updated: 2026-09-30 (all 8 phases implemented; deployment pending user credentials)._

## 1. What this is

Final-year major project, grown into a research-grade prototype:
**"A Satellite-Driven Framework for Coastal Ecosystem Connectivity and Conservation Decision Support"**
(paper: `docs/EcoConnectAI_IEEE_paper.pdf`, source `docs/paper_source_main.tex`).

Pipeline: Sentinel-1/2 imagery → mangrove segmentation (U-Net) → probability raster → habitat patches →
connectivity graph → IIC/PC/ECA → leave-one-out patch criticality → what-if loss → restoration candidates →
field verification → reports → audit trail.

**Status: development / research prototype.** No field validation, no government deployment, no validated
restoration costs. Assistant = grounded Claude (claude-opus-5) when ANTHROPIC_API_KEY set, template fallback otherwise. Owner: GitHub `kuldeep31016`,
repo `kuldeep31016/Major-Project-EconnectAI`, default branch `main`.

**Long-term goal (user's spec, 2026-09-27):** evolve into a cloud-native, provenance-aware, honest,
reproducible coastal-ecosystem decision-support platform (PostGIS, object storage, async jobs, model
registry, experiment tracking, sensitivity, digital twin, field HITL loop, grounded GenAI assistant, CI/CD,
Docker). Phased plan in `ROADMAP.md`. The full original spec is summarised in `AUDIT_2026-09-27.md §0`.

## 2. Honesty rules (NON-NEGOTIABLE)

- Never fabricate results, validation, deployment, costs, ecological claims, patentability or novelty.
- Metrics are **agreement with Global Mangrove Watch (GMW) v3 2020 weak labels**, not field ground truth.
- Result labels in use: `PUBLISHED BASELINE — NOT OUR RESULT` (Ghorbanian et al. 95.56 % OA),
  `PROTOTYPE / SYNTHETIC`, `DEVELOPMENT-SUBSET RESULT — NOT FINAL`, `OUR EXPERIMENTAL RESULT` (none yet),
  `NOT YET RUN`. Scenario outputs = `SIMULATED` ("what-if", never a prediction).
- Model status ladder: Development → Experimental → Candidate → Validated (Validated only via an explicit
  workflow — nothing is validated today).
- Modelled change = "modelled habitat change", never "confirmed loss".
- UNB7 (EfficientNet-B7) is a research target, **not trained**.

## 3. Real measured results (verified from files 2026-09-27)

Segmentation (`outputs/segmentation/<exp>/metrics.json`, test @ threshold 0.5, no TTA; all DEVELOPMENT):

| Experiment | Input | Tiles train/val/test | Test IoU / F1 / P / R |
|---|---|---|---|
| **multi_E1_s1_b0_dev** (4 areas, reported model) | S1 VV+VH | 800/195/200 | **0.842 / 0.914 / 0.878 / 0.954** |
| kerala_E1_s1_b0_dev | S1 | 176/32/48 | 0.023 / 0.045 / 0.033 / 0.072 |
| kerala_E2_s2_b0_dev | S2 + NDVI/NDWI | 176/32/48 | 0.054 / 0.102 / 0.063 / 0.279 |
| kerala_E3_s1s2_b0_dev | S1+S2 | 176/32/48 | 0.053 / 0.101 / 0.066 / 0.209 |
| kerala-coast_development | S1 (2025 scene!) | 176/32/48 | 0.031 / 0.061 / 0.056 / 0.066 |

- The 4-area score is dominated by Sundarbans; Kerala is weak (thin 1–3 px fringes, 0.2 % positives).
- The 1,373-tile figure in the spec = total 4-area tiles; dev split capped at 800/200/200 (195 val actual).
- Threshold sweep picked 0.70 for E1 and multi (grid edge — F1 still rising), 0.45 for E2 — **selected on
  the test split** (known methodological flaw, see audit).
- The 4-area tile set was **overwritten** by a Kerala-only rebuild on 2026-09-20; the raw data/checkpoints
  are not in git (gitignored), so these results are **not reproducible from the repo alone**.

Graph (k=3, τ=5 km, C(G)=IIC). **Kerala LATEST (since 2026-10-01) = `kerala-coast_multi_E1_s1_b0_dev_t0.70`**
(reported 4-area model, 2020 scene, t 0.70): 12 patches, 18 links, 3 components, 204.6 ha. Worked example **P07**
(5.49 ha, 2.7 %, 7th by area, rank #3, −25.6 % IIC, cut vertex 3→4); cut vertices P02, P07; P01 #1 (−63.8 %).
Restoration: C01–C04 (21–159 ha) are *uncertain habitat* (rule below); first real site **C05** 18 ha +16.45 %.
Candidate rule (`ecoconnect/pipeline/restoration_rules.py`, re-exported by backend): uncertain_habitat if
area > 5 ha AND > 10 % of mapped habitat → shown as "field check", never as a restoration gain (API, alerts,
assistant, PDF report, UI). Landing page figures come live from the LATEST run (`frontend/hooks/use-landing-story.tsx`).
Previous LATEST (still stored, reproducible) = `kerala-coast_20260920T182222Z` (model `kerala-coast_development`,
threshold 0.5), 24 patches — the "P17 story" below refers to that run:
- **P17**: 3.13 ha (1.4 % of habitat, 17th by area), degree 4, **cut vertex** (components 2→3),
  criticality rank #3, S = 0.270 (≈27 % IIC loss). P01 is #1 (S = 0.307, 16 % of habitat, not a cut vertex).
- Restoration candidate **C1** ≈ 1.6 ha, +1.29 % IIC (simulated).
- Sensitivity (τ 3/5/8 × k 2/3/4, 2026-09-28): stable across τ at k=3 (ρ 0.96–1.0, same top-5); k=2 drops ρ to
  ~0.67–0.71. P01/P02/P03 top-5 in 9/9 variants; P17 top-5 in 6/9 (rank #2–#20) → P17's importance depends on k.
- Patch IDs are reassigned by area **per run** → "P17" is not a stable ID across runs. The paper's P17
  (synthetic prototype, rank 7, S 0.194) is a different object.
- Other runs: `<area>_multi_E1_s1_b0_dev_t0.70` for all four areas (Sundarbans 54 patches, Odisha 21,
  Gulf of Mannar 16, Kerala 12).
- Synthetic prototype maths reproduce paper Tables VI–VIII exactly; Tables VI–VII pinned by tests/test_regression.py, VIII/ρ/τ-robustness not yet pinned.
- P07 'small but critical' holds only for k ≥ 3, τ ≥ 5 km (top-5 in 4/9 τ×k variants) — say so when presenting.
- Paper ↔ code: 18 disagreements listed in docs/PAPER_IMPLEMENTATION_MATRIX.md (real runs do NOT reproduce the paper's synthetic headline findings).

## 4. Tech stack

- **Backend**: FastAPI (sync handlers), SQLAlchemy 2 + SQLite (`outputs/ecoconnect.db`, seeded at startup;
  `ECO_DATABASE_URL` can point to Postgres, psycopg in requirements-api), PyJWT HS256, bcrypt.
- **Science package** `ecoconnect/`: PyTorch + segmentation-models-pytorch (U-Net, EfficientNet-B0 dev / B7
  full), rasterio, shapely, pyproj, scipy, networkx, pystac-client + planetary-computer.
- **Frontend** `frontend/`: Next.js 16.3 (App Router, `--webpack`), React 19.2, TypeScript, Tailwind 4,
  shadcn/base-ui, Leaflet + react-leaflet 5, React Flow 11, Recharts 3, framer-motion.
  ⚠ `frontend/AGENTS.md`: this Next version has breaking changes — read `node_modules/next/dist/docs/`.
- **Deploy (existing)**: backend Docker on Render free plan (`render.yaml`,
  https://major-project-econnectai.onrender.com, sleeps; SQLite not persistent), frontend on Vercel
  (root `frontend/`). `docker-compose.yml` = backend + frontend. CI: `.github/workflows/ci.yml` (ruff F, pytest,
  pip-audit; tsc, eslint, next build, npm audit; docker build of both images).
  Demo password: backend `ECO_DEMO_PASSWORD` (Render: set in dashboard, `sync:false`), frontend demo buttons use
  `NEXT_PUBLIC_DEMO_PASSWORD` (default demo1234).

## 5. Repository layout (what lives where)

```
backend/        paths.py (RUNS_DIR/SEG_DIR, data_root, abs_path, resolve_run, patch_from_dict — the ONLY run resolver;
                tests repoint backend.paths.RUNS_DIR) · security.py (slug validation app-dependency, contained(),
                login throttle 10 fails/5 min) · main.py (run/artefact/compute endpoints)
                db.py (20 tables incl. jobs, artifacts) · migrate.py + migrations/ (Alembic; runs at startup;
                pre-Alembic DBs stamped 0001) · storage.py (LocalStorage | S3Storage via ECO_STORAGE) ·
                artifacts.py (sha256 registry, synced in registry.sync_all) · jobs.py (DB queue, conditional-UPDATE
                claim, inline worker thread ECO_INLINE_WORKER=1) · job_handlers.py (segment, scenario) ·
                jobs_api.py (/api/jobs, /api/artifacts) · worker.py (`python -m backend.worker`)
                registry_api.py (PATCH /api/models/{id}/status, /api/registry-models, /api/experiments/compare,
                /api/provenance/{area}/{run}, POST /api/runs/{area}/{run}/reproduce → job) · provenance.py
                (12-step lineage, also embedded as `lineage` in the evidence-chain response) · job_handlers:
                segment, scenario, reproduce. Model status ladder DEVELOPMENT→EXPERIMENTAL→CANDIDATE→VALIDATED
                (manage_models: admin/analyst/gis; validate_models: admin only; migration 0003)
                workflow_api.py (Phase 5: /api/field/checklist, /api/restoration/reviews* stage machine GIS_REVIEW →
                FIELD_VERIFICATION → FEASIBILITY → DECIDED, decide_restoration cap = senior/admin, 6 feasibility factors
                None = "Not assessed"; /api/hitl/disagreements + /api/hitl/export GeoJSON; migration 0004;
                record_disagreement hooked into verify_evidence on ACCEPTED) · assistant_llm.py (Phase 6: evidence pack
                E1..En → Claude claude-opus-5, output_config json_schema, fallbacks="default"; citations filtered to pack;
                proposed_scenario validated vs real ids, executed only by user click; signed-in + ANTHROPIC_API_KEY else
                template insight.answer; 30 q/user/h; audited)
                observability.py (X-Request-ID middleware, JSON logs, in-memory route metrics) · admin_api.py
                (/api/admin/system, view_audit) · report_pdf.py (fpdf2, Latin-1 transliteration) · auth: ECO_ACCESS_MINUTES
                (60) + RefreshToken table (migration 0005, sha256-stored, rotation, reuse → family revoked), /api/auth/refresh,
                /api/auth/logout · evidence photos via storage.get_storage() key evidence/<file> (S3/R2 in prod) · routers.py (platform: auth, users,
                alerts, detections, field tasks, evidence, projects, scenarios, audit, assistant, reports)
                db.py (15 tables) · auth.py (JWT + 6-role RBAC) · registry.py (sync runs→DB)
                alerts.py (rule engine) · scenarios.py (Scenario Lab A–G) · insight.py (evidence chain,
                template assistant, official report)
ecoconnect/     gee/ (stac_acquire, gmw_labels, gee_acquire) · geospatial/ (raster io, preprocessing,
                tiling, patch_extraction) · ml/ (datasets, models/unet, training, evaluation, inference)
                graph/ (construction, connectivity, criticality, what_if, restoration, explain, types, sensitivity = τ×k grid,
                kendall, jaccard, scale_areas, hypothetical_patch)
                pipeline/ (config, sources, analysis, report, frontend_adapter, provenance = git/config/file hashes)
scripts/        acquire_study_area, build_tiles, train, evaluate, predict, threshold_sweep,
                run_graph_analysis, run_pipeline, run_all_areas, phase2_*.sh
configs/        study_areas, acquisition, dataset(_s2,_s1s2), train_dev/full(_s2,_s1s2), graph, demo
outputs/        runs/<area>/<run_id>/ (manifest, patches.geojson, graph, metrics, criticality, explanations,
                restoration, what_if_top1, tau_sensitivity, patches_input, frontend_bundle) + LATEST
                segmentation/<exp>/ (metrics, experiment, history, plots, samples) + experiments.csv
                quicklooks/  (rasters, .pth, .db, .jwt_secret are gitignored)
tests/          test_graph, test_regression (pins stored P17/C1 + synthetic paper tables), test_patch_extraction,
                test_ml_pipeline (needs torch), test_acquisition, test_backend (+security), test_workflow
docs/           context/ (THIS), ARCHITECTURE, API, DATA_PROVENANCE, RESULTS_PROVENANCE, MODEL_CARD,
                EXPERIMENTS, SECURITY, DEPLOYMENT, FIELD_WORKFLOW, PRODUCT_*, PAPER_*, IMPLEMENTATION_AUDIT…
mesa_prep/      evaluation prep: videos, decks, scripts, Q&A, cheat sheet (tracked)
```

Frontend routes: `/` landing · `/demo` (guided story: components/demo/network-canvas.tsx SVG over S1 quicklook,
stage by scroll position; data via lib/api fetchRun*) · `/login` · `/command` (main dashboard) · `/analysis` · `/graph` ·
`/scenario` (Scenario Lab) · `/simulation` (legacy, duplicates scenario/restoration) · `/restoration` ·
`/field` · `/projects` · `/alerts` · `/experiments` · `/reports` · `/history` · `/audit` · `/upload`
(New Analysis) · `/settings` (UI only) · `/dashboard` (redirect). API client `frontend/lib/api.ts`,
bundle state `frontend/hooks/use-analysis.tsx`, getters `frontend/lib/data.ts`.

## 6. How to run (fresh clone)

```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements-api.txt pytest pandas   # API + tests (no torch)
# full research stack incl. torch: .venv/bin/pip install -r requirements.txt
.venv/bin/python -m pytest -q          # 2026-09-30: 93 passed, 1 skipped (ML needs torch); also passes with ECO_DATABASE_URL=postgresql+psycopg://…
# tests set ECO_INLINE_WORKER=0 and drive jobs with backend.jobs.work_once()
.venv/bin/ruff check backend ecoconnect scripts tests --select F   # CI lint scope
.venv/bin/python -m uvicorn backend.main:app --port 8000
cd frontend && npm install && npm run dev   # http://localhost:3000
```
`.claude/launch.json` has `backend` and `frontend` preview configs. Demo users: admin, senior, range, field,
gis, analyst — password from `ECO_DEMO_PASSWORD` (default `demo1234`). Delete `outputs/ecoconnect.db` to reseed.
Fresh clone has **no** `data/`, checkpoints or rasters → inference (`/api/segment`), probability overlays
needing TIFFs, and timeline mask-diff won't work; precomputed runs/JSON do.

## 7. Key known problems (details + file:line in the audit §I; bugs 1–19 FIXED 2026-09-28)

1. Most read + compute endpoints are still unauthenticated; heavy work is synchronous (no jobs yet — Phase 2).
2. ML methodology bugs 20–28 OPEN (normaliser cache, 128 px split leakage, threshold picked on test split,
   Kerala LATEST model trained on 2025 imagery vs 2020 labels, no git commit/hash in manifests) — need re-runs.
3. `/simulation` duplicates `/scenario` + `/restoration`; `main.py` still large; ~57 eslint warnings (unused imports).
4. Docker images not built locally yet (daemon was off). **GitHub Actions cannot run: account locked for billing**
   (user must fix billing or make repo public).
5. `/api/segment` is now async (202 + job); frontend `postSegment` polls `waitForJob`. Inference in a worker
   container needs a torch image (API image has no torch).

## 8. Machine / environment gotchas

- Dev machine: Apple M3, 16 GB, MPS, low disk (~9 GB free), Python 3.14 (also /opt/homebrew python3.12).
  Shell is **fish**. UNB7 full training intended for Colab/Kaggle GPU.
- GMW tiles are named by the **north** edge; S2 must be selected per MGRS granule with overlap filter;
  run Python with `-u` when logging; GDAL `CPL_VSIL_CURL_CHUNK_SIZE=4MB` speeds STAC reads; certifi needed.
- Interface score Eq. (7) is non-monotone under removal → UI headlines C(G)=IIC.
- JWT secret persisted to `outputs/.jwt_secret` when `ECO_JWT_SECRET` unset.

## 9. Working agreement with the user

- Commit / push / merge **only when the user says so**; at that moment update `docs/context/*` (see
  `docs/context/README.md`). User wants zero need to re-read chats or the whole codebase next session.
- Work phase by phase (ROADMAP), preserve working functionality, run tests each phase, prefer fewer
  excellent features over many broken ones, keep costs student-friendly (free tiers, optional GPU).

## 10. Secrets & deployment state (2026-09-30)

- Local `.env` (gitignored, chmod 600) holds ANTHROPIC_API_KEY (user-provided; user asked not to spend it — no test
  calls made). Never commit it; in deployment it goes into the Render dashboard (render.yaml `sync: false`).
- Local dev DB: PostgreSQL 18 cluster in data/postgres (gitignored) on 127.0.0.1:5433, db `ecoconnect`, user `eco`
  (trust auth, localhost only); `scripts/local_postgres.sh start` BEFORE the backend (.env points at it; comment the
  ECO_DATABASE_URL line out to use SQLite). Tests always use their own temp DB.
- Live (2026-09-30): the CORRECT API is Render service srv-dapspsmgekts73f33760 at
  https://major-project-econnectai-lzaw.onrender.com (Neon DB, Anthropic key, CORS = localhost:3000 + Vercel URL);
  `scripts/check_deployment.py` → 14/14 PASS. Frontend https://major-project-econnect-ai.vercel.app uses it (Vercel NEXT_PUBLIC_API_URL, type Config — NEXT_PUBLIC_*
  cannot be Secret); verified 2026-10-01: bundle contains only the -lzaw URL, /demo loads live data in a browser. An OLD duplicate service answers at major-project-econnectai.onrender.com
  (SQLite, CORS *) — SUSPENDED by user 2026-10-01 (answers 503; Render project "Major Project", Frankfurt). `/api/health` reports effective CORS origins for diagnosis.
- Target stack: Vercel (frontend) + Render web service (API, Docker) + Neon PostgreSQL + Cloudflare R2 (photos) +
  GitHub Actions CI with deploy hook. GitHub Actions still blocked: account billing lock (user must fix in
  github.com/settings/billing; repo is public).
