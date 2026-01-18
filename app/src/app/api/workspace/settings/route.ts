import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET: Get workspace settings
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

    // Get workspace settings
    const { data: settings, error } = await supabase
      .from('workspace_settings')
      .select('*')
      .eq('workspace_id', membership.workspace_id)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching settings:', error)
      return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
    }

    // Get workspace info
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('id, name')
      .eq('id', membership.workspace_id)
      .single()

    return NextResponse.json({
      settings: settings || {
        feed_schedule_time: '09:00',
        feed_timezone: 'UTC',
        feed_enabled: true,
        slack_enabled: false,
        notion_enabled: false,
        mixpanel_enabled: false,
        airtable_enabled: false,
      },
      workspace,
      role: membership.role,
    })
  } catch (error) {
    console.error('Settings error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT: Update workspace settings
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
      return NextResponse.json({ error: 'Only owners and admins can update settings' }, { status: 403 })
    }

    const body = await request.json()
    const {
      feed_schedule_time,
      feed_timezone,
      feed_enabled,
      slack_enabled,
      notion_enabled,
      mixpanel_enabled,
      airtable_enabled,
    } = body

    // Upsert settings
    const { data: settings, error } = await supabase
      .from('workspace_settings')
      .upsert({
        workspace_id: membership.workspace_id,
        feed_schedule_time: feed_schedule_time || '09:00',
        feed_timezone: feed_timezone || 'UTC',
        feed_enabled: feed_enabled ?? true,
        slack_enabled: slack_enabled ?? false,
        notion_enabled: notion_enabled ?? false,
        mixpanel_enabled: mixpanel_enabled ?? false,
        airtable_enabled: airtable_enabled ?? false,
      }, {
        onConflict: 'workspace_id'
      })
      .select()
      .single()

    if (error) {
      console.error('Error updating settings:', error)
      return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
    }

    return NextResponse.json({ settings })
  } catch (error) {
    console.error('Settings update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
