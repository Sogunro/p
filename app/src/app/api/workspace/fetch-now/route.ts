import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SourceSystem, AirtableSourceConfig } from '@/types/database'

// POST /api/workspace/fetch-now
// Triggers n8n to fetch evidence from specified sources
// Body: { sources?: SourceSystem[], sessionId?: string, lookback_hours?: number }
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

    // Get workspace evidence sources configuration
    const { data: evidenceSources } = await supabase
      .from('workspace_evidence_sources')
      .select('*')
      .eq('workspace_id', membership.workspace_id)
      .single()

    // Parse request body
    const body = await request.json().catch(() => ({}))
    const requestedSources = body.sources as SourceSystem[] | undefined
    const sessionId = body.sessionId as string | undefined
    const lookbackHours = body.lookback_hours as number | undefined

    // Use evidence sources config if available, otherwise fall back to workspace settings
    let enabledSources: SourceSystem[] = []
    let sourceConfig = {
      slack: { enabled: false, channel_ids: [] as string[] },
      notion: { enabled: false, database_ids: [] as string[] },
      airtable: { enabled: false, sources: [] as AirtableSourceConfig[] },
      mixpanel: { enabled: false },
    }

    if (evidenceSources) {
      // Use new evidence sources configuration
      if (evidenceSources.slack_enabled) {
        enabledSources.push('slack')
        sourceConfig.slack = {
          enabled: true,
          channel_ids: evidenceSources.slack_channel_ids || [],
        }
      }
      if (evidenceSources.notion_enabled) {
        enabledSources.push('notion')
        sourceConfig.notion = {
          enabled: true,
          database_ids: evidenceSources.notion_database_ids || [],
        }
      }
      if (evidenceSources.airtable_enabled) {
        enabledSources.push('airtable')
        sourceConfig.airtable = {
          enabled: true,
          sources: (evidenceSources.airtable_sources as AirtableSourceConfig[]) || [],
        }
      }
      if (evidenceSources.mixpanel_enabled) {
        enabledSources.push('mixpanel')
        sourceConfig.mixpanel = { enabled: true }
      }
    } else {
      // Fall back to old workspace_settings for backwards compatibility
      const { data: settings } = await supabase
        .from('workspace_settings')
        .select('*')
        .eq('workspace_id', membership.workspace_id)
        .single()

      if (settings) {
        if (settings.slack_enabled) enabledSources.push('slack')
        if (settings.notion_enabled) enabledSources.push('notion')
        if (settings.mixpanel_enabled) enabledSources.push('mixpanel')
        if (settings.airtable_enabled) enabledSources.push('airtable')
      }
    }

    // If specific sources requested, filter to only enabled ones
    const sourcesToFetch = requestedSources
      ? requestedSources.filter(s => enabledSources.includes(s))
      : enabledSources

    if (sourcesToFetch.length === 0) {
      return NextResponse.json({
        error: 'No enabled sources to fetch',
        message: 'Enable at least one integration in Settings > Evidence Sources',
        enabledSources: [],
      }, { status: 400 })
    }

    // Build the sources payload for n8n
    const sourcesPayload = {
      slack: sourcesToFetch.includes('slack') ? sourceConfig.slack : { enabled: false },
      notion: sourcesToFetch.includes('notion') ? sourceConfig.notion : { enabled: false },
      airtable: sourcesToFetch.includes('airtable') ? sourceConfig.airtable : { enabled: false },
      mixpanel: sourcesToFetch.includes('mixpanel') ? sourceConfig.mixpanel : { enabled: false },
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
          lookback_hours: lookbackHours || evidenceSources?.lookback_hours || 24,
          callback_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://your-app.vercel.app'}/api/webhook/insights`,
          sources: sourcesPayload,
        },
        webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://your-app.vercel.app'}/api/webhook/insights`,
        webhookSecret: 'Configure N8N_WEBHOOK_SECRET in environment variables',
      })
    }

    // Trigger n8n workflow with full source configuration
    const n8nResponse = await fetch(n8nTriggerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': process.env.N8N_WEBHOOK_SECRET || '',
      },
      body: JSON.stringify({
        workspace_id: membership.workspace_id,
        lookback_hours: lookbackHours || evidenceSources?.lookback_hours || 24,
        callback_url: `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/webhook/insights`,
        sources: sourcesPayload,
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

    // Get evidence sources config
    const { data: evidenceSources } = await supabase
      .from('workspace_evidence_sources')
      .select('*')
      .eq('workspace_id', membership.workspace_id)
      .single()

    // Get workspace settings for last_fetch_at
    const { data: settings } = await supabase
      .from('workspace_settings')
      .select('last_fetch_at')
      .eq('workspace_id', membership.workspace_id)
      .single()

    // Determine enabled sources from evidence sources config
    const enabledSources: SourceSystem[] = []
    if (evidenceSources) {
      if (evidenceSources.slack_enabled) enabledSources.push('slack')
      if (evidenceSources.notion_enabled) enabledSources.push('notion')
      if (evidenceSources.mixpanel_enabled) enabledSources.push('mixpanel')
      if (evidenceSources.airtable_enabled) enabledSources.push('airtable')
    }

    return NextResponse.json({
      workspaceId: membership.workspace_id,
      enabledSources,
      lastFetchAt: settings?.last_fetch_at || null,
      autoFetchEnabled: evidenceSources?.auto_fetch_enabled || false,
      autoFetchTime: evidenceSources?.auto_fetch_time || '18:00',
      lookbackHours: evidenceSources?.lookback_hours || 24,
      n8nConfigured: !!process.env.N8N_TRIGGER_URL,
      sourceDetails: evidenceSources ? {
        slack: {
          enabled: evidenceSources.slack_enabled,
          channelCount: (evidenceSources.slack_channel_ids || []).length,
        },
        notion: {
          enabled: evidenceSources.notion_enabled,
          databaseCount: (evidenceSources.notion_database_ids || []).length,
        },
        airtable: {
          enabled: evidenceSources.airtable_enabled,
          sourceCount: ((evidenceSources.airtable_sources as AirtableSourceConfig[]) || []).length,
        },
        mixpanel: {
          enabled: evidenceSources.mixpanel_enabled,
        },
      } : null,
    })
  } catch (error) {
    console.error('Fetch status error:', error)
    return NextResponse.json(
      { error: 'Failed to get fetch status' },
      { status: 500 }
    )
  }
}
