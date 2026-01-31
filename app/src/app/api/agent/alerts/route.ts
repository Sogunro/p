import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
    const agentType = searchParams.get('agent_type')
    const isRead = searchParams.get('is_read')
    const decisionId = searchParams.get('decision_id')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabase
      .from('agent_alerts')
      .select('*')
      .eq('workspace_id', membership.workspace_id)
      .eq('is_dismissed', false)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (agentType) {
      query = query.eq('agent_type', agentType)
    }
    if (isRead !== null && isRead !== undefined) {
      query = query.eq('is_read', isRead === 'true')
    }
    if (decisionId) {
      query = query.eq('related_decision_id', decisionId)
    }

    const { data: alerts, error } = await query

    if (error) {
      console.error('Alerts fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 })
    }

    return NextResponse.json({ alerts: alerts || [], count: alerts?.length || 0 })
  } catch (error) {
    console.error('Alerts error:', error)
    return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { alert_id, is_read, is_dismissed } = body

    if (!alert_id) {
      return NextResponse.json({ error: 'alert_id is required' }, { status: 400 })
    }

    const update: Record<string, boolean> = {}
    if (is_read !== undefined) update.is_read = is_read
    if (is_dismissed !== undefined) update.is_dismissed = is_dismissed

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No update fields provided' }, { status: 400 })
    }

    const { error } = await supabase
      .from('agent_alerts')
      .update(update)
      .eq('id', alert_id)

    if (error) {
      console.error('Alert update error:', error)
      return NextResponse.json({ error: 'Failed to update alert' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Alert update error:', error)
    return NextResponse.json({ error: 'Failed to update alert' }, { status: 500 })
  }
}
