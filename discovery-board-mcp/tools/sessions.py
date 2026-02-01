"""Session management tools for Discovery Board."""

from mcp.server.fastmcp import FastMCP
from db.supabase_client import get_supabase


def register(mcp: FastMCP):

    @mcp.tool()
    def create_session(
        user_id: str,
        title: str,
        workspace_id: str | None = None,
        template_id: str | None = None,
        objectives: list[str] | None = None,
    ) -> dict:
        """Create a new discovery session.

        Args:
            user_id: The user creating the session.
            title: Session title.
            workspace_id: Optional workspace to scope this session to.
            template_id: Optional template to base the session on.
            objectives: Optional list of objective strings to add.
        """
        sb = get_supabase()

        # Create the session
        row = {"user_id": user_id, "title": title, "status": "active"}
        if workspace_id:
            row["workspace_id"] = workspace_id
        if template_id:
            row["template_id"] = template_id

        result = sb.table("sessions").insert(row).execute()
        session = result.data[0]

        # If template specified, copy template sections into the session
        if template_id:
            ts = sb.table("template_sections").select("*").eq("template_id", template_id).order("order_index").execute()
            for sect in ts.data:
                sb.table("sections").insert({
                    "session_id": session["id"],
                    "name": sect["name"],
                    "order_index": sect["order_index"],
                }).execute()

        # Add objectives if provided
        if objectives:
            for i, obj in enumerate(objectives):
                sb.table("session_objectives").insert({
                    "session_id": session["id"],
                    "content": obj,
                    "order_index": i,
                }).execute()

        # Re-fetch with related data
        return _get_session_full(session["id"])

    @mcp.tool()
    def get_session(session_id: str) -> dict:
        """Get a session with all its sections, notes, objectives, checklist, and constraints.

        Args:
            session_id: The session UUID.
        """
        return _get_session_full(session_id)

    @mcp.tool()
    def list_sessions(
        user_id: str | None = None,
        workspace_id: str | None = None,
        status: str | None = None,
        limit: int = 20,
    ) -> list[dict]:
        """List sessions with optional filters.

        Args:
            user_id: Filter by owner.
            workspace_id: Filter by workspace.
            status: Filter by status (draft, active, completed).
            limit: Max results (default 20).
        """
        sb = get_supabase()
        q = sb.table("sessions").select("*")
        if user_id:
            q = q.eq("user_id", user_id)
        if workspace_id:
            q = q.eq("workspace_id", workspace_id)
        if status:
            q = q.eq("status", status)
        result = q.order("updated_at", desc=True).limit(limit).execute()
        return result.data

    @mcp.tool()
    def update_session(
        session_id: str,
        title: str | None = None,
        status: str | None = None,
    ) -> dict:
        """Update a session's title or status.

        Args:
            session_id: The session UUID.
            title: New title.
            status: New status (draft, active, completed).
        """
        sb = get_supabase()
        updates = {}
        if title is not None:
            updates["title"] = title
        if status is not None:
            updates["status"] = status
        if not updates:
            return {"error": "No fields to update"}
        sb.table("sessions").update(updates).eq("id", session_id).execute()
        return _get_session_full(session_id)


def _get_session_full(session_id: str) -> dict:
    """Fetch a session with all related data."""
    sb = get_supabase()

    session = sb.table("sessions").select("*").eq("id", session_id).single().execute().data

    # Sections with their sticky notes
    sections = sb.table("sections").select("*").eq("session_id", session_id).order("order_index").execute().data
    for sect in sections:
        notes = sb.table("sticky_notes").select("*").eq("section_id", sect["id"]).execute().data
        sect["sticky_notes"] = notes

    # Objectives
    objectives = sb.table("session_objectives").select("*").eq("session_id", session_id).order("order_index").execute().data

    # Checklist items
    checklist = sb.table("session_checklist_items").select("*").eq("session_id", session_id).order("order_index").execute().data

    # Session constraints (join through junction table)
    sc_links = sb.table("session_constraints").select("*, constraints(*)").eq("session_id", session_id).execute().data
    constraints = [link["constraints"] for link in sc_links if link.get("constraints")]

    session["sections"] = sections
    session["objectives"] = objectives
    session["checklist"] = checklist
    session["constraints"] = constraints
    return session
