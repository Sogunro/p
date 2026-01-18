import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { InsightsFeed, SourceSystem } from '@/types/database'

interface GroupedBySource {
  [key: string]: {
    items: InsightsFeed[]
    count: number
  }
}

interface GroupedByDate {
  [key: string]: {
    items: InsightsFeed[]
    count: number
    sources: string[]
  }
}

// GET: List insights feed for user's workspace
// Query params:
//   - all=true: Show all insights (including added/dismissed)
//   - groupBy=source: Group insights by source system
//   - groupBy=date: Group insights by fetched date
//   - groupBy=source,date: Group by both
//   - source=slack|notion|mixpanel|airtable: Filter by source
//   - startDate=YYYY-MM-DD: Filter by start date
//   - endDate=YYYY-MM-DD: Filter by end date
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const showAll = searchParams.get('all') === 'true'
    const groupBy = searchParams.get('groupBy')?.split(',') || []
    const sourceFilter = searchParams.get('source') as SourceSystem | null
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Get user's workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .maybeSingle()

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

    // Apply source filter
    if (sourceFilter) {
      query = query.eq('source_system', sourceFilter)
    }

    // Apply date range filters
    if (startDate) {
      query = query.gte('fetched_at', `${startDate}T00:00:00.000Z`)
    }
    if (endDate) {
      query = query.lte('fetched_at', `${endDate}T23:59:59.999Z`)
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

    // Build response with groupings if requested
    const response: {
      insights: InsightsFeed[]
      workspaceId: string
      lastFetchAt: string | null
      pendingCount: number
      groupedBySource?: GroupedBySource
      groupedByDate?: GroupedByDate
    } = {
      insights: insights || [],
      workspaceId: membership.workspace_id,
      lastFetchAt: settings?.last_fetch_at || null,
      pendingCount: insights?.filter(i => !i.is_added_to_bank && !i.is_dismissed).length || 0
    }

    // Group by source if requested
    if (groupBy.includes('source') && insights) {
      const groupedBySource: GroupedBySource = {
        slack: { items: [], count: 0 },
        notion: { items: [], count: 0 },
        mixpanel: { items: [], count: 0 },
        airtable: { items: [], count: 0 },
      }

      insights.forEach((insight) => {
        const source = insight.source_system as keyof typeof groupedBySource
        if (groupedBySource[source]) {
          groupedBySource[source].items.push(insight)
          groupedBySource[source].count++
        }
      })

      response.groupedBySource = groupedBySource
    }

    // Group by date if requested
    if (groupBy.includes('date') && insights) {
      const groupedByDate: GroupedByDate = {}

      insights.forEach((insight) => {
        const date = insight.fetched_at.split('T')[0]
        if (!groupedByDate[date]) {
          groupedByDate[date] = { items: [], count: 0, sources: [] }
        }
        groupedByDate[date].items.push(insight)
        groupedByDate[date].count++
        if (!groupedByDate[date].sources.includes(insight.source_system)) {
          groupedByDate[date].sources.push(insight.source_system)
        }
      })

      response.groupedByDate = groupedByDate
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Insights feed error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
