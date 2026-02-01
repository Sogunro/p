"""
Gap Analyzer Agent (NEW - Haiku)
Given all evidence linked to a sticky note, identifies coverage gaps:
- Missing segments
- Missing source types
- Weak areas that need more evidence

Creates agent_alerts for significant gaps.
"""

import json
from anthropic import Anthropic
from config import ANTHROPIC_API_KEY, CLAUDE_HAIKU_MODEL
from db import get_supabase

anthropic_client = Anthropic(api_key=ANTHROPIC_API_KEY)


async def gap_analyzer_node(state: dict) -> dict:
    """Analyze evidence coverage gaps for the linked sticky note."""
    evidence_id = state["evidence_id"]
    workspace_id = state["workspace_id"]
    sticky_note_id = state.get("sticky_note_id")
    supabase = get_supabase()

    if not sticky_note_id:
        return {**state, "gaps": []}

    # Get all evidence linked to this sticky note
    links = supabase.table("sticky_note_evidence_links") \
        .select("evidence_bank_id") \
        .eq("sticky_note_id", sticky_note_id) \
        .execute()

    if not links.data or len(links.data) == 0:
        return {**state, "gaps": ["No evidence linked"]}

    evidence_ids = [l["evidence_bank_id"] for l in links.data]

    # Fetch all linked evidence details
    evidence_result = supabase.table("evidence_bank") \
        .select("id, title, source_system, segment, computed_strength, has_direct_voice, created_at") \
        .in_("id", evidence_ids) \
        .execute()

    evidence_items = evidence_result.data or []

    if len(evidence_items) <= 1:
        return {**state, "gaps": ["Single evidence source — needs more validation"]}

    # Compute coverage metrics
    sources = set(e.get("source_system", "unknown") for e in evidence_items)
    segments = set(e.get("segment") for e in evidence_items if e.get("segment"))
    has_voice = any(e.get("has_direct_voice") for e in evidence_items)
    strengths = [e.get("computed_strength", 0) for e in evidence_items]
    avg_strength = sum(strengths) / len(strengths) if strengths else 0

    gaps = []
    if len(sources) <= 1:
        gaps.append("Single source type — needs independent corroboration")
    if len(segments) <= 1:
        gaps.append("Single segment — validate across user segments")
    if not has_voice:
        gaps.append("No direct user voice — add interview/survey data")
    if avg_strength < 40:
        gaps.append(f"Weak average strength ({avg_strength:.0f}%) — gather stronger evidence")

    # Only call Haiku for deeper analysis if we have enough evidence
    if len(evidence_items) >= 3 and len(gaps) > 0:
        evidence_summary = "\n".join([
            f"- [{e.get('source_system', '?')}] \"{e.get('title', 'Untitled')}\" "
            f"(strength: {e.get('computed_strength', 0)}%, segment: {e.get('segment', '?')})"
            for e in evidence_items[:8]
        ])

        response = anthropic_client.messages.create(
            model=CLAUDE_HAIKU_MODEL,
            max_tokens=200,
            messages=[{
                "role": "user",
                "content": (
                    f"Given this evidence collection, what specific gaps exist?\n\n"
                    f"Evidence:\n{evidence_summary}\n\n"
                    f"Known gaps: {', '.join(gaps)}\n\n"
                    f"List 1-2 additional specific gaps (be concise, one line each). "
                    f"Return only the gap descriptions, one per line."
                ),
            }],
        )

        additional = response.content[0].text.strip().split("\n")
        for line in additional[:2]:
            cleaned = line.strip().lstrip("- •")
            if cleaned and len(cleaned) > 5:
                gaps.append(cleaned)

    # Create alert if significant gaps found
    if len(gaps) >= 2:
        supabase.table("agent_alerts").insert({
            "workspace_id": workspace_id,
            "agent_type": "gap_analyzer",
            "alert_type": "info",
            "title": f"Evidence gaps detected ({len(gaps)} issues)",
            "content": "\n".join(f"• {g}" for g in gaps),
            "metadata": json.dumps({
                "sticky_note_id": sticky_note_id,
                "evidence_count": len(evidence_items),
                "source_count": len(sources),
                "segment_count": len(segments),
                "has_voice": has_voice,
                "avg_strength": avg_strength,
            }),
            "related_evidence_ids": evidence_ids[:5],
        }).execute()

    return {**state, "gaps": gaps}
