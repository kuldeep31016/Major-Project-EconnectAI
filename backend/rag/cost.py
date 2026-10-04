"""Cost accounting. Prices are USD per million tokens and live in one table that can be overridden with
LLM_PRICING_JSON (e.g. '{"claude-haiku-4-5-20251001": {"in": 1, "out": 5, "cache_write": 1.25, "cache_read": 0.1}}').
Usage reported by the provider is used when present; otherwise tokens are estimated (≈ 4 characters per token).
Local embeddings and retrieval cost nothing per request (they use the server's CPU)."""
from __future__ import annotations

import json
import os

# Anthropic list prices per 1M tokens (verify against the provider's pricing page before relying on them).
DEFAULT_PRICING = {
    "claude-haiku-4-5": {"in": 1.0, "out": 5.0, "cache_write": 1.25, "cache_read": 0.10},
    "claude-haiku-4-5-20251001": {"in": 1.0, "out": 5.0, "cache_write": 1.25, "cache_read": 0.10},
    "claude-sonnet-5-5": {"in": 2.0, "out": 10.0, "cache_write": 2.50, "cache_read": 0.20},
    "claude-opus-5-5": {"in": 4.0, "out": 20.0, "cache_write": 5.0, "cache_read": 0.20},
}


def pricing() -> dict:
    p = dict(DEFAULT_PRICING)
    raw = os.environ.get("LLM_PRICING_JSON")
    if raw:
        try:
            p.update(json.loads(raw))
        except ValueError:
            pass
    return p


def estimate_tokens(text: str) -> int:
    return max(1, len(text) // 4)


def llm_cost(model: str, input_tokens: int, output_tokens: int, cache_write: int = 0, cache_read: int = 0) -> float:
    pr = pricing().get(model)
    if not pr:
        return 0.0
    return round((input_tokens * pr["in"] + output_tokens * pr["out"] + cache_write * pr.get("cache_write", pr["in"])
                  + cache_read * pr.get("cache_read", 0.0)) / 1e6, 6)
