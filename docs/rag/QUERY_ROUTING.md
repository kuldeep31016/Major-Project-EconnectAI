# Query routing

Not every question goes to RAG. Numbers, statuses and settings come from the database and run files; RAG is only used
for explanations, and the LLM only when an explanation needs writing. Order in `backend/chat.ask`:

```
question ─► size/rate checks ─► classify (rules, no LLM)
   ├─ unsafe ───────────────────────────────► refuse (no retrieval, no LLM)
   ├─ casual / ambiguous ───────────────────► short reply or clarifying question
   ├─ structured tool matches ──────────────► authoritative answer from DB / run files (no LLM)
   ├─ response cache hit (same scope) ──────► cached answer
   └─ knowledge / analytical / multi_step / follow_up
          └─ decompose? ─► hybrid retrieval ─► rerank ─► confidence gate
                 ├─ low confidence ─────────► abstain ("not in the indexed material")
                 ├─ LLM off / anonymous / cap reached ─► extractive answer with citations
                 └─ LLM (Claude) ─► citation validation ─► answer (or extractive if no valid citation)
```

## Routes

| Spec route | What it covers | Implementation | LLM? |
|---|---|---|---|
| A. Structured database | counts, statuses, tasks, reports, users | `chat.structured` intents `n_patches`, `n_links`, `n_components`, `habitat_area`, `alerts`, `tasks`, `reports`, `user`, `study_areas` | no |
| B. Run data / record lookup | a named patch or candidate | `patch_summary`, `patch_rank`, `patch_area`, `patch_links`, `patch_cut`, `patch_loss`, `patch_confidence`, `patch_verification`, `candidate`, `top_critical`, `cut_vertices`, `largest`, `iic`, `restoration_where`, `what_if` | no |
| C. Metadata / provenance | datasets, parameters, which data produced this | `datasets`, `parameters`, `provenance`, `model`, `run` | no |
| D. Comparison of areas | "Compare Kerala and Sundarbans" | `compare_areas` (table in the user's order, IIC caveat) | no |
| E. Document listing | "Which documents describe…" | `documents` (document-level aggregation of fused scores) | no |
| F. Knowledge (RAG) | "What is IIC?", "How is criticality calculated?" | classify `knowledge` → retrieval → LLM or extractive | optional |
| G. Analytical / multi-part | "Why is P02 important?", "Compare P07 and P08 and explain…" | `analytical` / `multi_step` → bounded decomposition (≤ `RAG_MAX_TOOL_CALLS`=4 sub-queries) → retrieval → LLM | optional |
| H. Follow-up | "and what about P02?" | `follow_up` → rewritten with conversation memory → as F/G | optional |
| Refusals | injection, secret extraction, access-control bypass, off-record facts | classify `unsafe`; object-scope abstention | no |

Permission-sensitive intents return `tasks_denied` / `reports_denied` instead of data when the role does not allow it.

## Decomposition

Triggered only when a question names two or more records (P07 and P08) or a record plus a document topic
("…according to the methodology"). Each sub-query is retrieved separately, candidates are merged, reranked against the
original question, and every named record is guaranteed a slot. Simple questions are never decomposed (test:
`test_simple_questions_are_not_decomposed`). The trace field `decomposition` lists the sub-queries.

## Model routing

Knowledge / follow-up / casual questions use `claude-haiku-4-5`; analytical / multi-step ("why", "compare") questions use
`claude-opus-5-5` with reasoning effort `medium` (`LLM_MODEL_FAST`, `LLM_MODEL`, `LLM_MODEL_STRONG`). Chosen on 2026-10-04
from a same-evidence comparison of four questions: Haiku $0.0035 / 3.7 s, Sonnet 5.5 $0.010 / 4.1 s, Opus $0.026 / 9 s
per answer, all factually correct; Opus gave the most thorough caveats, so it is kept for reasoning questions. On
overload the API fails over to `claude-sonnet-5-5`, then the client fallback model, then the extractive answer.

Route accuracy on the golden set (`route` field, 105 questions): **1.00** (`docs/rag/EVAL_RESULTS.md`).
