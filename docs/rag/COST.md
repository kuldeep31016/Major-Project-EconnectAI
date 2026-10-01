# Cost

## Where money can be spent

| Step | Cost per request | Why |
|---|---|---|
| Classification, rewriting, memory | $0 | rules, no LLM |
| Structured tools | $0 | database / run files |
| Embedding (documents and queries) | $0 per request | local ONNX model on the API server's CPU |
| Retrieval, reranking | $0 | local |
| LLM generation | tokens × price | only when enabled, signed in, under caps, and the question needs explanation |

Prices (USD per 1M tokens, Anthropic list prices at the time of writing — verify before relying on them; override with
`LLM_PRICING_JSON`):

| Model | Input | Output | Cache write | Cache read |
|---|---|---|---|---|
| claude-haiku-4-5-20251001 (default, fast) | 1.00 | 5.00 | 1.25 | 0.10 |
| claude-sonnet-5-5 (strong / fallback) | 2.00 | 10.00 | 2.50 | 0.20 |
| claude-opus-5-5 (not used by default) | 4.00 | 20.00 | 5.00 | 0.20 |

## Estimated cost per typical LLM request

Input ≈ system prompt (~600 tokens) + app data (~150) + context (≤ 2,500) + question ≈ **3,300 tokens**; output ≈ **250**.

| Route | Estimate |
|---|---|
| knowledge question → Haiku 4.5 | 3,300 × $1 + 250 × $5 per 1M ≈ **$0.0046** |
| analytical question → Sonnet 5.5 | 3,300 × $2 + 250 × $10 per 1M ≈ **$0.0091** |
| structured / cached / extractive answer | **$0** |

In the golden set, 20 of 64 questions (31 %) would reach the LLM for a signed-in user; the rest are answered by tools
or retrieval. Blended estimate: roughly **$0.002 per question** for signed-in use, **$0** for the public demo (no LLM).
Prompt caching only applies above the model's minimum prompt length (4,096 tokens for Haiku 4.5), so with the current
short system prompt it is usually a no-op; cache read/write tokens are recorded when the provider reports them.

## Worst case under the default caps

Per user: 30 LLM calls/hour × ~$0.009 ≈ $0.27/hour. Per browser session: 20 calls/day. Set `LLM_ENABLED=0` for zero
spend, lower the caps, or route everything to Haiku (`LLM_MODEL_STRONG=claude-haiku-4-5-20251001`).

## Tracking

Each request writes model, input/output tokens (provider-reported usage when available), cache read tokens and
`cost_usd` to `chat_events`. `/system` → Assistant shows the last 24 h: cost, cost per answered question, cost by user,
LLM share, cache hits, latency p50/p95 and feedback. `GET /api/chat/diagnostics` returns the same as JSON.
