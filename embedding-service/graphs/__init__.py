"""
LangGraph orchestration graphs for Discovery OS.
Two main flows:
- EvidenceLinkFlow: Orchestrates agents when evidence is linked to a sticky note
- SessionAnalysisFlow: Orchestrates the full session analysis pipeline
"""

from graphs.evidence_link import build_evidence_link_graph
from graphs.session_analysis import build_session_analysis_graph

__all__ = ["build_evidence_link_graph", "build_session_analysis_graph"]
