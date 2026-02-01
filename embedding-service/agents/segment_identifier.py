"""
Segment Identifier Agent (Agent 3)
Auto-triggered when evidence is linked to a sticky note.
Uses Claude Haiku to extract user segment from evidence text.

Segments: Enterprise, Mid-market, SMB, Consumer, Internal
"""

import json
from anthropic import Anthropic

from config import ANTHROPIC_API_KEY, CLAUDE_HAIKU_MODEL
from db import get_supabase

anthropic_client = Anthropic(api_key=ANTHROPIC_API_KEY)


async def run_segment_identifier(evidence_id: str, workspace_id: str) -> dict:
    """Extract user segment from evidence text using Claude Haiku."""
    supabase = get_supabase()

    # Fetch evidence item
    evidence_result = supabase.table("evidence_bank") \
        .select("id, title, content, url, type, source_system, segment") \
        .eq("id", evidence_id) \
        .single().execute()

    if not evidence_result.data:
        return {"segment": None, "error": "Evidence not found"}

    evidence = evidence_result.data

    # Build text context for classification
    text_parts = []
    if evidence.get("title"):
        text_parts.append(f"Title: {evidence['title']}")
    if evidence.get("content"):
        text_parts.append(f"Content: {evidence['content'][:500]}")
    if evidence.get("source_system"):
        text_parts.append(f"Source: {evidence['source_system']}")

    if not text_parts:
        return {"segment": None, "error": "No text content to classify"}

    evidence_text = "\n".join(text_parts)

    # Claude Haiku zero-shot classification
    response = anthropic_client.messages.create(
        model=CLAUDE_HAIKU_MODEL,
        max_tokens=100,
        messages=[{
            "role": "user",
            "content": (
                f"Extract the user segment from this evidence.\n"
                f"Options: Enterprise, Mid-market, SMB, Consumer, Internal\n\n"
                f"Evidence:\n{evidence_text}\n\n"
                f"Return only the segment name(s), comma-separated. "
                f"If unclear, return the most likely segment."
            ),
        }],
    )

    raw_response = response.content[0].text.strip()

    # Parse segments from response
    valid_segments = {"enterprise", "mid-market", "smb", "consumer", "internal"}
    detected = []
    for part in raw_response.split(","):
        cleaned = part.strip().lower()
        if cleaned in valid_segments:
            detected.append(part.strip().title().replace("Mid-Market", "Mid-market"))

    # Use first segment as primary
    primary_segment = detected[0] if detected else None

    # Update evidence_bank.segment field
    if primary_segment:
        supabase.table("evidence_bank") \
            .update({"segment": primary_segment}) \
            .eq("id", evidence_id) \
            .execute()

    # Create agent alert (only if segment was detected)
    if primary_segment:
        supabase.table("agent_alerts").insert({
            "workspace_id": workspace_id,
            "agent_type": "segment_identifier",
            "alert_type": "info",
            "title": f"Segment identified: {primary_segment}",
            "content": f"Evidence \"{evidence.get('title', 'Untitled')[:60]}\" classified as {primary_segment} segment.",
            "metadata": json.dumps({
                "evidence_id": evidence_id,
                "detected_segments": detected,
                "primary_segment": primary_segment,
                "raw_response": raw_response,
            }),
            "related_evidence_ids": [evidence_id],
        }).execute()

    return {
        "segment": primary_segment,
        "all_segments": detected,
        "evidence_id": evidence_id,
    }
