import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' })

// GET: List discovery briefs for workspace
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    let query = supabase
      .from('discovery_briefs')
      .select('*')
      .eq('workspace_id', membership.workspace_id)
      .order('created_at', { ascending: false })

    if (sessionId) {
      query = query.eq('session_id', sessionId)
    }

    const { data: briefs, error } = await query

    if (error) {
      console.error('Error fetching briefs:', error)
      return NextResponse.json({ error: 'Failed to fetch briefs' }, { status: 500 })
    }

    return NextResponse.json({ briefs: briefs || [] })
  } catch (error) {
    console.error('Discovery brief list error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: Generate a new discovery brief
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    const body = await request.json()
    const { session_id, title } = body

    // Gather workspace intelligence
    // 1. Recent high-strength evidence
    const { data: evidence } = await supabase
      .from('evidence_bank')
      .select('id, title, content, source_system, computed_strength, segment, sentiment, created_at')
      .eq('workspace_id', membership.workspace_id)
      .order('computed_strength', { ascending: false })
      .limit(20)

    // 2. Decision history
    const { data: decisions } = await supabase
      .from('decisions')
      .select('id, title, status, hypothesis, evidence_strength, evidence_count, created_at')
      .order('created_at', { ascending: false })
      .limit(15)

    // 3. Recent agent alerts
    const { data: alerts } = await supabase
      .from('agent_alerts')
      .select('agent_type, alert_type, title, content, created_at')
      .eq('workspace_id', membership.workspace_id)
      .order('created_at', { ascending: false })
      .limit(10)

    // 4. If session-specific, get session data
    let sessionContext = ''
    if (session_id) {
      const { data: session } = await supabase
        .from('sessions')
        .select('title, objectives, constraints')
        .eq('id', session_id)
        .single()

      if (session) {
        const objectives = Array.isArray(session.objectives)
          ? session.objectives.join(', ')
          : session.objectives || 'None'
        const constraints = Array.isArray(session.constraints)
          ? session.constraints.join(', ')
          : session.constraints || 'None'
        sessionContext = `\nSESSION: ${session.title}\nObjectives: ${objectives}\nConstraints: ${constraints}\n`
      }
    }

    // Build evidence summary
    const evidenceText = (evidence || []).slice(0, 15).map(e =>
      `- [${e.source_system}] "${e.title}" (strength: ${e.computed_strength || 0}%, segment: ${e.segment || '?'}, sentiment: ${e.sentiment || '?'})`
    ).join('\n')

    // Build decision summary
    const decisionText = (decisions || []).slice(0, 10).map(d =>
      `- "${d.title}" — ${d.status.toUpperCase()} (strength: ${d.evidence_strength || 0}%, ${d.evidence_count} evidence)`
    ).join('\n')

    // Build alerts summary
    const alertsText = (alerts || []).slice(0, 5).map(a =>
      `- [${a.agent_type}] ${a.title}: ${(a.content || '').slice(0, 100)}`
    ).join('\n')

    // 5. Gather weak/parked evidence items for "What we're NOT doing"
    const { data: weakEvidence } = await supabase
      .from('evidence_bank')
      .select('id, title, computed_strength, segment')
      .eq('workspace_id', membership.workspace_id)
      .lt('computed_strength', 40)
      .order('computed_strength', { ascending: true })
      .limit(10)

    const { data: parkedDecisions } = await supabase
      .from('decisions')
      .select('id, title, evidence_strength')
      .in('status', ['parked', 'deferred'])
      .order('created_at', { ascending: false })
      .limit(10)

    const notDoingText = [
      ...(weakEvidence || []).map(e => `- "${e.title}" — strength ${e.computed_strength || 0}% (weak evidence, needs validation)`),
      ...(parkedDecisions || []).map(d => `- "${d.title}" — parked (evidence strength: ${d.evidence_strength || 0}%)`),
    ].join('\n')

    const prompt = `Generate a comprehensive discovery brief for a product team. This brief synthesizes all available evidence, decisions, and agent intelligence into pre-session intelligence.
${sessionContext}
EVIDENCE (${(evidence || []).length} items, top by strength):
${evidenceText || 'No evidence collected yet'}

DECISIONS (${(decisions || []).length} total):
${decisionText || 'No decisions made yet'}

RECENT AGENT INSIGHTS:
${alertsText || 'No recent agent activity'}

PARKED / WEAK ITEMS (not pursuing):
${notDoingText || 'None — all items have adequate evidence'}

Generate a discovery brief with these sections in markdown:
1. **Executive Summary** — 2-3 sentence overview of current state
2. **Key Themes** — Top 3-5 recurring themes across all evidence (as bullet points)
3. **Evidence Landscape** — Summary of evidence coverage: sources, segments, strength distribution
4. **Decision Status** — Overview of committed/validating/parked decisions
5. **Top Risks & Gaps** — What's missing? Where is evidence weak?
6. **What We're NOT Doing** — Items explicitly parked or deprioritized due to weak evidence. Explain why each was parked and what evidence would be needed to reconsider.
7. **Recommended Focus Areas** — What to explore in the next discovery session
8. **Agent Intelligence** — Key findings from automated analysis

Keep it actionable and under 600 words. Use markdown formatting.`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    })

    const briefContent = response.content[0].type === 'text' ? response.content[0].text.trim() : ''

    // Extract key themes and risks from the response (simple extraction)
    const themeMatches = briefContent.match(/Key Themes[\s\S]*?(?=##|\*\*Evidence|\*\*Decision|$)/i)
    const riskMatches = briefContent.match(/Top Risks[\s\S]*?(?=##|\*\*Recommended|\*\*Agent|$)/i)

    const keyThemes = themeMatches
      ? themeMatches[0].match(/[-•]\s*\*?\*?([^*\n]+)/g)?.map(t => t.replace(/[-•]\s*\*?\*?/, '').trim()).slice(0, 5) || []
      : []
    const topRisks = riskMatches
      ? riskMatches[0].match(/[-•]\s*\*?\*?([^*\n]+)/g)?.map(t => t.replace(/[-•]\s*\*?\*?/, '').trim()).slice(0, 5) || []
      : []

    // Store the brief
    const { data: brief, error } = await supabase
      .from('discovery_briefs')
      .insert({
        workspace_id: membership.workspace_id,
        session_id: session_id || null,
        title: title || `Discovery Brief — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
        content: briefContent,
        evidence_count: (evidence || []).length,
        decision_count: (decisions || []).length,
        key_themes: keyThemes,
        top_risks: topRisks,
        generated_by: user.id,
        raw_response: response as unknown as Record<string, unknown>,
      })
      .select()
      .single()

    if (error) {
      console.error('Error storing brief:', error)
      return NextResponse.json({ error: 'Failed to store brief' }, { status: 500 })
    }

    return NextResponse.json({ brief })
  } catch (error) {
    console.error('Discovery brief generation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
