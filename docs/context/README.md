# docs/context — persistent project memory

This folder is the **hand-over memory between chat sessions**. The chat history is deleted after each
feature; the next session (possibly on a fresh `git clone`) must be able to continue **by reading only
these files**, without re-reading the whole codebase or old chats.

## Read order for a new session (≈10 min of reading, not hours)

1. [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md) — what the project is, stack, layout, how to run, real
   results, honesty rules, gotchas. **The single source of truth.**
2. [`SESSION_LOG.md`](SESSION_LOG.md) — newest entry first: what was done last, what is in progress,
   what is next.
3. [`ROADMAP.md`](ROADMAP.md) — phased plan with checkbox status.
4. [`AUDIT_2026-09-27.md`](AUDIT_2026-09-27.md) — full architecture audit (diagrams, API map, ER
   diagram, bugs with file:line, gap analysis, target architecture). Only open the section you need.

## Update rule (whenever the user says "commit / push / merge")

Before committing:

1. Append a new entry at the **top** of `SESSION_LOG.md` (date, goal, what changed + files, tests run
   and their result, decisions made, open issues, next step).
2. Update `PROJECT_CONTEXT.md` if anything structural changed (new module, new endpoint family, new
   result, new env var, new command, new gotcha). Keep it current — delete stale statements.
3. Tick / edit items in `ROADMAP.md`.
4. If an audit bug was fixed, mark it `FIXED (<commit/date>)` in the audit file's bug list.
5. Commit the context changes in the same commit as the code.

Keep entries factual. Never record a result, validation, or deployment that did not happen.
