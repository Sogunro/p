import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/decisions — list decisions for workspace
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

    // Optional filters
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const sessionId = searchParams.get('session_id')
    const search = searchParams.get('search')

    let query = supabase
      .from('decisions')
      .select('*, evidence_decision_links(id, evidence_id)')
      .eq('workspace_id', membership.workspace_id)
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    if (sessionId) {
      query = query.eq('session_id', sessionId)
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,hypothesis.ilike.%${search}%,description.ilike.%${search}%`)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching decisions:', error)
      return NextResponse.json({ error: 'Failed to fetch decisions' }, { status: 500 })
    }

    return NextResponse.json({ decisions: data, workspace_id: membership.workspace_id })
  } catch (error) {
    console.error('Decisions GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/decisions — create a decision
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
    const { title, hypothesis, description, session_id, status, success_metrics, external_ref, external_url } = body

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('decisions')
      .insert({
        workspace_id: membership.workspace_id,
        title,
        hypothesis: hypothesis || null,
        description: description || null,
        session_id: session_id || null,
        status: status || 'validate',
        success_metrics: success_metrics || [],
        external_ref: external_ref || null,
        external_url: external_url || null,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating decision:', error)
      return NextResponse.json({ error: 'Failed to create decision' }, { status: 500 })
    }

    return NextResponse.json({ decision: data })
  } catch (error) {
    console.error('Decisions POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
