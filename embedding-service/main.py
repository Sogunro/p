"""
Discovery OS - Embedding Service
FastAPI service for generating text embeddings using fastembed (ONNX runtime).
Deployed on Railway, called by the Next.js app for vector search.
"""

import os
from typing import Optional

import numpy as np
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel
from fastembed import TextEmbedding

load_dotenv()

app = FastAPI(title="Discovery OS Embedding Service", version="1.0.0")

# Load model at startup (all-MiniLM-L6-v2 produces 384-dim vectors via ONNX)
model = TextEmbedding("sentence-transformers/all-MiniLM-L6-v2")

API_KEY = os.getenv("EMBEDDING_API_KEY", "")


def verify_api_key(authorization: Optional[str] = Header(None)):
    """Simple API key auth via Bearer token."""
    if not API_KEY:
        return  # No key configured = open access (dev mode)
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    token = authorization.replace("Bearer ", "")
    if token != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")


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


# --- Endpoints ---


@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check - confirms model is loaded."""
    return HealthResponse(
        status="ok",
        model="all-MiniLM-L6-v2",
        dimensions=384,
    )


@app.post("/embed", response_model=EmbedResponse)
async def embed(req: EmbedRequest, authorization: Optional[str] = Header(None)):
    """Generate embedding for a single text string."""
    verify_api_key(authorization)

    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    embeddings = list(model.embed([req.text]))
    embedding = embeddings[0]
    # Normalize
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

    if not req.texts or len(req.texts) == 0:
        raise HTTPException(status_code=400, detail="Texts list cannot be empty")

    if len(req.texts) > 100:
        raise HTTPException(status_code=400, detail="Maximum 100 texts per batch")

    texts = [t for t in req.texts if t.strip()]
    if not texts:
        raise HTTPException(status_code=400, detail="All texts are empty")

    embeddings_list = list(model.embed(texts))
    # Normalize each
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
