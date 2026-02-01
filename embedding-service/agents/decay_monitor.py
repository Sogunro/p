"""
Decay Monitor Agent (Agent 6)
Daily check for stale evidence on active decisions AND validating sticky notes.
Flags items where evidence is aging out or confidence is dangerously low.

Monitors:
  - Committed decisions (building this — evidence must stay fresh)
  - Validating sticky notes (actively gathering evidence)
  - DOES NOT monitor: parked decisions, new sticky notes (0%)

Sequential flow:
  query decisions+notes → check evidence age → flag stale → generate report → store alert
"""

import json
from datetime import datetime, timezone, timedelta

from anthropic import Anthropic

from config import ANTHROPIC_API_KEY, CLAUDE_SONNET_MODEL
from db import get_supabase

anthropic_client = Anthropic(api_key=ANTHROPIC_API_KEY)


async def run_decay_monitor(workspace_id: str) -> dict:
    """Run the Decay Monitor for a workspace. Returns a health report."""
    supabase = get_supabase()
    now = datetime.now(timezone.utc)

    flagged = []
    healthy = []

    # --- Part 1: Monitor committed and validating decisions ---
    decisions_result = supabase.table("decisions") \
        .select("id, title, status, evidence_strength, evidence_count, updated_at") \
        .eq("workspace_id", workspace_id) \
        .in_("status", ["commit", "validate"]) \
        .execute()

    decisions = decisions_result.data or []

    for decision in decisions:
        links = supabase.table("evidence_decision_links") \
            .select("evidence_id") \
            .eq("decision_id", decision["id"]).execute()

        if not links.data:
            flagged.append({
                "type": "decision",
                "id": decision["id"],
                "title": decision["title"],
                "status": decision["status"],
                "reason": "No evidence linked",
                "days_since_latest": None,
                "stale_percentage": 100,
                "strength": decision.get("evidence_strength", 0),
            })
            continue

        evidence_ids = [l["evidence_id"] for l in links.data]
        evidence = supabase.table("evidence_bank") \
            .select("id, source_timestamp, created_at, computed_strength") \
            .in_("id", evidence_ids).execute()

        staleness = _calculate_staleness(evidence.data or [], now)

        if not staleness["dates"]:
            flagged.append({
                "type": "decision",
                "id": decision["id"],
                "title": decision["title"],
                "status": decision["status"],
                "reason": "No dated evidence",
                "days_since_latest": None,
                "stale_percentage": 100,
                "strength": decision.get("evidence_strength", 0),
            })
            continue

        strength = decision.get("evidence_strength") or 0
        reasons = _check_flag_conditions(staleness, strength, decision["status"])

        if reasons:
            flagged.append({
                "type": "decision",
                "id": decision["id"],
                "title": decision["title"],
                "status": decision["status"],
                "reason": "; ".join(reasons),
                "days_since_latest": staleness["days_since_latest"],
                "stale_percentage": staleness["stale_percentage"],
                "strength": strength,
            })
        else:
            healthy.append({
                "type": "decision",
                "id": decision["id"],
                "title": decision["title"],
                "status": decision["status"],
                "days_since_latest": staleness["days_since_latest"],
                "strength": strength,
            })

    # --- Part 2: Monitor validating sticky notes ---
    # Get validation workflows that are actively validating
    workflows_result = supabase.table("validation_workflows") \
        .select("id, sticky_note_id, status, updated_at") \
        .eq("workspace_id", workspace_id) \
        .eq("status", "validating") \
        .execute()

    workflows = workflows_result.data or []

    if workflows:
        workflow_note_ids = [w["sticky_note_id"] for w in workflows if w.get("sticky_note_id")]

        if workflow_note_ids:
            # Get sticky note details
            notes_result = supabase.table("sticky_notes") \
                .select("id, content") \
                .in_("id", workflow_note_ids) \
                .execute()
            notes_map = {n["id"]: n for n in (notes_result.data or [])}

            for workflow in workflows:
                note_id = workflow.get("sticky_note_id")
                if not note_id:
                    continue

                note = notes_map.get(note_id, {})

                # Get linked evidence for this sticky note
                note_links = supabase.table("sticky_note_evidence_links") \
                    .select("evidence_bank_id") \
                    .eq("sticky_note_id", note_id) \
                    .execute()

                if not note_links.data:
                    flagged.append({
                        "type": "sticky_note",
                        "id": note_id,
                        "title": (note.get("content") or "Untitled note")[:60],
                        "status": "validating",
                        "reason": "Validating but no evidence linked",
                        "days_since_latest": None,
                        "stale_percentage": 100,
                        "strength": 0,
                    })
                    continue

                eb_ids = [l["evidence_bank_id"] for l in note_links.data]
                evidence = supabase.table("evidence_bank") \
                    .select("id, source_timestamp, created_at, computed_strength") \
                    .in_("id", eb_ids).execute()

                staleness = _calculate_staleness(evidence.data or [], now)

                if not staleness["dates"]:
                    continue

                # For sticky notes, flag if evidence > 30 days old
                reasons = []
                if staleness["days_since_latest"] > 30:
                    reasons.append(f"Last evidence: {staleness['days_since_latest']} days ago")

                avg_strength = staleness["avg_strength"]
                if avg_strength > 0 and avg_strength < 40:
                    reasons.append(f"Weak evidence strength: {avg_strength:.0f}%")

                if reasons:
                    flagged.append({
                        "type": "sticky_note",
                        "id": note_id,
                        "title": (note.get("content") or "Untitled note")[:60],
                        "status": "validating",
                        "reason": "; ".join(reasons),
                        "days_since_latest": staleness["days_since_latest"],
                        "stale_percentage": staleness["stale_percentage"],
                        "strength": avg_strength,
                    })
                else:
                    healthy.append({
                        "type": "sticky_note",
                        "id": note_id,
                        "title": (note.get("content") or "Untitled note")[:60],
                        "status": "validating",
                        "days_since_latest": staleness["days_since_latest"],
                        "strength": avg_strength,
                    })

    # Generate report
    report = await _generate_report(flagged, healthy, workspace_id)

    # Store alert
    alert_data = {
        "workspace_id": workspace_id,
        "agent_type": "decay_monitor",
        "alert_type": "action_needed" if flagged else "info",
        "title": f"Evidence Health: {len(flagged)} items need attention" if flagged else "Evidence Health: All items healthy",
        "content": report,
        "metadata": json.dumps({
            "flagged_count": len(flagged),
            "healthy_count": len(healthy),
            "total_decisions": len(decisions),
            "total_validating_notes": len(workflows),
            "flagged_items": flagged[:20],
            "healthy_items": [
                {"id": h["id"], "title": h["title"], "type": h["type"]}
                for h in healthy
            ],
        }),
    }

    result = supabase.table("agent_alerts").insert(alert_data).execute()
    alert_id = result.data[0]["id"] if result.data else None

    return {
        "flagged": len(flagged),
        "healthy": len(healthy),
        "total_decisions": len(decisions),
        "total_validating_notes": len(workflows),
        "report": report,
        "alert_id": alert_id,
    }


def _calculate_staleness(evidence_items: list, now: datetime) -> dict:
    """Calculate staleness metrics for a set of evidence items."""
    dates = []
    strengths = []

    for e in evidence_items:
        ts = e.get("source_timestamp") or e.get("created_at")
        if ts:
            try:
                dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                dates.append(dt)
            except (ValueError, TypeError):
                pass
        if e.get("computed_strength"):
            strengths.append(e["computed_strength"])

    if not dates:
        return {"dates": [], "days_since_latest": None, "stale_percentage": 100, "avg_strength": 0}

    latest = max(dates)
    days_since_latest = (now - latest).days
    old_count = sum(1 for d in dates if (now - d).days > 90)
    stale_percentage = round((old_count / len(dates)) * 100)
    avg_strength = sum(strengths) / len(strengths) if strengths else 0

    return {
        "dates": dates,
        "days_since_latest": days_since_latest,
        "stale_percentage": stale_percentage,
        "avg_strength": avg_strength,
    }


def _check_flag_conditions(staleness: dict, strength: float, status: str) -> list:
    """Determine if an item should be flagged based on staleness metrics."""
    reasons = []
    if staleness["days_since_latest"] and staleness["days_since_latest"] > 21:
        reasons.append(f"Most recent evidence is {staleness['days_since_latest']} days old")
    if staleness["stale_percentage"] > 50:
        reasons.append(f"{staleness['stale_percentage']}% of evidence is older than 90 days")
    if strength < 40 and status == "commit":
        reasons.append(f"Committed with weak evidence (strength: {strength:.0f})")
    return reasons


async def _generate_report(flagged: list, healthy: list, workspace_id: str) -> str:
    """Generate a markdown digest report using Claude."""
    if not flagged and not healthy:
        return "No active decisions or validating notes to monitor."

    flagged_text = ""
    for d in flagged:
        type_label = "Decision" if d["type"] == "decision" else "Note"
        flagged_text += (
            f"- **[{type_label}] {d['title']}** ({d['status'].upper()}): {d['reason']}\n"
            f"  Strength: {d.get('strength', 0):.0f}/100\n"
        )

    healthy_text = ""
    for d in healthy:
        type_label = "Decision" if d["type"] == "decision" else "Note"
        healthy_text += (
            f"- **[{type_label}] {d['title']}** ({d['status'].upper()}): "
            f"Strength {d.get('strength', 0):.0f}, "
            f"latest evidence {d.get('days_since_latest', '?')} days ago\n"
        )

    response = anthropic_client.messages.create(
        model=CLAUDE_SONNET_MODEL,
        max_tokens=800,
        messages=[{
            "role": "user",
            "content": (
                f"Generate a concise daily evidence health digest in markdown format.\n\n"
                f"## Needs Attention ({len(flagged)} items)\n{flagged_text or 'None'}\n\n"
                f"## Healthy ({len(healthy)} items)\n{healthy_text or 'None'}\n\n"
                f"Write:\n"
                f"1. A 1-2 sentence executive summary\n"
                f"2. For flagged items: specific action recommendation\n"
                f"3. For healthy items: brief acknowledgment\n"
                f"Keep it under 300 words. Use markdown formatting."
            ),
        }],
    )

    return response.content[0].text.strip()
