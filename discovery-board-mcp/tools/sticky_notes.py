"""Sticky note management tools for Discovery Board."""

from mcp.server.fastmcp import FastMCP
from db.supabase_client import get_supabase


def register(mcp: FastMCP):

    @mcp.tool()
    def create_sticky_note(
        section_id: str,
        content: str,
        position_x: int = 0,
        position_y: int = 0,
    ) -> dict:
        """Create a sticky note in a section.

        Args:
            section_id: The section this note belongs to.
            content: The note text.
            position_x: X position on canvas.
            position_y: Y position on canvas.
        """
        sb = get_supabase()
        result = sb.table("sticky_notes").insert({
            "section_id": section_id,
            "content": content,
            "position_x": position_x,
            "position_y": position_y,
        }).execute()
        return result.data[0]

    @mcp.tool()
    def update_sticky_note(
        note_id: str,
        content: str | None = None,
        position_x: int | None = None,
        position_y: int | None = None,
    ) -> dict:
        """Update a sticky note's content or position.

        Args:
            note_id: The sticky note UUID.
            content: New content text.
            position_x: New X position.
            position_y: New Y position.
        """
        sb = get_supabase()
        updates = {}
        if content is not None:
            updates["content"] = content
        if position_x is not None:
            updates["position_x"] = position_x
        if position_y is not None:
            updates["position_y"] = position_y
        if not updates:
            return {"error": "No fields to update"}
        result = sb.table("sticky_notes").update(updates).eq("id", note_id).execute()
        return result.data[0]

    @mcp.tool()
    def delete_sticky_note(note_id: str) -> dict:
        """Delete a sticky note and its evidence links.

        Args:
            note_id: The sticky note UUID to delete.
        """
        sb = get_supabase()
        # Evidence links cascade-delete via FK, but let's be explicit
        sb.table("sticky_note_evidence_links").delete().eq("sticky_note_id", note_id).execute()
        sb.table("evidence").delete().eq("sticky_note_id", note_id).execute()
        sb.table("sticky_notes").delete().eq("id", note_id).execute()
        return {"deleted": note_id}

    @mcp.tool()
    def get_sticky_note(note_id: str) -> dict:
        """Get a sticky note with its linked evidence.

        Args:
            note_id: The sticky note UUID.
        """
        sb = get_supabase()
        note = sb.table("sticky_notes").select("*").eq("id", note_id).single().execute().data

        # Get evidence bank links
        links = (
            sb.table("sticky_note_evidence_links")
            .select("*, evidence_bank(*)")
            .eq("sticky_note_id", note_id)
            .execute()
            .data
        )
        note["evidence_bank_items"] = [
            link["evidence_bank"] for link in links if link.get("evidence_bank")
        ]

        # Get direct evidence
        direct = sb.table("evidence").select("*").eq("sticky_note_id", note_id).execute().data
        note["direct_evidence"] = direct

        return note

    @mcp.tool()
    def list_sticky_notes(
        session_id: str,
        section_id: str | None = None,
    ) -> list[dict]:
        """List sticky notes for a session, optionally filtered by section.

        Args:
            session_id: The session UUID.
            section_id: Optional section UUID to filter to.
        """
        sb = get_supabase()
        if section_id:
            notes = sb.table("sticky_notes").select("*").eq("section_id", section_id).execute().data
        else:
            # Get all sections for this session, then all notes
            sections = sb.table("sections").select("id").eq("session_id", session_id).execute().data
            section_ids = [s["id"] for s in sections]
            if not section_ids:
                return []
            notes = sb.table("sticky_notes").select("*").in_("section_id", section_ids).execute().data
        return notes

    @mcp.tool()
    def create_section(
        session_id: str,
        name: str,
        section_type: str = "general",
        order_index: int = 0,
        position_x: int = 0,
        position_y: int = 0,
        width: int = 300,
        height: int = 400,
    ) -> dict:
        """Create a new section in a session.

        Args:
            session_id: The session UUID.
            name: Section name.
            section_type: Type of section (general, problems, solutions, assumptions, evidence, decisions, problem_space, pain_points, observed_problems, proposed_solutions).
            order_index: Display order.
            position_x: X position on canvas.
            position_y: Y position on canvas.
            width: Section width in pixels.
            height: Section height in pixels.
        """
        sb = get_supabase()
        result = sb.table("sections").insert({
            "session_id": session_id,
            "name": name,
            "section_type": section_type,
            "order_index": order_index,
            "position_x": position_x,
            "position_y": position_y,
            "width": width,
            "height": height,
        }).execute()
        return result.data[0]
