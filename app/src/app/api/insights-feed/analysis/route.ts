import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/insights-feed/analysis?date=YYYY-MM-DD
// GET /api/insights-feed/analysis?history=true&limit=7
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify user is authenticated
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    const workspaceId = membership.workspace_id
    const searchParams = request.nextUrl.searchParams
    const date = searchParams.get('date')
    const history = searchParams.get('history')
    const limit = parseInt(searchParams.get('limit') || '7', 10)

    if (history === 'true') {
      // Get recent analyses for trend viewing
      const { data: analyses, error } = await supabase
        .from('daily_insights_analysis')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('analysis_date', { ascending: false })
        .limit(limit)

      if (error) {
        return NextResponse.json({ error: 'Failed to fetch analyses' }, { status: 500 })
      }

      return NextResponse.json({ analyses })
    }

    if (date) {
      // Get analysis for a specific date
      const { data: analysis, error } = await supabase
        .from('daily_insights_analysis')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('analysis_date', date)
        .maybeSingle()

      if (error) {
        return NextResponse.json({ error: 'Failed to fetch analysis' }, { status: 500 })
      }

      if (!analysis) {
        return NextResponse.json({ error: 'No analysis found for this date' }, { status: 404 })
      }

      return NextResponse.json({ analysis })
    }

    // Default: get today's analysis
    const today = new Date().toISOString().split('T')[0]
    const { data: analysis, error } = await supabase
      .from('daily_insights_analysis')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('analysis_date', today)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch analysis' }, { status: 500 })
    }

    return NextResponse.json({ analysis })
  } catch (error) {
    console.error('Analysis fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analysis', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
