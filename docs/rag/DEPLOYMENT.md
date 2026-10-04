# Deploying the assistant

## Requirements

- PostgreSQL with the `vector` extension (Neon has it; locally `brew install pgvector`). Without it the app still
  works: vectors are stored in a JSON column and searched in process (`VECTOR_STORE=auto`).
- ~200 MB RAM for the local embedding model (`BAAI/bge-small-en-v1.5`, ONNX via fastembed). On very small instances set
  `EMBEDDING_PROVIDER=none` (BM25 only).
- Optional: `ANTHROPIC_API_KEY` (+ `ANTHROPIC_WORKSPACE_ID` if the key is workspace-scoped). Without a key the
  assistant answers from structured tools and extractive retrieval only.

## Steps

1. Set environment variables on the host (never in the repo or in `NEXT_PUBLIC_*`): see `.env.example`, section
   "EcoConnectAI Assistant".
2. Run migrations: `alembic upgrade head` (0007 creates the RAG tables, 0008 adds the pgvector column + HNSW index if
   the extension became available later; both are idempotent).
3. Start the API. With `RAG_INGEST_ON_START=1` the corpus (docs, FAQ, latest runs) is ingested on start and missing
   vectors are back-filled; unchanged chunks are skipped.
4. Check `GET /api/chat/diagnostics` (admin): index size, embedder, vector store, last-24 h cost and latency.

## Re-indexing

| When | Do |
|---|---|
| Docs / FAQ edited, new run produced | restart the API (startup ingest) or `POST /api/rag/ingest` (alias `POST /api/chat/reindex`; `view_audit` roles) |
| Embedding model changed | change `EMBEDDING_MODEL`; ingest re-embeds every chunk (vectors of different models are never mixed) |
| Document uploaded / deleted in the UI | indexed / removed immediately; retrieval cache invalidated |
| After any of the above | `DELETE /api/chat/cache` is optional — the cache scope already includes index and model versions |

## One-time step for this release

The document hash now includes `content_type`, so the first ingest after deploying re-chunks every document once
(embeddings are reused from the cache, so no re-embedding cost) and marks previously indexed evaluation reports
`DELETED`. Nothing else to do: no migration is needed (`content_type` lives in the existing `meta` JSON columns).

## Production checklist

- `LLM_ENABLED=1` only with spend caps set (`MAX_LLM_CALLS_PER_SESSION`, `ECO_ASSISTANT_PER_HOUR`).
- Set a private demo password; anonymous users never reach the LLM.
- Run `make rag-eval` after changing chunking, prompts, weights or the FAQ.
- Anonymous rate limits are per process; use one worker or an external limiter if scaling out.
