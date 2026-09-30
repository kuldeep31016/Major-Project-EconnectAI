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

## 2026-10-01 — accuracy pass, plain-language layer, meaningful alerts

Goal: every module accurate and understandable to non-experts/funders.
Changed: Kerala LATEST → multi_E1 run (user choice). restoration_rules (uncertain_habitat rule) moved to
ecoconnect/pipeline, applied in scenarios feasibility (verdict field_check), /bundle, restoration route, assistant
evidence, insight template answers (+ new "cut" intent), PDF report (Class column). alerts.py: plain titles +
"Suggested next step", restoration vs uncertain alerts separated (max 3 each), RULES_VERSION=2 stamped in evidence;
ensure_alerts() at startup creates/refreshes OPEN alerts of LATEST runs (acted-on alerts kept). /api/runs marks
isLatest (header period selector used runs[0] → showed 2025 wrongly). Frontend: landing figures live via
hooks/use-landing-story.tsx, new PurposeSection ("In plain words"), plain copy in pipeline/core/capabilities/why
sections (removed false "dual-sensor fusion" claim — model is S1 VV+VH only), per-page "In plain words" line
(lib/plain-language.ts in AppShell), glossary tooltips (components/shared/term.tsx), alerts sorted by severity,
navbar CTA hidden on phones. check_deployment what-if uses the run's top patch (P17 no longer exists in LATEST).
Tests: pytest 96 passed 1 skipped; ruff F clean; tsc ok; eslint 0 errors; next build ok; 18 routes crawled.
Open: Odisha/Sundarbans large "restoration sites" (up to 587 ha) pass the relative rule — user may want an absolute cap.
Next: user's big spec — gap check vs existing docs/features (most phases done), add missing docs/Makefile, E2E acceptance test.

## 2026-10-01 — sign-in page redesign (user mockup) + QA standard

frontend/app/login/page.tsx rebuilt to the user's mockup: left story panel (Instrument Serif headline via lib/fonts.ts,
3 feature cards, real Vembanad imagery graded emerald + dashed contours), right card (icon inputs, Forgot password =
honest "ask your State Administrator" note, Remember me = real: tokens in sessionStorage when unchecked, via
lib/api setRememberSession/readKey/writeKey), collapsible demo accounts. "Continue with Google" deliberately omitted
(no OAuth). Height-aware sizing (clamp/vh) + `short:` custom variant (max-height 1000px, globals.css) → fits one
viewport: QA-measured at 1110×600 (user's window), 1280×720, 1440×900, 1920×1080, 375×812. Assistant hidden on /login.
Old Render service suspended (503). User rule: screenshot/measure every UI change at those sizes before reporting.
Next: user wants all modules functionally perfect and the product explained in plain language for funders/stakeholders.

## 2026-09-30 — two Render services found; correct one passes 14/14

Live CORS '*' came from an old duplicate Render service at major-project-econnectai.onrender.com (env ECO_CORS_ORIGINS
= '*', 1 char, per new /api/health diagnostics; a failed-login probe was NOT written to Neon). The service the user
configured is srv-dapspsmgekts73f33760 → https://major-project-econnectai-lzaw.onrender.com: check_deployment 14/14
PASS. PRs #10–#12: cors_config (trim, lone '*' kept permissive + loud warning, ECO_CORS_ALLOW_ALL), health CORS report.
frontend/Dockerfile default API URL updated. User actions: Vercel NEXT_PUBLIC_API_URL → lzaw URL + redeploy; suspend old
service; GitHub billing lock; optional R2 + Starter plan.

## 2026-09-30 — production live on Neon; CORS hardening

User set Render env (Neon ECO_DATABASE_URL, CORS origins incl. Vercel URL, Anthropic key, new JWT secret; regex removed).
Neon verified from here: schema 0005, Render seeded 6 users / 11 runs / 5 models / 167 artifacts. Live CORS still
answered '*' although local reproduction with the same value was correct → security.cors_config(): split on , and
whitespace, strip trailing '/', drop '*' unless ECO_CORS_ALLOW_ALL=1; startup logs "cors configured origins=[...]";
/api/admin/system shows effective origins. Test added (94 passed). If '*' persists after deploy, look for another
source of ECO_CORS_ORIGINS in Render (environment group / secret file).

## 2026-09-30 — local PostgreSQL + live deployment check

Added scripts/local_postgres.sh (init/start/stop/status/url; data/postgres) — dev DB created, migrated to 0005, synced
(4 areas, 11 runs, 5 models, 167 artifacts, 6 demo users); full suite 93 passed on a fresh local PG test DB.
.env now points at it. Added scripts/check_deployment.py; live run: health/ready/run data/what-if P17 −27.0 %/
traversal/auth all PASS; CORS allow-origin '*' FAIL (user fix in Render). Vercel CLI not logged in; no Render/Neon/R2
CLIs — account creation and entering secrets are the user's steps (docs/DEPLOYMENT.md §3, final chat message).

## 2026-09-30 — Phase 8 finish + Phase 7 + deployment prep

Changed: backend/report_pdf.py + GET /api/reports/{id}/pdf (reports page downloads it for official-* reports);
CONTRIBUTING.md, docs/DATA.md, docs/RESEARCH.md; RESEARCH_IP_NOTES public-disclosure note (repo is public).
Phase 7: backend/observability.py, backend/admin_api.py, frontend /system page (+nav for admin/senior); refresh tokens
(db RefreshToken, migration 0005, auth.issue/rotate/revoke, routers refresh/logout; frontend lib/api tryRefresh single-flight
retry on 401 except login/refresh/logout — bug found in browser: /api/auth/me was excluded); auth required on
/api/reports, /api/projects*; anonymous evidence chain redacts field personal data. Evidence photos now in object
storage. boto3 in requirements-api. render.yaml: /api/ready health check, secrets sync:false (DB URL, CORS origin,
Anthropic key, R2). CI: deploy job (needs RENDER_DEPLOY_HOOK_URL secret). docs/DEPLOYMENT.md rewritten with cost table.
User gave Anthropic key → only in local .env.
Tests: 93 passed/1 skipped; eslint 0 errors; next build OK. Browser: /system live; corrupted access token auto-refreshed.
CI: still "account locked due to a billing issue" (not code).
Next: user creates accounts/secrets (Neon, R2, Render env, Vercel env, GitHub secret) → deploy; then live-test assistant
with a few questions only (user wants the key conserved).

## 2026-09-28 — Phase 8 (part): guided demo, IP notes, limitations

Changed: frontend/app/demo/page.tsx + components/demo/network-canvas.tsx (Design Style 5 editorial, brand colours kept;
real S1 quicklook positioned by X-Bounds, real patch polygons from graph.json, links animate in, focus = cut vertex
maximising rank_by_area − rank (P17), live postWhatIf + restore scenario; chapter = last [data-chapter] above 60 %
viewport — onViewportEnter was unreliable on mobile). lib/api.ts fetchRunGraph/Criticality/Restoration/Manifest/Metrics.
Landing "Kerala Demo" links → /demo; assistant hidden on /demo. docs/RESEARCH_IP_NOTES.md (no novelty/patent claims,
prior-art to check, disclosure-timing warning), docs/LIMITATIONS.md, README capability table.
Tests: 90 passed/1 skipped; eslint 0 errors; next build OK. Browser-verified desktop + mobile.
Next (user stopped for the day): rest of Phase 8 (CONTRIBUTING/DATA/RESEARCH docs, server-side PDF report) or
Phase 7 (observability /health+/ready UI, refresh tokens, auth on sensitive reads, deployment + cost doc).

## 2026-09-28 — Phases 5–6: restoration decisions, field checklist, HITL, grounded assistant; logo

Changed: db RestorationReview/ModelDisagreement/Evidence.checklist + FIELD_CHECKLIST/REVIEW_STAGES/FEASIBILITY_FACTORS
(migration 0004); backend/workflow_api.py; routers submit_evidence(checklist) + verify_evidence → record_disagreement;
auth decide_restoration. backend/assistant_llm.py; /api/assistant/ask rewritten (optional_user, rate limit, audit);
insight.py what-if regex fixed (lowercase p17 fell through to summary). requirements add anthropic>=1.0; .env.example.
Frontend: components/restoration/review-panel.tsx (model recommendation vs human decision, stages, Not assessed);
/field checklist selects + Disagreements register (include/exclude, GeoJSON export); assistant-launcher: mode badge,
citations, ProposedScenario card (Run → BeforeAfter). Logo: all logos theme green gradient (#15803d→#0f5132),
"AI" #4ade80, favicon.ico (Vercel default) → app/icon.svg leaf.
Tests: tests/test_phase5.py, tests/test_assistant.py (stubbed Claude client) → 90 passed/1 skipped; workflow tests
made order-independent. Browser-verified: review panel with real C1; template assistant P17 what-if −27.0 %.
Open: Claude path never called live (no ANTHROPIC_API_KEY locally). User wants: everything real (no mock), highly
animated/unique UI, patent + funding → never claim patentability; Phase 8 has Research & IP notes.
Next: user to choose Phase 8 (animated landing, guided P17 demo story, flow animations, IP notes) or Phase 7.

## 2026-09-28 — Phase 4 (P1): sensitivity, scenario types, digital twin

Changed: ecoconnect/graph/sensitivity.py (new); backend/scenarios.py types reduce_area, add_patch (bbox-validated,
labelled hypothetical), radius, sensitivity; main.ScenarioBody new fields; routers save mapping keys.
Frontend: components/simulation/before-after.tsx (shared); /scenario kinds E–H + inputs + sensitivity tables;
/graph "Digital twin · what-if" card (remove selected / restore candidate; scenario graph stored in state, not memo).
Tests: tests/test_sensitivity.py → 80 passed/1 skipped. Browser-verified: P17 removal −27.0 %, 2→3 components;
sensitivity grid table + verdict.
Deferred (P2): temporal fragmentation indicators, multi-criteria criticality, retire /simulation (graph "Simulate" links there).
Next: Phase 5 — restoration intelligence ("Not assessed" fields, model recommendation vs human decision states),
field observation checklist, model-disagreement flag, HITL dataset export.

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
