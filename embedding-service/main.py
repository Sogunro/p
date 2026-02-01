"""
Discovery OS - Embedding & Agent Service
FastAPI service for generating text embeddings (fastembed/ONNX) and
running AI agents (LangGraph). 7-agent architecture.
Deployed on Railway, called by the Next.js app.
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


app = FastAPI(title="Discovery OS Embedding & Agent Service", version="3.0.0", lifespan=lifespan)


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


# --- Agent Request Models ---


class ContradictionRequest(BaseModel):
    evidence_id: str
    workspace_id: str


class SegmentIdentifyRequest(BaseModel):
    evidence_id: str
    workspace_id: str


class SessionAnalyzeRequest(BaseModel):
    session_id: str
    workspace_id: str


class BriefGenerateRequest(BaseModel):
    decision_id: str
    workspace_id: str


class DecayReportRequest(BaseModel):
    workspace_id: str


class CompetitorMonitorRequest(BaseModel):
    workspace_id: str


# --- Embedding Endpoints ---


@app.get("/health")
async def health():
    """Health check — always responds, reports model status."""
    agents_available = bool(os.getenv("ANTHROPIC_API_KEY") and os.getenv("SUPABASE_URL"))
    if model is not None:
        return {
            "status": "ok",
            "model": "all-MiniLM-L6-v2",
            "dimensions": 384,
            "agents": agents_available,
        }
    return {
        "status": "loading",
        "model": "all-MiniLM-L6-v2",
        "dimensions": 384,
        "error": model_error,
        "agents": agents_available,
    }


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


# --- Agent Endpoints (7-Agent Architecture) ---


# Agent 2: Contradiction Detector (Auto-triggered, Haiku)
@app.post("/agent/detect-contradictions")
async def agent_detect_contradictions(req: ContradictionRequest, authorization: Optional[str] = Header(None)):
    """Contradiction Detector — checks if evidence conflicts with existing evidence."""
    verify_api_key(authorization)
    try:
        from agents.contradiction_detector import run_contradiction_detector
        result = await run_contradiction_detector(
            evidence_id=req.evidence_id,
            workspace_id=req.workspace_id,
        )
        return {"success": True, **result}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Contradiction Detector failed: {str(e)}")


# Agent 3: Segment Identifier (Auto-triggered, Haiku)
@app.post("/agent/segment-identify")
async def agent_segment_identify(req: SegmentIdentifyRequest, authorization: Optional[str] = Header(None)):
    """Segment Identifier — extracts user segment from evidence text."""
    verify_api_key(authorization)
    try:
        from agents.segment_identifier import run_segment_identifier
        result = await run_segment_identifier(
            evidence_id=req.evidence_id,
            workspace_id=req.workspace_id,
        )
        return {"success": True, **result}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Segment Identifier failed: {str(e)}")


# Agent 4: Session Analyzer (User-triggered, Sonnet)
@app.post("/agent/analyze-session")
async def agent_analyze_session(req: SessionAnalyzeRequest, authorization: Optional[str] = Header(None)):
    """Session Analyzer — ranks problems, checks constraints, generates recommendations."""
    verify_api_key(authorization)
    try:
        from agents.session_analyzer import run_session_analyzer
        result = await run_session_analyzer(
            session_id=req.session_id,
            workspace_id=req.workspace_id,
        )
        return {"success": True, **result}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Session Analyzer failed: {str(e)}")


# Agent 5: Brief Generator (User-triggered, Sonnet)
@app.post("/agent/generate-brief")
async def agent_generate_brief(req: BriefGenerateRequest, authorization: Optional[str] = Header(None)):
    """Brief Generator — generates executive decision brief."""
    verify_api_key(authorization)
    try:
        from agents.brief_generator import run_brief_generator
        result = await run_brief_generator(
            decision_id=req.decision_id,
            workspace_id=req.workspace_id,
        )
        return {"success": True, **result}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Brief Generator failed: {str(e)}")


# Agent 6: Decay Monitor (Scheduled daily, pure logic)
@app.post("/agent/decay-report")
async def agent_decay_report(req: DecayReportRequest, authorization: Optional[str] = Header(None)):
    """Decay Monitor — checks for stale evidence on active decisions and validating notes."""
    verify_api_key(authorization)
    try:
        from agents.decay_monitor import run_decay_monitor
        result = await run_decay_monitor(workspace_id=req.workspace_id)
        return {"success": True, **result}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Decay Monitor failed: {str(e)}")


# Agent 7: Competitor Monitor (Scheduled weekly, Haiku)
@app.post("/agent/competitor-monitor")
async def agent_competitor_monitor(req: CompetitorMonitorRequest, authorization: Optional[str] = Header(None)):
    """Competitor Monitor — scans for competitor feature releases."""
    verify_api_key(authorization)
    try:
        from agents.competitor_monitor import run_competitor_monitor
        result = await run_competitor_monitor(workspace_id=req.workspace_id)
        return {"success": True, **result}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Competitor Monitor failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
