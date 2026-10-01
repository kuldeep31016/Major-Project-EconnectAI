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
4. **RRF** (k = 60) + small priors: the record of an object named in the question (+0.08), glossary term match, FAQ
   question match, definitional questions prefer docs over run records, page help only for UI questions → `FUSED_TOP_K`.

Failure of the dense side (model missing, vector query error) is recorded and retrieval continues lexically.

## Reranking (`backend/rag/rerank.py`)

Heuristic features: coverage of the question's content words, exact bigram phrases, identifier match, heading match,
dense similarity, curated-source flag. Skipped when retrieval is decisive (top fused score ≥ 1.35 × runner-up and
coverage ≥ 0.75). Optional cross-encoder (`RERANKER_PROVIDER=cross-encoder`); any error falls back to the heuristic.
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
