import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET: List insights feed for user's workspace
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const showAll = searchParams.get('all') === 'true'

    // Get user's workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    // Build query
    let query = supabase
      .from('insights_feed')
      .select('*')
      .eq('workspace_id', membership.workspace_id)
      .order('fetched_at', { ascending: false })

    // By default, only show pending items (not added to bank, not dismissed)
    if (!showAll) {
      query = query.eq('is_added_to_bank', false).eq('is_dismissed', false)
    }

    const { data: insights, error } = await query

    if (error) {
      console.error('Error fetching insights:', error)
      return NextResponse.json({ error: 'Failed to fetch insights' }, { status: 500 })
    }

    // Get workspace settings for last fetch time
    const { data: settings } = await supabase
      .from('workspace_settings')
      .select('last_fetch_at, feed_schedule_time')
      .eq('workspace_id', membership.workspace_id)
      .single()

    return NextResponse.json({
      insights,
      workspaceId: membership.workspace_id,
      lastFetchAt: settings?.last_fetch_at,
      pendingCount: insights?.filter(i => !i.is_added_to_bank && !i.is_dismissed).length || 0
    })
  } catch (error) {
    console.error('Insights feed error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
