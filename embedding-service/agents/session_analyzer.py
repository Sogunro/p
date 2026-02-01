"""
Session Analyzer Agent (Agent 4)
User-triggered via "Analyze Session" button.
Uses Claude Sonnet to rank problems by evidence strength,
check constraints, and generate commit/validate/park recommendations.
"""

import json
from anthropic import Anthropic

from config import ANTHROPIC_API_KEY, CLAUDE_SONNET_MODEL
from db import get_supabase

anthropic_client = Anthropic(api_key=ANTHROPIC_API_KEY)


async def run_session_analyzer(session_id: str, workspace_id: str) -> dict:
    """Analyze a session: rank problems, check constraints, generate recommendations."""
    supabase = get_supabase()

    # Fetch session with all related data
    session_result = supabase.table("sessions") \
        .select("id, title, objectives, checklist, constraints") \
        .eq("id", session_id) \
        .single().execute()

    if not session_result.data:
        return {"error": "Session not found"}

    session = session_result.data

    # Fetch sections with sticky notes
    sections_result = supabase.table("sections") \
        .select("id, title, section_type, position") \
        .eq("session_id", session_id) \
        .order("position") \
        .execute()

    sections = sections_result.data or []
    section_ids = [s["id"] for s in sections]

    if not section_ids:
        return {"error": "No sections found"}

    # Fetch sticky notes
    notes_result = supabase.table("sticky_notes") \
        .select("id, content, has_evidence, section_id, position") \
        .in_("section_id", section_ids) \
        .execute()

    notes = notes_result.data or []
    note_ids = [n["id"] for n in notes]

    # Fetch evidence links for each note
    evidence_data = {}
    if note_ids:
        links_result = supabase.table("sticky_note_evidence_links") \
            .select("sticky_note_id, evidence_bank_id") \
            .in_("sticky_note_id", note_ids) \
            .execute()

        links = links_result.data or []
        evidence_bank_ids = list(set([l["evidence_bank_id"] for l in links]))

        if evidence_bank_ids:
            eb_result = supabase.table("evidence_bank") \
                .select("id, title, content, source_system, computed_strength, segment, sentiment, created_at") \
                .in_("id", evidence_bank_ids) \
                .execute()

            eb_map = {e["id"]: e for e in (eb_result.data or [])}

            for link in links:
                note_id = link["sticky_note_id"]
                if note_id not in evidence_data:
                    evidence_data[note_id] = []
                if link["evidence_bank_id"] in eb_map:
                    evidence_data[note_id].append(eb_map[link["evidence_bank_id"]])

    # Build analysis context
    section_map = {s["id"]: s for s in sections}
    problems = []
    solutions = []

    for note in notes:
        sec = section_map.get(note["section_id"], {})
        sec_type = sec.get("section_type", "general")
        evidence_items = evidence_data.get(note["id"], [])

        # Calculate aggregate strength
        strengths = [e.get("computed_strength", 0) for e in evidence_items if e.get("computed_strength")]
        avg_strength = sum(strengths) / len(strengths) if strengths else 0

        # Collect segments
        segments = list(set(
            e.get("segment") for e in evidence_items if e.get("segment")
        ))

        # Collect sources
        sources = list(set(
            e.get("source_system") for e in evidence_items if e.get("source_system")
        ))

        note_info = {
            "content": note["content"],
            "section_type": sec_type,
            "evidence_count": len(evidence_items),
            "avg_strength": round(avg_strength, 1),
            "segments": segments,
            "sources": sources,
            "key_evidence": [
                f"[{e.get('source_system', '?')}] {e.get('title', '')[:80]}"
                for e in evidence_items[:5]
            ],
        }

        if sec_type in ("problems", "assumptions"):
            problems.append(note_info)
        elif sec_type == "solutions":
            solutions.append(note_info)

    # Sort problems by evidence strength (descending)
    problems.sort(key=lambda p: p["avg_strength"], reverse=True)

    # Build prompt
    objectives_text = ""
    if session.get("objectives"):
        objs = session["objectives"]
        if isinstance(objs, list):
            objectives_text = "\n".join(f"- {o}" for o in objs)
        elif isinstance(objs, str):
            objectives_text = objs

    constraints_text = ""
    if session.get("constraints"):
        cons = session["constraints"]
        if isinstance(cons, list):
            constraints_text = "\n".join(f"- {c}" for c in cons)
        elif isinstance(cons, str):
            constraints_text = cons

    problems_text = ""
    for i, p in enumerate(problems, 1):
        band = "Strong" if p["avg_strength"] >= 70 else "Moderate" if p["avg_strength"] >= 40 else "Weak"
        problems_text += (
            f"\n{i}. [{p['avg_strength']}% {band}] \"{p['content'][:100]}\"\n"
            f"   Evidence: {p['evidence_count']} items | Sources: {', '.join(p['sources']) or 'none'} | "
            f"Segments: {', '.join(p['segments']) or 'unknown'}\n"
        )
        for ev in p["key_evidence"]:
            problems_text += f"   - {ev}\n"

    solutions_text = ""
    for s in solutions:
        solutions_text += f"\n- \"{s['content'][:100]}\" ({s['evidence_count']} evidence, {s['avg_strength']}% strength)\n"

    prompt = (
        f"Analyze this discovery session and provide actionable recommendations.\n\n"
        f"SESSION: {session.get('title', 'Untitled')}\n\n"
        f"OBJECTIVES:\n{objectives_text or 'None specified'}\n\n"
        f"CONSTRAINTS:\n{constraints_text or 'None specified'}\n\n"
        f"PROBLEMS (ranked by evidence strength):\n{problems_text or 'None'}\n\n"
        f"SOLUTIONS:\n{solutions_text or 'None proposed'}\n\n"
        f"Provide a JSON response with this structure:\n"
        f'{{\n'
        f'  "ranked_problems": [\n'
        f'    {{\n'
        f'      "problem": "brief description",\n'
        f'      "strength_pct": number,\n'
        f'      "recommendation": "commit" | "validate" | "park",\n'
        f'      "reason": "1-2 sentence justification",\n'
        f'      "constraint_check": {{"fits": true/false, "issues": ["..."]}},\n'
        f'      "segments": ["..."],\n'
        f'      "gaps": ["what evidence is missing"]\n'
        f'    }}\n'
        f'  ],\n'
        f'  "objectives_status": [\n'
        f'    {{"objective": "...", "status": "done"|"partial"|"pending", "note": "..."}}\n'
        f'  ],\n'
        f'  "suggested_next_steps": ["step 1", "step 2", ...],\n'
        f'  "summary": "2-3 sentence overall assessment"\n'
        f'}}'
    )

    response = anthropic_client.messages.create(
        model=CLAUDE_SONNET_MODEL,
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}],
    )

    raw_text = response.content[0].text.strip()

    # Parse JSON response
    try:
        if "```" in raw_text:
            raw_text_clean = raw_text.split("```")[1]
            if raw_text_clean.startswith("json"):
                raw_text_clean = raw_text_clean[4:]
            raw_text_clean = raw_text_clean.strip()
        else:
            raw_text_clean = raw_text
        analysis = json.loads(raw_text_clean)
    except (json.JSONDecodeError, IndexError):
        analysis = {"raw_response": raw_text, "parse_error": True}

    # Store as agent alert
    alert_data = {
        "workspace_id": workspace_id,
        "agent_type": "session_analyzer",
        "alert_type": "info",
        "title": f"Session Analysis: {session.get('title', 'Untitled')[:60]}",
        "content": analysis.get("summary", raw_text[:500]),
        "metadata": json.dumps({
            "session_id": session_id,
            "analysis": analysis,
            "problem_count": len(problems),
            "solution_count": len(solutions),
        }),
    }

    alert_result = supabase.table("agent_alerts").insert(alert_data).execute()
    alert_id = alert_result.data[0]["id"] if alert_result.data else None

    return {
        "analysis": analysis,
        "alert_id": alert_id,
        "problem_count": len(problems),
        "solution_count": len(solutions),
    }
