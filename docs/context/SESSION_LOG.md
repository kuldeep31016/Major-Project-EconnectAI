# Session log (newest first)

Template for each entry:

```
## YYYY-MM-DD — <short title>
Goal:
Changed (files):
Tests: <command> → <result>
Decisions:
Open issues / not done:
Next step:
```

---

## 2026-09-28 — Phase 3: registry, experiments, provenance, reproducibility

Changed: ecoconnect/pipeline/provenance.py (code_version, config_sha256, file_sha256) → run manifests + trainer
experiment.json; db.Model status/display_name/version/code_commit/validation (migration 0003); registry sets status
once; auth caps manage_models/validate_models; backend/{provenance.py, registry_api.py}; reproduce job; evidence
chain gains `lineage`. Frontend: components/analysis/lineage-panel.tsx (steps + Reproduce button) in the evidence
drawer; /experiments shows registry status, promote button, compare table; lib/api.ts types/clients.
Tests: tests/test_registry.py (ladder rules, compare, P17 lineage, reproduce, fingerprints) → 76 passed/1 skipped.
Verified in browser: compare table real numbers; P17 lineage; "Reproduced exactly (graph level)".
All 11 stored runs reproduce exactly at graph level (raster level impossible here: rasters not in git).
Next: Phase 4 — sensitivity engine UI (τ/threshold/k, rank correlation, stability), scenario engine (multi-remove,
reduce area, hypothetical patch, radius, before/after), network digital twin; maybe retire /simulation.

## 2026-09-28 — Phase 2: migrations, storage, artifacts, jobs

Changed: backend/{migrate.py, migrations/, storage.py, artifacts.py, jobs.py, job_handlers.py, jobs_api.py, worker.py};
db.py (Job, Artifact; init_db → Alembic; empty ECO_DATABASE_URL = unset); paths.py gained run_summary; main.py:
segment split into `_prepare_segment` (sync 4xx) + job, `/api/ready`, inline worker in lifespan; registry syncs
artifacts; frontend lib/api.ts (JobRecord, fetchJob, waitForJob, job-based postSegment), upload page shows stage;
CI job on postgis/postgis:16-3.4; compose profiles postgres/worker; requirements add alembic; .env.example.
Tests: 71 passed/1 skipped (SQLite); 70 passed on local PostgreSQL 18 (before the /api/ready test was added);
next build OK. Inline worker verified on real Kerala τ-sweep job.
Found: GitHub Actions blocked — account locked (billing). Not a code failure.
Deferred: patches/edges as DB rows with geometry (needs PostGIS; with Phase 3/4).
Next: Phase 3 — model registry (status ladder + validation workflow), experiment tracking/comparison, provenance chain
API + "Why am I seeing this?" UI, git commit/config hash in manifests, "Reproduce this analysis".

## 2026-09-28 — Phase 1: security, honesty, regression tests, CI

Changed: `backend/security.py` (new: slug validation as app-level dependency, `contained()`, login throttle),
`backend/paths.py` (new: single run resolver/path helpers), main/routers/scenarios/registry/alerts refactored onto it;
`/api/segment` restricted to .tif under DATA_ROOT/outputs + `outputs/segmentation/<exp>/best_model.pth`, result_kind
fixed to development; failed logins audited; `/api/health` no longer leaks paths; verify_evidence cascade fixed (reject →
task IN_PROGRESS, alert untouched, cascade audited); alert regen keeps task-referenced alerts (DISMISSED); photo upload
sync + magic bytes + uuid names; saved scenarios recomputed server-side; FK/assignee validation (400 not 500).
Frontend: experiments fabricated fallbacks removed, landing honesty strip + reworded claims, 13 unused components
deleted (incl. invented INR costs), login no silent demo1234, evidence photos via authed blob, Esri labels instead of
dead Stamen, what-if order-insensitive compare, year sync, error handling. render.yaml/compose no committed password;
compose API URL fixed; `frontend/.dockerignore`; `.github/workflows/ci.yml`; ruff config in pyproject.
Docs: README/MODEL_CARD/RESULTS_PROVENANCE/EXPERIMENTS updated with 4-area result + LATEST P17.
Tests: `pytest -q` → 63 passed, 1 skipped; ruff F clean; tsc OK; eslint 0 errors; `next build` OK. Docker not built
locally (daemon off).
Decisions: defer main.py split to Phase 2 (jobs move heavy endpoints); defer /simulation retirement to Phase 4.
Next: Phase 2 — Alembic + Postgres/PostGIS option, storage abstraction + artifacts table (sha256), job system + worker.

## 2026-09-27 — Full audit + context folder

Goal: user asked for a complete audit of the project (architecture, data flow, ER, ML, graph, frontend,
API, debt, bugs, security, scalability, implemented/partial/mock, labelling) against their
"next-generation platform" spec, and a persistent context folder so future chats need no history.

Changed (files):
- `docs/context/README.md` (how to use + update rule), `PROJECT_CONTEXT.md` (source of truth),
  `AUDIT_2026-09-27.md` (full audit A–P, gap analysis, target architecture, classification),
  `ROADMAP.md` (phases 1–8 with checkboxes), `SESSION_LOG.md` (this file).
- `CLAUDE.md` at repo root (auto-loaded by Claude Code; points to docs/context).
- No application code changed.

Tests: fresh clone, venv from `requirements-api.txt` + pytest + pandas →
`.venv/bin/python -m pytest -q` → **43 passed, 1 skipped** (ML smoke test skipped: torch not installed).

Decisions:
- Audit first, no rewrites (per spec §50). Phase 1 starts with security (path traversal is exploitable).
- Context lives in-repo (`docs/context/`) so it survives chat deletion and fresh clones.

Open issues: all bugs in audit §I are OPEN. Nothing committed yet (user commits on request).

Next step: Phase 1 — fix path traversal + `/api/segment` path validation, remove committed demo password,
honest-label UI fixes, P17/synthetic regression tests, then docs refresh.
