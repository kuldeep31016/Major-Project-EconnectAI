# EcoConnectAI - Backend Dockerfile (API only)
# The deployed API serves precomputed pipeline runs from outputs/; training and inference
# happen off-box, so the image uses requirements-api.txt (no torch) and fits small hosts.
FROM python:3.11-slim

WORKDIR /app

# libexpat1: required by the rasterio (GDAL) wheels, missing from recent python:slim images
RUN apt-get update && apt-get install -y --no-install-recommends curl libexpat1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements-api.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements-api.txt

# RAG embedding model baked into the image (~64 MB) so the API never downloads it at runtime (docs/rag/SETUP.md)
ENV EMBEDDING_CACHE_DIR=/app/models_cache
RUN python -c "from fastembed import TextEmbedding; TextEmbedding('BAAI/bge-small-en-v1.5', cache_dir='/app/models_cache')"

# Copy application source and outputs
COPY ecoconnect/ ./ecoconnect/
COPY backend/ ./backend/
COPY configs/ ./configs/
COPY scripts/ ./scripts/
COPY outputs/ ./outputs/
COPY pyproject.toml .
# knowledge sources for the assistant's RAG index (docs, paper source, FAQ, page help + glossary wording)
COPY README.md ./
COPY docs/ ./docs/
COPY frontend/lib/plain-language.ts ./frontend/lib/plain-language.ts
COPY frontend/components/shared/term.tsx ./frontend/components/shared/term.tsx

ENV PYTHONUNBUFFERED=1
# 512 MB instances: fewer glibc malloc arenas (less fragmentation); embed one chunk at a time (see backend/rag/embeddings.py)
ENV MALLOC_ARENA_MAX=2 EMBEDDING_BATCH_SIZE=1
ENV PORT=8000

EXPOSE 8000

# Hosts such as Render inject $PORT
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT} --proxy-headers --forwarded-allow-ips='*'"]
