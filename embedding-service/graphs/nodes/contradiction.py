"""
Node wrapper: Contradiction Detector
Wraps agents/contradiction_detector for use in LangGraph StateGraph.
"""

from agents.contradiction_detector import run_contradiction_detector


async def contradiction_node(state: dict) -> dict:
    """Run contradiction detector on the evidence and update state."""
    evidence_id = state["evidence_id"]
    workspace_id = state["workspace_id"]

    result = await run_contradiction_detector(evidence_id, workspace_id)

    return {
        **state,
        "contradiction_result": result,
        "contradictions_found": result.get("contradictions_found", 0),
        "contradiction_alerts": result.get("alerts", []),
    }
