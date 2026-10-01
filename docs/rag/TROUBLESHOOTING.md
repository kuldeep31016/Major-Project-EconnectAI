# RAG troubleshooting

| Symptom | Check | Fix |
|---|---|---|
| Answers say "not enough verified information" for a documented topic | `/system` → Knowledge index: is the document INDEXED? Ask with `debug` (admin wrench in the chat) to see retrieved passages and the abstention reason | re-index the document; add a FAQ entry in `docs/ASSISTANT_FAQ.md` for recurring questions; add a synonym in `rag/text.EXPAND` |
| "dense search off" in `/system` | `GET /api/rag/status` → `embedder.error` | install `fastembed`; check `EMBEDDING_CACHE_DIR` is writable / model baked into the image; on low-memory hosts set `EMBEDDING_PROVIDER=none` deliberately |
| Vector search "in-process" on Neon | migration 0007 could not `CREATE EXTENSION vector` | enable pgvector for the database (Neon: `CREATE EXTENSION vector;` as owner), then re-run migrations or add the column manually as in 0007 |
| A document is FAILED | its `error` in the documents table | fix the source (encoding, empty PDF text), then re-index it |
| A document is STALE | the source changed since indexing | "Re-index changed" in `/system` or `make rag-ingest` |
| Answers mention an old run | LATEST pointer changed but ingest has not run | ingest (startup does it automatically); the response cache is keyed on the index version so old answers are not reused |
| LLM never used | `/system` → Assistant: provider / LLM enabled; the chat answer's `llm_reason` in debug | set `ANTHROPIC_API_KEY`, `LLM_ENABLED=1`; public users never get LLM answers by design; caps may be reached |
| "generative explanation is temporarily unavailable" | debug → `llm_reason` (timeout, rate limit, error class) | provider outage or caps; answers continue extractively |
| Slow first question after a restart | embedding model loads on first use (~6 s) | expected; subsequent queries ~2 ms for embedding |
| Too many 429 for the public demo | `ECO_ANON_ASK_PER_HOUR` | raise it; the limit is per API process |
| Evaluation regressed | `make rag-eval`, read `docs/rag/EVAL_RESULTS.md` failures | compare with the previous report; revert the change that lowered recall/abstention |
