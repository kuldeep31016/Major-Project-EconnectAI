# RAG security

| Threat | Control | Where |
|---|---|---|
| Unauthorised retrieval | Every chunk has `visibility` (public · staff · admin) copied from its document; the caller's role maps to allowed visibilities (public/field → public; analyst, GIS, range, senior → + staff; state admin → + admin). Filtering happens **before scoring**, in Python and in the pgvector SQL, so restricted text never becomes a candidate, never enters the context, never reaches the LLM. | `rag/retrieval.py` (`VISIBILITY_FOR_ROLE`, `_pg_dense`) |
| Private operational data | Field tasks, evidence, photos, users, audit, reports are **not indexed**. Structured tools answer counts/statuses with server-side role checks (field officers see only their own tasks; anonymous users get "sign in"). | `chat.structured`, `rag/sources.py` |
| Cross-run mixing | Run chunks are scoped to the study area in context; only each area's LATEST run is indexed. | `rag/retrieval.py`, `rag/sources._runs` |
| Response-cache leakage | Cache scope includes role scope (public/field/staff/admin), area, run, named objects and all version fields; answers are never shared across scopes. | `chat._scope` |
| Prompt injection in user input | Instruction-override and secret-extraction patterns are refused before retrieval (no LLM call). | `rag/classify.py` |
| Indirect injection (in documents) | Instruction-like lines in retrieved passages are replaced; every passage is fenced in `<source>` tags (closing tags inside content are defused); the system prompt states that source text is data and must not change behaviour. | `rag/context.py`, `rag/generation.SYSTEM_PROMPT` |
| Fabricated citations / ungrounded answers | Only `[S#]` ids present in the context are kept; an LLM answer with no valid citation is discarded and the extractive answer is shown instead. | `rag/service.validate_citations` |
| Arbitrary SQL / tool misuse | The LLM has no tools and cannot run queries. All data access goes through predefined, parameterised functions. | design |
| Secrets | `ANTHROPIC_API_KEY` and DB credentials only in the server environment; never in `NEXT_PUBLIC_*`, never logged, never in prompts. Provider errors are reduced to the exception class name. | `rag/generation.py`, `chat_api.py` |
| Stack traces | The chat endpoint never returns them (generic message; detail in server logs/diagnostics only for view_audit roles). | `chat.ask`, `chat_api.chat_stream` |
| Abuse / cost exhaustion | Question ≤ 500 chars, history ≤ 20 turns × 2000 chars, anonymous per-client limit, LLM per-session and per-user caps, bounded retrieval depth, context and output tokens, max 2 retries. | `chat_api.py`, `security.py`, `rag/config.py` |
| Malicious uploads | Admin only (`manage_users`), allow-listed types, ≤ 5 MB, parsed before storing, safe file names, stored under a random key. | `chat_api.rag_upload` |
| Logging of sensitive text | Traces store chunk ids, not chunk text; questions truncated to 200 chars; no raw documents in logs. | `chat_events` |

Known limits: rate limits for anonymous users are per API process (in memory); injection detection is pattern-based
(defence in depth together with fencing and citation validation, not a guarantee); the public demo's admin account is
reachable with the demo password (see project security notes) — set a private demo password in production.
