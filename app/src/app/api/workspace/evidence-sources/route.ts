import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET: Get workspace evidence sources configuration
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    // Get evidence sources config
    const { data: config, error } = await supabase
      .from('workspace_evidence_sources')
      .select('*')
      .eq('workspace_id', membership.workspace_id)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching evidence sources:', error)
      return NextResponse.json({ error: 'Failed to fetch evidence sources' }, { status: 500 })
    }

    // Return default config if none exists
    return NextResponse.json({
      config: config || {
        workspace_id: membership.workspace_id,
        slack_enabled: false,
        slack_channel_ids: [],
        notion_enabled: false,
        notion_database_ids: [],
        airtable_enabled: false,
        airtable_sources: [],
        mixpanel_enabled: false,
        auto_fetch_enabled: false,
        auto_fetch_time: '18:00',
        lookback_hours: 24,
      },
      role: membership.role,
    })
  } catch (error) {
    console.error('Evidence sources error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT: Update workspace evidence sources configuration
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's workspace and check role
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    if (membership.role !== 'owner' && membership.role !== 'admin') {
      return NextResponse.json({ error: 'Only owners and admins can update evidence sources' }, { status: 403 })
    }

    const body = await request.json()
    const {
      slack_enabled,
      slack_channel_ids,
      notion_enabled,
      notion_database_ids,
      airtable_enabled,
      airtable_sources,
      mixpanel_enabled,
      auto_fetch_enabled,
      auto_fetch_time,
      lookback_hours,
    } = body

    // Validate airtable_sources format if provided
    if (airtable_sources && Array.isArray(airtable_sources)) {
      for (const source of airtable_sources) {
        if (!source.base_id || !source.table_id) {
          return NextResponse.json({
            error: 'Airtable sources must have base_id and table_id'
          }, { status: 400 })
        }
      }
    }

    // Upsert config
    const { data: config, error } = await supabase
      .from('workspace_evidence_sources')
      .upsert({
        workspace_id: membership.workspace_id,
        slack_enabled: slack_enabled ?? false,
        slack_channel_ids: slack_channel_ids || [],
        notion_enabled: notion_enabled ?? false,
        notion_database_ids: notion_database_ids || [],
        airtable_enabled: airtable_enabled ?? false,
        airtable_sources: airtable_sources || [],
        mixpanel_enabled: mixpanel_enabled ?? false,
        auto_fetch_enabled: auto_fetch_enabled ?? false,
        auto_fetch_time: auto_fetch_time || '18:00',
        lookback_hours: lookback_hours || 24,
      }, {
        onConflict: 'workspace_id'
      })
      .select()
      .single()

    if (error) {
      console.error('Error updating evidence sources:', error)
      return NextResponse.json({ error: 'Failed to update evidence sources' }, { status: 500 })
    }

    return NextResponse.json({ config })
  } catch (error) {
    console.error('Evidence sources update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
