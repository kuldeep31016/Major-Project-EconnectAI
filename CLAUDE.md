# EcoConnectAI — instructions for Claude Code

**Start every session by reading `docs/context/README.md`, then `docs/context/PROJECT_CONTEXT.md` and the
top entry of `docs/context/SESSION_LOG.md`.** They hold the full project context; do not re-read the whole
codebase or ask for old chats. Open `docs/context/AUDIT_2026-09-27.md` / `ROADMAP.md` sections only as needed.

Rules:
- Never fabricate results, validation, deployment, costs, novelty or patentability. Metrics are vs GMW weak
  labels; scenarios are SIMULATED; nothing is field-validated. See PROJECT_CONTEXT §2.
- Commit / push / merge only when the user asks. At that moment, first update `docs/context/`
  (SESSION_LOG entry on top, PROJECT_CONTEXT if structure changed, ROADMAP checkboxes, audit bug status)
  and include it in the same commit.
- Preserve working functionality; run `.venv/bin/python -m pytest -q` (and frontend lint/build when touched).
- Frontend uses a Next.js version with breaking changes — see `frontend/AGENTS.md`.
