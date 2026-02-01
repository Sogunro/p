"""Analysis and insight tools for Discovery Board."""

from mcp.server.fastmcp import FastMCP
from db.supabase_client import get_supabase


def register(mcp: FastMCP):

    @mcp.tool()
    def get_session_analysis(session_id: str) -> dict | None:
        """Get the latest analysis for a session.

        Args:
            session_id: The session UUID.
        """
        sb = get_supabase()
        result = (
            sb.table("session_analyses")
            .select("*")
            .eq("session_id", session_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        return result.data[0] if result.data else None

    @mcp.tool()
    def save_session_analysis(
        session_id: str,
        summary: str | None = None,
        objective_score: int | None = None,
        assumptions: list | None = None,
        evidence_backed: list | None = None,
        validation_recommendations: list | None = None,
        constraint_analysis: list | None = None,
        checklist_review: list | None = None,
        session_diagnosis: dict | None = None,
        evidence_assessment: dict | None = None,
        strategic_alignment: dict | None = None,
        solutions_analysis: dict | None = None,
        pattern_detection: dict | None = None,
        priority_ranking: list | None = None,
        next_steps: list | None = None,
        hypotheses: list | None = None,
        conflicts: list | None = None,
        raw_response: dict | None = None,
    ) -> dict:
        """Save a session analysis result.

        Args:
            session_id: The session UUID.
            summary: Analysis summary text.
            objective_score: Score 0-100 of how well objectives are met.
            assumptions: List of identified assumptions.
            evidence_backed: List of evidence-backed claims.
            validation_recommendations: List of validation suggestions.
            constraint_analysis: Constraint evaluation results.
            checklist_review: Checklist evaluation results.
            session_diagnosis: Comprehensive diagnosis of the session.
            evidence_assessment: Assessment of evidence quality.
            strategic_alignment: How well session aligns with strategy.
            solutions_analysis: Analysis of proposed solutions.
            pattern_detection: Detected patterns across evidence.
            priority_ranking: Ranked priorities.
            next_steps: Recommended next actions.
            hypotheses: Generated hypotheses.
            conflicts: Detected conflicts/contradictions.
            raw_response: Full raw AI response.
        """
        sb = get_supabase()
        row = {"session_id": session_id}
        if summary is not None:
            row["summary"] = summary
        if objective_score is not None:
            row["objective_score"] = objective_score
        if assumptions is not None:
            row["assumptions"] = assumptions
        if evidence_backed is not None:
            row["evidence_backed"] = evidence_backed
        if validation_recommendations is not None:
            row["validation_recommendations"] = validation_recommendations
        if constraint_analysis is not None:
            row["constraint_analysis"] = constraint_analysis
        if checklist_review is not None:
            row["checklist_review"] = checklist_review
        if session_diagnosis is not None:
            row["session_diagnosis"] = session_diagnosis
        if evidence_assessment is not None:
            row["evidence_assessment"] = evidence_assessment
        if strategic_alignment is not None:
            row["strategic_alignment"] = strategic_alignment
        if solutions_analysis is not None:
            row["solutions_analysis"] = solutions_analysis
        if pattern_detection is not None:
            row["pattern_detection"] = pattern_detection
        if priority_ranking is not None:
            row["priority_ranking"] = priority_ranking
        if next_steps is not None:
            row["next_steps"] = next_steps
        if hypotheses is not None:
            row["hypotheses"] = hypotheses
        if conflicts is not None:
            row["conflicts"] = conflicts
        if raw_response is not None:
            row["raw_response"] = raw_response

        result = sb.table("session_analyses").insert(row).execute()
        return result.data[0]

    @mcp.tool()
    def get_workspace_insights(
        workspace_id: str,
        source_system: str | None = None,
        is_dismissed: bool = False,
        limit: int = 50,
    ) -> list[dict]:
        """Get insights feed items for a workspace.

        Args:
            workspace_id: The workspace UUID.
            source_system: Filter by source (slack, notion, mixpanel, airtable).
            is_dismissed: Include dismissed items (default False).
            limit: Max results (default 50).
        """
        sb = get_supabase()
        q = sb.table("insights_feed").select("*").eq("workspace_id", workspace_id)
        if not is_dismissed:
            q = q.eq("is_dismissed", False)
        if source_system:
            q = q.eq("source_system", source_system)
        result = q.order("fetched_at", desc=True).limit(limit).execute()
        return result.data

    @mcp.tool()
    def get_daily_analysis(
        workspace_id: str,
        analysis_date: str | None = None,
    ) -> dict | None:
        """Get a daily insights analysis for a workspace.

        Args:
            workspace_id: The workspace UUID.
            analysis_date: Date to fetch (YYYY-MM-DD). If omitted, gets latest.
        """
        sb = get_supabase()
        q = sb.table("daily_insights_analysis").select("*").eq("workspace_id", workspace_id)
        if analysis_date:
            q = q.eq("analysis_date", analysis_date)
        else:
            q = q.order("analysis_date", desc=True).limit(1)
        result = q.execute()
        return result.data[0] if result.data else None

    @mcp.tool()
    def get_agent_alerts(
        workspace_id: str,
        agent_type: str | None = None,
        is_read: bool | None = None,
        limit: int = 20,
    ) -> list[dict]:
        """Get AI agent alerts for a workspace.

        Args:
            workspace_id: The workspace UUID.
            agent_type: Filter by agent type (strength_calculator, contradiction_detector, etc.).
            is_read: Filter by read status.
            limit: Max results (default 20).
        """
        sb = get_supabase()
        q = sb.table("agent_alerts").select("*").eq("workspace_id", workspace_id)
        if agent_type:
            q = q.eq("agent_type", agent_type)
        if is_read is not None:
            q = q.eq("is_read", is_read)
        result = q.order("created_at", desc=True).limit(limit).execute()
        return result.data

    @mcp.tool()
    def get_confidence_history(
        workspace_id: str,
        entity_id: str | None = None,
        entity_type: str | None = None,
        limit: int = 50,
    ) -> list[dict]:
        """Get confidence/strength change history.

        Args:
            workspace_id: The workspace UUID.
            entity_id: Filter to a specific entity.
            entity_type: Filter by type (evidence_bank, sticky_note, decision, hypothesis).
            limit: Max results (default 50).
        """
        sb = get_supabase()
        q = sb.table("confidence_history").select("*").eq("workspace_id", workspace_id)
        if entity_id:
            q = q.eq("entity_id", entity_id)
        if entity_type:
            q = q.eq("entity_type", entity_type)
        result = q.order("recorded_at", desc=True).limit(limit).execute()
        return result.data

    @mcp.tool()
    def get_calibration(
        workspace_id: str,
        user_id: str,
    ) -> dict | None:
        """Get PM calibration data for a user.

        Args:
            workspace_id: The workspace UUID.
            user_id: The user UUID.
        """
        sb = get_supabase()
        result = (
            sb.table("pm_calibration")
            .select("*")
            .eq("workspace_id", workspace_id)
            .eq("user_id", user_id)
            .order("period_end", desc=True)
            .limit(1)
            .execute()
        )
        return result.data[0] if result.data else None
