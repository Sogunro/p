"""
Contradiction Detector Agent
When new evidence is ingested, checks if it contradicts existing evidence
on the same topic using vector similarity + sentiment comparison.

Flow:
  receive evidence → search similar → compare sentiment → Claude analysis → store alert
"""

import json

import numpy as np
from anthropic import Anthropic

from config import ANTHROPIC_API_KEY, CLAUDE_MODEL
from db import get_supabase

anthropic_client = Anthropic(api_key=ANTHROPIC_API_KEY)


async def run_contradiction_detector(evidence_id: str, workspace_id: str) -> dict:
    """Check if a piece of evidence contradicts existing evidence."""
    supabase = get_supabase()

    # Fetch the new evidence item
    evidence_result = supabase.table("evidence_bank") \
        .select("id, title, content, sentiment, source_system, embedding, computed_strength") \
        .eq("id", evidence_id) \
        .single().execute()

    if not evidence_result.data:
        return {"contradictions_found": 0, "error": "Evidence not found"}

    new_evidence = evidence_result.data
    embedding = new_evidence.get("embedding")

    if not embedding:
        return {"contradictions_found": 0, "error": "Evidence has no embedding"}

    # Parse embedding if it's a string
    if isinstance(embedding, str):
        try:
            embedding = json.loads(embedding)
        except json.JSONDecodeError:
            return {"contradictions_found": 0, "error": "Invalid embedding format"}

    # Search for similar evidence
    search_result = supabase.rpc("search_evidence", {
        "query_embedding": json.dumps(embedding),
        "target_workspace_id": workspace_id,
        "match_limit": 10,
        "similarity_threshold": 0.75,
    }).execute()

    similar_items = search_result.data or []

    # Remove the evidence itself from results
    similar_items = [s for s in similar_items if s["id"] != evidence_id]

    if not similar_items:
        return {"contradictions_found": 0, "message": "No similar evidence found"}

    # Get full details for similar items (including sentiment)
    similar_ids = [s["id"] for s in similar_items]
    details_result = supabase.table("evidence_bank") \
        .select("id, title, content, sentiment, source_system, computed_strength") \
        .in_("id", similar_ids).execute()

    similar_details = {d["id"]: d for d in (details_result.data or [])}

    # Check for sentiment contradictions
    new_sentiment = new_evidence.get("sentiment")
    contradictions = []

    for similar in similar_items:
        detail = similar_details.get(similar["id"], {})
        existing_sentiment = detail.get("sentiment")

        # Sentiment-based contradiction detection
        is_sentiment_conflict = (
            new_sentiment and existing_sentiment and
            new_sentiment != existing_sentiment and
            {new_sentiment, existing_sentiment} == {"positive", "negative"}
        )

        # Different sources make contradictions more significant
        is_independent = detail.get("source_system") != new_evidence.get("source_system")

        if is_sentiment_conflict and is_independent:
            contradictions.append({
                "existing_evidence": {
                    "id": similar["id"],
                    "title": detail.get("title", ""),
                    "content": (detail.get("content") or "")[:300],
                    "sentiment": existing_sentiment,
                    "source_system": detail.get("source_system", ""),
                    "strength": detail.get("computed_strength", 0),
                    "similarity": similar.get("similarity", 0),
                },
                "conflict_type": "sentiment_mismatch",
            })

    if not contradictions:
        # Even without sentiment data, let Claude check for semantic contradictions
        contradictions = await _claude_contradiction_check(new_evidence, similar_items, similar_details)

    if not contradictions:
        return {"contradictions_found": 0, "message": "No contradictions detected"}

    # Generate analysis for each contradiction
    alerts_created = []
    for contradiction in contradictions[:3]:  # Cap at 3 alerts per evidence
        analysis = await _analyze_contradiction(new_evidence, contradiction)

        alert_data = {
            "workspace_id": workspace_id,
            "agent_type": "contradiction_detector",
            "alert_type": "warning",
            "title": f"Contradiction: {new_evidence.get('title', 'New evidence')[:60]} vs {contradiction['existing_evidence']['title'][:60]}",
            "content": analysis,
            "metadata": json.dumps({
                "new_evidence": {
                    "id": evidence_id,
                    "title": new_evidence.get("title", ""),
                    "sentiment": new_evidence.get("sentiment"),
                    "source_system": new_evidence.get("source_system", ""),
                },
                "existing_evidence": contradiction["existing_evidence"],
                "conflict_type": contradiction.get("conflict_type", "semantic"),
                "similarity": contradiction["existing_evidence"].get("similarity", 0),
            }),
            "related_evidence_ids": [evidence_id, contradiction["existing_evidence"]["id"]],
        }

        result = supabase.table("agent_alerts").insert(alert_data).execute()
        if result.data:
            alerts_created.append(result.data[0]["id"])

    return {
        "contradictions_found": len(contradictions),
        "alerts": alerts_created,
    }


async def _claude_contradiction_check(new_evidence: dict, similar_items: list, similar_details: dict) -> list:
    """Use Claude to detect semantic contradictions when sentiment data is missing."""
    new_text = f"Title: {new_evidence.get('title', '')}\nContent: {(new_evidence.get('content') or '')[:300]}"

    items_text = ""
    for s in similar_items[:5]:
        detail = similar_details.get(s["id"], {})
        items_text += (
            f"\n[{s['id'][:8]}] Title: {detail.get('title', '')}\n"
            f"    Content: {(detail.get('content') or '')[:200]}\n"
            f"    Source: {detail.get('source_system', '')}\n"
            f"    Similarity: {s.get('similarity', 0):.2f}\n"
        )

    response = anthropic_client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=500,
        messages=[{
            "role": "user",
            "content": (
                f"Does this new evidence contradict any of the existing evidence below?\n\n"
                f"NEW EVIDENCE:\n{new_text}\n\n"
                f"EXISTING EVIDENCE:{items_text}\n\n"
                f"Return a JSON array of objects with 'id' (the 8-char ID prefix) and 'reason' "
                f"for each contradiction found. Return empty array [] if no contradictions.\n"
                f"Only flag genuine contradictions (opposing claims about the same topic), not just different topics."
            ),
        }],
    )

    text = response.content[0].text.strip()
    try:
        if "```" in text:
            text = text.split("```")[1].replace("json", "").strip()
        results = json.loads(text)
        if not isinstance(results, list):
            return []
    except (json.JSONDecodeError, IndexError):
        return []

    contradictions = []
    for r in results:
        prefix = r.get("id", "")
        # Find matching item
        for s in similar_items:
            if s["id"].startswith(prefix):
                detail = similar_details.get(s["id"], {})
                contradictions.append({
                    "existing_evidence": {
                        "id": s["id"],
                        "title": detail.get("title", ""),
                        "content": (detail.get("content") or "")[:300],
                        "sentiment": detail.get("sentiment"),
                        "source_system": detail.get("source_system", ""),
                        "strength": detail.get("computed_strength", 0),
                        "similarity": s.get("similarity", 0),
                    },
                    "conflict_type": "semantic",
                    "reason": r.get("reason", ""),
                })
                break

    return contradictions


async def _analyze_contradiction(new_evidence: dict, contradiction: dict) -> str:
    """Generate a detailed analysis of a contradiction."""
    existing = contradiction["existing_evidence"]

    response = anthropic_client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=400,
        messages=[{
            "role": "user",
            "content": (
                f"Analyze this evidence contradiction briefly:\n\n"
                f"**Evidence A** ({new_evidence.get('source_system', 'unknown')} — "
                f"sentiment: {new_evidence.get('sentiment', 'unknown')}):\n"
                f"{new_evidence.get('title', '')}: {(new_evidence.get('content') or '')[:200]}\n\n"
                f"**Evidence B** ({existing.get('source_system', 'unknown')} — "
                f"sentiment: {existing.get('sentiment', 'unknown')}):\n"
                f"{existing.get('title', '')}: {existing.get('content', '')[:200]}\n\n"
                f"In 3-4 sentences:\n"
                f"1. What specifically conflicts?\n"
                f"2. A possible explanation (different segments, different timeframes, etc.)\n"
                f"3. Which is likely more reliable and why?"
            ),
        }],
    )

    return response.content[0].text.strip()
