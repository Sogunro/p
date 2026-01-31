FROM python:3.11-slim

WORKDIR /app

# Install build tools needed by crewai/tiktoken dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends build-essential && \
    rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download the ONNX model at build time
RUN python -c "from fastembed import TextEmbedding; TextEmbedding('sentence-transformers/all-MiniLM-L6-v2')"

# Copy application
COPY . .

# Run the application — shell form so $PORT expands at runtime
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
