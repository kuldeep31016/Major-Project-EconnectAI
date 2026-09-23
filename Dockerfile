# EcoConnectAI - Backend Dockerfile (API only)
# The deployed API serves precomputed pipeline runs from outputs/; training and inference
# happen off-box, so the image uses requirements-api.txt (no torch) and fits small hosts.
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements-api.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements-api.txt

# Copy application source and outputs
COPY ecoconnect/ ./ecoconnect/
COPY backend/ ./backend/
COPY configs/ ./configs/
COPY scripts/ ./scripts/
COPY outputs/ ./outputs/
COPY pyproject.toml .

ENV PYTHONUNBUFFERED=1
ENV PORT=8000

EXPOSE 8000

# Hosts such as Render inject $PORT
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT}"]
