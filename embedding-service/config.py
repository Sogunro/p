"""
Shared configuration for the embedding service and AI agents.
All values read from environment variables.
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

# Claude model for agent reasoning
CLAUDE_MODEL = "claude-sonnet-4-20250514"
