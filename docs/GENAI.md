# EcoConnectAI Assistant — overview

> The production RAG design, configuration, evaluation, security and cost are documented in [`docs/rag/`](rag/ARCHITECTURE.md)
> (2026-10-01). This page is a short overview; where it differs from `docs/rag/`, `docs/rag/` is authoritative.

* **Tiers**: structured tools (no LLM) → response cache → hybrid retrieval (BM25 + local `bge-small` embeddings,
  pgvector on PostgreSQL) → conditional rerank → confidence/abstention → context builder → routed Claude model with
  validated `[S#]` citations, or an extractive answer when the LLM is off, capped or failing.
* **Ingestion**: versioned and incremental (`rag_documents`, `rag_chunks`, `rag_embedding_cache`); background job
  `rag_ingest`; admin uploads; see [INGESTION](rag/INGESTION.md).
* **Evaluation**: 64-question golden set, 64/64 with the real embedding model; see [EVALUATION](rag/EVALUATION.md).
* **This is RAG, not training**: no model is trained or fine-tuned on project data.
