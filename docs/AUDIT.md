# EcoConnectAI — Audit (2026-10-01)

Fresh audit of the working tree on 2026-10-01 (branch `main` at `a60aa6b` **plus uncommitted work**: EXIF-GPS
evidence, `ecoconnect/graph/temporal.py`, `scripts/acceptance_test.py`, `Makefile`, patch-importance table).
The earlier, more detailed architecture audit (diagrams, ER model, API map, bug list 1–28 with file:line) is
[`docs/context/AUDIT_2026-09-27.md`](context/AUDIT_2026-09-27.md); bugs 1–19 there are FIXED, 20–28 are still OPEN
unless noted below. Feature-by-feature status: [`IMPLEMENTATION_STATUS.md`](IMPLEMENTATION_STATUS.md).

Measured on this machine today:

- `.venv/bin/python -m pytest -q` → **99 passed, 1 skipped** (skip = `tests/test_ml_pipeline.py`, PyTorch not installed).
- `.venv/bin/python scripts/acceptance_test.py` → **16 passed, 4 skipped, 0 failed** (skipped: acquisition,
  preprocessing, segmentation, probability map — no scenes, checkpoints or PyTorch on this machine).
- `ruff check backend ecoconnect scripts tests --select F` → clean. `npx eslint .` (frontend) → 0 errors, 55 warnings.

Standing honesty frame: segmentation metrics are agreement with **Global Mangrove Watch (GMW) v3 weak labels**,
not field truth; all results are **DEVELOPMENT**; scenarios are **SIMULATED**; temporal differences are
**model-estimated**; nothing is field-validated, deployed to a government, or backed by validated costs.

---

## A. What currently works

Verified by tests and/or the acceptance run:

- Graph engine: k-NN + τ graph, IIC / PC / ECA, exact leave-one-out criticality, cut vertices, what-if removal,
  restoration gain R_i and optional R_i/Cost_i, rule-based explanations (`ecoconnect/graph/*`, `tests/test_graph.py`,
  `tests/test_regression.py`).
- τ×k sensitivity grid with Spearman, Kendall, top-5 Jaccard, per-patch rank range (`ecoconnect/graph/sensitivity.py`,
  `tests/test_sensitivity.py`).
- Scenario Lab (11 scenario types, `backend/scenarios.py`), restoration feasibility with the uncertain-habitat rule
  (`ecoconnect/pipeline/restoration_rules.py`).
- Temporal patch tracking by polygon overlap with a like-for-like comparability check (new, `ecoconnect/graph/temporal.py`,
  `tests/test_temporal.py`).
- Platform: JWT access + rotating refresh tokens, 6-role RBAC, audit log, alerts rule engine (RULES_VERSION 2),
  field tasks + evidence (now with EXIF GPS fallback), restoration review stage machine, HITL disagreement register +
  GeoJSON export, model registry status ladder, DB job queue + worker, provenance lineage, graph-level
  "reproduce" job, experiment comparison, PDF reports, `/api/health` + `/api/ready`, admin `/system` page.
- Graph-level reproduction of all 11 stored runs (acceptance step 2; `backend/job_handlers.py` `reproduce`).
- Alembic migrations 0001–0005 on SQLite and PostgreSQL (`backend/migrations/`).
- Live deployment (per `docs/context/PROJECT_CONTEXT.md` §10, 2026-09-30/10-01): Render API + Neon + Vercel,
  `scripts/check_deployment.py` 14/14 PASS at that time. Not re-checked in this audit.

## B. What partially works

- **Segmentation pipeline** (`ecoconnect/ml/*`, `scripts/train.py`, `evaluate.py`, `predict.py`): code exists and produced
  the stored metrics, but cannot run on this machine (no PyTorch, checkpoints, scenes). Raster-level reproduction is
  not possible from here.
- **`/api/segment` inference job**: async and validated, but needs a torch image + checkpoint; the API Docker image has
  no torch (`requirements-api.txt`).
- **Threshold calibration**: sweep exists but selects on the TEST split (`scripts/threshold_sweep.py:5,69`, audit bug 22);
  0.70 is the grid edge.
- **Temporal comparison**: tracking works, but only one like-for-like pair exists at best; Kerala 2025 run
  (`kerala_E1_s1_b0_dev_2025_t0.70`) uses the weak Kerala-only model. `/simulation` timeline mask-diff needs TIFFs.
- **Grounded Claude assistant**: code + tests with a fake client (`tests/test_assistant.py`); live path deliberately
  barely exercised (key conserved). Template fallback works.
- **Restoration feasibility**: 6 factors, most "Not assessed" (no cost, tenure, legal layers); NDWI factor needs the scene.
- **Storage abstraction**: `S3Storage` (`backend/storage.py`) exists but is untested; production R2 bucket optional.
- **CI**: workflow is complete (`.github/workflows/ci.yml`) but has never run successfully — GitHub account billing lock.
- **`/simulation`** page still carries the timeline tab; duplicates `/scenario` + `/restoration` otherwise.

## C. What is UI-only

- `/settings` — "Save" only flips a `saved` flag (`frontend/app/settings/page.tsx:69-72`); nothing persisted server-side.
- `/history` — status/"completed" values are synthesised client-side from `fetchRuns()` (`frontend/app/history/page.tsx:48`).
- "Forgot password" on `/login` is an explanatory note, not a flow. No OAuth.
- Landing / demo storytelling layout (figures themselves are live from the LATEST run via `frontend/hooks/use-landing-story.tsx`).

## D. What is backed by real computation

All graph metrics, criticality, what-if, restoration gain, sensitivity, scenario results, temporal tracking,
explanations, alerts, PDF content and assistant evidence packs are computed from stored run artefacts
(`outputs/runs/<area>/<run>/patches_input.json`, `graph.json`, `criticality.*`) at request time or were computed by
`scripts/run_graph_analysis.py`. The acceptance test re-derives P07's −25.57 % from scratch and matches stored values.

## E. What is backed by real satellite data

- Sentinel-1 RTC (VV, VH) temporal medians from Microsoft Planetary Computer STAC (`ecoconnect/gee/stac_acquire.py:229`)
  for Kerala, Odisha (Bhitarkanika), Gulf of Mannar, Sundarbans; Sentinel-2 L2A SCL-masked medians for Kerala.
- GMW v3 2020 labels (`ecoconnect/gee/gmw_labels.py`).
- Model `multi_E1_s1_b0_dev` (U-Net EfficientNet-B0, S1 VV+VH, 4 areas, 800/195/200 tiles): test IoU **0.842**,
  F1 **0.914**, P 0.878, R 0.954 vs GMW weak labels (`outputs/segmentation/multi_E1_s1_b0_dev/metrics.json`). DEVELOPMENT.
- Graph runs `<area>_multi_E1_s1_b0_dev_t0.70` derived from its predictions (Kerala LATEST: 12 patches, 18 links,
  3 components, 204.6 ha).
- The scenes, probability rasters and checkpoints are **not in the repo and not on this machine** now; only derived
  vectors/JSON and quicklook PNGs are tracked.

## F. What is simulated

Every what-if, restoration gain, scenario (remove, restore, reduce_area, add_patch, radius, τ, sensitivity,
threshold), digital-twin card and restoration ranking — labelled `SIMULATED`. Temporal comparisons are
`MODEL-ESTIMATED CHANGE` (or `NOT LIKE-FOR-LIKE`), never observed loss. Acceptance-test field evidence is test data.

## G. What is synthetic

- The paper's Section VI results (P16/P17 prototype, INR costs C1–C8, τ ρ≈0.49) come from synthetic geometry
  (`docs/legacy_experiment/`, reproduced by `tests/test_regression.py`).
- Demo users/organisation (`backend/auth.py:166`), seeded alerts/tasks are demonstration data.
- `prototype_synthetic` runs, if present in the DB, carry `result_kind = synthetic`.

## H. What exists in the research paper but not in code

(`docs/paper_source_main.tex`)
- **UNB7 (EfficientNet-B7)** training — config exists (`configs/train_full.yaml`), never trained. Swin U-Net encoder
  option exists in `ecoconnect/ml/models/unet.py` but never trained.
- 3-class output (mangrove / non-mangrove water / non-habitat) — code trains binary.
- ≈14 000 tiles labelled from FSI atlas / wetland inventory / Ramsar — code uses GMW only, ~1 373 tiles.
- Landsat-9 indices — absent. Radiometric/geometric correction are inherited from RTC products, not implemented.
- 100 m sensitivity grid with four bands (paper Table implstatus) — replaced by patch-level leave-one-out.
- Budget-constrained restoration selection and costed INR ranking — code never invents costs; user CSV only.
- Grad-CAM / SHAP / LIME on the segmentation model — not implemented (paper says "should follow").
- Species-specific dispersal thresholds — τ is a free parameter, not species-calibrated.

## I. What exists in code but not in the paper

The paper describes a client-side prototype with **no backend, database or ML runtime** (Section V-A). Everything
server-side is beyond the paper: FastAPI backend, PostgreSQL/Alembic, RBAC/JWT/refresh tokens, audit log, alerts,
field workflow + EXIF evidence, HITL register, restoration review stage machine, model registry ladder, job queue,
provenance + reproduce, PC/ECA/Kendall/Jaccard sensitivity grid, 11 scenario types, temporal patch tracking,
uncertain-habitat rule, grounded Claude assistant, PDF reports, observability, Docker/CI/Render/Vercel.
Also the actually trained S1 B0 model and real-data graph runs (the paper reports none).

## J. What is missing

- Trained UNB7; S2 / S1+S2 at 4-area scale; calibrated probabilities; threshold chosen on a validation split.
- Multi-year same-model inference (needed for any meaningful temporal statement).
- Any field observation, independent validation data, cost/tenure/legal layers.
- Patches/edges/criticality as DB rows with geometry (still files).
- Retrieval over project documentation (the assistant retrieves run artefacts + DB records only; limitations are a
  hard-coded note list in `backend/assistant_llm.py:146`).
- Push progress (WebSocket/SSE) — jobs are polled every 2 s (`frontend/lib/api.ts:189`).
- `docs/REPRODUCIBILITY.md` is referenced by `scripts/acceptance_test.py` and `README.md` but does not exist.
- Frontend tests (no unit/E2E test files in `frontend/`).
- Split of `backend/main.py` (760 LOC) into routers; retirement of `/simulation` (996 LOC).

## K. What should NOT be implemented (would require unsupported scientific claims)

- A "Validated" model status, accuracy claims vs field truth, or reporting 95.56 % (foundation study) as ours.
- Cause attribution for change (erosion, clearing, aquaculture) from model differences.
- Predictive/forecast language for scenarios; "confirmed loss" from temporal diffs.
- Restoration costs, ROI or budget optimisation from invented or unsurveyed costs.
- Species-level functional connectivity or a "calibrated" τ without dispersal data.
- Automatic retraining from HITL disagreements (no reviewed label pipeline exists).
- Carbon / ecosystem-service valuations, or claims of government adoption / deployment.
- Uncertainty "confidence" tiers presented as calibrated probabilities (model is uncalibrated).

## L. Technical debt

- Uncommitted interdependent work: `backend/scenarios.py` imports untracked `ecoconnect/graph/temporal.py`; CI
  references untracked `scripts/acceptance_test.py`. Committing only the modified files would break the build.
- Stale docstrings: `backend/main.py:742` and `backend/scenarios.py:5` still say compare_periods is
  "OBSERVED (MODEL OUTPUT)"; code now returns `MODEL-ESTIMATED CHANGE` / `NOT LIKE-FOR-LIKE`.
- `remove_polygon` silently falls back to the nearest patch when the drawn polygon hits nothing, and tests both
  lat/lon axis orders (`backend/scenarios.py:73-93`) — result may not reflect what the user drew.
- ML methodology bugs 20–22, 24–28 still OPEN (normaliser cache, tile leakage, threshold on test split,
  `run_pipeline.py:72,93` uses `scenes[-1]`, manifest fields). Bug 23's TTA part appears addressed
  (`scripts/evaluate.py:41` passes `tta`); normaliser part not re-verified.
- 55 eslint warnings; `/simulation` duplication; two run resolvers still coexist (`main._resolve_run`, `routers._run_dir_for`).
- In-memory per-process rate limits (`_ask_log`, login throttle) — reset on restart, not shared across workers.

## M. Security issues

1. **Unauthenticated, unbounded compute** (DoS): `POST /api/runs/{a}/{r}/scenario`, `/reanalyse`, `/what-if`,
   `/restoration` need no login and have no rate limit (`backend/main.py:354,380,482,739`). The `tau` scenario accepts an
   unbounded `taus_km` list with no range check and runs full leave-one-out criticality per value
   (`backend/scenarios.py:129-137`); `reanalyse` accepts any `tau_km`/`k` (`backend/main.py:476-479`). The `radius` and
   `sensitivity` types are bounded. On a free-tier single process this can stall the API.
2. **Anonymous writes to the audit log** (uncommitted change, `backend/routers.py:633-639`): every anonymous assistant
   question now inserts an `AuditLog` row with no rate limit (the 30/h cap applies only to signed-in LLM use) →
   unbounded DB growth / audit flooding on the public API.
3. **Public demo admin**: demo buttons use `NEXT_PUBLIC_DEMO_PASSWORD` (default `demo1234`, `frontend/app/login/page.tsx:16`),
   which is compiled into the public bundle and includes the `state_admin` account (manage_users, validate_models).
   If the live `ECO_DEMO_PASSWORD` equals it, anyone can administer the live instance. Not verified against live values.
4. **Orphan uploads**: `submit_evidence` stores the photo before refusing a request with no coordinates and no EXIF GPS
   (`backend/routers.py` ~386 vs 395) → unreferenced objects in storage.
5. `/api/health` publicly reports CORS configuration (`backend/main.py:141-145`) — low-risk info disclosure.
6. Tokens in `localStorage`/`sessionStorage` (XSS-readable) — mitigated by 60-min access tokens + refresh rotation.
7. Dev JWT secret written to `outputs/.jwt_secret` when `ECO_JWT_SECRET` is unset (`backend/auth.py:20-35`); production
   must set it (render.yaml `sync:false`).

Fixed since 2026-09-27: path traversal, arbitrary checkpoint load, committed demo password, login throttling,
unauthenticated reports/projects, evidence-chain personal data redaction for anonymous users.

## N. Deployment blockers

- **GitHub Actions cannot run** (owner account billing lock) → no automated tests, docker builds or deploy hook.
- Render free plan sleeps; single process; no torch → no live inference. Docker images never built locally.
- Evidence photos persist only when `ECO_STORAGE=s3` + R2 bucket are configured (optional, per docs/DEPLOYMENT.md).
- Model checkpoints / rasters are not in the repo or object storage → probability overlays and raster-level
  reproduction unavailable in any deployment.
- Uncommitted work (section L) must be committed together before any redeploy.

## O. Testing gaps

- No frontend tests (unit or E2E); UI verified only by manual screenshot QA.
- ML pipeline test skipped without torch; CI never ran it either (API-only requirements).
- Not tested: `compare_periods` through the HTTP endpoint, `S3Storage`, live Claude path (fake client only),
  unauthenticated compute limits (none exist), anonymous audit growth, `remove_polygon` fallback, stale-job recovery
  in a real multi-worker setup, PostgreSQL in CI (job defined, never run).
- Acceptance test SKIPs 4 of 20 steps on this machine; raster-level reproduction is untested.
- `tests/test_regression.py` pins the synthetic paper tables and the PREVIOUS Kerala run
  (`kerala-coast_20260920T182222Z`, P17); the current Kerala LATEST (`kerala-coast_multi_E1_s1_b0_dev_t0.70`, P07)
  is checked only by the acceptance script, not by pytest.
