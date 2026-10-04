# Query understanding, retrieval, reranking, context and generation

## Query understanding (`backend/rag/classify.py`, no LLM)

| Type | Rule (examples) | Handling |
|---|---|---|
| unsafe | instruction override, "reveal the system prompt", "print the API key" | refused before retrieval |
| casual | hello, thanks, who are you | short canned reply |
| ambiguous | "tell me about this" with nothing selected and no history | clarifying question |
| follow_up | "and what about Sundarbans?", "which one…", pronouns + history | rewritten from the previous question; identifiers kept |
| multi_step | several "?", compare/versus, several object ids | strong model when the LLM is used |
| analytical | why / what makes / explain / impact | strong model when the LLM is used |
| knowledge | everything else | fast model when the LLM is used |

"This / it" also resolves to the patch or candidate selected on screen. Structured questions are recognised by the tool
layer (`backend/chat.structured`) — counts, patch/candidate facts, model, run, alerts, field-task status, verification
status, reports — and answered from stored data with no retrieval and no LLM. Original, normalised and rewritten query
are recorded per request. Memory = last `RAG_HISTORY_TURNS` turns + a deterministic ≤ 300-char topic summary; history
never overrides stored data (the prompt prefers `<app_data>`).

## Hybrid retrieval (`backend/rag/retrieval.py`)

1. **ACL + scope filter first** — chunk visibility must be allowed for the caller (public · staff · admin), run chunks
   only for the study area in context.
2. **Lexical**: BM25 (k1 1.4, b 0.75) over word tokens with light stemming and query-side synonym expansion → `LEXICAL_TOP_K`.
3. **Dense**: cosine over embeddings of the *current* model version → `DENSE_TOP_K`; pgvector HNSW
   (`ORDER BY embedding_vec <=> q`, same ACL/scope filters in SQL) when available, else numpy.
4. **Weighted RRF** (k = `RAG_RRF_K` = 20, lexical weight 1.0, vector weight 1.5) + small priors: the record of an object named in the question (+0.08), glossary term match, FAQ
   question match, definitional questions prefer docs over run records, page help only for UI questions → `FUSED_TOP_K`.

Failure of the dense side (model missing, vector query error) is recorded and retrieval continues lexically; failure of
the lexical side continues on vectors only (method label "dense/pgvector only (bm25 unavailable)"). Developer documents
get a ×0.6 prior unless the question is technical. `RAG_RETRIEVAL_MODE=bm25|vector|hybrid` switches modes for ablation.

### RRF tuning (fastembed, golden set, LLM off)

| k / vector weight | nDCG@5 | Note |
|---|---|---|
| 60 / 1.0 | 0.818 | previous default |
| 60 / 1.3 | 0.846 | |
| 20 / 1.0 | 0.829 | |
| **20 / 1.5** | **0.855 → 0.883** after FAQ/expectation fixes | chosen |

### Ablation (53 retrieval questions, same reranker)

| Mode | Recall@5 | MRR | nDCG@5 |
|---|---|---|---|
| BM25 only | 1.00 | 0.959 | 0.786 |
| Vector only | 1.00 | 0.943 | 0.886 |
| Hybrid | 1.00 | 0.964 | 0.883 |

Hybrid keeps BM25's exact-identifier strength (P07, UNB7) and the vector side's ordering; vector-only is marginally
higher on nDCG@5 on this small set but loses exact-term matches when the embedder is unavailable or a term is rare.
The cross-encoder reranker was measured and not adopted: same accuracy, ~100× p95 latency.

## Reranking (`backend/rag/rerank.py`)

Heuristic features: coverage of the question's content words, exact bigram phrases, identifier match, heading match,
dense similarity, curated-source flag. Skipped when retrieval is decisive (top fused score ≥ 1.35 × runner-up and
coverage ≥ 0.75). Optional cross-encoder (`RERANKER_PROVIDER=cross-encoder`); any error falls back to the heuristic.

Priors added 2026-10-02: developer documents (API, architecture, audit, RAG internals …) are down-weighted ×0.6 unless
the question is technical, so user questions land on the FAQ, glossary and workflow text. The grounding check matches
word variants and procedural synonyms ("calculated" ~ computed/measured, "found" ~ generated/identified); comparison
questions are grounded when every named patch's stored record was retrieved. Answers made without the LLM are cached
under a separate key, so they never replace LLM answers.
Top `RAG_RERANK_TOP_K` passages continue.

## Confidence and abstention

`confidence = 0.6·best coverage + 0.25·supporting sources + 0.15·dense agreement`. Abstain when the best passage covers
< 60 % of the question's content words or confidence < `RAG_MIN_CONFIDENCE`. Object-scope rule: if the question names a
patch/candidate and asks for information that neither its record nor any single top passage holds (for example species
or ownership details for a patch), the answer says the stored results do not include that.

## Context builder (`backend/rag/context.py`)

Exact and near-duplicate (token Jaccard ≥ 0.85) passages removed; strongest first; stops at `RAG_MAX_CONTEXT_TOKENS`
without cutting a passage (the best one is trimmed at a sentence if it alone exceeds the budget); instruction-like
lines replaced by `[instruction-like text removed from source]`; each item fenced:
`<source id="S1" title="…" section="…" page="…" run="…">…</source>`. Internal database ids are not exposed.

## Generation (`backend/rag/generation.py`)

User turn = `<app_data>` (authoritative stored facts for the run and any named object) + sources + memory + question.
The system prompt (static, cacheable) requires `[S#]` citations for every factual sentence, separation of inference,
conflict reporting, preference for app data, the exact abstention sentence, and the project's honesty rules.
After generation, citations not in the context are removed; an answer with no valid citation is **not shown** — the
extractive answer is used instead. Streaming: `POST /api/chat/stream` (SSE `status` · `delta` · `final`); the final
event carries the validated text and structured citations (id, title, section, page, type, uri, run id).

## Extractive answers (LLM off, capped or failing)

FAQ answer or glossary definition verbatim; a named patch's stored explanation + how its rank holds across τ + the
development-result caveat; otherwise the best three-sentence window from the top two passages. Every sentence is
quoted from an indexed passage (checked by the evaluation's faithfulness metric).
