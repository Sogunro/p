"""
Evidence Hunter Agent — LangGraph
Autonomously searches the evidence bank via vector similarity to find
evidence relevant to a hypothesis, then links it to the decision.

LangGraph Nodes:
  generate_queries → search_vector → filter_rank → (loop?) → summarize → store_results
"""

import json
from typing import TypedDict, Annotated

import numpy as np
from anthropic import Anthropic
from langgraph.graph import StateGraph, END

from config import ANTHROPIC_API_KEY, CLAUDE_MODEL
from db import get_supabase

anthropic_client = Anthropic(api_key=ANTHROPIC_API_KEY)


class HunterState(TypedDict):
    hypothesis: str
    workspace_id: str
    decision_id: str | None
    queries: list[str]
    results: list[dict]
    filtered: list[dict]
    summary: str
    confidence_before: float
    confidence_after: float
    iteration: int


# --------------- Nodes ---------------


def generate_queries(state: HunterState) -> dict:
    """Use Claude to generate 3-5 search queries from the hypothesis."""
    hypothesis = state["hypothesis"]
    iteration = state.get("iteration", 0)

    previous_context = ""
    if iteration > 0 and state.get("filtered"):
        previous_context = (
            f"\n\nPrevious search found {len(state['filtered'])} results but we need more. "
            f"Try different angles, synonyms, or broader/narrower terms."
        )

    response = anthropic_client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=500,
        messages=[{
            "role": "user",
            "content": (
                f"Generate 3-5 short search queries to find evidence related to this hypothesis:\n\n"
                f"\"{hypothesis}\"\n\n"
                f"Return ONLY a JSON array of strings. Each query should be 3-8 words, "
                f"covering different angles (user pain, market signal, metric, quote, feature).{previous_context}\n\n"
                f"Example: [\"user frustration onboarding flow\", \"churn rate new users\", \"competitor signup process\"]"
            ),
        }],
    )

    text = response.content[0].text.strip()
    # Parse JSON array from response
    try:
        if "```" in text:
            text = text.split("```")[1].replace("json", "").strip()
        queries = json.loads(text)
        if not isinstance(queries, list):
            queries = [hypothesis]
    except (json.JSONDecodeError, IndexError):
        queries = [hypothesis]

    return {"queries": queries, "iteration": iteration + 1}


def search_vector(state: HunterState) -> dict:
    """For each query, embed it and search via pgvector."""
    from main import model as embed_model

    queries = state["queries"]
    workspace_id = state["workspace_id"]
    all_results = list(state.get("results", []))
    seen_ids = {r["id"] for r in all_results}

    supabase = get_supabase()

    for query in queries:
        # Generate embedding for query
        if embed_model is None:
            continue

        embeddings = list(embed_model.embed([query]))
        embedding = embeddings[0]
        norm = np.linalg.norm(embedding)
        if norm > 0:
            embedding = embedding / norm

        # Search via Supabase RPC
        result = supabase.rpc("search_evidence", {
            "query_embedding": json.dumps(embedding.tolist()),
            "target_workspace_id": workspace_id,
            "match_limit": 10,
            "similarity_threshold": 0.3,
        }).execute()

        if result.data:
            for item in result.data:
                if item["id"] not in seen_ids:
                    seen_ids.add(item["id"])
                    all_results.append(item)

    return {"results": all_results}


def filter_rank(state: HunterState) -> dict:
    """Use Claude to filter and rank results by relevance to the hypothesis."""
    hypothesis = state["hypothesis"]
    results = state["results"]

    if not results:
        return {"filtered": []}

    # Format results for Claude
    results_text = ""
    for i, r in enumerate(results[:20]):  # Cap at 20 to avoid token overflow
        results_text += (
            f"\n[{i}] Title: {r.get('title', 'N/A')}\n"
            f"    Content: {(r.get('content') or '')[:200]}\n"
            f"    Source: {r.get('source_system', 'unknown')}\n"
            f"    Similarity: {r.get('similarity', 0):.2f}\n"
            f"    Strength: {r.get('computed_strength', 0):.0f}\n"
        )

    response = anthropic_client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=800,
        messages=[{
            "role": "user",
            "content": (
                f"Hypothesis: \"{hypothesis}\"\n\n"
                f"Evidence found:{results_text}\n\n"
                f"Return a JSON array of the INDEX NUMBERS (e.g. [0, 3, 5]) of evidence items "
                f"that are genuinely relevant to this hypothesis. Only include items with clear "
                f"topical relevance (not just keyword overlap). Be selective — quality over quantity."
            ),
        }],
    )

    text = response.content[0].text.strip()
    try:
        if "```" in text:
            text = text.split("```")[1].replace("json", "").strip()
        indices = json.loads(text)
        if not isinstance(indices, list):
            indices = []
    except (json.JSONDecodeError, IndexError):
        indices = []

    filtered = []
    for idx in indices:
        if isinstance(idx, int) and 0 <= idx < len(results):
            filtered.append(results[idx])

    return {"filtered": filtered}


def should_loop(state: HunterState) -> str:
    """Decide whether to loop back for more searches or proceed to summarize."""
    filtered = state.get("filtered", [])
    iteration = state.get("iteration", 0)

    if len(filtered) < 3 and iteration < 2:
        return "generate_queries"
    return "summarize"


def summarize(state: HunterState) -> dict:
    """Generate a summary of findings for the alert."""
    hypothesis = state["hypothesis"]
    filtered = state.get("filtered", [])

    if not filtered:
        return {
            "summary": f"No relevant evidence found for: \"{hypothesis}\". "
                       f"Consider adding evidence manually or broadening the hypothesis.",
        }

    evidence_text = ""
    for r in filtered:
        evidence_text += (
            f"- **{r.get('title', 'Untitled')}** ({r.get('source_system', 'unknown')}, "
            f"strength: {r.get('computed_strength', 0):.0f}): "
            f"{(r.get('content') or '')[:150]}\n"
        )

    response = anthropic_client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=600,
        messages=[{
            "role": "user",
            "content": (
                f"Summarize what was found for this hypothesis:\n"
                f"\"{hypothesis}\"\n\n"
                f"Evidence found ({len(filtered)} items):\n{evidence_text}\n\n"
                f"Write a brief (3-5 sentences) summary covering:\n"
                f"1. What the evidence supports or contradicts\n"
                f"2. Key gaps remaining\n"
                f"3. Confidence assessment (weak/moderate/strong basis)"
            ),
        }],
    )

    return {"summary": response.content[0].text.strip()}


def store_results(state: HunterState) -> dict:
    """Save results as an agent alert and optionally link evidence to decision."""
    supabase = get_supabase()
    filtered = state.get("filtered", [])
    decision_id = state.get("decision_id")
    workspace_id = state["workspace_id"]

    evidence_ids = [r["id"] for r in filtered]
    linked_count = 0

    # Auto-link evidence to decision if decision_id provided
    if decision_id and evidence_ids:
        for eid in evidence_ids:
            try:
                supabase.table("evidence_decision_links").upsert({
                    "decision_id": decision_id,
                    "evidence_id": eid,
                    "relevance_note": "Auto-linked by Evidence Hunter agent",
                }, on_conflict="decision_id,evidence_id").execute()
                linked_count += 1
            except Exception:
                pass

        # Recalculate decision evidence strength
        if linked_count > 0:
            _recalculate_decision_strength(supabase, decision_id)

    # Get confidence before/after if we have a decision
    confidence_before = state.get("confidence_before", 0)
    confidence_after = confidence_before
    if decision_id:
        result = supabase.table("decisions").select("evidence_strength").eq("id", decision_id).single().execute()
        if result.data:
            confidence_after = result.data.get("evidence_strength", 0) or 0

    # Create alert
    alert_data = {
        "workspace_id": workspace_id,
        "agent_type": "evidence_hunter",
        "alert_type": "info" if filtered else "warning",
        "title": f"Evidence Hunt: Found {len(filtered)} relevant items" if filtered else "Evidence Hunt: No evidence found",
        "content": state.get("summary", ""),
        "metadata": json.dumps({
            "hypothesis": state["hypothesis"],
            "queries_used": state.get("queries", []),
            "found_count": len(filtered),
            "linked_count": linked_count,
            "evidence_ids": evidence_ids,
            "confidence_before": confidence_before,
            "confidence_after": confidence_after,
        }),
        "related_decision_id": decision_id,
        "related_evidence_ids": evidence_ids,
    }

    result = supabase.table("agent_alerts").insert(alert_data).execute()
    alert_id = result.data[0]["id"] if result.data else None

    return {
        "confidence_before": confidence_before,
        "confidence_after": confidence_after,
    }


def _recalculate_decision_strength(supabase, decision_id: str):
    """Recalculate decision evidence_strength from linked evidence."""
    links = supabase.table("evidence_decision_links") \
        .select("evidence_id, segment_match_factor") \
        .eq("decision_id", decision_id).execute()

    if not links.data:
        supabase.table("decisions").update({
            "evidence_strength": 0,
            "evidence_count": 0,
            "gate_recommendation": "park",
        }).eq("id", decision_id).execute()
        return

    evidence_ids = [l["evidence_id"] for l in links.data]
    factors = {l["evidence_id"]: l.get("segment_match_factor", 1.0) for l in links.data}

    evidence = supabase.table("evidence_bank") \
        .select("id, computed_strength") \
        .in_("id", evidence_ids).execute()

    if not evidence.data:
        return

    total = 0
    count = 0
    for e in evidence.data:
        strength = (e.get("computed_strength") or 0) * factors.get(e["id"], 1.0)
        total += strength
        count += 1

    avg_strength = total / count if count > 0 else 0

    gate = "park"
    if avg_strength >= 70:
        gate = "commit"
    elif avg_strength >= 40:
        gate = "validate"

    supabase.table("decisions").update({
        "evidence_strength": round(avg_strength, 1),
        "evidence_count": count,
        "gate_recommendation": gate,
    }).eq("id", decision_id).execute()


# --------------- Graph ---------------


def build_hunter_graph():
    """Build the LangGraph for Evidence Hunter."""
    graph = StateGraph(HunterState)

    graph.add_node("generate_queries", generate_queries)
    graph.add_node("search_vector", search_vector)
    graph.add_node("filter_rank", filter_rank)
    graph.add_node("summarize", summarize)
    graph.add_node("store_results", store_results)

    graph.set_entry_point("generate_queries")
    graph.add_edge("generate_queries", "search_vector")
    graph.add_edge("search_vector", "filter_rank")
    graph.add_conditional_edges("filter_rank", should_loop)
    graph.add_edge("summarize", "store_results")
    graph.add_edge("store_results", END)

    return graph.compile()


# Pre-compiled graph
hunter_graph = None


def get_hunter_graph():
    global hunter_graph
    if hunter_graph is None:
        hunter_graph = build_hunter_graph()
    return hunter_graph


async def run_evidence_hunter(hypothesis: str, workspace_id: str, decision_id: str | None = None) -> dict:
    """Run the Evidence Hunter agent."""
    supabase = get_supabase()

    # Get current confidence if decision exists
    confidence_before = 0
    if decision_id:
        result = supabase.table("decisions").select("evidence_strength").eq("id", decision_id).single().execute()
        if result.data:
            confidence_before = result.data.get("evidence_strength", 0) or 0

    graph = get_hunter_graph()
    initial_state: HunterState = {
        "hypothesis": hypothesis,
        "workspace_id": workspace_id,
        "decision_id": decision_id,
        "queries": [],
        "results": [],
        "filtered": [],
        "summary": "",
        "confidence_before": confidence_before,
        "confidence_after": 0,
        "iteration": 0,
    }

    final_state = graph.invoke(initial_state)

    return {
        "found": len(final_state.get("filtered", [])),
        "linked": len(final_state.get("filtered", [])) if decision_id else 0,
        "summary": final_state.get("summary", ""),
        "confidence_before": final_state.get("confidence_before", 0),
        "confidence_after": final_state.get("confidence_after", 0),
        "queries_used": final_state.get("queries", []),
    }
