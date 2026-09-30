# Contributing to EcoConnectAI

## Ground rules
1. **Never fabricate results.** No invented numbers, costs, validation, deployments or ecological claims — in code,
   UI copy, fixtures or docs. If data is missing, show "Not assessed" / "not recorded" / an empty state.
2. **Label every result**: `DEVELOPMENT-SUBSET RESULT — NOT FINAL`, `PROTOTYPE / SYNTHETIC`, `SIMULATED`,
   `PUBLISHED BASELINE — NOT OUR RESULT`. Model metrics are agreement with GMW reference labels.
3. **Keep stored results reproducible.** `tests/test_regression.py` pins the stored Kerala P17 / C1 results and the
   paper tables; a change that alters them needs a new run and an explanation, not a test edit.
4. **The AI assistant may only propose.** Anything that changes state goes through a validated API and a human action.

## Setup
```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements-api.txt pytest pandas ruff   # add requirements.txt for ML
cd frontend && npm ci && cd ..
```
Start with `docs/context/README.md` — it is the project's hand-over memory.

## Before opening a pull request
```bash
.venv/bin/ruff check backend ecoconnect scripts tests --select F
.venv/bin/python -m pytest -q
cd frontend && npx tsc --noEmit -p . && npx eslint . && npm run build
```
- Schema change → new Alembic revision in `backend/migrations/versions/` (never edit an applied one).
- New endpoint → auth/capability check, input validation, audit entry for state changes, and a test.
- UI change → verify in the browser (desktop + mobile width) and keep result labels visible.
- Update `docs/context/` (SESSION_LOG entry, ROADMAP, PROJECT_CONTEXT if structure changed) in the same PR.

## Security
Report vulnerabilities privately to the maintainer (see `docs/SECURITY.md`); do not open public issues for them.
Never commit `.env`, credentials, datasets or checkpoints (see `.gitignore`).
