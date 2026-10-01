"""Production RAG for the EcoConnectAI Assistant. See docs/rag/ARCHITECTURE.md.

    config      environment-driven settings          sources     source loaders (docs, paper, runs, uploads)
    chunking    structure-aware chunker              embeddings  EmbeddingProvider (fastembed ONNX | hashing)
    ingest      versioned, incremental indexing      retrieval   hybrid BM25 + dense (+ pgvector), ACL-filtered, RRF
    rerank      conditional reranking                context     ContextBuilder (dedupe, budget, citations)
    classify    query classification + rewriting     generation  LLMProvider routing, retries, fallback, streaming
    cost        pricing + per-request cost           service     orchestration used by backend/chat.py
"""
