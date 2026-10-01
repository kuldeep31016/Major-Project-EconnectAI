# API (FastAPI, `backend/`)

_Generated 2026-10-01 from the running app's route table and `/openapi.json` (84 operations). Auth
requirements were read from each route's dependencies._

- **Interactive docs**: `http://localhost:8000/docs` (Swagger UI) and `/openapi.json`, on any running instance.
- **Auth**: `POST /api/auth/login` returns `token` (JWT access token) and `refresh_token`. Send
  `Authorization: Bearer <token>`. When it expires, call `POST /api/auth/refresh`.
- **Auth column**:
  - `public`: no token needed.
  - `signed-in`: any active user.
  - `optional`: works anonymously, more with a token.
  - `cap:<x>`: the role must hold capability `x` (matrix in `docs/SECURITY.md`).
  - "(+ handler)": further role or ownership rules inside the handler.
- Path ids (`study_area`, `run_id`, `experiment_id`, `object_type`, `object_id`, `job_id`) must be slugs, or the
  API returns 400. `run_id` accepts `latest`.
- Heavy work returns **202 + a job**. Poll `GET /api/jobs/{id}`; there is no SSE or WebSocket.

## Health and discovery

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/health` | public | Liveness, version, uptime, effective CORS origins |
| GET | `/api/ready` | public | Readiness: DB reachable and schema at the latest migration (503 otherwise) |
| GET | `/api/study-areas` | public | Configured study areas with their LATEST run summary |
| GET | `/api/runs` | public | All stored runs (`?study_area=`), newest first, `isLatest` flag |
| GET | `/api/scenes` | public | Acquired scene sidecars under `DATA_ROOT/scenes` |
| GET | `/api/scenes/{study_area}/quicklook.png` | public | Sensor quicklook from the scene raster (needs the TIFF; cached) |
| GET | `/api/admin/system` | cap:view_audit | Health, schema, jobs, in-memory request metrics, store sizes |

## Run artefacts (read)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/runs/{study_area}/{run_id}/bundle` | public | Everything the UI needs for one run (restoration rule applied) |
| GET | `/api/runs/{study_area}/{run_id}/manifest` | public | Run manifest (config, data source, provenance) |
| GET | `/api/runs/{study_area}/{run_id}/patches` | public | `patches.geojson` |
| GET | `/api/runs/{study_area}/{run_id}/graph` | public | `graph.json` |
| GET | `/api/runs/{study_area}/{run_id}/metrics` | public | IIC / PC / ECA and interface score |
| GET | `/api/runs/{study_area}/{run_id}/criticality` | public | Leave-one-out criticality per patch |
| GET | `/api/runs/{study_area}/{run_id}/explanations` | public | Rule-based explanations |
| GET | `/api/runs/{study_area}/{run_id}/restoration` | public | Restoration candidates (uncertain-habitat rule applied) |
| GET | `/api/runs/{study_area}/{run_id}/tau-sensitivity` | public | Stored τ sensitivity |
| GET | `/api/runs/{study_area}/{run_id}/report` | public | Decision-support report composed from the run's artefacts |
| GET | `/api/runs/{study_area}/{run_id}/files/{name}` | public | Raw file from the run folder (basename only) |
| GET | `/api/runs/{study_area}/{run_id}/probability.png` | public | Probability raster as a WGS84-bounded PNG (needs the TIFF; cached) |
| GET | `/api/runs/{study_area}/timeline` | public | One entry per scene year with a comparable run, plus mask difference when rasters exist |
| GET | `/api/runs/{study_area}/{run_id}/evidence/{object_type}/{object_id}` | optional | Evidence chain behind a patch or candidate (field personal data redacted when anonymous) |
| GET | `/api/provenance/{study_area}/{run_id}` | public | Ordered lineage (`?object_type=patch|candidate&object_id=`) |

## Interactive analysis (recomputed per request; results labelled SIMULATED)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/runs/{study_area}/{run_id}/what-if` | public | Exact removal of patches (Eq. 10) |
| POST | `/api/runs/{study_area}/{run_id}/restoration` | public | Eq. 11–12 ranking, cost-aware only with user-supplied costs |
| POST | `/api/runs/{study_area}/{run_id}/reanalyse` | public | Rebuild the graph with another τ / k / metric |
| POST | `/api/runs/{study_area}/{run_id}/scenario` | public | Scenario Lab (remove, restore, reduce area, add patch, radius, τ, sensitivity, threshold, compare periods) |
| GET | `/api/runs/{study_area}/{run_id}/restoration/feasibility` | public | Gain ranking plus rule-based feasibility ("not assessed" when data are missing) |
| GET | `/api/scenarios` | public | Saved scenarios |
| POST | `/api/scenarios` | signed-in | Save a scenario. The server recomputes the result from the params. |

## Pipeline, jobs, reproducibility

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/segment` | cap:run_analysis | Queue inference (optional) and graph analysis as a `segment` job (202, one at a time) |
| POST | `/api/runs/{study_area}/{run_id}/reproduce` | signed-in | Queue a `reproduce` job that recomputes a stored run and diffs every result (≤ 3 queued per user) |
| POST | `/api/jobs` | signed-in (+ handler) | Submit a `scenario` job (`segment` must use `/api/segment`) |
| GET | `/api/jobs` | signed-in | List jobs (own jobs; all jobs with `view_audit`) |
| GET | `/api/jobs/{job_id}` | signed-in (+ handler) | Job status, progress, stage, log, result |
| POST | `/api/jobs/{job_id}/cancel` | signed-in (+ handler) | Cancel a QUEUED/RUNNING job |
| GET | `/api/artifacts` | public | Artifact registry (key, sha256, size, run/model) |
| POST | `/api/registry/sync` | cap:run_analysis | Re-sync on-disk runs, models and artifacts into the DB |
| GET | `/api/registry/{study_area}` | public | Registry index of a study area (scenes, labels, versions, models) |

## Models and experiments

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/models` | public | Segmentation experiments found on disk |
| GET | `/api/models/{experiment_id}` | public | Metrics, config, history, calibration and assets of one experiment |
| GET | `/api/models/{experiment_id}/asset/{name}` | public | PNG asset of an experiment |
| PATCH | `/api/models/{experiment_id}/status` | signed-in (+ handler: manage_models; VALIDATED needs validate_models and evidence) | Move along the status ladder |
| GET | `/api/registry-models` | public | Registered models with status and headline test metrics |
| GET | `/api/experiments/compare` | public | Side-by-side config and metrics of recorded experiments |
| GET | `/api/model-cards` | public | Model cards (published baseline, prototype and our results kept separate) |

## Auth and users

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/login` | public (throttled) | Username + password → access and refresh tokens |
| POST | `/api/auth/refresh` | public (refresh token) | Rotate the refresh token and get a new access token |
| POST | `/api/auth/logout` | optional | Revoke the refresh-token family |
| GET | `/api/auth/me` | signed-in | Current user and capabilities |
| GET | `/api/auth/roles` | public | Roles and their capabilities |
| GET | `/api/users` | cap:assign_tasks | List users (for task assignment) |
| POST | `/api/users` | cap:manage_users | Create a user |

## Alerts and detections

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/alerts` | public | Alerts (severity, trigger numbers, suggested next step) |
| POST | `/api/alerts/generate/{study_area}` | cap:manage_alerts | Run the alert rules for a study area |
| PATCH | `/api/alerts/{alert_id}` | cap:manage_alerts | Change alert status (OPEN, ACKNOWLEDGED, ASSIGNED, RESOLVED, DISMISSED) |
| GET | `/api/detections` | public | Detections and their verification status |
| POST | `/api/detections` | cap:review_detections | Register or update a detection |
| PATCH | `/api/detections/{det_id}/status` | cap:review_detections | Change the verification status (field-verified states need accepted evidence) |

## Field verification and human-in-the-loop

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/field/checklist` | public | Observation checklist template |
| GET | `/api/field-tasks` | signed-in (+ handler) | Tasks (field officers see only their own) |
| POST | `/api/field-tasks` | cap:assign_tasks | Create and assign a field task |
| PATCH | `/api/field-tasks/{task_id}/status` | signed-in (+ handler) | Progress a task (role and ownership rules) |
| GET | `/api/field-tasks/{task_id}/evidence` | signed-in | Evidence of a task |
| POST | `/api/field-tasks/{task_id}/evidence` | cap:submit_evidence (+ handler) | Multipart evidence: observation, checklist, optional photo (≤ 8 MB, JPEG/PNG/WebP, EXIF GPS) |
| PATCH | `/api/evidence/{evidence_id}/verify` | cap:verify_evidence | Accept or reject evidence (records model disagreements) |
| GET | `/api/evidence/photo/{name}` | signed-in | Evidence photo from object storage |
| GET | `/api/hitl/disagreements` | cap:review_detections | Model-vs-field disagreement register |
| PATCH | `/api/hitl/disagreements/{disagreement_id}` | cap:review_detections | Include or exclude a disagreement for future training |
| GET | `/api/hitl/export` | cap:review_detections | GeoJSON of included disagreements |

## Restoration decisions, projects, reports

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/restoration/reviews` | cap:review_detections | Open a review for a restoration candidate |
| GET | `/api/restoration/reviews` | signed-in | List reviews |
| PATCH | `/api/restoration/reviews/{review_id}/gis` | cap:review_detections | GIS review stage |
| POST | `/api/restoration/reviews/{review_id}/field-task` | cap:assign_tasks | Create the field-verification task for a review |
| PATCH | `/api/restoration/reviews/{review_id}/feasibility` | cap:review_detections | Record feasibility factors (unset = "Not assessed") |
| PATCH | `/api/restoration/reviews/{review_id}/decision` | cap:decide_restoration | Human decision (APPROVED needs a field-verified site) |
| GET | `/api/projects` | signed-in | Conservation projects |
| POST | `/api/projects` | cap:manage_projects | Create a project |
| GET | `/api/projects/{project_id}` | signed-in | Project detail with tasks and reports |
| PATCH | `/api/projects/{project_id}` | cap:manage_projects | Update a project |
| POST | `/api/reports/generate` | cap:generate_report | Official report from run artefacts, project and field verification (stored and audited) |
| GET | `/api/reports` | signed-in | Stored official reports |
| GET | `/api/reports/{report_id}/pdf` | signed-in | PDF of a stored report (download audited) |

## Assistant and audit

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/chat` | optional | EcoConnectAI Assistant (RAG): structured → cache → retrieval → optional LLM; see docs/GENAI.md. `GET /api/chat/diagnostics`, `POST /api/chat/reindex`, `DELETE /api/chat/cache` need view_audit. |
| POST | `/api/assistant/ask` | optional | Evidence-grounded answer. Claude for signed-in users when configured (per-user hourly cap), template otherwise. Every question is audited. |
| GET | `/api/audit` | cap:view_audit | Audit log |
