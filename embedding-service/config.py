"""
Shared configuration for the embedding service and AI agents.
All values read from environment variables.

Model strategy:
- Haiku for simple tasks (contradiction, segment, competitor) — ~$0.0003/call
- Sonnet for complex reasoning (session analysis, brief generation) — ~$0.01-0.05/call
"""

import os
from dotenv import load_dotenv

load_dotenv()

# Supabase (for agent database access)
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

# Anthropic (for Claude calls from agents)
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

# Embedding service auth
EMBEDDING_API_KEY = os.getenv("EMBEDDING_API_KEY", "")

# Claude models — Haiku for simple tasks, Sonnet for complex reasoning
CLAUDE_HAIKU_MODEL = "claude-haiku-3-5-20241022"
CLAUDE_SONNET_MODEL = "claude-sonnet-4-20250514"
# Legacy alias (used by existing code referencing CLAUDE_MODEL)
CLAUDE_MODEL = CLAUDE_SONNET_MODEL
