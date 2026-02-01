import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET: Fetch a single outcome
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    const { data: outcome, error } = await supabase
      .from('outcomes')
      .select('*, decisions(id, title, status, evidence_strength)')
      .eq('id', id)
      .eq('workspace_id', membership.workspace_id)
      .single()

    if (error || !outcome) {
      return NextResponse.json({ error: 'Outcome not found' }, { status: 404 })
    }

    return NextResponse.json({ outcome })
  } catch (error) {
    console.error('Outcome GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH: Update an outcome
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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
    const updates: Record<string, unknown> = {}

    if (body.outcome_type !== undefined) updates.outcome_type = body.outcome_type
    if (body.title !== undefined) updates.title = body.title
    if (body.target_metrics !== undefined) updates.target_metrics = body.target_metrics
    if (body.actual_metrics !== undefined) updates.actual_metrics = body.actual_metrics
    if (body.learnings !== undefined) updates.learnings = body.learnings
    if (body.source_retrospective !== undefined) updates.source_retrospective = body.source_retrospective
    if (body.review_date !== undefined) updates.review_date = body.review_date

    const { data: outcome, error } = await supabase
      .from('outcomes')
      .update(updates)
      .eq('id', id)
      .eq('workspace_id', membership.workspace_id)
      .select('*, decisions(id, title, status, evidence_strength)')
      .single()

    if (error || !outcome) {
      console.error('Update outcome error:', error)
      return NextResponse.json({ error: 'Failed to update outcome' }, { status: 500 })
    }

    return NextResponse.json({ outcome })
  } catch (error) {
    console.error('Outcome PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE: Remove an outcome
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    const { error } = await supabase
      .from('outcomes')
      .delete()
      .eq('id', id)
      .eq('workspace_id', membership.workspace_id)

    if (error) {
      console.error('Delete outcome error:', error)
      return NextResponse.json({ error: 'Failed to delete outcome' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Outcome DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
