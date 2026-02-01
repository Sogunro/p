"""
Brief Generator Agent (Agent 5)
User-triggered via "Generate Brief" button on decision detail page.
Uses Claude Sonnet to generate executive decision brief with evidence
strength breakdown, constraint compliance, and key quotes.
"""

import json
from anthropic import Anthropic

from config import ANTHROPIC_API_KEY, CLAUDE_SONNET_MODEL
from db import get_supabase

anthropic_client = Anthropic(api_key=ANTHROPIC_API_KEY)


async def run_brief_generator(decision_id: str, workspace_id: str) -> dict:
    """Generate an executive decision brief."""
    supabase = get_supabase()

    # Fetch decision
    decision_result = supabase.table("decisions") \
        .select("*") \
        .eq("id", decision_id) \
        .single().execute()

    if not decision_result.data:
        return {"error": "Decision not found"}

    decision = decision_result.data

    # Fetch linked evidence via evidence_decision_links
    links_result = supabase.table("evidence_decision_links") \
        .select("evidence_bank_id") \
        .eq("decision_id", decision_id) \
        .execute()

    evidence_items = []
    if links_result.data:
        evidence_ids = [l["evidence_bank_id"] for l in links_result.data]
        eb_result = supabase.table("evidence_bank") \
            .select("id, title, content, source_system, computed_strength, segment, sentiment, created_at") \
            .in_("id", evidence_ids) \
            .execute()
        evidence_items = eb_result.data or []

    # Fetch session for constraints if available
    constraints_text = "None specified"
    if decision.get("session_id"):
        session_result = supabase.table("sessions") \
            .select("constraints") \
            .eq("id", decision["session_id"]) \
            .single().execute()
        if session_result.data and session_result.data.get("constraints"):
            cons = session_result.data["constraints"]
            if isinstance(cons, list):
                constraints_text = "\n".join(f"- {c}" for c in cons)
            elif isinstance(cons, str):
                constraints_text = cons

    # Calculate evidence metrics
    strengths = [e.get("computed_strength", 0) for e in evidence_items if e.get("computed_strength")]
    avg_strength = sum(strengths) / len(strengths) if strengths else 0
    band = "Strong" if avg_strength >= 70 else "Moderate" if avg_strength >= 40 else "Weak"
    sources = list(set(e.get("source_system", "unknown") for e in evidence_items))
    segments = list(set(e.get("segment") for e in evidence_items if e.get("segment")))

    # Build evidence context
    evidence_text = ""
    for e in evidence_items[:10]:
        evidence_text += (
            f"- [{e.get('source_system', '?')}] \"{e.get('title', 'Untitled')[:80]}\"\n"
            f"  Strength: {e.get('computed_strength', 0)}% | Segment: {e.get('segment', '?')}\n"
        )
        if e.get("content"):
            evidence_text += f"  Key quote: \"{e['content'][:150]}...\"\n"

    prompt = (
        f"Generate an executive decision brief for a product decision.\n\n"
        f"DECISION: {decision.get('title', 'Untitled')}\n"
        f"Hypothesis: {decision.get('hypothesis', 'None')}\n"
        f"Status: {decision.get('status', 'unknown')}\n"
        f"Success Metric: {decision.get('success_metric', 'Not specified')}\n"
        f"Owner: {decision.get('owner', 'Not assigned')}\n"
        f"Review Date: {decision.get('review_date', 'Not set')}\n\n"
        f"EVIDENCE STRENGTH: {avg_strength:.0f}% ({band})\n"
        f"Sources: {', '.join(sources) or 'None'} ({len(evidence_items)} items)\n"
        f"Segments: {', '.join(segments) or 'Unknown'}\n\n"
        f"EVIDENCE:\n{evidence_text or 'No evidence linked'}\n\n"
        f"CONSTRAINTS:\n{constraints_text}\n\n"
        f"Generate a brief with these sections:\n"
        f"1. DECISION - one line\n"
        f"2. PROBLEM ADDRESSED - 2-3 sentences\n"
        f"3. EVIDENCE STRENGTH - percentage, coverage breakdown (sources, segments, direct voice, recency)\n"
        f"4. KEY EVIDENCE - top 3 quotes with source attribution\n"
        f"5. CONSTRAINTS - check each constraint (fits/risk)\n"
        f"6. EXPECTED IMPACT - projected outcomes\n"
        f"7. SUCCESS METRIC - from decision record\n"
        f"8. REVIEW DATE - from decision record\n"
        f"9. OWNER - from decision record\n\n"
        f"Format as clean markdown with clear section headers."
    )

    response = anthropic_client.messages.create(
        model=CLAUDE_SONNET_MODEL,
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}],
    )

    brief_content = response.content[0].text.strip()

    # Store as agent alert
    alert_data = {
        "workspace_id": workspace_id,
        "agent_type": "brief_generator",
        "alert_type": "info",
        "title": f"Brief: {decision.get('title', 'Untitled')[:60]}",
        "content": brief_content,
        "metadata": json.dumps({
            "decision_id": decision_id,
            "evidence_count": len(evidence_items),
            "avg_strength": round(avg_strength, 1),
            "strength_band": band,
            "sources": sources,
            "segments": segments,
        }),
        "related_decision_id": decision_id,
        "related_evidence_ids": [e["id"] for e in evidence_items[:20]],
    }

    alert_result = supabase.table("agent_alerts").insert(alert_data).execute()
    alert_id = alert_result.data[0]["id"] if alert_result.data else None

    return {
        "brief": brief_content,
        "alert_id": alert_id,
        "evidence_count": len(evidence_items),
        "avg_strength": round(avg_strength, 1),
        "strength_band": band,
    }
