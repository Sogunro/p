"""Constraints and objectives management tools for Discovery Board."""

from mcp.server.fastmcp import FastMCP
from db.supabase_client import get_supabase


def register(mcp: FastMCP):

    # ── Objectives ──────────────────────────────────────────

    @mcp.tool()
    def add_objective(
        session_id: str,
        content: str,
        order_index: int | None = None,
    ) -> dict:
        """Add an objective to a session.

        Args:
            session_id: The session UUID.
            content: Objective text.
            order_index: Display order. If omitted, appends to end.
        """
        sb = get_supabase()
        if order_index is None:
            existing = (
                sb.table("session_objectives")
                .select("order_index")
                .eq("session_id", session_id)
                .order("order_index", desc=True)
                .limit(1)
                .execute()
                .data
            )
            order_index = (existing[0]["order_index"] + 1) if existing else 0

        result = sb.table("session_objectives").insert({
            "session_id": session_id,
            "content": content,
            "order_index": order_index,
        }).execute()
        return result.data[0]

    @mcp.tool()
    def update_objective(objective_id: str, content: str) -> dict:
        """Update an objective's text.

        Args:
            objective_id: The objective UUID.
            content: New objective text.
        """
        sb = get_supabase()
        result = sb.table("session_objectives").update({"content": content}).eq("id", objective_id).execute()
        return result.data[0]

    @mcp.tool()
    def delete_objective(objective_id: str) -> dict:
        """Delete an objective.

        Args:
            objective_id: The objective UUID.
        """
        sb = get_supabase()
        sb.table("session_objectives").delete().eq("id", objective_id).execute()
        return {"deleted": objective_id}

    @mcp.tool()
    def list_objectives(session_id: str) -> list[dict]:
        """List all objectives for a session.

        Args:
            session_id: The session UUID.
        """
        sb = get_supabase()
        result = sb.table("session_objectives").select("*").eq("session_id", session_id).order("order_index").execute()
        return result.data

    # ── Constraints ─────────────────────────────────────────

    @mcp.tool()
    def add_constraint(
        user_id: str,
        type: str,
        label: str,
        value: str | None = None,
    ) -> dict:
        """Add a new constraint for a user.

        Args:
            user_id: The user UUID.
            type: Constraint type (vision, kpi, resources, budget, timeline, technical).
            label: Constraint label/name.
            value: Constraint value.
        """
        sb = get_supabase()
        result = sb.table("constraints").insert({
            "user_id": user_id,
            "type": type,
            "label": label,
            "value": value,
        }).execute()
        return result.data[0]

    @mcp.tool()
    def update_constraint(
        constraint_id: str,
        label: str | None = None,
        value: str | None = None,
    ) -> dict:
        """Update a constraint's label or value.

        Args:
            constraint_id: The constraint UUID.
            label: New label.
            value: New value.
        """
        sb = get_supabase()
        updates = {}
        if label is not None:
            updates["label"] = label
        if value is not None:
            updates["value"] = value
        if not updates:
            return {"error": "No fields to update"}
        result = sb.table("constraints").update(updates).eq("id", constraint_id).execute()
        return result.data[0]

    @mcp.tool()
    def link_constraint_to_session(
        session_id: str,
        constraint_id: str,
    ) -> dict:
        """Link an existing constraint to a session.

        Args:
            session_id: The session UUID.
            constraint_id: The constraint UUID.
        """
        sb = get_supabase()
        result = sb.table("session_constraints").insert({
            "session_id": session_id,
            "constraint_id": constraint_id,
        }).execute()
        return result.data[0]

    @mcp.tool()
    def unlink_constraint_from_session(
        session_id: str,
        constraint_id: str,
    ) -> dict:
        """Remove a constraint from a session.

        Args:
            session_id: The session UUID.
            constraint_id: The constraint UUID.
        """
        sb = get_supabase()
        sb.table("session_constraints").delete().eq(
            "session_id", session_id
        ).eq("constraint_id", constraint_id).execute()
        return {"unlinked": True}

    @mcp.tool()
    def list_constraints(
        user_id: str | None = None,
        session_id: str | None = None,
    ) -> list[dict]:
        """List constraints. Filter by user or by session.

        Args:
            user_id: Filter by user's constraints.
            session_id: Filter by constraints linked to a session.
        """
        sb = get_supabase()
        if session_id:
            links = (
                sb.table("session_constraints")
                .select("*, constraints(*)")
                .eq("session_id", session_id)
                .execute()
                .data
            )
            return [link["constraints"] for link in links if link.get("constraints")]
        elif user_id:
            result = sb.table("constraints").select("*").eq("user_id", user_id).execute()
            return result.data
        else:
            return {"error": "Provide user_id or session_id"}

    # ── Checklist ───────────────────────────────────────────

    @mcp.tool()
    def add_checklist_item(
        session_id: str,
        content: str,
        is_default: bool = False,
    ) -> dict:
        """Add a checklist item to a session.

        Args:
            session_id: The session UUID.
            content: Checklist item text.
            is_default: Whether this is a default item.
        """
        sb = get_supabase()
        existing = (
            sb.table("session_checklist_items")
            .select("order_index")
            .eq("session_id", session_id)
            .order("order_index", desc=True)
            .limit(1)
            .execute()
            .data
        )
        order_index = (existing[0]["order_index"] + 1) if existing else 0

        result = sb.table("session_checklist_items").insert({
            "session_id": session_id,
            "content": content,
            "is_default": is_default,
            "order_index": order_index,
        }).execute()
        return result.data[0]

    @mcp.tool()
    def toggle_checklist_item(item_id: str, is_checked: bool) -> dict:
        """Toggle a checklist item's checked state.

        Args:
            item_id: The checklist item UUID.
            is_checked: New checked state.
        """
        sb = get_supabase()
        result = sb.table("session_checklist_items").update({"is_checked": is_checked}).eq("id", item_id).execute()
        return result.data[0]

    @mcp.tool()
    def delete_checklist_item(item_id: str) -> dict:
        """Delete a checklist item.

        Args:
            item_id: The checklist item UUID.
        """
        sb = get_supabase()
        sb.table("session_checklist_items").delete().eq("id", item_id).execute()
        return {"deleted": item_id}
