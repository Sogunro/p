"""
Supabase client helper for AI agents.
Uses service role key to bypass RLS — agents need full read/write access.
"""

from supabase import create_client, Client
from config import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

_client: Client | None = None


def get_supabase() -> Client:
    """Get or create a Supabase client with service role privileges."""
    global _client
    if _client is None:
        if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
            raise RuntimeError(
                "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for agent database access"
            )
        _client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    return _client
