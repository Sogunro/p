"""
Voice Detector Agent (NEW - Haiku)
Checks if evidence text contains direct user quotes, interview transcripts,
or first-person user feedback (as opposed to aggregated metrics/reports).

Sets evidence_bank.has_direct_voice = true/false.
"""

from anthropic import Anthropic
from config import ANTHROPIC_API_KEY, CLAUDE_HAIKU_MODEL
from db import get_supabase

anthropic_client = Anthropic(api_key=ANTHROPIC_API_KEY)


async def voice_detector_node(state: dict) -> dict:
    """Detect if evidence contains direct user voice."""
    evidence_id = state["evidence_id"]
    supabase = get_supabase()

    # Fetch evidence
    result = supabase.table("evidence_bank") \
        .select("id, title, content, source_system") \
        .eq("id", evidence_id) \
        .single().execute()

    if not result.data:
        return {**state, "has_direct_voice": False}

    evidence = result.data
    text_parts = []
    if evidence.get("title"):
        text_parts.append(evidence["title"])
    if evidence.get("content"):
        text_parts.append(evidence["content"][:800])

    if not text_parts:
        return {**state, "has_direct_voice": False}

    text = "\n".join(text_parts)

    # Quick heuristic check first (avoid API call for obvious cases)
    voice_indicators = [
        '"', "'", "said", "told us", "user said", "customer said",
        "interview", "verbatim", "quote", "feedback from",
        "I think", "I want", "I need", "we need",
    ]
    has_obvious_voice = any(indicator.lower() in text.lower() for indicator in voice_indicators)

    if not has_obvious_voice and evidence.get("source_system") in ("mixpanel", "amplitude"):
        # Analytics data rarely has direct voice
        supabase.table("evidence_bank") \
            .update({"has_direct_voice": False}) \
            .eq("id", evidence_id) \
            .execute()
        return {**state, "has_direct_voice": False}

    # Use Haiku for borderline cases
    response = anthropic_client.messages.create(
        model=CLAUDE_HAIKU_MODEL,
        max_tokens=50,
        messages=[{
            "role": "user",
            "content": (
                f"Does this evidence contain direct user voice (quotes, interview excerpts, "
                f"first-person user feedback)? Answer YES or NO only.\n\n"
                f"Source: {evidence.get('source_system', 'unknown')}\n"
                f"Text: {text[:500]}"
            ),
        }],
    )

    answer = response.content[0].text.strip().upper()
    has_voice = answer.startswith("YES")

    # Update evidence_bank
    supabase.table("evidence_bank") \
        .update({"has_direct_voice": has_voice}) \
        .eq("id", evidence_id) \
        .execute()

    return {**state, "has_direct_voice": has_voice}
