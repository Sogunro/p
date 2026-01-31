"""
Decay Monitor Agent
Daily check for stale evidence on active decisions.
Flags decisions where evidence is aging out or confidence is dangerously low.

Not a LangGraph graph — simple sequential flow:
  query decisions → check evidence age → flag stale → generate report → store alert
"""

import json
from datetime import datetime, timezone, timedelta

from anthropic import Anthropic

from config import ANTHROPIC_API_KEY, CLAUDE_MODEL
from db import get_supabase

anthropic_client = Anthropic(api_key=ANTHROPIC_API_KEY)


async def run_decay_monitor(workspace_id: str) -> dict:
    """Run the Decay Monitor for a workspace. Returns a health report."""
    supabase = get_supabase()
    now = datetime.now(timezone.utc)

    # Get all active decisions (commit or validate)
    decisions_result = supabase.table("decisions") \
        .select("id, title, status, evidence_strength, evidence_count, updated_at") \
        .eq("workspace_id", workspace_id) \
        .in_("status", ["commit", "validate"]) \
        .execute()

    decisions = decisions_result.data or []

    if not decisions:
        return {
            "flagged": 0,
            "healthy": 0,
            "total": 0,
            "report": "No active decisions to monitor.",
            "alert_id": None,
        }

    flagged = []
    healthy = []

    for decision in decisions:
        # Get linked evidence with timestamps
        links = supabase.table("evidence_decision_links") \
            .select("evidence_id") \
            .eq("decision_id", decision["id"]).execute()

        if not links.data:
            flagged.append({
                **decision,
                "reason": "No evidence linked",
                "days_since_latest": None,
                "stale_percentage": 100,
            })
            continue

        evidence_ids = [l["evidence_id"] for l in links.data]
        evidence = supabase.table("evidence_bank") \
            .select("id, title, source_timestamp, created_at, computed_strength") \
            .in_("id", evidence_ids).execute()

        if not evidence.data:
            flagged.append({
                **decision,
                "reason": "Evidence records not found",
                "days_since_latest": None,
                "stale_percentage": 100,
            })
            continue

        # Calculate staleness metrics
        dates = []
        for e in evidence.data:
            ts = e.get("source_timestamp") or e.get("created_at")
            if ts:
                try:
                    dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                    dates.append(dt)
                except (ValueError, TypeError):
                    pass

        if not dates:
            flagged.append({
                **decision,
                "reason": "No dated evidence",
                "days_since_latest": None,
                "stale_percentage": 100,
            })
            continue

        latest = max(dates)
        days_since_latest = (now - latest).days
        old_count = sum(1 for d in dates if (now - d).days > 90)
        stale_percentage = round((old_count / len(dates)) * 100) if dates else 0

        strength = decision.get("evidence_strength") or 0

        # Flag conditions
        reasons = []
        if days_since_latest > 21:
            reasons.append(f"Most recent evidence is {days_since_latest} days old")
        if stale_percentage > 50:
            reasons.append(f"{stale_percentage}% of evidence is older than 90 days")
        if strength < 40 and decision["status"] == "commit":
            reasons.append(f"Committed decision has weak evidence (strength: {strength:.0f})")

        if reasons:
            flagged.append({
                **decision,
                "reason": "; ".join(reasons),
                "days_since_latest": days_since_latest,
                "stale_percentage": stale_percentage,
            })
        else:
            healthy.append({
                **decision,
                "days_since_latest": days_since_latest,
                "stale_percentage": stale_percentage,
            })

    # Generate report using Claude
    report = await _generate_report(flagged, healthy, workspace_id)

    # Store alert
    alert_data = {
        "workspace_id": workspace_id,
        "agent_type": "decay_monitor",
        "alert_type": "action_needed" if flagged else "info",
        "title": f"Evidence Health: {len(flagged)} decisions need attention" if flagged else "Evidence Health: All decisions healthy",
        "content": report,
        "metadata": json.dumps({
            "flagged_count": len(flagged),
            "healthy_count": len(healthy),
            "total_checked": len(decisions),
            "flagged_decisions": [
                {
                    "id": d["id"],
                    "title": d["title"],
                    "status": d["status"],
                    "reason": d["reason"],
                    "days_since_latest": d.get("days_since_latest"),
                    "stale_percentage": d.get("stale_percentage"),
                }
                for d in flagged
            ],
            "healthy_decisions": [
                {"id": d["id"], "title": d["title"]}
                for d in healthy
            ],
        }),
    }

    result = supabase.table("agent_alerts").insert(alert_data).execute()
    alert_id = result.data[0]["id"] if result.data else None

    return {
        "flagged": len(flagged),
        "healthy": len(healthy),
        "total": len(decisions),
        "report": report,
        "alert_id": alert_id,
    }


async def _generate_report(flagged: list, healthy: list, workspace_id: str) -> str:
    """Generate a markdown digest report using Claude."""
    if not flagged and not healthy:
        return "No active decisions to monitor."

    flagged_text = ""
    for d in flagged:
        flagged_text += (
            f"- **{d['title']}** ({d['status'].upper()}): {d['reason']}\n"
            f"  Evidence strength: {d.get('evidence_strength', 0):.0f}/100\n"
        )

    healthy_text = ""
    for d in healthy:
        healthy_text += (
            f"- **{d['title']}** ({d['status'].upper()}): "
            f"Strength {d.get('evidence_strength', 0):.0f}, "
            f"latest evidence {d.get('days_since_latest', '?')} days ago\n"
        )

    response = anthropic_client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=800,
        messages=[{
            "role": "user",
            "content": (
                f"Generate a concise daily evidence health digest in markdown format.\n\n"
                f"## Needs Attention ({len(flagged)} decisions)\n{flagged_text or 'None'}\n\n"
                f"## Healthy ({len(healthy)} decisions)\n{healthy_text or 'None'}\n\n"
                f"Write:\n"
                f"1. A 1-2 sentence executive summary\n"
                f"2. For flagged items: specific action recommendation (hunt for new evidence, revisit decision, etc.)\n"
                f"3. For healthy items: brief acknowledgment\n"
                f"Keep it under 300 words. Use markdown formatting."
            ),
        }],
    )

    return response.content[0].text.strip()
