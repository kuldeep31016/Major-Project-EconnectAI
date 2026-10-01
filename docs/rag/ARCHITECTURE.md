# EcoConnectAI Assistant — RAG architecture

Status: implemented, tested and evaluated (2026-10-01). Companion docs: [SETUP](SETUP.md) · [INGESTION](INGESTION.md) ·
[RETRIEVAL](RETRIEVAL.md) · [EVALUATION](EVALUATION.md) · [SECURITY](SECURITY.md) · [COST](COST.md) · [TROUBLESHOOTING](TROUBLESHOOTING.md).

This is retrieval-augmented generation, **not model training**: no model is trained or fine-tuned on project data.
Knowledge stays in the database and is retrieved per question; the LLM only writes answers from what is retrieved.

## 1. The existing system (what the assistant sits on)

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

## 2. What is searchable and what is not

| Data | Indexed for retrieval? | How it is answered |
|---|---|---|
| README, `docs/*.md`, `docs/rag/*.md`, `docs/ASSISTANT_FAQ.md` | yes (public) | RAG |
| Research paper (`docs/paper_source_main.tex`) | yes (public) | RAG |
| Page help + glossary (frontend wording) | yes (public) | RAG |
| Study-area configuration, model registry | yes (public) | RAG + structured tools |
| Each area's LATEST run: summary, network, every patch, every candidate, stored what-if | yes (public, scoped to its study area) | structured tools first, RAG for "why" |
| Admin-uploaded documents (md/txt/html/json/csv/pdf) | yes, visibility chosen at upload (public / staff / admin) | RAG |
| Field tasks, evidence, photos, users, audit log, reports, refresh tokens, chat logs | **never indexed, never sent to the LLM** | permission-checked structured tools return counts/statuses only |
| Raw rasters, checkpoints | not indexed | — |

Rationale: structured questions ("how many patches", "P07's area") must come from the authoritative store, not from
an embedding; private operational data is answered by code that checks the caller's role, so no retrieval mistake can
leak it.

## 3. Request flow

```mermaid
flowchart TD
    U[Question + app context + last turns] --> C{Classify<br/>rules, no LLM}
    C -- unsafe --> R1[Refuse: injection / secret request]
    C -- casual / ambiguous --> R2[Canned reply / clarifying question]
    C -- follow_up --> RW[Rewrite from history<br/>identifiers preserved]
    C --> S{Structured tool?<br/>counts · patch/candidate facts · model · run · alerts · tasks}
    RW --> S
    S -- yes --> A[Answer + sources, 0 tokens]
    S -- no --> K{Response cache<br/>scope + index/embedding/reranker/prompt/model versions}
    K -- hit --> A
    K -- miss --> H[Hybrid retrieval<br/>ACL filter → BM25 + dense → RRF]
    H --> RR[Conditional rerank]
    RR --> CF{Confidence / object-scope check}
    CF -- low --> AB[Abstain: not enough verified information]
    CF -- ok --> CB[ContextBuilder<br/>dedupe · budget · neutralise injection · S# ids]
    CB --> G{LLM allowed?<br/>enabled · provider · signed in · session & hourly caps}
    G -- yes --> L[Routed model, retries + jitter, fallback model<br/>stream deltas]
    L --> V[Citation validation<br/>invalid ids dropped · no citation → not shown]
    G -- no / failed --> X[Extractive answer from the same evidence]
    V --> A
    X --> A
    A --> T[(chat_events trace + cost · audit_log)]
```

Offline, separately from the request path:

```mermaid
flowchart LR
    S1[docs · paper · FAQ · help] --> P[Parse + normalise]
    S2[LATEST runs · registry] --> P
    S3[uploads in object storage] --> P
    P --> H{content hash changed?<br/>or embedding model changed?}
    H -- no --> SKIP[skip]
    H -- yes --> CH[Structure-aware chunking] --> E[Embed via cache] --> DB[(rag_documents / rag_chunks<br/>+ pgvector column on Neon)]
    DB --> V[version + 1, INDEXED]
```

## 4. Decisions and reasons

| Decision | Choice | Why (alternatives considered) |
|---|---|---|
| Vector store | **pgvector on PostgreSQL** (`rag_chunks.embedding_vec`, HNSW, migration 0007) when the extension exists; otherwise in-process numpy over vectors stored in the same table | The project already runs PostgreSQL (Neon supports pgvector) — no new infrastructure. Corpus is ~500 chunks, so in-process search is < 5 ms where pgvector is unavailable (local PG18 has no extension; SQLite in tests). A dedicated vector DB would add cost and operations for no benefit at this scale. |
| Embeddings | **Local ONNX `BAAI/bge-small-en-v1.5`** via fastembed (384-dim), baked into the Docker image | No API key, no per-query cost, private text never leaves the server, ~2 ms per query on CPU. Anthropic has no embedding API; Voyage AI would add a second vendor and send documents out. Deterministic hashing embedder for tests/CI (declared as non-semantic). |
| Lexical | BM25 over the same chunks, query-side synonym expansion | Exact identifiers (P07, C05, IIC, Sentinel-1) and phrases; dense search alone misses them. |
| Fusion | Reciprocal-rank fusion (k = 60) + small structural priors | Robust to incomparable score scales; no tuning of weights between BM25 and cosine. |
| Reranking | Local heuristic feature scorer by default; cross-encoder (`ms-marco-MiniLM-L-6-v2`) optional; **skipped when retrieval is decisive** | Evaluation shows recall@5 = 1.0 and MRR 0.97 without a neural reranker; a cross-encoder adds ~80 MB and latency for no measured gain. |
| Query understanding | Rules (classification, follow-up rewriting, memory summary) | Zero extra LLM calls; deterministic and testable. |
| Generation | Plain-text answer with inline `[S#]` citations; routed model; streaming | Works on every current Claude model (Haiku 4.5 does not support the adaptive-thinking / effort options); citations are validated in code. |
| Model routing | fast (Haiku 4.5) for knowledge/follow-ups, strong (Sonnet 5.5) for analytical/multi-step, configurable | Cheapest model that is adequate for short grounded answers. |
| Fallback | retries with exponential backoff + jitter (retryable errors only) → a different fallback model → extractive answer | The assistant never fails a question because the LLM is down, and never falls back to ungrounded text. |
| Fine-tuning | **not used** | No requirement that RAG + prompt cannot meet (facts change with every run; fine-tuning would freeze them). Revisit only for a style/format requirement. |

## 5. Security model (summary — see [SECURITY](SECURITY.md))

Authorization is applied **before** scoring: chunks carry `visibility` (public/staff/admin) and run chunks are scoped
to the study area; the retriever never scores a chunk the caller may not see. Retrieved text is untrusted: instruction-
like lines are neutralised and every item is fenced in `<source>` tags; the system prompt treats it as data.
Prompt-injection and secret-extraction questions are refused before retrieval. The LLM cannot run SQL or tools; all
database access goes through predefined, parameterised functions.

## 6. Caching model

| Layer | Key | Invalidation |
|---|---|---|
| Embedding cache (`rag_embedding_cache`) | content sha256 + embedding model version | never stale (content-addressed) |
| Query-embedding cache (LRU 512) | model version + normalised query | process lifetime |
| Retrieval cache (LRU 256) | index version + role scope + area + selected object + query tokens | index version changes |
| Response cache (`chat_cache`) | area, run, objects, role scope, **index version, embedding model, reranker version, prompt version, model** + normalised question (exact or Jaccard ≥ 0.75) | any version changes; TTL `RAG_CACHE_TTL` |
| Prompt cache (provider) | static system prompt marked `cache_control: ephemeral` | provider-managed (only above the model's minimum prompt length) |

## 7. Cost-control model

Structured tools and retrieval answer most questions with **0 LLM tokens**. The LLM is used only for signed-in users,
only when enabled and configured, under per-session (`MAX_LLM_CALLS_PER_SESSION`) and per-user hourly caps, with a
bounded context (`RAG_MAX_CONTEXT_TOKENS`) and output (`MAX_OUTPUT_TOKENS`). Every request records model, tokens
(actual usage from the provider) and cost. See [COST](COST.md).

## 8. Fallback model

LLM unavailable / timeout / rate-limited → retries → fallback model → extractive answer with a visible note.
Embedding model unavailable → lexical retrieval (reported in diagnostics). pgvector query error → in-process vectors →
lexical. Reranker error → heuristic. Index empty (first boot before the ingest job finishes) → sources are chunked in
memory and searched lexically. Low confidence → abstention, never a guess.

## 9. Evaluation strategy

Golden set of 64 questions (`tests/rag/golden.jsonl`) across 11 categories, run by `scripts/rag_eval.py` with the real
embedding model; a pytest gate re-runs it with the hashing embedder and with a stub LLM on every test run. Failure-mode
tests in `tests/rag/test_pipeline.py` and `tests/test_chat.py`. Results: [EVALUATION](EVALUATION.md).

## 10. Service boundaries (code)

`backend/rag/`: `config` · `sources` (parsers + loaders) · `chunking` · `embeddings` · `ingest` · `retrieval` ·
`rerank` · `context` · `classify` · `generation` · `cost` · `service`. `backend/chat.py` = structured tools, cache,
tracing; `backend/chat_api.py` = HTTP (`/api/chat`, `/api/chat/stream`, `/api/rag/*`).
