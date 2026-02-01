"""
Node wrapper: Segment Identifier
Wraps agents/segment_identifier for use in LangGraph StateGraph.
"""

from agents.segment_identifier import run_segment_identifier


async def segment_node(state: dict) -> dict:
    """Run segment identifier on the evidence and update state."""
    evidence_id = state["evidence_id"]
    workspace_id = state["workspace_id"]

    result = await run_segment_identifier(evidence_id, workspace_id)

    return {
        **state,
        "segment_result": result,
        "segment": result.get("segment"),
        "all_segments": result.get("all_segments", []),
    }
