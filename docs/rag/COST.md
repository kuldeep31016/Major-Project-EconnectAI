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
| claude-opus-5-5 (analytical / multi-step) | 4.00 | 20.00 | 5.00 | 0.20 |
| claude-sonnet-5-5 (fallback on overload) | 2.00 | 10.00 | 2.50 | 0.20 |
| claude-haiku-4-5 (knowledge / follow-up / casual) | 1.00 | 5.00 | 1.25 | 0.10 |

## Measured cost per LLM answer

Input ≈ system prompt + app data + ≤ 2,500 context tokens + question ≈ 3,000–4,500 tokens; output (incl. adaptive
thinking at low/medium effort) ≈ 600–1,200 tokens. Measured on real calls (2026-10-01/02): **≈ $0.025–0.035 per LLM
answer** (9 probe calls cost $0.25 in total).

| Route | Cost |
|---|---|
| structured / cached / extractive / refused | **$0** |
| knowledge / follow-up (Haiku 4.5) | ≈ $0.002–0.004 (measured mean $0.0035) |
| analytical / multi-step (Opus 5.5, effort medium) | ≈ $0.02–0.04 (measured mean $0.026) |

In the golden set about a third of questions reach the LLM for a signed-in user; the rest are answered by tools, the
cache or refusals. Blended: roughly **$0.01 per question** for signed-in use, **$0** for the public demo (no LLM).

## Worst case under the default caps

Per user: 30 LLM calls/hour × ~$0.04 ≈ $1.20/hour; per browser session 20 calls/day ≈ $0.80. Cheaper options: set
`LLM_MODEL_FAST=claude-haiku-4-5` (≈ 5× cheaper for knowledge questions), lower the caps, or `LLM_ENABLED=0` for zero
spend.

## Tracking

Each request writes model, input/output tokens (provider-reported usage when available), cache read tokens and
`cost_usd` to `chat_events`. `/system` → Assistant shows the last 24 h: cost, cost per answered question, cost by user,
LLM share, cache hits, latency p50/p95/p99 and feedback. `GET /api/chat/diagnostics` returns the same as JSON plus
cost by model, by query type and by route, stage latency (retrieval / rerank / LLM p50/p95/p99) and cost per day for
the last 7 days.

## Model choice and return on investment (measured 2026-10-04)

Same retrieved evidence and prompt, four questions: Haiku 4.5 $0.0035 / 3.7 s, Sonnet 5.5 $0.010 / 4.1 s, Opus 5.5
$0.026 / 9 s per answer; all factually correct. In a 12-question probe, 8 questions were answered by data tools for
$0 in ~5 ms and 4 needed the LLM. At 1,000 questions / month (~1/3 reaching the LLM): Opus everywhere ≈ $9, the
Haiku + Opus mix ≈ $4-5, Haiku everywhere ≈ $1.2. The biggest saving is not the model but answering data questions
from tools (free, exact) and the response cache (repeat questions free).
