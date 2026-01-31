"""
Discovery OS - Embedding Service
FastAPI service for generating text embeddings using fastembed (ONNX runtime).
Deployed on Railway, called by the Next.js app for vector search.
"""

import os
import sys
import traceback
from contextlib import asynccontextmanager
from typing import Optional

import numpy as np
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel

load_dotenv()

# Global model reference — loaded lazily at startup
model = None
model_error = None

API_KEY = os.getenv("EMBEDDING_API_KEY", "")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load model during startup, not at import time."""
    global model, model_error
    print("Starting embedding service...", flush=True)
    print(f"PORT={os.getenv('PORT', 'not set')}", flush=True)
    try:
        from fastembed import TextEmbedding
        print("Importing fastembed... done", flush=True)
        print("Loading model all-MiniLM-L6-v2...", flush=True)
        model = TextEmbedding("sentence-transformers/all-MiniLM-L6-v2")
        print("Model loaded successfully!", flush=True)
    except Exception as e:
        model_error = str(e)
        print(f"ERROR loading model: {e}", flush=True)
        traceback.print_exc()
    yield
    print("Shutting down embedding service.", flush=True)


app = FastAPI(title="Discovery OS Embedding Service", version="1.0.0", lifespan=lifespan)


def verify_api_key(authorization: Optional[str] = Header(None)):
    """Simple API key auth via Bearer token."""
    if not API_KEY:
        return
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    token = authorization.replace("Bearer ", "")
    if token != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")


def get_model():
    if model is None:
        raise HTTPException(status_code=503, detail=f"Model not loaded. Error: {model_error or 'still loading'}")
    return model


# --- Request / Response Models ---


class EmbedRequest(BaseModel):
    text: str


class EmbedResponse(BaseModel):
    embedding: list[float]
    dimensions: int


class EmbedBatchRequest(BaseModel):
    texts: list[str]


class EmbedBatchResponse(BaseModel):
    embeddings: list[list[float]]
    dimensions: int
    count: int


class HealthResponse(BaseModel):
    status: str
    model: str
    dimensions: int
    error: Optional[str] = None


# --- Endpoints ---


@app.get("/health")
async def health():
    """Health check — always responds, reports model status."""
    if model is not None:
        return {"status": "ok", "model": "all-MiniLM-L6-v2", "dimensions": 384}
    return {"status": "loading", "model": "all-MiniLM-L6-v2", "dimensions": 384, "error": model_error}


@app.post("/embed", response_model=EmbedResponse)
async def embed(req: EmbedRequest, authorization: Optional[str] = Header(None)):
    """Generate embedding for a single text string."""
    verify_api_key(authorization)
    m = get_model()

    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    embeddings = list(m.embed([req.text]))
    embedding = embeddings[0]
    norm = np.linalg.norm(embedding)
    if norm > 0:
        embedding = embedding / norm
    return EmbedResponse(
        embedding=embedding.tolist(),
        dimensions=len(embedding),
    )


@app.post("/embed-batch", response_model=EmbedBatchResponse)
async def embed_batch(req: EmbedBatchRequest, authorization: Optional[str] = Header(None)):
    """Generate embeddings for multiple texts in one call."""
    verify_api_key(authorization)
    m = get_model()

    if not req.texts or len(req.texts) == 0:
        raise HTTPException(status_code=400, detail="Texts list cannot be empty")

    if len(req.texts) > 100:
        raise HTTPException(status_code=400, detail="Maximum 100 texts per batch")

    texts = [t for t in req.texts if t.strip()]
    if not texts:
        raise HTTPException(status_code=400, detail="All texts are empty")

    embeddings_list = list(m.embed(texts))
    result = []
    for emb in embeddings_list:
        norm = np.linalg.norm(emb)
        if norm > 0:
            emb = emb / norm
        result.append(emb.tolist())

    return EmbedBatchResponse(
        embeddings=result,
        dimensions=384,
        count=len(result),
    )


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
