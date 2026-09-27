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

## Phase 3 — Model registry, experiments, provenance, reproducibility
- [ ] P1 Model registry with status ladder (Development/Experimental/Candidate/Validated) + validation workflow
- [ ] P1 Experiment tracking table seeded from `experiments.csv` + comparison UI
- [ ] P0 Provenance chain API + "Why am I seeing this?" UI; capture git commit, config hash, artifact ids in new manifests
- [ ] P1 "Reproduce this analysis" (re-run graph stage from stored config/artifacts; diff results)

## Phase 4 — Analysis features
- [ ] P1 Sensitivity engine (τ 3/5/8, threshold, k) with rank correlation + stability summary
- [ ] P1 Scenario engine: multi-remove, reduce area, hypothetical patch, radius; before/after panel
- [ ] P1 Network digital twin view (cut vertices, clusters, isolated, interactive remove/restore)
- [ ] P2 Temporal analysis with same-model enforcement, fragmentation indicators
- [ ] P2 Transparent multi-criteria criticality (shown weights)

## Phase 5 — Restoration, field, HITL
- [ ] P1 Restoration intelligence fields ("Not assessed"), model-recommendation vs human-decision states
- [ ] P1 Field observation checklist; link observation → model result; model-disagreement flag
- [ ] P2 HITL disagreement dataset export (no auto-retrain)

## Phase 6 — Grounded GenAI assistant
- [ ] P1 Retrieval → evidence pack → Claude → cited answer; "not enough evidence" refusal
- [ ] P1 NL → structured ScenarioCommand → validator → engine, confirm before run; template fallback when no API key

## Phase 7 — CI/CD, observability, security, deployment
- [x] P0 GitHub Actions: ruff, pytest, eslint, tsc, next build, pip-audit/npm audit, docker build
- [ ] P1 `/health`, `/ready`, request IDs, structured logs, admin health page
- [ ] P1 Refresh tokens / shorter access tokens; auth on sensitive reads
- [ ] P2 Cloud deployment doc + cost estimate (free-tier stack)

## Phase 8 — Docs, GitHub, demo
- [ ] P1 README rewrite; LIMITATIONS, CONTRIBUTING, DATA, RESEARCH, Research & IP notes
- [ ] P1 Guided demo mode (real P17 story), landing polish
- [ ] P2 Server-side PDF report with provenance + limitations

## Needs new ML experiments / external data (not code-only)
- Fix tiling leakage + normaliser cache, rebuild 4-area tiles, threshold on validation split, re-evaluate
- UNB7 on GPU; S2 / S1+S2 at 4-area scale; calibration; multi-year inference (same model)
- External: multi-year scenes, field observations, cost/ownership/legal layers
