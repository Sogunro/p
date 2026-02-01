"""
SessionAnalysisFlow — LangGraph orchestration for session analysis.

Flow: START → Gather Data → Gap Analysis per note → Session Analyzer (Sonnet) → Quality Gate → END

Orchestrates the full session analysis pipeline with a quality gate
that can retry with expanded context if results are insufficient.
"""

from typing import TypedDict, Optional
from langgraph.graph import StateGraph, END

from db import get_supabase


class SessionAnalysisState(TypedDict, total=False):
    """State passed through the session analysis flow."""
    # Input
    session_id: str
    workspace_id: str

    # Gather step
    session_data: dict
    notes_with_evidence: list
    total_notes: int

    # Gap analysis
    per_note_gaps: list

    # Session analyzer output
    analysis_result: dict
    ranked_problems: list
    recommendations_count: int

    # Quality gate
    passed_quality: bool
    retry_count: int

    # Final
    completed: bool
    error: Optional[str]


async def gather_data(state: dict) -> dict:
    """Gather all session data: notes, evidence, sections."""
    session_id = state["session_id"]
    supabase = get_supabase()

    # Fetch session with sections and notes
    session_result = supabase.table("sessions") \
        .select("id, title, objectives, constraints") \
        .eq("id", session_id) \
        .single().execute()

    if not session_result.data:
        return {**state, "error": "Session not found"}

    # Fetch sections with notes
    sections_result = supabase.table("sections") \
        .select("id, name, section_type") \
        .eq("session_id", session_id) \
        .execute()

    sections = sections_result.data or []
    section_ids = [s["id"] for s in sections]

    # Fetch sticky notes
    notes_result = supabase.table("sticky_notes") \
        .select("id, section_id, content, has_evidence") \
        .in_("section_id", section_ids) \
        .execute() if section_ids else type("", (), {"data": []})()

    notes = notes_result.data or []

    # Fetch evidence links for notes with evidence
    notes_with_evidence = []
    for note in notes:
        if note.get("has_evidence"):
            links = supabase.table("sticky_note_evidence_links") \
                .select("evidence_bank_id") \
                .eq("sticky_note_id", note["id"]) \
                .execute()

            evidence_ids = [l["evidence_bank_id"] for l in (links.data or [])]
            if evidence_ids:
                evidence = supabase.table("evidence_bank") \
                    .select("id, title, computed_strength, segment, has_direct_voice, source_system") \
                    .in_("id", evidence_ids) \
                    .execute()
                note["linked_evidence"] = evidence.data or []
            else:
                note["linked_evidence"] = []
            notes_with_evidence.append(note)

    return {
        **state,
        "session_data": session_result.data,
        "notes_with_evidence": notes_with_evidence,
        "total_notes": len(notes),
        "per_note_gaps": [],
        "retry_count": state.get("retry_count", 0),
    }


async def analyze_gaps(state: dict) -> dict:
    """Run gap analysis on each note with evidence."""
    notes = state.get("notes_with_evidence", [])
    per_note_gaps = []

    for note in notes:
        evidence_list = note.get("linked_evidence", [])
        sources = set(e.get("source_system", "?") for e in evidence_list)
        segments = set(e.get("segment") for e in evidence_list if e.get("segment"))
        has_voice = any(e.get("has_direct_voice") for e in evidence_list)
        strengths = [e.get("computed_strength", 0) for e in evidence_list]
        avg_strength = sum(strengths) / len(strengths) if strengths else 0

        gaps = []
        if len(sources) <= 1:
            gaps.append("single_source")
        if len(segments) <= 1:
            gaps.append("single_segment")
        if not has_voice:
            gaps.append("no_voice")
        if avg_strength < 40:
            gaps.append("weak_evidence")

        per_note_gaps.append({
            "note_id": note["id"],
            "content": note.get("content", "")[:100],
            "evidence_count": len(evidence_list),
            "avg_strength": avg_strength,
            "gaps": gaps,
        })

    return {**state, "per_note_gaps": per_note_gaps}


async def run_session_analyzer(state: dict) -> dict:
    """Run the Sonnet-powered session analyzer."""
    from agents.session_analyzer import run_session_analyzer as _run_analyzer

    try:
        result = await _run_analyzer(
            session_id=state["session_id"],
            workspace_id=state["workspace_id"],
        )

        # Extract ranked problems if available
        ranked = result.get("ranked_problems", [])
        recommendations = [p for p in ranked if p.get("recommendation")]

        return {
            **state,
            "analysis_result": result,
            "ranked_problems": ranked,
            "recommendations_count": len(recommendations),
        }
    except Exception as e:
        return {
            **state,
            "analysis_result": {"error": str(e)},
            "ranked_problems": [],
            "recommendations_count": 0,
            "error": str(e),
        }


def quality_gate(state: dict) -> str:
    """Check if analysis quality is sufficient.
    If < 3 recommendations and retry_count < 1, retry with expanded context."""
    recs = state.get("recommendations_count", 0)
    retries = state.get("retry_count", 0)

    if recs < 3 and retries < 1:
        return "retry"
    return "done"


async def retry_with_context(state: dict) -> dict:
    """Retry analysis with expanded context."""
    return {
        **state,
        "retry_count": state.get("retry_count", 0) + 1,
    }


async def finalize_analysis(state: dict) -> dict:
    """Mark flow as completed."""
    return {
        **state,
        "completed": True,
        "passed_quality": state.get("recommendations_count", 0) >= 3
            or state.get("retry_count", 0) >= 1,
    }


def build_session_analysis_graph() -> StateGraph:
    """Build the SessionAnalysisFlow StateGraph."""
    graph = StateGraph(dict)

    # Add nodes
    graph.add_node("gather", gather_data)
    graph.add_node("gaps", analyze_gaps)
    graph.add_node("analyze", run_session_analyzer)
    graph.add_node("retry", retry_with_context)
    graph.add_node("finalize", finalize_analysis)

    # Define flow
    graph.set_entry_point("gather")
    graph.add_edge("gather", "gaps")
    graph.add_edge("gaps", "analyze")

    # Quality gate: conditional routing
    graph.add_conditional_edges(
        "analyze",
        quality_gate,
        {
            "retry": "gather",  # Re-gather with expanded context
            "done": "finalize",
        },
    )

    graph.add_edge("retry", "gather")
    graph.add_edge("finalize", END)

    return graph.compile()
