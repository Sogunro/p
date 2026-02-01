import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET: List outcomes for workspace
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
    const decisionId = searchParams.get('decision_id')
    const outcomeType = searchParams.get('outcome_type')

    let query = supabase
      .from('outcomes')
      .select('*, decisions(id, title, status, evidence_strength)')
      .eq('workspace_id', membership.workspace_id)
      .order('created_at', { ascending: false })

    if (decisionId) {
      query = query.eq('decision_id', decisionId)
    }
    if (outcomeType) {
      query = query.eq('outcome_type', outcomeType)
    }

    const { data: outcomes, error } = await query

    if (error) {
      console.error('Fetch outcomes error:', error)
      return NextResponse.json({ error: 'Failed to fetch outcomes' }, { status: 500 })
    }

    return NextResponse.json({ outcomes: outcomes || [] })
  } catch (error) {
    console.error('Outcomes GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: Create a new outcome
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
    const { decision_id, outcome_type, title, target_metrics, actual_metrics, learnings, source_retrospective, review_date } = body

    if (!decision_id) {
      return NextResponse.json({ error: 'decision_id is required' }, { status: 400 })
    }

    // Verify the decision belongs to this workspace
    const { data: decision } = await supabase
      .from('decisions')
      .select('id')
      .eq('id', decision_id)
      .eq('workspace_id', membership.workspace_id)
      .single()

    if (!decision) {
      return NextResponse.json({ error: 'Decision not found in workspace' }, { status: 404 })
    }

    const { data: outcome, error } = await supabase
      .from('outcomes')
      .insert({
        workspace_id: membership.workspace_id,
        decision_id,
        outcome_type: outcome_type || 'pending',
        title: title || '',
        target_metrics: target_metrics || [],
        actual_metrics: actual_metrics || [],
        learnings: learnings || null,
        source_retrospective: source_retrospective || null,
        review_date: review_date || null,
        created_by: user.id,
      })
      .select('*, decisions(id, title, status, evidence_strength)')
      .single()

    if (error) {
      console.error('Create outcome error:', error)
      return NextResponse.json({ error: 'Failed to create outcome' }, { status: 500 })
    }

    return NextResponse.json({ outcome })
  } catch (error) {
    console.error('Outcomes POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
