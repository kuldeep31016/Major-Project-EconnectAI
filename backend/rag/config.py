"""All RAG settings come from the environment (docs/rag/SETUP.md lists them). Read at call time so tests and
operators can change them without a restart where it is safe to do so."""
from __future__ import annotations

import os


def _get(name: str, default: str) -> str:
    return os.environ.get(name) or os.environ.get(f"ECO_{name}") or default


def _int(name: str, default: int, lo: int, hi: int) -> int:
    try:
        return max(lo, min(hi, int(_get(name, str(default)))))
    except ValueError:
        return default


def _float(name: str, default: float) -> float:
    try:
        return float(_get(name, str(default)))
    except ValueError:
        return default


class Settings:
    # chunking (approximate tokens; 1 token ≈ 4 characters of English)
    @property
    def chunk_size(self) -> int: return _int("CHUNK_SIZE", 350, 80, 2000)
    @property
    def chunk_overlap(self) -> int: return _int("CHUNK_OVERLAP", 40, 0, 400)
    @property
    def min_chunk_size(self) -> int: return _int("MIN_CHUNK_SIZE", 25, 5, 400)
    @property
    def max_chunk_size(self) -> int: return _int("MAX_CHUNK_SIZE", 700, 120, 4000)

    # embeddings
    @property
    def embedding_provider(self) -> str: return _get("EMBEDDING_PROVIDER", "fastembed")      # fastembed | hashing | none
    @property
    def embedding_model(self) -> str: return _get("EMBEDDING_MODEL", "BAAI/bge-small-en-v1.5")
    @property
    def embedding_batch_size(self) -> int: return _int("EMBEDDING_BATCH_SIZE", 1, 1, 256)
    @property
    def embedding_cache_dir(self) -> str: return _get("EMBEDDING_CACHE_DIR", "outputs/models_cache/fastembed")

    # vector store
    @property
    def vector_store(self) -> str: return _get("VECTOR_STORE", "auto")                       # auto | pgvector | memory

    # retrieval
    @property
    def dense_top_k(self) -> int: return _int("RAG_VECTOR_TOP_K", _int("DENSE_TOP_K", 30, 1, 200), 1, 200)
    @property
    def lexical_top_k(self) -> int: return _int("RAG_LEXICAL_TOP_K", _int("LEXICAL_TOP_K", 30, 1, 200), 1, 200)
    @property
    def fused_top_k(self) -> int: return _int("RAG_FUSED_TOP_K", _int("FUSED_TOP_K", 20, 1, 100), 1, 100)
    @property
    def rerank_top_k(self) -> int: return _int("RAG_RERANK_TOP_K", 6, 1, 20)
    @property
    def rrf_k(self) -> int: return _int("RAG_RRF_K", 20, 1, 200)   # tuned 2026-10-02 on the 105-question set (docs/rag/RETRIEVAL.md)
    @property
    def rrf_lexical_weight(self) -> float: return _float("RAG_RRF_LEXICAL_WEIGHT", 1.0)
    @property
    def rrf_vector_weight(self) -> float: return _float("RAG_RRF_VECTOR_WEIGHT", 1.5)
    @property
    def retrieval_mode(self) -> str: return _get("RAG_RETRIEVAL_MODE", "hybrid")          # hybrid | bm25 | vector (ablation)
    @property
    def max_tool_calls(self) -> int: return _int("RAG_MAX_TOOL_CALLS", 4, 1, 8)   # bound on sub-retrievals per question

    # reranking
    @property
    def reranker_provider(self) -> str: return _get("RERANKER_PROVIDER", "heuristic")         # heuristic | cross-encoder | none
    @property
    def reranker_model(self) -> str: return _get("RERANKER_MODEL", "Xenova/ms-marco-MiniLM-L-6-v2")

    # token budgets
    @property
    def max_context_tokens(self) -> int: return _int("RAG_MAX_CONTEXT_TOKENS", 2500, 300, 20000)
    @property
    def max_output_tokens(self) -> int: return _int("MAX_OUTPUT_TOKENS", 4000, 100, 16000)  # includes thinking tokens
    @property
    def history_turns(self) -> int: return _int("RAG_HISTORY_TURNS", 6, 0, 20)

    # generation / routing (no deprecated ids hard-coded: everything overridable)
    @property
    def llm_provider(self) -> str: return _get("LLM_PROVIDER", "anthropic")
    @property
    # 2026-10-04 cost/quality test (same evidence, 4 questions): Haiku 4.5 $0.0035/answer, 3.7 s, accurate; Opus 5.5
    # $0.026/answer, 9 s, most thorough -> Haiku for look-up style questions, Opus for "why / compare" reasoning
    def llm_model_fast(self) -> str: return _get("LLM_MODEL_FAST", "claude-haiku-4-5")
    @property
    def llm_model(self) -> str: return _get("LLM_MODEL", "claude-haiku-4-5")
    @property
    def llm_model_strong(self) -> str: return _get("LLM_MODEL_STRONG", "claude-opus-5-5")
    @property
    def llm_fallback_model(self) -> str: return _get("LLM_FALLBACK_MODEL", "claude-sonnet-5-5")
    # effort per route (Opus 5.5 always thinks; effort sets how much): chat-style answers stay quick and cheap
    @property
    def llm_effort_fast(self) -> str: return _get("LLM_EFFORT_FAST", "low")
    @property
    def llm_effort(self) -> str: return _get("LLM_EFFORT", "low")
    @property
    def llm_effort_strong(self) -> str: return _get("LLM_EFFORT_STRONG", "medium")
    @property
    def llm_server_fallback(self) -> bool: return _get("LLM_SERVER_FALLBACK", "1") not in ("0", "false", "no")
    @property
    def llm_timeout_s(self) -> float: return _float("LLM_TIMEOUT_S", 60.0)
    @property
    def llm_max_retries(self) -> int: return _int("LLM_MAX_RETRIES", 2, 0, 5)
    @property
    def llm_deadline_s(self) -> float: return _float("LLM_DEADLINE_S", 150.0)   # whole answer: retries + fallback

    # confidence / abstention
    @property
    def min_confidence(self) -> float: return _float("RAG_MIN_CONFIDENCE", 0.35)

    # caching
    @property
    def cache_ttl_s(self) -> int: return _int("RAG_CACHE_TTL", 7 * 24 * 3600, 0, 90 * 24 * 3600)


S = Settings()
PROMPT_VERSION = "p4-2026-10-02"
RERANKER_VERSION = "h1"
