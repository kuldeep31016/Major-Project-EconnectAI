# RAG troubleshooting

| Symptom | Check | Fix |
|---|---|---|
| Answers say "not enough verified information" for a documented topic | `/system` → Knowledge index: is the document INDEXED? Ask with `debug` (admin wrench in the chat) to see retrieved passages and the abstention reason | re-index the document; add a FAQ entry in `docs/ASSISTANT_FAQ.md` for recurring questions; add a synonym in `rag/text.EXPAND` |
| "dense search off" in `/system` | `GET /api/rag/status` → `embedder.error` | install `fastembed`; check `EMBEDDING_CACHE_DIR` is writable / model baked into the image; on low-memory hosts set `EMBEDDING_PROVIDER=none` deliberately |
| Vector search "in-process" on Neon | migration 0007 could not `CREATE EXTENSION vector` | enable pgvector for the database (Neon: `CREATE EXTENSION vector;` as owner), then re-run migrations or add the column manually as in 0007 |
| A document is FAILED | its `error` in the documents table | fix the source (encoding, empty PDF text), then re-index it |
| A document is STALE | the source changed since indexing | "Re-index changed" in `/system` or `make rag-ingest` |
| Answers mention an old run | LATEST pointer changed but ingest has not run | ingest (startup does it automatically); the response cache is keyed on the index version so old answers are not reused |
| LLM never used, debug shows "LLM unavailable: BadRequestError" | the API key is not scoped to a workspace (400 "must include the anthropic-workspace-id header") | set `ANTHROPIC_WORKSPACE_ID` (Console → Settings → Workspaces) or create the key inside a workspace |
| LLM never used | `/system` → Assistant: provider / LLM enabled; the chat answer's `llm_reason` in debug | set `ANTHROPIC_API_KEY`, `LLM_ENABLED=1`; public users never get LLM answers by design; caps may be reached |
| "generative explanation is temporarily unavailable" | debug → `llm_reason` (timeout, rate limit, error class) | provider outage or caps; answers continue extractively |
| Slow first question after a restart | embedding model loads on first use (~6 s) | expected; subsequent queries ~2 ms for embedding |
| Too many 429 for the public demo | `ECO_ANON_ASK_PER_HOUR` | raise it; the limit is per API process |
| Evaluation regressed | `make rag-eval`, read `docs/rag/EVAL_RESULTS.md` failures | compare with the previous report; revert the change that lowered recall/abstention |

## Live evaluation looks stuck / takes tens of minutes before the first question

Seen on 2026-10-02: a live run appeared to take ~38 minutes to reach its first question and then stalled. Cause: the
laptop was asleep (lid closed on battery, macOS power log: Clamshell Sleep 05:25 → wake 10:28 IST); the process only
ran during ~30-second maintenance wakes, ~17 minutes apart. Awake, the same run reaches question 1 after ~42 s (40 s
of that is embedding the scratch index) and answers in 3–11 s.

`scripts/rag_eval.py` now prints a `STAGE` timeline (startup, embedder, ingest, first question, per-question
retrieval / LLM / grader timings), reports `host_suspended_s` when the wall clock advances while the process clock does
not, wraps the run in `caffeinate -i` on macOS (prevents idle sleep; it cannot stop lid-close sleep on battery), and
bounds each question (`--question-timeout`, default 240 s) and each answer (`LLM_DEADLINE_S`, default 150 s). Run
live evaluations on AC power with the lid open. Diagnose with a small subset first:
`scripts/rag_eval.py --llm live --judge 3 --ids t01,s14 --ask "Why is P02 important?"`.

## Render: "Out of memory (used over 512Mi)" right after a deploy

Seen 2026-10-01: the startup ingest re-embedded changed documents with fastembed at batch size 64. onnxruntime keeps
its peak activation memory, and a padded batch of long chunks is large. Measured locally (633 chunks): batch 64 peaks
at 2.4 GB, 16 at 832 MB, 8 at 631 MB, 1 at model + 42 MB, and batch 1 runs fastest. The whole app now peaks at
~425 MB (was ~1.1 GB): ~130 MB API, ~225 MB embedding model, small remainder for ingest and queries. Vectors are
identical across batch sizes, so nothing needs re-embedding. Fix: `EMBEDDING_BATCH_SIZE=1` (default) and
`MALLOC_ARENA_MAX=2` (Dockerfile). If memory is still tight, set `EMBEDDING_PROVIDER=none` (BM25 only, ~225 MB less)
or move to a larger instance.
