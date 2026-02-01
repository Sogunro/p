"""Evidence management tools for Discovery Board."""

from mcp.server.fastmcp import FastMCP
from db.supabase_client import get_supabase


def register(mcp: FastMCP):

    @mcp.tool()
    def search_evidence(
        workspace_id: str,
        query: str | None = None,
        source_system: str | None = None,
        strength: str | None = None,
        tags: list[str] | None = None,
        limit: int = 20,
    ) -> list[dict]:
        """Search evidence bank items with filters.

        Args:
            workspace_id: The workspace to search within.
            query: Text search across title and content.
            source_system: Filter by source (manual, slack, notion, mixpanel, airtable, intercom, gong, interview, support, analytics, social).
            strength: Filter by strength (high, medium, low).
            tags: Filter by tags (any match).
            limit: Max results (default 20).
        """
        sb = get_supabase()
        q = sb.table("evidence_bank").select("*").eq("workspace_id", workspace_id)

        if query:
            q = q.or_(f"title.ilike.%{query}%,content.ilike.%{query}%")
        if source_system:
            q = q.eq("source_system", source_system)
        if strength:
            q = q.eq("strength", strength)
        if tags:
            q = q.overlaps("tags", tags)

        result = q.order("computed_strength", desc=True).limit(limit).execute()
        return result.data

    @mcp.tool()
    def get_evidence(evidence_id: str) -> dict:
        """Get a single evidence bank item by ID.

        Args:
            evidence_id: The evidence bank item UUID.
        """
        sb = get_supabase()
        result = sb.table("evidence_bank").select("*").eq("id", evidence_id).single().execute()
        return result.data

    @mcp.tool()
    def add_evidence(
        workspace_id: str,
        title: str,
        type: str = "text",
        content: str | None = None,
        url: str | None = None,
        source_system: str = "manual",
        strength: str = "medium",
        tags: list[str] | None = None,
        source_metadata: dict | None = None,
        created_by: str | None = None,
    ) -> dict:
        """Add a new evidence item to the evidence bank.

        Args:
            workspace_id: The workspace this evidence belongs to.
            title: Evidence title.
            type: Evidence type (url or text).
            content: Text content of the evidence.
            url: URL source if type is url.
            source_system: Where this evidence came from (manual, slack, notion, etc.).
            strength: Initial strength rating (high, medium, low).
            tags: List of tags.
            source_metadata: Additional metadata as JSON.
            created_by: User ID of who added this.
        """
        sb = get_supabase()
        row = {
            "workspace_id": workspace_id,
            "title": title,
            "type": type,
            "source_system": source_system,
            "strength": strength,
        }
        if content is not None:
            row["content"] = content
        if url is not None:
            row["url"] = url
        if tags:
            row["tags"] = tags
        if source_metadata:
            row["source_metadata"] = source_metadata
        if created_by:
            row["created_by"] = created_by

        result = sb.table("evidence_bank").insert(row).execute()
        return result.data[0]

    @mcp.tool()
    def link_evidence_to_note(
        sticky_note_id: str,
        evidence_bank_id: str,
    ) -> dict:
        """Link an evidence bank item to a sticky note.

        Args:
            sticky_note_id: The sticky note UUID.
            evidence_bank_id: The evidence bank item UUID.
        """
        sb = get_supabase()
        result = sb.table("sticky_note_evidence_links").insert({
            "sticky_note_id": sticky_note_id,
            "evidence_bank_id": evidence_bank_id,
        }).execute()

        # Update has_evidence flag on the sticky note
        sb.table("sticky_notes").update({"has_evidence": True}).eq("id", sticky_note_id).execute()

        return result.data[0]

    @mcp.tool()
    def unlink_evidence_from_note(
        sticky_note_id: str,
        evidence_bank_id: str,
    ) -> dict:
        """Remove a link between an evidence bank item and a sticky note.

        Args:
            sticky_note_id: The sticky note UUID.
            evidence_bank_id: The evidence bank item UUID.
        """
        sb = get_supabase()
        sb.table("sticky_note_evidence_links").delete().eq(
            "sticky_note_id", sticky_note_id
        ).eq("evidence_bank_id", evidence_bank_id).execute()

        # Check if there are remaining links
        remaining = (
            sb.table("sticky_note_evidence_links")
            .select("id", count="exact")
            .eq("sticky_note_id", sticky_note_id)
            .execute()
        )
        if remaining.count == 0:
            sb.table("sticky_notes").update({"has_evidence": False}).eq("id", sticky_note_id).execute()

        return {"unlinked": True}

    @mcp.tool()
    def get_evidence_for_note(sticky_note_id: str) -> list[dict]:
        """Get all evidence bank items linked to a sticky note.

        Args:
            sticky_note_id: The sticky note UUID.
        """
        sb = get_supabase()
        links = (
            sb.table("sticky_note_evidence_links")
            .select("*, evidence_bank(*)")
            .eq("sticky_note_id", sticky_note_id)
            .execute()
            .data
        )
        return [link["evidence_bank"] for link in links if link.get("evidence_bank")]

    @mcp.tool()
    def update_evidence_strength(
        evidence_id: str,
        strength: str | None = None,
        source_weight: float | None = None,
        recency_factor: float | None = None,
        sentiment: str | None = None,
        segment: str | None = None,
        computed_strength: float | None = None,
        has_direct_voice: bool | None = None,
    ) -> dict:
        """Update evidence strength fields.

        Args:
            evidence_id: The evidence bank item UUID.
            strength: Manual strength rating (high, medium, low).
            source_weight: Computed source weight (0-1).
            recency_factor: Computed recency factor (0-1).
            sentiment: Detected sentiment (positive, negative, neutral).
            segment: User segment this evidence applies to.
            computed_strength: Overall computed strength score.
            has_direct_voice: Whether this has direct user voice.
        """
        sb = get_supabase()
        updates = {}
        if strength is not None:
            updates["strength"] = strength
        if source_weight is not None:
            updates["source_weight"] = source_weight
        if recency_factor is not None:
            updates["recency_factor"] = recency_factor
        if sentiment is not None:
            updates["sentiment"] = sentiment
        if segment is not None:
            updates["segment"] = segment
        if computed_strength is not None:
            updates["computed_strength"] = computed_strength
        if has_direct_voice is not None:
            updates["has_direct_voice"] = has_direct_voice
        if not updates:
            return {"error": "No fields to update"}

        result = sb.table("evidence_bank").update(updates).eq("id", evidence_id).execute()
        return result.data[0]
