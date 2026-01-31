import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { computeAggregateStrength, getStrengthBand } from '@/lib/evidence-strength'
import type { DecisionStatus } from '@/types/database'

interface RouteContext {
  params: Promise<{ id: string }>
}

// POST /api/decisions/[id]/evidence — link evidence to a decision
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: decisionId } = await context.params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { evidence_id, segment_match_factor, relevance_note } = body

    if (!evidence_id) {
      return NextResponse.json({ error: 'evidence_id is required' }, { status: 400 })
    }

    // Create the link
    const { data: link, error: linkError } = await supabase
      .from('evidence_decision_links')
      .insert({
        decision_id: decisionId,
        evidence_id,
        segment_match_factor: segment_match_factor || 1.0,
        relevance_note: relevance_note || null,
        linked_by: user.id,
      })
      .select()
      .single()

    if (linkError) {
      if (linkError.code === '23505') {
        return NextResponse.json({ error: 'Evidence already linked to this decision' }, { status: 409 })
      }
      console.error('Error linking evidence:', linkError)
      return NextResponse.json({ error: 'Failed to link evidence' }, { status: 500 })
    }

    // Recalculate aggregate evidence strength for this decision
    const updatedDecision = await recalculateDecisionStrength(supabase, decisionId)

    return NextResponse.json({ link, decision: updatedDecision })
  } catch (error) {
    console.error('Decision evidence POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/decisions/[id]/evidence — unlink evidence from a decision
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id: decisionId } = await context.params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const evidenceId = searchParams.get('evidence_id')

    if (!evidenceId) {
      return NextResponse.json({ error: 'evidence_id query param is required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('evidence_decision_links')
      .delete()
      .eq('decision_id', decisionId)
      .eq('evidence_id', evidenceId)

    if (error) {
      console.error('Error unlinking evidence:', error)
      return NextResponse.json({ error: 'Failed to unlink evidence' }, { status: 500 })
    }

    // Recalculate aggregate evidence strength
    const updatedDecision = await recalculateDecisionStrength(supabase, decisionId)

    return NextResponse.json({ success: true, decision: updatedDecision })
  } catch (error) {
    console.error('Decision evidence DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Recalculate and update a decision's aggregate evidence strength and gate recommendation.
 * Called after linking/unlinking evidence.
 */
async function recalculateDecisionStrength(
  supabase: Awaited<ReturnType<typeof createClient>>,
  decisionId: string
) {
  // Fetch all linked evidence IDs
  const { data: links } = await supabase
    .from('evidence_decision_links')
    .select('evidence_id, segment_match_factor')
    .eq('decision_id', decisionId)

  if (!links || links.length === 0) {
    // No evidence — reset strength
    const { data } = await supabase
      .from('decisions')
      .update({
        evidence_strength: 0,
        evidence_count: 0,
        gate_recommendation: 'park',
        updated_at: new Date().toISOString(),
      })
      .eq('id', decisionId)
      .select()
      .single()

    return data
  }

  const evidenceIds = links.map(l => l.evidence_id)

  // Fetch the actual evidence records
  const { data: evidenceItems } = await supabase
    .from('evidence_bank')
    .select('id, source_system, created_at, segment, source_timestamp, computed_strength')
    .in('id', evidenceIds)

  if (!evidenceItems || evidenceItems.length === 0) {
    const { data } = await supabase
      .from('decisions')
      .update({
        evidence_strength: 0,
        evidence_count: 0,
        gate_recommendation: 'park',
        updated_at: new Date().toISOString(),
      })
      .eq('id', decisionId)
      .select()
      .single()

    return data
  }

  // Use pre-computed strength if available, otherwise compute aggregate
  const strengthValues = evidenceItems.map(e => {
    const link = links.find(l => l.evidence_id === e.id)
    const segmentFactor = link?.segment_match_factor || 1.0
    // Use individual computed_strength, adjusted by segment_match_factor
    return (e.computed_strength || 0) * segmentFactor
  })

  const avgStrength = Math.round(
    strengthValues.reduce((sum, s) => sum + s, 0) / strengthValues.length
  )

  // Determine gate recommendation based on strength thresholds
  let gateRecommendation: DecisionStatus
  if (avgStrength >= 70) {
    gateRecommendation = 'commit'
  } else if (avgStrength >= 40) {
    gateRecommendation = 'validate'
  } else {
    gateRecommendation = 'park'
  }

  const { data } = await supabase
    .from('decisions')
    .update({
      evidence_strength: avgStrength,
      evidence_count: evidenceItems.length,
      gate_recommendation: gateRecommendation,
      updated_at: new Date().toISOString(),
    })
    .eq('id', decisionId)
    .select()
    .single()

  return data
}
