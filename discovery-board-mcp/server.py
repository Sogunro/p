"""Discovery Board MCP Server

Exposes the Discovery Board database as MCP tools for AI agents.
Uses the Supabase service-role client to bypass RLS.
"""

from mcp.server.fastmcp import FastMCP

from tools.sessions import register as register_sessions
from tools.sticky_notes import register as register_sticky_notes
from tools.evidence import register as register_evidence
from tools.constraints import register as register_constraints
from tools.decisions import register as register_decisions
from tools.analysis import register as register_analysis

mcp = FastMCP(
    "Discovery Board",
    description="MCP server for the Discovery Board product-decision platform. "
    "Provides tools to manage sessions, sticky notes, evidence, "
    "constraints, decisions, and analysis.",
)

# Register all tool modules
register_sessions(mcp)
register_sticky_notes(mcp)
register_evidence(mcp)
register_constraints(mcp)
register_decisions(mcp)
register_analysis(mcp)

if __name__ == "__main__":
    mcp.run()
