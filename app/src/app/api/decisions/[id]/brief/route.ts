import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { getStrengthBand, getStrengthBandLabel } from '@/lib/evidence-strength'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

interface RouteContext {
  params: Promise<{ id: string }>
}

// POST /api/decisions/[id]/brief — generate executive decision brief
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: decisionId } = await context.params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch decision with evidence links
    const { data: decision, error: decisionError } = await supabase
      .from('decisions')
      .select('*')
      .eq('id', decisionId)
      .single()

    if (decisionError || !decision) {
      return NextResponse.json({ error: 'Decision not found' }, { status: 404 })
    }

    // Fetch linked evidence
    const { data: links } = await supabase
      .from('evidence_decision_links')
      .select('evidence_id, segment_match_factor, relevance_note')
      .eq('decision_id', decisionId)

    let evidenceItems: Record<string, unknown>[] = []
    if (links && links.length > 0) {
      const evidenceIds = links.map(l => l.evidence_id)
      const { data: evidence } = await supabase
        .from('evidence_bank')
        .select('id, title, content, source_system, strength, computed_strength, segment, url, source_timestamp, created_at')
        .in('id', evidenceIds)
      evidenceItems = evidence || []
    }

    // Fetch session info if linked
    let sessionContext = ''
    if (decision.session_id) {
      const { data: session } = await supabase
        .from('sessions')
        .select('title, name')
        .eq('id', decision.session_id)
        .single()
      if (session) {
        sessionContext = `Discovery Session: ${session.title || session.name}`
      }
    }

    // Build the prompt
    const band = getStrengthBand(decision.evidence_strength)
    const bandLabel = getStrengthBandLabel(band)

    const evidenceSummary = evidenceItems.map((ev, i) => {
      const link = links?.find(l => l.evidence_id === (ev as { id: string }).id)
      return `${i + 1}. [${(ev as { source_system: string }).source_system}] "${(ev as { title: string }).title}"
   Content: ${(ev as { content: string | null }).content || 'N/A'}
   Strength: ${(ev as { computed_strength: number }).computed_strength}/100
   ${link?.relevance_note ? `Relevance: ${link.relevance_note}` : ''}`
    }).join('\n')

    const prompt = `You are a product management advisor generating an executive decision brief.

DECISION RECORD:
- Title: ${decision.title}
- Hypothesis: ${decision.hypothesis || 'None specified'}
- Description: ${decision.description || 'None specified'}
- Status: ${decision.status} (${decision.status === 'commit' ? 'approved to ship' : decision.status === 'validate' ? 'needs more evidence' : 'shelved'})
- Evidence Strength: ${decision.evidence_strength}/100 (${bandLabel})
- Evidence Count: ${decision.evidence_count}
- Gate Recommendation: ${decision.gate_recommendation || 'N/A'}
${decision.is_overridden ? `- OVERRIDE: ${decision.override_reason}` : ''}
${sessionContext ? `- ${sessionContext}` : ''}
${decision.success_metrics && JSON.stringify(decision.success_metrics) !== '[]' ? `- Success Metrics: ${JSON.stringify(decision.success_metrics)}` : ''}

LINKED EVIDENCE:
${evidenceSummary || 'No evidence linked.'}

Generate a concise executive decision brief with the following sections:

1. **DECISION SUMMARY** (2-3 sentences: what is being decided and the recommendation)
2. **EVIDENCE ASSESSMENT** (what evidence supports this, what's the strength, any gaps?)
3. **KEY RISKS** (what could go wrong, what evidence is missing?)
4. **RECOMMENDATION** (clear commit/validate/park recommendation with rationale)
${decision.is_overridden ? '5. **OVERRIDE NOTE** (acknowledge the override and its stated reason)' : ''}

Keep it brief, direct, and actionable. No fluff. Use bullet points where helpful.
Format as plain text with markdown headers (**bold** for sections).`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [
        { role: 'user', content: prompt }
      ],
    })

    const briefText = message.content[0].type === 'text' ? message.content[0].text : ''

    return NextResponse.json({ brief: briefText })
  } catch (error) {
    console.error('Brief generation error:', error)
    return NextResponse.json({ error: 'Failed to generate brief' }, { status: 500 })
  }
}
