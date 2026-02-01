import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// POST: Generate a draft outcome using Claude
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
    const { decision_id } = body

    if (!decision_id) {
      return NextResponse.json({ error: 'decision_id is required' }, { status: 400 })
    }

    // Fetch decision + linked evidence
    const { data: decision } = await supabase
      .from('decisions')
      .select('*')
      .eq('id', decision_id)
      .eq('workspace_id', membership.workspace_id)
      .single()

    if (!decision) {
      return NextResponse.json({ error: 'Decision not found' }, { status: 404 })
    }

    // Fetch linked evidence
    const { data: links } = await supabase
      .from('evidence_decision_links')
      .select('evidence_id')
      .eq('decision_id', decision_id)

    const evidenceIds = (links || []).map(l => l.evidence_id)
    let evidenceSummary = 'No evidence linked.'

    if (evidenceIds.length > 0) {
      const { data: evidence } = await supabase
        .from('evidence_bank')
        .select('title, content, source_system, computed_strength, segment')
        .in('id', evidenceIds)

      if (evidence && evidence.length > 0) {
        evidenceSummary = evidence.map(e =>
          `- ${e.title} (${e.source_system}, strength: ${Math.round(e.computed_strength || 0)}%${e.segment ? `, segment: ${e.segment}` : ''})`
        ).join('\n')
      }
    }

    // Fetch constraints
    const { data: constraints } = await supabase
      .from('constraints')
      .select('label, type, value')
      .eq('user_id', user.id)

    const constraintsSummary = constraints && constraints.length > 0
      ? constraints.map(c => `- ${c.label}: ${c.value || c.type}`).join('\n')
      : 'No constraints defined.'

    const prompt = `You are a product management assistant. Based on this decision, suggest outcome tracking metrics and success criteria.

Decision: ${decision.title}
Hypothesis: ${decision.hypothesis || 'None'}
Description: ${decision.description || 'None'}
Status: ${decision.status}
Evidence Strength: ${decision.evidence_strength}%

Linked Evidence:
${evidenceSummary}

Constraints:
${constraintsSummary}

Respond in JSON format only:
{
  "target_metrics": [
    { "name": "metric name", "target": "target value" }
  ],
  "success_criteria": "A brief description of what success looks like for this decision",
  "review_date": "YYYY-MM-DD (suggest a date 2-4 weeks from today for review)",
  "suggested_outcome_type": "pending"
}

Keep metrics specific and measurable. Suggest 2-4 metrics.`

    if (!process.env.ANTHROPIC_API_KEY) {
      // Fallback if no API key - return a basic draft
      const reviewDate = new Date()
      reviewDate.setDate(reviewDate.getDate() + 21)
      return NextResponse.json({
        draft: {
          target_metrics: [
            { name: 'Primary metric', target: 'TBD' },
            { name: 'User satisfaction', target: 'TBD' },
          ],
          success_criteria: `Validate that "${decision.title}" achieves its intended impact within the review period.`,
          review_date: reviewDate.toISOString().split('T')[0],
          suggested_outcome_type: 'pending',
        },
      })
    }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
    }

    const draft = JSON.parse(jsonMatch[0])

    return NextResponse.json({ draft })
  } catch (error) {
    console.error('Generate outcome error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
