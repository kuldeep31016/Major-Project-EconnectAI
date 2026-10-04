# RAG evaluation

Golden set: `tests/rag/golden.jsonl` — **105 questions**: easy, exact lookup, semantic, structured database, multi-turn,
multi-source, ambiguous, unanswerable, permission-sensitive, adversarial, prompt injection, plus app/product questions
(s01–s22) and technical/methodology questions (t01–t16). Each item has expected facts, forbidden phrases, an expected
source, the expected route/tier and whether the assistant must abstain. Runner: `scripts/rag_eval.py` (scratch copy of
the data, fresh database). Per-question table: [`EVAL_RESULTS.md`](EVAL_RESULTS.md) (generated).

```
make rag-eval        # fastembed, LLM off, BM25/vector/hybrid ablation, appends to eval_history.jsonl
make rag-eval-live   # real Claude answers + LLM judge on N answers (spends API credit, capped)
```

## Latest results (2026-10-02, `BAAI/bge-small-en-v1.5`, LLM tier off)

| Metric | Value | Meaning |
|---|---|---|
| Answer pass rate | **105 / 105 (1.00)** | expected facts present, forbidden phrases absent, expected tier |
| Route accuracy | **1.00** | structured / retrieval / refused as expected |
| Retrieval recall@5 | **1.00** | expected source among the top-5 reranked passages |
| MRR | 0.964 | |
| nDCG@5 | 0.883 | graded by expected-source position |
| Precision@5 | 0.33 | strict: one expected source per question |
| Faithfulness (extractive) | 0.98 | each answer sentence occurs in an indexed passage |
| Citation correctness | **1.00** | expected source among cited sources |
| Abstention accuracy | **1.00** | |
| Latency p50 / p95 | 9 ms / 13 ms | in-process, laptop |
| Cost | $0 | |

Ablation and RRF tuning: [RETRIEVAL](RETRIEVAL.md). History of runs: `docs/rag/eval_history.jsonl` (only `--record`).

## Real LLM answers, graded (2026-10-02, corrected grader)

`make rag-eval-live` → [`EVAL_RESULTS_LIVE.md`](EVAL_RESULTS_LIVE.md) (+ `eval_live_transcript.json` with every answer, the
exact evidence and each claim verdict). All 105 questions run; the first 12 LLM-eligible ones call Claude Opus 5.5 and
each of those 12 answers is graded.

**Grader**: Claude Opus 5.5 (effort low) receives the question, the answer, the `<app_data>` block and the full rendered
text of every source the generator saw (not just labels). It splits the answer into claims and labels each SUPPORTED /
PARTIALLY_SUPPORTED / UNSUPPORTED; the script computes groundedness = mean claim score (1 / 0.5 / 0). A citation that
does not contain the claim does not count as support.

| Metric | Value |
|---|---|
| Claude answers graded | 12 (99 claims: 87 supported, 6 partial, 6 unsupported) |
| Groundedness | **0.91** |
| Citation support (cited source actually contains the claim) | 0.956 |
| Correctness / relevance (grader) | 0.921 / 0.904 |
| Citation correctness (expected source cited, all 105) | 1.00 |
| Refusal correctness (all 105, 10 refusals) | 1.00 |
| Fact-phrase pass rate (all 105) | 104/105 — g02's answer omits the literal phrase "structural connectivity" (graded 1.0 grounded) |
| Claude latency p50 / p95 / max | 8.0 s / 19.9 s / 19.9 s (g08, analytical) |
| Retrieval p50 / p95 | 4 ms / 10 ms |
| Grader latency | 4.8–12.5 s |
| Timeouts / fallbacks / host suspension | 0 / 0 / 0 s |
| Generation cost | $0.205 for 12 answers (grader calls extra) |

All 6 unsupported claims are the caveats the system prompt requires ("connectivity is structural, not observed animal
movement", "not a conservation decision"); they are not in the retrieved passages, so the strict grader counts them.
No unsupported claim concerns the project's data or methods. These are model-graded scores on 12 answers, not human
review; the previous run's groundedness (0.57) is void because that grader saw only source labels.

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
| 18 | very long conversation | `test_long_conversation_is_windowed_and_bounded`, `test_memory_carries_recent_turns_and_summarises_older_ones` (≤ 1,200-char memory, > 20 turns rejected) |
| 19 | repeated question | semantic cache hit, no second LLM call |
| 21 | BM25 outage | `test_bm25_outage_degrades_to_vector_search` |
| 22 | access-control bypass | `test_access_control_bypass_attempts_are_refused_before_retrieval` |
| 24 | evaluation report indexed as knowledge | `test_an_evaluation_chunk_in_the_index_is_never_retrieved_and_gibberish_is_refused` (fails without the filter) |
| 25 | LLM retries unbounded in time | `test_llm_deadline_bounds_retries_and_fallback` |
| 26 | grader sees labels only | `test_grader_receives_source_text_and_a_citation_alone_is_not_support`, `test_debug_trace_carries_the_exact_evidence_but_it_is_not_persisted` |
| 27 | host sleep mistaken for a hang | `test_timeline_reports_host_suspension` |
| 23 | multi-part question | `test_multi_part_question_is_decomposed_and_keeps_every_named_record` |
| 20 | concurrent requests | `test_concurrent_requests` (16 parallel; found and fixed a cache-insert race) |

Also: non-retryable errors are not retried, embedding-model change re-embeds without mixing, upload validation and admin
gating, structure-aware chunking, parsers strip boilerplate, cost from provider usage, streaming SSE, feedback ownership.

## When to re-run

After changing chunking, embedding model, retrieval/rerank weights, prompts, the FAQ, or adding many documents:
`make rag-eval` (real model) and `make test` (gates). Investigate any drop in recall, abstention or citation correctness
before shipping.
