"""EmbeddingProvider abstraction.

    fastembed  (default) BAAI/bge-small-en-v1.5 via ONNX Runtime: 384-dim, ~64 MB, CPU, no API key, no per-query cost
    hashing    deterministic feature-hashing of words + character trigrams (384-dim). NOT semantic - used by tests/CI
               and as a declared fallback; it has its own model_version so its vectors are never mixed with real ones
    none       dense retrieval disabled (lexical only)

Every stored vector records ``model_version``; retrieval only compares vectors of the same version. Changing the model
therefore never mixes spaces - chunks with another version are simply re-embedded by the next ingest.
"""
from __future__ import annotations

import hashlib
import math
import re
import threading
from collections import OrderedDict
from typing import Optional, Protocol

from .config import S


class EmbeddingProvider(Protocol):
    def model_version(self) -> str: ...
    def embed_documents(self, texts: list[str]) -> list[list[float]]: ...
    def embed_query(self, text: str) -> list[float]: ...


class HashingEmbedder:
    DIM = 384

    def model_version(self) -> str:
        return "hashing-v1-384"

    def _vec(self, text: str) -> list[float]:
        v = [0.0] * self.DIM
        t = text.lower()
        feats = re.findall(r"[a-z0-9]+", t) + [t[i:i + 3] for i in range(len(t) - 2)]
        for f in feats:
            h = int.from_bytes(hashlib.blake2b(f.encode(), digest_size=8).digest(), "little")
            v[h % self.DIM] += 1.0 if (h >> 32) & 1 else -1.0
        n = math.sqrt(sum(x * x for x in v)) or 1.0
        return [x / n for x in v]

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [self._vec(t) for t in texts]

    def embed_query(self, text: str) -> list[float]:
        return self._vec(text)


class FastEmbedder:
    def __init__(self, model: str, cache_dir: str):
        from fastembed import TextEmbedding          # raises ImportError when unavailable -> caller falls back
        self.model = model
        self._m = TextEmbedding(model, cache_dir=cache_dir)

    def model_version(self) -> str:
        return f"fastembed:{self.model}"

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [v.tolist() for v in self._m.embed(texts, batch_size=64)]

    def embed_query(self, text: str) -> list[float]:
        return next(iter(self._m.query_embed([text]))).tolist()


_lock = threading.Lock()
_provider: Optional[EmbeddingProvider] = None
_provider_error: Optional[str] = None
_override: Optional[EmbeddingProvider] = None


def set_embedder(p: Optional[EmbeddingProvider]) -> None:
    """Tests inject a provider; None restores configuration-based selection."""
    global _override, _provider
    _override, _provider = p, None
    _qcache.clear()


def get_embedder() -> Optional[EmbeddingProvider]:
    """The configured provider, loaded once. Returns None when dense retrieval is disabled or the model cannot load
    (then retrieval is lexical-only and the reason is visible in diagnostics)."""
    global _provider, _provider_error
    if _override is not None:
        return _override
    with _lock:
        if _provider is not None or _provider_error is not None:
            return _provider
        kind = S.embedding_provider
        try:
            if kind == "fastembed":
                from ecoconnect.pipeline.config import REPO_ROOT
                cache = S.embedding_cache_dir
                cache = cache if cache.startswith("/") else str(REPO_ROOT / cache)
                _provider = FastEmbedder(S.embedding_model, cache)
            elif kind == "hashing":
                _provider = HashingEmbedder()
            else:
                _provider_error = "dense retrieval disabled (EMBEDDING_PROVIDER=none)"
        except Exception as e:  # noqa: BLE001 - missing package, download blocked, out of memory ...
            _provider_error = f"{type(e).__name__}: {e}"[:200]
        return _provider


def embedder_status() -> dict:
    p = get_embedder()
    return {"provider": S.embedding_provider, "model_version": p.model_version() if p else None, "error": _provider_error}


# query-embedding cache (LRU): repeated questions never re-embed
_qcache: "OrderedDict[tuple[str, str], list[float]]" = OrderedDict()


def embed_query_cached(text: str) -> Optional[list[float]]:
    p = get_embedder()
    if p is None:
        return None
    key = (p.model_version(), text.strip().lower())
    if key in _qcache:
        _qcache.move_to_end(key)
        return _qcache[key]
    v = p.embed_query(text)
    _qcache[key] = v
    if len(_qcache) > 512:
        _qcache.popitem(last=False)
    return v
