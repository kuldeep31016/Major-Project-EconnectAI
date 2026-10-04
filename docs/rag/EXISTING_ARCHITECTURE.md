# Existing architecture (inspected before the RAG work)

What the assistant was built on top of. The full design is in [ARCHITECTURE](ARCHITECTURE.md).

| Concern | Existing component |
|---|---|
| Frontend | Next.js 16 / React 19, `frontend/components/chat/eco-assistant.tsx` (floating chat panel) |
| Backend | FastAPI (`backend/main.py`, routers), Python 3.11 in Docker (3.14 on the dev Mac) |
| Database | SQLAlchemy + Alembic; SQLite (dev/tests), PostgreSQL (local PG18 cluster, **Neon** in production) |
| Auth | JWT access + rotating refresh tokens; 6 roles; capabilities checked server-side (`backend/auth.py`) |
| Jobs | DB-backed queue + inline worker (`backend/jobs.py`) — used for ingestion |
| Storage | `backend/storage.py` local / S3-compatible — used for uploaded documents |
| Logging | JSON logs with request ids, route metrics (`backend/observability.py`), audit log table |
| Data | stored analysis runs (`outputs/runs/<area>/<run>`), model registry, field tasks/evidence, reports, alerts |
| Previous assistant | tiered: structured lookups → answer cache → in-memory BM25 + trigram index → Claude with JSON-schema citations (one LLM call site, `assistant_llm.ask_llm`) |

LLM call sites today: `backend/rag/generation.py` (the assistant) and `backend/assistant_llm.ask_llm` (legacy
`/api/assistant/ask` endpoint only). No other code calls an LLM.


## Findings that shaped the design

- Most user questions are about **live numbers** (patch counts, ranks, alerts, tasks). Those must come from the
  database and run files, not from retrieved text — hence structured tools before RAG ([QUERY_ROUTING](QUERY_ROUTING.md)).
- PostgreSQL was already the production database (Neon supports pgvector), so no separate vector database was added.
- Roles and capabilities already existed server-side; retrieval reuses them as chunk visibility filters.
- The DB-backed job queue and object storage were reused for ingestion and uploads.
- Gaps found and fixed: no vector column locally (pgvector not installed → migration 0008 + backfill), FAQ headings
  without "?" silently dropped by the parser, the selected patch hijacking "this app" questions, BM25 errors not
  caught, extractive cached answers able to shadow LLM answers, an eval report indexed as knowledge (gibberish then
  "found" its own test row), and a live eval that looked hung while the laptop was asleep (no stage timeline, no
  overall LLM deadline).
