# Caching

| Cache | What | Key | Invalidation |
|---|---|---|---|
| Response cache (`chat_cache` table) | final answer payload | `scope` + canonical question; near-duplicate wording (word Jaccard ≥ 0.75) also hits | TTL `RAG_CACHE_TTL` (7 days); scope changes; `DELETE /api/chat/cache` (admin) |
| Embedding cache | chunk embeddings | content hash + embedding model version | re-embedded only when text or model changes; re-ingest with no changes ≈ 0.04 s |
| Query-embedding cache (in process, LRU 512) | query vectors | query text + model | embedder change |
| Retrieval cache (in process) | fused candidates per query | query + scope + area + index version + retrieval mode | `retrieval.invalidate()` on every ingest / upload / delete |
| Prompt caching (Anthropic) | system prompt prefix | provider-side | only above the model's minimum prompt length; usually a no-op with the current short prompt |

## Response-cache scope

`chat._scope` hashes everything that can change the answer except the wording:
study area, run id, named records (P07, C3…), role scope (public / field / staff / admin), index version, embedding
model version, reranker version, prompt version (`PROMPT_VERSION`) and the model. When the LLM is not available for
the request the scope gets an `|extractive` suffix, so an extractive answer can never be served later in place of an
LLM answer (test: `test_extractive_cache_never_replaces_an_llm_answer`).

Not cached: refusals, structured answers (always read live data), permission-denied answers, errors.

## What this means for cost

A repeated question in the same scope costs $0 and returns in a few ms. Changing the prompt, model or embedder changes
the scope, so stale answers are not reused after an upgrade.
