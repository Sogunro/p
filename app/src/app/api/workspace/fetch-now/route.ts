import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SourceSystem } from '@/types/database'

// POST /api/workspace/fetch-now
// Triggers n8n to fetch evidence from specified sources
// Body: { sources?: SourceSystem[], sessionId?: string }
export async function POST(request: NextRequest) {
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
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    // Get workspace settings to check which integrations are enabled
    const { data: settings } = await supabase
      .from('workspace_settings')
      .select('*')
      .eq('workspace_id', membership.workspace_id)
      .single()

    if (!settings) {
      return NextResponse.json({ error: 'Workspace settings not found' }, { status: 404 })
    }

    // Parse request body
    const body = await request.json().catch(() => ({}))
    const requestedSources = body.sources as SourceSystem[] | undefined
    const sessionId = body.sessionId as string | undefined

    // Determine which sources to fetch
    const enabledSources: SourceSystem[] = []
    if (settings.slack_enabled) enabledSources.push('slack')
    if (settings.notion_enabled) enabledSources.push('notion')
    if (settings.mixpanel_enabled) enabledSources.push('mixpanel')
    if (settings.airtable_enabled) enabledSources.push('airtable')

    // If specific sources requested, filter to only enabled ones
    const sourcesToFetch = requestedSources
      ? requestedSources.filter(s => enabledSources.includes(s))
      : enabledSources

    if (sourcesToFetch.length === 0) {
      return NextResponse.json({
        error: 'No enabled sources to fetch',
        message: 'Enable at least one integration in Settings > Integrations',
        enabledSources: [],
      }, { status: 400 })
    }

    // Check if N8N_TRIGGER_URL is configured
    const n8nTriggerUrl = process.env.N8N_TRIGGER_URL

    if (!n8nTriggerUrl) {
      // If no n8n URL configured, return info for manual setup
      return NextResponse.json({
        success: false,
        message: 'n8n trigger URL not configured',
        manualSetup: true,
        payload: {
          workspace_id: membership.workspace_id,
          sources: sourcesToFetch,
          session_id: sessionId,
          fetch_type: 'on_demand',
          timestamp: new Date().toISOString(),
        },
        webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://your-app.vercel.app'}/api/webhook/insights`,
        webhookSecret: 'Configure N8N_WEBHOOK_SECRET in environment variables',
      })
    }

    // Trigger n8n workflow
    const n8nResponse = await fetch(n8nTriggerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': process.env.N8N_WEBHOOK_SECRET || '',
      },
      body: JSON.stringify({
        workspace_id: membership.workspace_id,
        sources: sourcesToFetch,
        session_id: sessionId,
        fetch_type: 'on_demand',
        timestamp: new Date().toISOString(),
        callback_url: `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/webhook/insights`,
      }),
    })

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text()
      console.error('n8n trigger failed:', errorText)
      return NextResponse.json({
        error: 'Failed to trigger evidence fetch',
        details: errorText,
      }, { status: 502 })
    }

    // Update last_fetch_at in workspace_settings
    await supabase
      .from('workspace_settings')
      .update({ last_fetch_at: new Date().toISOString() })
      .eq('workspace_id', membership.workspace_id)

    return NextResponse.json({
      success: true,
      message: `Evidence fetch triggered for: ${sourcesToFetch.join(', ')}`,
      sources: sourcesToFetch,
      workspaceId: membership.workspace_id,
      sessionId: sessionId || null,
    })
  } catch (error) {
    console.error('Fetch now error:', error)
    return NextResponse.json(
      { error: 'Failed to trigger fetch', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// GET /api/workspace/fetch-now
// Returns the current fetch status and enabled sources
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
      .select('workspace_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    // Get workspace settings
    const { data: settings } = await supabase
      .from('workspace_settings')
      .select('*')
      .eq('workspace_id', membership.workspace_id)
      .single()

    if (!settings) {
      return NextResponse.json({ error: 'Workspace settings not found' }, { status: 404 })
    }

    // Determine enabled sources
    const enabledSources: SourceSystem[] = []
    if (settings.slack_enabled) enabledSources.push('slack')
    if (settings.notion_enabled) enabledSources.push('notion')
    if (settings.mixpanel_enabled) enabledSources.push('mixpanel')
    if (settings.airtable_enabled) enabledSources.push('airtable')

    return NextResponse.json({
      workspaceId: membership.workspace_id,
      enabledSources,
      lastFetchAt: settings.last_fetch_at,
      feedEnabled: settings.feed_enabled,
      scheduleTime: settings.feed_schedule_time,
      timezone: settings.feed_timezone,
      n8nConfigured: !!process.env.N8N_TRIGGER_URL,
    })
  } catch (error) {
    console.error('Fetch status error:', error)
    return NextResponse.json(
      { error: 'Failed to get fetch status' },
      { status: 500 }
    )
  }
}
