import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStrengthBand } from '@/lib/evidence-strength'
import type { DecisionStatus } from '@/types/database'

interface RouteContext {
  params: Promise<{ id: string }>
}

// GET /api/decisions/[id] — get single decision with linked evidence
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: decision, error } = await supabase
      .from('decisions')
      .select(`
        *,
        evidence_decision_links(
          id,
          evidence_id,
          segment_match_factor,
          relevance_note,
          linked_by,
          linked_at
        )
      `)
      .eq('id', id)
      .single()

    if (error || !decision) {
      return NextResponse.json({ error: 'Decision not found' }, { status: 404 })
    }

    // Fetch full evidence details for linked evidence
    const evidenceIds = (decision.evidence_decision_links as { evidence_id: string }[])
      .map((link: { evidence_id: string }) => link.evidence_id)

    let linkedEvidence: Record<string, unknown>[] = []
    if (evidenceIds.length > 0) {
      const { data: evidenceData } = await supabase
        .from('evidence_bank')
        .select('*')
        .in('id', evidenceIds)

      linkedEvidence = evidenceData || []
    }

    // Fetch session info if linked
    let session = null
    if (decision.session_id) {
      const { data: sessionData } = await supabase
        .from('sessions')
        .select('id, name, created_at')
        .eq('id', decision.session_id)
        .single()
      session = sessionData
    }

    return NextResponse.json({
      decision,
      linked_evidence: linkedEvidence,
      session,
    })
  } catch (error) {
    console.error('Decision GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/decisions/[id] — update a decision
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch current decision
    const { data: current, error: fetchError } = await supabase
      .from('decisions')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !current) {
      return NextResponse.json({ error: 'Decision not found' }, { status: 404 })
    }

    const body = await request.json()
    const updates: Record<string, unknown> = {}

    // Core fields
    if (body.title !== undefined) updates.title = body.title
    if (body.hypothesis !== undefined) updates.hypothesis = body.hypothesis
    if (body.description !== undefined) updates.description = body.description
    if (body.session_id !== undefined) updates.session_id = body.session_id
    if (body.success_metrics !== undefined) updates.success_metrics = body.success_metrics
    if (body.external_ref !== undefined) updates.external_ref = body.external_ref
    if (body.external_url !== undefined) updates.external_url = body.external_url

    // Status change — check if overriding gate recommendation
    if (body.status !== undefined) {
      const newStatus = body.status as DecisionStatus
      updates.status = newStatus

      // Check if this is an override (user sets status different from gate_recommendation)
      if (current.gate_recommendation && newStatus !== current.gate_recommendation) {
        if (!body.override_reason) {
          return NextResponse.json(
            { error: 'override_reason is required when overriding gate recommendation' },
            { status: 400 }
          )
        }
        updates.is_overridden = true
        updates.override_reason = body.override_reason
        updates.overridden_at = new Date().toISOString()
        updates.overridden_by = user.id
      } else if (newStatus === current.gate_recommendation) {
        // User aligned with gate — clear override if previously overridden
        updates.is_overridden = false
        updates.override_reason = null
        updates.overridden_at = null
        updates.overridden_by = null
      }
    }

    // Direct override fields (for manual override)
    if (body.is_overridden !== undefined) {
      updates.is_overridden = body.is_overridden
      if (body.is_overridden && body.override_reason) {
        updates.override_reason = body.override_reason
        updates.overridden_at = new Date().toISOString()
        updates.overridden_by = user.id
      }
    }

    updates.updated_at = new Date().toISOString()

    if (Object.keys(updates).length === 1) {
      // Only updated_at — no real changes
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('decisions')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating decision:', error)
      return NextResponse.json({ error: 'Failed to update decision' }, { status: 500 })
    }

    return NextResponse.json({ decision: data })
  } catch (error) {
    console.error('Decision PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/decisions/[id] — delete a decision
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase
      .from('decisions')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting decision:', error)
      return NextResponse.json({ error: 'Failed to delete decision' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Decision DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
