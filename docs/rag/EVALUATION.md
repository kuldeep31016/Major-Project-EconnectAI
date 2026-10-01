# RAG evaluation

Golden set: `tests/rag/golden.jsonl` — 64 questions in 11 categories: easy (8), exact lookup (8), semantic (14),
structured database (13), multi-turn (4), multi-source (2), ambiguous (2), unanswerable (4), permission-sensitive (3),
adversarial / overclaim bait (3), prompt injection (3). Each item has expected facts, forbidden phrases, an expected
source, the expected tier and whether the assistant must abstain. Runner: `scripts/rag_eval.py` (scratch copy of the
data, fresh database, no paid API). Full per-question table: [`EVAL_RESULTS.md`](EVAL_RESULTS.md) (generated).

## Latest results (2026-10-01, real embeddings `BAAI/bge-small-en-v1.5`, LLM tier off)

| Metric | Value | Meaning |
|---|---|---|
| Answer pass rate | **64 / 64 (1.00)** | expected facts present, forbidden phrases absent, expected tier |
| Retrieval recall@5 | **1.00** | expected source among the top-5 reranked passages |
| MRR | **0.97** | rank of the first correct passage among fused candidates |
| Precision@5 | 0.29 | strict: one expected source per question, so ≤ 0.2–0.4 is expected even when perfect |
| Context relevance | 0.89 | question words covered by the top passage |
| Faithfulness (extractive) | 0.97 | each answer sentence occurs in an indexed passage (formatting-insensitive); the miss is a table row trimmed with "…" |
| Citation correctness | **1.00** | expected source among the cited sources |
| Abstention accuracy | **1.00** | unanswerable → refused; answerable → answered |
| LLM calls | 0 | structured + retrieval tiers only |
| Latency p50 / p95 | 8–12 ms / 12–58 ms | in-process on a laptop, varies between runs; the first query loads the embedding model (~6 s once) |
| Cost | $0 | |
| Ingestion | ~43 documents, ~530 chunks embedded in 35–42 s (incl. model load); re-run with no changes 0.04 s | |

Other configurations (pytest gate `tests/rag/test_golden.py`, run on every `make test`):

| Configuration | Result |
|---|---|
| hashing embedder (CI, not semantic), LLM off | 63 / 64 (misses "What does ECA mean?"), recall@5 1.00, abstention 1.00 |
| hashing embedder, stub LLM that cites its first source | 20 questions go through the LLM path; abstention 1.00; citation correctness ≥ 0.95 (the stub's prose is not evaluated) |

**Not evaluated**: answer quality of a real LLM (would spend API credit; the user asked for no test calls). The LLM path
is constrained mechanically (only supplied sources, citation validation, no-citation → not shown) and covered by stubbed
tests; a human review of real generated answers is the next step once credit may be spent.

## Failure-mode tests (`tests/rag/test_pipeline.py`, `tests/test_chat.py`)

| # | Scenario | Test |
|---|---|---|
| 1 | answer exists | golden set; `test_llm_answer_is_grounded_citations_validated_and_cached` |
| 2 | answer does not exist | golden *unanswerable*; `test_empty_and_unanswerable_retrieval_abstains` |
| 3 | similar but wrong documents | duplicate/near-duplicate upload dedup; object-scope abstention ("bird species in P07") |
| 4 | exact identifiers | `test_exact_identifier_and_hybrid` (P07 record ranked first) |
| 5 | multiple sources | golden *multi_source*; LLM turn contains run evidence + passages |
| 6 | database information | 9 structured questions never call the LLM |
| 7 | unauthorised user, restricted data | `test_restricted_documents_never_reach_unauthorised_callers` (admin-only upload invisible to public/field/staff, absent from the LLM prompt) |
| 8 | prompt injection inside a document | `test_prompt_injection_in_a_document_is_neutralised` |
| 9 | prompt injection in user input | golden *injection*; `test_unsafe_casual_ambiguous_unknown_offtopic` |
| 10 | LLM timeout | `test_timeout_retries_then_fallback_model_then_extractive` |
| 11 | vector store failure | `test_vector_failure_falls_back_to_lexical` |
| 12 | reranker failure | `test_reranker_failure_falls_back` |
| 13 | empty retrieval | `test_empty_and_unanswerable_retrieval_abstains` |
| 14 | stale document | `test_upload_update_stale_delete_and_embedding_cache` (STALE → re-index → version 2) |
| 15 | deleted document | same test (chunks removed, never retrieved) |
| 16 | duplicate document | same test (0 new embeddings; one passage in context) |
| 17 | huge document | `test_huge_document_is_bounded` |
| 18 | very long conversation | `test_long_conversation_is_windowed_and_bounded` (window, ≤ 300-char memory, > 20 turns rejected) |
| 19 | repeated question | semantic cache hit, no second LLM call |
| 20 | concurrent requests | `test_concurrent_requests` (16 parallel; found and fixed a cache-insert race) |

Also: non-retryable errors are not retried, embedding-model change re-embeds without mixing, upload validation and admin
gating, structure-aware chunking, parsers strip boilerplate, cost from provider usage, streaming SSE, feedback ownership.

## When to re-run

After changing chunking, embedding model, retrieval/rerank weights, prompts, the FAQ, or adding many documents:
`make rag-eval` (real model) and `make test` (gates). Investigate any drop in recall, abstention or citation correctness
before shipping.
