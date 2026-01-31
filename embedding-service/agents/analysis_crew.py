"""
Analysis Crew — CrewAI
Multi-agent deep analysis of a decision's evidence.
Three AI agents collaborate sequentially:
  1. Sentiment Analyst — classifies evidence tone and emotional patterns
  2. Theme Synthesizer — clusters evidence into themes
  3. Validator — scores confidence, finds gaps, assesses quality

Uses CrewAI for role-based multi-agent orchestration.
"""

import json

from crewai import Agent, Task, Crew, Process
from anthropic import Anthropic

from config import ANTHROPIC_API_KEY, CLAUDE_MODEL
from db import get_supabase

anthropic_client = Anthropic(api_key=ANTHROPIC_API_KEY)


def _build_evidence_context(evidence_items: list) -> str:
    """Format evidence items into a readable context string."""
    context = ""
    for i, e in enumerate(evidence_items):
        context += (
            f"\n[{i+1}] {e.get('title', 'Untitled')}\n"
            f"    Source: {e.get('source_system', 'unknown')}\n"
            f"    Strength: {e.get('computed_strength', 0):.0f}/100\n"
            f"    Sentiment: {e.get('sentiment') or 'not analyzed'}\n"
            f"    Content: {(e.get('content') or 'No content')[:300]}\n"
        )
    return context


async def run_analysis_crew(decision_id: str, workspace_id: str) -> dict:
    """Run the CrewAI Analysis Crew on a decision's evidence."""
    supabase = get_supabase()

    # Fetch decision
    decision_result = supabase.table("decisions") \
        .select("id, title, hypothesis, description, status, evidence_strength, evidence_count") \
        .eq("id", decision_id) \
        .single().execute()

    if not decision_result.data:
        return {"error": "Decision not found"}

    decision = decision_result.data

    # Fetch linked evidence
    links = supabase.table("evidence_decision_links") \
        .select("evidence_id, segment_match_factor, relevance_note") \
        .eq("decision_id", decision_id).execute()

    if not links.data:
        return {"error": "No evidence linked to this decision"}

    evidence_ids = [l["evidence_id"] for l in links.data]
    evidence_result = supabase.table("evidence_bank") \
        .select("id, title, content, source_system, sentiment, computed_strength, segment, source_timestamp, tags") \
        .in_("id", evidence_ids).execute()

    evidence_items = evidence_result.data or []

    if not evidence_items:
        return {"error": "Evidence records not found"}

    evidence_context = _build_evidence_context(evidence_items)

    # Build the crew
    decision_context = (
        f"Decision: {decision['title']}\n"
        f"Hypothesis: {decision.get('hypothesis', 'Not specified')}\n"
        f"Description: {decision.get('description', 'Not specified')}\n"
        f"Status: {decision['status']}\n"
        f"Current Evidence Strength: {decision.get('evidence_strength', 0):.0f}/100\n"
        f"Evidence Count: {decision.get('evidence_count', 0)}"
    )

    # --- Define Agents ---

    sentiment_analyst = Agent(
        role="Sentiment Analyst",
        goal=(
            "Analyze the emotional tone and sentiment patterns across all evidence items. "
            "Identify user satisfaction signals, frustration indicators, and enthusiasm markers."
        ),
        backstory=(
            "You are an expert in qualitative research and sentiment analysis with 10 years of "
            "experience analyzing user feedback, support tickets, and product interviews. "
            "You excel at reading between the lines and identifying emotional undercurrents."
        ),
        verbose=False,
        allow_delegation=False,
        llm="anthropic/claude-sonnet-4-20250514",
    )

    theme_synthesizer = Agent(
        role="Theme Synthesizer",
        goal=(
            "Cluster the evidence into coherent themes, identify recurring patterns, "
            "and synthesize the big picture from individual data points."
        ),
        backstory=(
            "You are an expert in thematic analysis and pattern recognition, specializing in "
            "product discovery research. You can find signal in noise and connect dots across "
            "disparate data sources to reveal underlying themes."
        ),
        verbose=False,
        allow_delegation=False,
        llm="anthropic/claude-sonnet-4-20250514",
    )

    validator = Agent(
        role="Evidence Validator",
        goal=(
            "Critically assess the quality, completeness, and reliability of the evidence body. "
            "Score confidence, identify gaps, and flag methodological concerns."
        ),
        backstory=(
            "You are an expert in research methodology and evidence evaluation with a background "
            "in academic research and product analytics. You are skeptical by nature and always "
            "looking for what's missing, biased, or insufficiently supported."
        ),
        verbose=False,
        allow_delegation=False,
        llm="anthropic/claude-sonnet-4-20250514",
    )

    # --- Define Tasks ---

    sentiment_task = Task(
        description=(
            f"Analyze the sentiment patterns in the following evidence for this decision.\n\n"
            f"{decision_context}\n\n"
            f"EVIDENCE:{evidence_context}\n\n"
            f"Produce a structured JSON analysis with:\n"
            f"1. overall_sentiment: positive/negative/mixed\n"
            f"2. sentiment_distribution: {{positive: N, negative: N, neutral: N}}\n"
            f"3. key_signals: array of {{signal, sentiment, evidence_indices, quote}}\n"
            f"4. emotional_patterns: array of patterns you notice\n"
            f"Return ONLY valid JSON."
        ),
        expected_output="JSON object with overall_sentiment, sentiment_distribution, key_signals, emotional_patterns",
        agent=sentiment_analyst,
    )

    theme_task = Task(
        description=(
            f"Based on the evidence and the sentiment analysis from your colleague, "
            f"cluster the evidence into themes.\n\n"
            f"{decision_context}\n\n"
            f"EVIDENCE:{evidence_context}\n\n"
            f"Produce a structured JSON analysis with:\n"
            f"1. themes: array of {{theme_name, description, evidence_indices, strength}}\n"
            f"2. cross_cutting_patterns: array of patterns that span multiple themes\n"
            f"3. outliers: evidence items that don't fit any theme\n"
            f"4. narrative: 2-3 sentence synthesis of the big picture\n"
            f"Return ONLY valid JSON."
        ),
        expected_output="JSON object with themes, cross_cutting_patterns, outliers, narrative",
        agent=theme_synthesizer,
    )

    validation_task = Task(
        description=(
            f"Critically evaluate the evidence body for this decision, considering "
            f"the sentiment analysis and thematic clustering from your colleagues.\n\n"
            f"{decision_context}\n\n"
            f"EVIDENCE:{evidence_context}\n\n"
            f"Produce a structured JSON analysis with:\n"
            f"1. confidence_score: 0-100 (your independent assessment)\n"
            f"2. confidence_rationale: why this score\n"
            f"3. gaps: array of {{gap, severity (critical/moderate/minor), recommendation}}\n"
            f"4. methodological_concerns: array of concerns about evidence quality\n"
            f"5. source_diversity_assessment: how diverse/independent are the sources\n"
            f"6. recommendation: commit/validate/park with rationale\n"
            f"Return ONLY valid JSON."
        ),
        expected_output="JSON object with confidence_score, gaps, methodological_concerns, recommendation",
        agent=validator,
    )

    # --- Run Crew ---

    crew = Crew(
        agents=[sentiment_analyst, theme_synthesizer, validator],
        tasks=[sentiment_task, theme_task, validation_task],
        process=Process.sequential,
        verbose=False,
    )

    result = crew.kickoff()

    # Parse results from each task
    sentiment_output = _safe_parse_json(sentiment_task.output.raw if sentiment_task.output else "{}")
    theme_output = _safe_parse_json(theme_task.output.raw if theme_task.output else "{}")
    validation_output = _safe_parse_json(validation_task.output.raw if validation_task.output else "{}")

    # Generate summary using Claude
    summary = await _generate_summary(decision, sentiment_output, theme_output, validation_output)

    # Store alert
    alert_data = {
        "workspace_id": workspace_id,
        "agent_type": "analysis_crew",
        "alert_type": "info",
        "title": f"Deep Analysis: {decision['title'][:80]}",
        "content": summary,
        "metadata": json.dumps({
            "decision_id": decision_id,
            "decision_title": decision["title"],
            "sentiment_analysis": sentiment_output,
            "theme_analysis": theme_output,
            "validation": validation_output,
            "evidence_count": len(evidence_items),
        }),
        "related_decision_id": decision_id,
        "related_evidence_ids": evidence_ids,
    }

    alert_result = supabase.table("agent_alerts").insert(alert_data).execute()
    alert_id = alert_result.data[0]["id"] if alert_result.data else None

    return {
        "themes": theme_output.get("themes", []),
        "sentiment_analysis": sentiment_output,
        "validation": validation_output,
        "summary": summary,
        "alert_id": alert_id,
    }


def _safe_parse_json(text: str) -> dict:
    """Safely parse JSON from agent output, handling markdown code blocks."""
    if not text:
        return {}
    text = text.strip()
    try:
        if "```" in text:
            # Extract JSON from code block
            parts = text.split("```")
            for part in parts[1:]:
                cleaned = part.replace("json", "", 1).strip()
                if cleaned:
                    return json.loads(cleaned)
        return json.loads(text)
    except (json.JSONDecodeError, IndexError):
        return {"raw_text": text}


async def _generate_summary(decision: dict, sentiment: dict, themes: dict, validation: dict) -> str:
    """Generate a human-readable summary from the crew's analysis."""
    confidence = validation.get("confidence_score", "N/A")
    recommendation = validation.get("recommendation", "N/A")
    theme_list = themes.get("themes", [])
    gaps = validation.get("gaps", [])
    overall_sentiment = sentiment.get("overall_sentiment", "unknown")

    response = anthropic_client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=600,
        messages=[{
            "role": "user",
            "content": (
                f"Write a concise deep analysis summary for decision: \"{decision['title']}\"\n\n"
                f"Crew findings:\n"
                f"- Overall sentiment: {overall_sentiment}\n"
                f"- Themes found: {len(theme_list)} ({', '.join(t.get('theme_name', '') for t in theme_list[:5])})\n"
                f"- Confidence score: {confidence}/100\n"
                f"- Recommendation: {recommendation}\n"
                f"- Gaps identified: {len(gaps)}\n"
                f"- Narrative: {themes.get('narrative', 'N/A')}\n\n"
                f"Write a 4-6 sentence executive summary in markdown covering:\n"
                f"1. What the evidence tells us\n"
                f"2. Key themes and sentiment\n"
                f"3. Confidence level and why\n"
                f"4. Top gap or concern\n"
                f"5. Final recommendation"
            ),
        }],
    )

    return response.content[0].text.strip()
