# EcoConnectAI — Roadmap (phase status)

Legend: `[ ]` not started · `[~]` in progress · `[x]` done (add date + commit) · Priority P0 must work,
P1 high value, P2 research extension, P3 optional. Bug numbers refer to `AUDIT_2026-09-27.md §I`.

## Phase 0 — Audit & context (done)
- [x] Full codebase audit, diagrams, gap analysis, target architecture (2026-09-27)
- [x] `docs/context/` hand-over memory + root `CLAUDE.md` pointer (2026-09-27)

## Phase 1 — Stabilise: security, cleanup, tests, config, Docker (done 2026-09-28 except noted)
- [x] P0 Fix path traversal: validate `study_area`/`run_id` (slug regex + resolved-path containment) in all resolvers (bug 1)
- [x] P0 `/api/segment`: only allow registered scenes/checkpoints by id; enum `result_kind` (bug 2)
- [x] P0 Remove committed demo password from render.yaml/compose; require env in prod; login rate limit
- [x] P0 Honest-label UI fixes: experiments fabricated fallbacks (11), command text (13), landing disclaimers, graph cut-vertex vs high-S (19), delete unused landing files with invented INR costs
- [x] P0 Regression tests: stored Kerala P17 result reproduces (S 0.270, cut vertex, rank 3); synthetic fixture == `docs/legacy_experiment/results_synthetic_prototype.json`; determinism
- [x] P1 Backend bugs 3–10; frontend bugs 12, 14–18
- [x] P1 Unify run resolver / path helpers / DATA_ROOT (`backend/paths.py`)
- [ ] P1 Split `main.py` into domain routers (deferred to Phase 2 with jobs)
- [x] P1 Refresh stale docs (README, MODEL_CARD, RESULTS_PROVENANCE, EXPERIMENTS) with real numbers
- [x] P1 docker-compose: browser-reachable API URL, env-based secrets, frontend .dockerignore
- [x] P1 compose profiles `postgres` (PostGIS) + `worker`
- [ ] P2 Retire `/simulation` duplication (deferred to Phase 4; its Timeline tab has no replacement yet) (merge into `/scenario` + `/restoration`), remove dead routes/components

## Phase 2 — Data platform (done 2026-09-28 except patches-as-rows)
- [x] P1 Alembic migrations (0001 baseline, 0002 jobs+artifacts); Postgres tested (local PG18 + CI PostGIS job)
- [x] P1 Storage abstraction (LocalFS / S3-compatible) + `artifacts` table (sha256, kind, run, model, version)
- [x] P1 DB-backed job system + inline/standalone worker; `/api/segment` → job; `scenario` job type (reanalyse/report stay sync: ms)
- [ ] P2 Patches / edges / criticality as DB rows with geometry

## Phase 3 — Model registry, experiments, provenance, reproducibility (done 2026-09-28)
- [x] P1 Model registry status ladder + validation workflow (admin + independent non-GMW evidence)
- [x] P1 Experiment comparison API + UI (registry synced from outputs/segmentation)
- [x] P0 Provenance lineage API + drawer UI; manifests record git commit, config_sha256, input_sha256
- [x] P1 "Reproduce this analysis" job (graph level; raster level when raster present) — all 11 stored runs reproduce

## Phase 4 — Analysis features (P1 done 2026-09-28)
- [x] P1 Sensitivity grid τ×k (Spearman, Kendall, top-5 Jaccard, per-patch rank range, verdict); threshold variant already existed
- [x] P1 Scenario types reduce_area, add_patch, radius, sensitivity + BeforeAfter panel
- [x] P1 Digital twin card on /graph (remove selected / restore candidate → redrawn network + before/after)
- [x] P2 Temporal analysis: polygon-overlap patch tracking (stable/grown/shrunk/split/merged/new/disappeared) + comparability check (2026-10-01); fragmentation indicators still open
- [ ] P2 Transparent multi-criteria criticality (shown weights)

## Phase 5 — Restoration, field, HITL (done 2026-09-28)
- [x] P1 Restoration intelligence fields ("Not assessed"), model-recommendation vs human-decision states
- [x] P1 Field observation checklist; link observation → model result; model-disagreement flag
- [x] P2 HITL disagreement dataset export (no auto-retrain)

## Phase 6 — Grounded GenAI assistant (done 2026-09-28; live Claude path untested — no API key on dev machine)
- [x] P1 Retrieval → evidence pack → Claude → cited answer; "not enough evidence" refusal
- [x] P1 NL → structured ScenarioCommand → validator → engine, confirm before run; template fallback when no API key

## Phase 7 — CI/CD, observability, security, deployment
- [x] P0 GitHub Actions: ruff, pytest, eslint, tsc, next build, pip-audit/npm audit, docker build
- [x] P1 `/health` (uptime), `/ready`, X-Request-ID, JSON logs, route metrics, `/system` admin page (2026-09-30)
- [x] P1 60-min access + rotating refresh tokens (reuse revokes family), logout; auth on reports/projects, anonymous evidence chain redacted (2026-09-30)
- [x] P2 docs/DEPLOYMENT.md rewrite + cost table; render.yaml secrets sync:false, /api/ready health check; CI deploy job via RENDER_DEPLOY_HOOK_URL (2026-09-30) (free-tier stack)

## Phase 8 — Docs, GitHub, demo
- [x] P1 README capability table; docs/LIMITATIONS.md; docs/RESEARCH_IP_NOTES.md (2026-09-28)
- [x] P2 CONTRIBUTING, DATA, RESEARCH docs (2026-09-30)
- [x] P1 Guided demo `/demo` (7-chapter scrollytelling, live data, P17 chosen by rule) + landing links (2026-09-28)
- [x] P2 Server-side PDF report (fpdf2; /api/reports/{id}/pdf, hashed artifact, audited) (2026-09-30)

## Needs new ML experiments / external data (not code-only)
- Fix tiling leakage + normaliser cache, rebuild 4-area tiles, threshold on validation split, re-evaluate
- UNB7 on GPU; S2 / S1+S2 at 4-area scale; calibration; multi-year inference (same model)
- External: multi-year scenes, field observations, cost/ownership/legal layers

## Phase 9 — Spec-2 hardening (2026-10-01)
- [x] Patch importance tab (area rank vs criticality rank, sortable leave-one-out table, explain/simulate/map)
- [x] EXIF GPS on evidence; location never invented; photo stored only after checks; field officers see only own evidence
- [x] Public compute bounded (per-client CallLimiter, list/range limits), proxy headers, anon assistant cap, all questions audited
- [x] scripts/acceptance_test.py (20 steps: 16 PASS / 4 SKIP without scenes/checkpoints/torch) in CI; Makefile
- [x] Docs: AUDIT, IMPLEMENTATION_STATUS, PAPER_IMPLEMENTATION_MATRIX, IP_READINESS, ARCHITECTURE, SECURITY, API, REPRODUCIBILITY, ML, GEOSPATIAL_PIPELINE, CONNECTIVITY, SCENARIOS, RESTORATION, GENAI; README rewritten
- [ ] RAG over docs/paper + deterministic tier-1 answers + answer cache (user's pasted spec-3, not yet started)
- [ ] Demo admin account exposed via public demo password (user decision); restoration review can approve with all factors "Not assessed"
- [ ] Threshold chosen on test split (bug 22); tiling leakage; LICENSE/CITATION (owner's choice)

