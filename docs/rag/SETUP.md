# RAG setup and configuration

## Install

`requirements-api.txt` includes `fastembed` (ONNX Runtime embeddings) and `pypdf`. The Docker image pre-downloads the
embedding model (`BAAI/bge-small-en-v1.5`, ~64 MB) into `/app/models_cache`, so the API never downloads it at runtime.
Locally the first ingest downloads it into `outputs/models_cache/` (git-ignored).

```bash
make setup          # API deps incl. fastembed
make run            # API + frontend; the API queues an incremental ingest at startup
make rag-status     # documents by status, chunks, embedder, stale sources
make rag-ingest     # incremental ingest from the command line (FORCE=1 to re-index everything)
make rag-eval       # golden-set evaluation -> docs/rag/EVAL_RESULTS.md
```

Memory: the embedding model adds ~150–200 MB RSS (measured process RSS with the model loaded: ~390 MB). On a 512 MB
instance set `EMBEDDING_PROVIDER=none` if it is too tight — retrieval then runs lexically (BM25) and still answers.

## Environment variables

All optional; defaults shown. Secrets only in the server environment — never in frontend variables.

| Variable | Default | Meaning |
|---|---|---|
| `LLM_ENABLED` | 1 | 0 = no LLM calls at all (structured + retrieval answers only) |
| `LLM_PROVIDER` | anthropic | provider in `backend/rag/generation.py` |
| `ANTHROPIC_API_KEY` | — | server-side only |
| `ANTHROPIC_WORKSPACE_ID` | — | only for keys not scoped to a workspace; sent as the `anthropic-workspace-id` header |
| `LLM_MODEL_FAST` | claude-haiku-4-5 | knowledge / follow-up questions (Haiku takes no effort parameter) |
| `LLM_MODEL` | claude-haiku-4-5 | default |
| `LLM_MODEL_STRONG` | claude-opus-5-5 | analytical / multi-step questions (effort `LLM_EFFORT_STRONG`=medium) |
| `LLM_SERVER_FALLBACK` | 1 | server-side refusal fallback (`fallbacks: "default"`) on Opus 5.x / Sonnet 5.5 |
| `LLM_FALLBACK_MODEL` | claude-sonnet-5-5 | used once if the routed model fails (a different model is always chosen) |
| `LLM_TIMEOUT_S` | 60 | per call |
| `LLM_MAX_RETRIES` | 2 | retryable errors only (429, 529, 5xx, timeout, connection) |
| `LLM_PRICING_JSON` | built-in table | override prices, USD per 1M tokens |
| `MAX_OUTPUT_TOKENS` | 4000 | LLM output cap, including the model's thinking tokens |
| `MAX_LLM_CALLS_PER_SESSION` | 20 | per browser session per 24 h |
| `ECO_ASSISTANT_PER_HOUR` | 30 | LLM calls per user per hour |
| `ECO_ANON_ASK_PER_HOUR` | 20 | public questions per client per hour |
| `EMBEDDING_PROVIDER` | fastembed | fastembed · hashing (tests, not semantic) · none |
| `EMBEDDING_MODEL` | BAAI/bge-small-en-v1.5 | 384-dim (the pgvector column is 384-dim) |
| `EMBEDDING_CACHE_DIR` | outputs/models_cache/fastembed | `/app/models_cache` in Docker |
| `VECTOR_STORE` | auto | auto (pgvector when present) · pgvector · memory |
| `RERANKER_PROVIDER` | heuristic | heuristic · cross-encoder · none |
| `RERANKER_MODEL` | Xenova/ms-marco-MiniLM-L-6-v2 | when `cross-encoder` |
| `DENSE_TOP_K` / `LEXICAL_TOP_K` / `FUSED_TOP_K` | 30 / 30 / 20 | candidate depths |
| `RAG_RERANK_TOP_K` | 6 | passages kept after reranking |
| `RAG_MAX_CONTEXT_TOKENS` | 2500 | context budget sent to the LLM |
| `RAG_MIN_CONFIDENCE` | 0.35 | abstain below |
| `RAG_HISTORY_TURNS` | 6 | conversation window |
| `RAG_CACHE_TTL` | 604800 | response-cache lifetime (s) |
| `CHUNK_SIZE` / `CHUNK_OVERLAP` / `MIN_CHUNK_SIZE` / `MAX_CHUNK_SIZE` | 350 / 40 / 25 / 700 | approximate tokens |
| `RAG_INGEST_ON_START` | 1 | queue an incremental ingest when the API starts |

## Production (Render + Neon)

1. Deploy as usual; migration `0007_rag_index` runs at startup and enables pgvector on Neon (`CREATE EXTENSION vector`)
   if the role may do so — otherwise the column is skipped and in-process search is used (check `/system`).
2. The startup ingest job indexes everything once (~35 s on a laptop, longer on a small instance); later starts only
   re-index changed documents.
3. Decide the LLM: `LLM_ENABLED=0` for zero spend; otherwise keep the caps. Watch `/system` → Assistant card.
