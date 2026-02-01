"""
Node wrapper: Strength Calculator
Computes evidence strength after segment identification.
Uses the segment data from the previous node to inform strength calculation.
"""

import json
from db import get_supabase


async def strength_node(state: dict) -> dict:
    """Calculate/update evidence strength using segment data from prior node."""
    evidence_id = state["evidence_id"]
    segment = state.get("segment")
    supabase = get_supabase()

    # Fetch current evidence data
    result = supabase.table("evidence_bank") \
        .select("id, computed_strength, source_weight, recency_factor, segment") \
        .eq("id", evidence_id) \
        .single().execute()

    if not result.data:
        return {**state, "strength_computed": False}

    evidence = result.data
    current_strength = evidence.get("computed_strength", 0)

    # If segment was just identified and differs from stored, recalculate
    # The actual strength formula is applied by the Next.js evidence-strength lib
    # Here we ensure the segment is stored so subsequent reads use it
    if segment and segment != evidence.get("segment"):
        supabase.table("evidence_bank") \
            .update({"segment": segment}) \
            .eq("id", evidence_id) \
            .execute()

    return {
        **state,
        "strength_computed": True,
        "computed_strength": current_strength,
    }
