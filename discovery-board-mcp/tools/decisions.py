"""Decision management tools for Discovery Board."""

from mcp.server.fastmcp import FastMCP
from db.supabase_client import get_supabase


def register(mcp: FastMCP):

    @mcp.tool()
    def create_decision(
        workspace_id: str,
        title: str,
        session_id: str | None = None,
        hypothesis: str | None = None,
        description: str | None = None,
        status: str = "validate",
        success_metrics: list[dict] | None = None,
        created_by: str | None = None,
        owner: str | None = None,
        review_date: str | None = None,
    ) -> dict:
        """Create a new decision.

        Args:
            workspace_id: The workspace UUID.
            title: Decision title.
            session_id: Optional linked session.
            hypothesis: The hypothesis being tested.
            description: Detailed description.
            status: Initial status (commit, validate, park). Defaults to validate.
            success_metrics: List of success metric objects.
            created_by: User ID.
            owner: Decision owner name.
            review_date: Date to review (YYYY-MM-DD).
        """
        sb = get_supabase()
        row = {
            "workspace_id": workspace_id,
            "title": title,
            "status": status,
        }
        if session_id:
            row["session_id"] = session_id
        if hypothesis:
            row["hypothesis"] = hypothesis
        if description:
            row["description"] = description
        if success_metrics:
            row["success_metrics"] = success_metrics
        if created_by:
            row["created_by"] = created_by
        if owner:
            row["owner"] = owner
        if review_date:
            row["review_date"] = review_date

        result = sb.table("decisions").insert(row).execute()
        return result.data[0]

    @mcp.tool()
    def get_decision(decision_id: str) -> dict:
        """Get a decision with its linked evidence.

        Args:
            decision_id: The decision UUID.
        """
        sb = get_supabase()
        decision = sb.table("decisions").select("*").eq("id", decision_id).single().execute().data

        # Get linked evidence
        links = (
            sb.table("evidence_decision_links")
            .select("*, evidence_bank:evidence_id(*)")
            .eq("decision_id", decision_id)
            .execute()
            .data
        )
        decision["evidence"] = [
            {**link["evidence_bank"], "relevance_note": link.get("relevance_note"), "segment_match_factor": link.get("segment_match_factor")}
            for link in links if link.get("evidence_bank")
        ]

        # Get outcomes
        outcomes = sb.table("outcomes").select("*").eq("decision_id", decision_id).execute().data
        decision["outcomes"] = outcomes

        return decision

    @mcp.tool()
    def list_decisions(
        workspace_id: str,
        session_id: str | None = None,
        status: str | None = None,
        limit: int = 20,
    ) -> list[dict]:
        """List decisions with filters.

        Args:
            workspace_id: The workspace UUID.
            session_id: Optional session filter.
            status: Optional status filter (commit, validate, park).
            limit: Max results (default 20).
        """
        sb = get_supabase()
        q = sb.table("decisions").select("*").eq("workspace_id", workspace_id)
        if session_id:
            q = q.eq("session_id", session_id)
        if status:
            q = q.eq("status", status)
        result = q.order("updated_at", desc=True).limit(limit).execute()
        return result.data

    @mcp.tool()
    def update_decision(
        decision_id: str,
        title: str | None = None,
        status: str | None = None,
        hypothesis: str | None = None,
        description: str | None = None,
        owner: str | None = None,
        review_date: str | None = None,
        is_overridden: bool | None = None,
        override_reason: str | None = None,
    ) -> dict:
        """Update a decision.

        Args:
            decision_id: The decision UUID.
            title: New title.
            status: New status (commit, validate, park).
            hypothesis: New hypothesis.
            description: New description.
            owner: New owner.
            review_date: New review date (YYYY-MM-DD).
            is_overridden: Whether the gate recommendation was overridden.
            override_reason: Reason for override.
        """
        sb = get_supabase()
        updates = {}
        if title is not None:
            updates["title"] = title
        if status is not None:
            updates["status"] = status
        if hypothesis is not None:
            updates["hypothesis"] = hypothesis
        if description is not None:
            updates["description"] = description
        if owner is not None:
            updates["owner"] = owner
        if review_date is not None:
            updates["review_date"] = review_date
        if is_overridden is not None:
            updates["is_overridden"] = is_overridden
        if override_reason is not None:
            updates["override_reason"] = override_reason
        if not updates:
            return {"error": "No fields to update"}

        result = sb.table("decisions").update(updates).eq("id", decision_id).execute()
        return result.data[0]

    @mcp.tool()
    def link_evidence_to_decision(
        decision_id: str,
        evidence_id: str,
        relevance_note: str | None = None,
        linked_by: str | None = None,
    ) -> dict:
        """Link an evidence bank item to a decision.

        Args:
            decision_id: The decision UUID.
            evidence_id: The evidence bank item UUID.
            relevance_note: Why this evidence is relevant.
            linked_by: User ID who created this link.
        """
        sb = get_supabase()
        row = {
            "decision_id": decision_id,
            "evidence_id": evidence_id,
        }
        if relevance_note:
            row["relevance_note"] = relevance_note
        if linked_by:
            row["linked_by"] = linked_by

        result = sb.table("evidence_decision_links").insert(row).execute()

        # Update decision evidence count and strength
        _refresh_decision_evidence_stats(decision_id)

        return result.data[0]

    @mcp.tool()
    def unlink_evidence_from_decision(
        decision_id: str,
        evidence_id: str,
    ) -> dict:
        """Remove an evidence link from a decision.

        Args:
            decision_id: The decision UUID.
            evidence_id: The evidence bank item UUID.
        """
        sb = get_supabase()
        sb.table("evidence_decision_links").delete().eq(
            "decision_id", decision_id
        ).eq("evidence_id", evidence_id).execute()

        _refresh_decision_evidence_stats(decision_id)
        return {"unlinked": True}

    @mcp.tool()
    def record_outcome(
        workspace_id: str,
        decision_id: str,
        outcome_type: str = "pending",
        title: str | None = None,
        target_metrics: dict | None = None,
        actual_metrics: dict | None = None,
        learnings: str | None = None,
        created_by: str | None = None,
    ) -> dict:
        """Record an outcome for a decision.

        Args:
            workspace_id: The workspace UUID.
            decision_id: The decision UUID.
            outcome_type: Result type (success, partial, failure, pending).
            title: Outcome title.
            target_metrics: What was expected.
            actual_metrics: What actually happened.
            learnings: Lessons learned.
            created_by: User ID.
        """
        sb = get_supabase()
        row = {
            "workspace_id": workspace_id,
            "decision_id": decision_id,
            "outcome_type": outcome_type,
        }
        if title:
            row["title"] = title
        if target_metrics:
            row["target_metrics"] = target_metrics
        if actual_metrics:
            row["actual_metrics"] = actual_metrics
        if learnings:
            row["learnings"] = learnings
        if created_by:
            row["created_by"] = created_by

        result = sb.table("outcomes").insert(row).execute()
        return result.data[0]


def _refresh_decision_evidence_stats(decision_id: str):
    """Recalculate evidence_count and evidence_strength for a decision."""
    sb = get_supabase()
    links = (
        sb.table("evidence_decision_links")
        .select("evidence_id, segment_match_factor, evidence_bank:evidence_id(computed_strength)")
        .eq("decision_id", decision_id)
        .execute()
        .data
    )
    count = len(links)
    if count == 0:
        avg_strength = 0
    else:
        strengths = []
        for link in links:
            eb = link.get("evidence_bank")
            if eb:
                strengths.append(float(eb.get("computed_strength", 0)))
        avg_strength = sum(strengths) / len(strengths) if strengths else 0

    # Determine gate recommendation
    if avg_strength > 70:
        gate = "commit"
    elif avg_strength >= 40:
        gate = "validate"
    else:
        gate = "park"

    sb.table("decisions").update({
        "evidence_count": count,
        "evidence_strength": round(avg_strength, 2),
        "gate_recommendation": gate,
    }).eq("id", decision_id).execute()
