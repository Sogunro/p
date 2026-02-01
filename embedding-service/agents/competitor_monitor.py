"""
Competitor Monitor Agent (Agent 7) — P3 Priority
Scheduled weekly (Monday 9 AM via n8n).
Scans for competitor feature releases relevant to committed decisions.

Currently a stub — extracts keywords from committed decisions.
Full web search integration requires n8n + external APIs (deferred).
"""

import json
from anthropic import Anthropic

from config import ANTHROPIC_API_KEY, CLAUDE_HAIKU_MODEL
from db import get_supabase

anthropic_client = Anthropic(api_key=ANTHROPIC_API_KEY)


async def run_competitor_monitor(workspace_id: str) -> dict:
    """Scan for competitor movements relevant to committed decisions."""
    supabase = get_supabase()

    # Fetch committed decisions
    decisions_result = supabase.table("decisions") \
        .select("id, title, hypothesis, status") \
        .eq("status", "commit") \
        .execute()

    # Filter by workspace: decisions are linked to sessions which have workspace
    # For now, fetch all committed decisions (service role bypasses RLS)
    decisions = decisions_result.data or []

    if not decisions:
        return {
            "status": "no_decisions",
            "message": "No committed decisions to monitor",
            "keywords": [],
            "matches": [],
        }

    # Extract keywords from decision titles and hypotheses using Haiku
    decision_texts = []
    for d in decisions[:10]:
        text = f"{d.get('title', '')} - {d.get('hypothesis', '')}"
        decision_texts.append(text)

    response = anthropic_client.messages.create(
        model=CLAUDE_HAIKU_MODEL,
        max_tokens=300,
        messages=[{
            "role": "user",
            "content": (
                f"Extract 5-10 product feature keywords from these committed decisions.\n"
                f"Return as a JSON array of strings.\n\n"
                f"Decisions:\n" + "\n".join(f"- {t}" for t in decision_texts) +
                f"\n\nReturn only the JSON array, nothing else."
            ),
        }],
    )

    raw_text = response.content[0].text.strip()
    try:
        if "```" in raw_text:
            raw_text = raw_text.split("```")[1].replace("json", "").strip()
        keywords = json.loads(raw_text)
        if not isinstance(keywords, list):
            keywords = []
    except (json.JSONDecodeError, IndexError):
        keywords = []

    # Store alert with extracted keywords
    # TODO: Add web search via n8n (competitor changelogs, Product Hunt, tech news)
    alert_data = {
        "workspace_id": workspace_id,
        "agent_type": "competitor_monitor",
        "alert_type": "info",
        "title": "Competitor Monitor: Keywords Extracted",
        "content": (
            f"Monitoring {len(decisions)} committed decisions.\n"
            f"Keywords: {', '.join(keywords[:10])}\n\n"
            f"Note: Web search integration pending. "
            f"Configure n8n to search competitor changelogs, Product Hunt, and tech news using these keywords."
        ),
        "metadata": json.dumps({
            "decision_count": len(decisions),
            "keywords": keywords,
            "decisions": [{"id": d["id"], "title": d.get("title", "")} for d in decisions[:10]],
            "status": "keywords_only",
        }),
    }

    alert_result = supabase.table("agent_alerts").insert(alert_data).execute()
    alert_id = alert_result.data[0]["id"] if alert_result.data else None

    return {
        "status": "keywords_extracted",
        "keywords": keywords,
        "decision_count": len(decisions),
        "alert_id": alert_id,
        "message": "Web search integration pending — keywords extracted for n8n",
    }
