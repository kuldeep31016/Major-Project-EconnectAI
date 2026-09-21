# EcoConnectAI - Backend Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system geospatial dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgdal-dev \
    gdal-bin \
    libspatialindex-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt .
# Use cpu torch for portable container deployment
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir -r requirements.txt

# Copy application source and outputs
COPY ecoconnect/ ./ecoconnect/
COPY backend/ ./backend/
COPY configs/ ./configs/
COPY scripts/ ./scripts/
COPY outputs/ ./outputs/
COPY pyproject.toml .

ENV PYTHONUNBUFFERED=1
ENV ECO_CORS_ORIGINS="*"

EXPOSE 8000

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
