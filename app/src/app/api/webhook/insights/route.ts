import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// This endpoint receives insights from n8n workflows
// Uses service role key for direct database access (no RLS)
export async function POST(request: NextRequest) {
  try {
    // Verify webhook secret
    const webhookSecret = request.headers.get('x-webhook-secret')
    if (webhookSecret !== process.env.N8N_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Invalid webhook secret' }, { status: 401 })
    }

    const body = await request.json()
    const { workspace_id, source_system, items } = body

    if (!workspace_id || !source_system || !items || !Array.isArray(items)) {
      return NextResponse.json({
        error: 'workspace_id, source_system, and items array are required'
      }, { status: 400 })
    }

    // Validate source_system
    const validSources = ['slack', 'notion', 'mixpanel', 'airtable']
    if (!validSources.includes(source_system)) {
      return NextResponse.json({
        error: `Invalid source_system. Must be one of: ${validSources.join(', ')}`
      }, { status: 400 })
    }

    // Use service role for webhook inserts (bypasses RLS)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Verify workspace exists
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id')
      .eq('id', workspace_id)
      .single()

    if (workspaceError || !workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    // Insert insights
    const insightsToInsert = items.map((item: {
      title: string
      content?: string
      url?: string
      strength?: string
      source_metadata?: Record<string, unknown>
    }) => ({
      workspace_id,
      source_system,
      title: item.title,
      content: item.content || null,
      url: item.url || null,
      strength: item.strength || 'medium',
      source_metadata: item.source_metadata || {},
      fetched_at: new Date().toISOString(),
    }))

    const { data: inserted, error: insertError } = await supabase
      .from('insights_feed')
      .insert(insightsToInsert)
      .select()

    if (insertError) {
      console.error('Error inserting insights:', insertError)
      return NextResponse.json({ error: 'Failed to insert insights' }, { status: 500 })
    }

    // Update last_fetch_at in workspace settings
    await supabase
      .from('workspace_settings')
      .update({ last_fetch_at: new Date().toISOString() })
      .eq('workspace_id', workspace_id)

    return NextResponse.json({
      success: true,
      inserted: inserted?.length || 0,
      message: `Successfully added ${inserted?.length || 0} insights from ${source_system}`
    })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET: Health check for n8n
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Insights webhook is active',
    expectedPayload: {
      workspace_id: 'uuid',
      source_system: 'slack | notion | mixpanel | airtable',
      items: [
        {
          title: 'string (required)',
          content: 'string (optional)',
          url: 'string (optional)',
          strength: 'high | medium | low (optional, defaults to medium)',
          source_metadata: 'object (optional)'
        }
      ]
    }
  })
}
