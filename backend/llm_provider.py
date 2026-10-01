"""LLM on/off switch + compatibility aliases. The provider abstraction itself lives in backend/rag/generation.py
(routing, retries, fallback, streaming, cost).

    LLM_ENABLED / ECO_LLM_ENABLED   1/0 (the older ECO_ASSISTANT_LLM=0 also disables)
"""
from __future__ import annotations

import os

from .rag.config import S
from .rag.generation import get_llm, set_llm


def _env(name: str, default: str) -> str:
    return os.environ.get(name) or os.environ.get(f"ECO_{name}") or default


def llm_enabled() -> bool:
    return _env("LLM_ENABLED", "1") not in ("0", "false", "False") and os.environ.get("ECO_ASSISTANT_LLM", "1") != "0"


class DisabledProvider:
    """A provider that is never available (tests / explicit off)."""
    name = "none"

    def available(self) -> bool:
        return False

    def generate(self, *a, **k):  # pragma: no cover - never called when unavailable
        raise RuntimeError("LLM disabled")

    def stream(self, *a, **k):  # pragma: no cover
        raise RuntimeError("LLM disabled")


def get_provider():
    return get_llm() if llm_enabled() else DisabledProvider()


set_provider = set_llm


def max_output_tokens() -> int:
    return S.max_output_tokens
