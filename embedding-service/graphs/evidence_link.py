"""
EvidenceLinkFlow — LangGraph orchestration for evidence linking.

Flow: START → parallel [Segment, Contradiction] → Strength → Voice → Gap → Router → END

When evidence is linked to a sticky note, this graph coordinates all agents
instead of the previous fire-and-forget Promise.allSettled approach.
"""

import asyncio
from typing import TypedDict, Optional
from langgraph.graph import StateGraph, END


class EvidenceLinkState(TypedDict, total=False):
    """State passed through the evidence link flow."""
    # Input
    evidence_id: str
    workspace_id: str
    sticky_note_id: Optional[str]

    # Segment node output
    segment_result: dict
    segment: Optional[str]
    all_segments: list

    # Contradiction node output
    contradiction_result: dict
    contradictions_found: int
    contradiction_alerts: list

    # Strength node output
    strength_computed: bool
    computed_strength: float

    # Voice detector output
    has_direct_voice: bool

    # Gap analyzer output
    gaps: list

    # Final status
    completed: bool
    error: Optional[str]


async def parallel_detect_node(state: dict) -> dict:
    """Run Segment Identifier and Contradiction Detector in parallel."""
    from graphs.nodes.segment import segment_node
    from graphs.nodes.contradiction import contradiction_node

    # Run both in parallel
    segment_task = asyncio.create_task(segment_node(state))
    contradiction_task = asyncio.create_task(contradiction_node(state))

    segment_result, contradiction_result = await asyncio.gather(
        segment_task, contradiction_task, return_exceptions=True
    )

    # Merge results, handling exceptions gracefully
    merged = {**state}
    if isinstance(segment_result, dict):
        merged.update(segment_result)
    else:
        merged["segment"] = None
        merged["segment_result"] = {"error": str(segment_result)}

    if isinstance(contradiction_result, dict):
        merged.update(contradiction_result)
    else:
        merged["contradictions_found"] = 0
        merged["contradiction_result"] = {"error": str(contradiction_result)}

    return merged


async def strength_step(state: dict) -> dict:
    """Compute strength using segment data from parallel step."""
    from graphs.nodes.strength import strength_node
    try:
        return await strength_node(state)
    except Exception as e:
        return {**state, "strength_computed": False, "error": str(e)}


async def voice_step(state: dict) -> dict:
    """Detect direct user voice in evidence."""
    from graphs.nodes.voice_detector import voice_detector_node
    try:
        return await voice_detector_node(state)
    except Exception as e:
        return {**state, "has_direct_voice": False}


async def gap_step(state: dict) -> dict:
    """Analyze evidence coverage gaps."""
    from graphs.nodes.gap_analyzer import gap_analyzer_node
    try:
        return await gap_analyzer_node(state)
    except Exception as e:
        return {**state, "gaps": []}


def router(state: dict) -> str:
    """Route based on results — always go to END for now.
    Future: could route to alert_node if contradictions + high strength."""
    return END


async def finalize(state: dict) -> dict:
    """Mark flow as completed."""
    return {**state, "completed": True}


def build_evidence_link_graph() -> StateGraph:
    """Build the EvidenceLinkFlow StateGraph."""
    graph = StateGraph(dict)

    # Add nodes
    graph.add_node("parallel_detect", parallel_detect_node)
    graph.add_node("strength", strength_step)
    graph.add_node("voice", voice_step)
    graph.add_node("gap_analysis", gap_step)
    graph.add_node("finalize", finalize)

    # Define edges: sequential pipeline
    graph.set_entry_point("parallel_detect")
    graph.add_edge("parallel_detect", "strength")
    graph.add_edge("strength", "voice")
    graph.add_edge("voice", "gap_analysis")
    graph.add_edge("gap_analysis", "finalize")
    graph.add_edge("finalize", END)

    return graph.compile()
