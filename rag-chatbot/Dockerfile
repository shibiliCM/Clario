# ==============================================================================
# Multi-stage Dockerfile for Clario (Unified Frontend + FastAPI Backend)
# Compatible with Render, Railway, Hugging Face Spaces, and VPS
# ==============================================================================

# --- Stage 1: Build React Frontend ---
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# --- Stage 2: Production Python Backend ---
FROM python:3.12-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000

# Install essential system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r ./backend/requirements.txt

# Copy backend application code
COPY backend/ ./backend/

# Copy compiled frontend from Stage 1 into the expected dist location
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Create persistent vector store directory
RUN mkdir -p /app/backend/vector_store

EXPOSE 8000

WORKDIR /app/backend

# Use shell parameter expansion to pick up Render/Railway $PORT automatically
CMD ["sh", "-c", "uvicorn rag_chatbot:app --host 0.0.0.0 --port ${PORT:-8000}"]
