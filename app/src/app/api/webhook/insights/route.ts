import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Types for AI-analyzed insights from n8n
interface AIAnalyzedInsight {
  title: string
  description?: string
  source: 'slack' | 'notion' | 'mixpanel' | 'airtable'
  source_url?: string
  pain_points?: string[]
  feature_requests?: string[]
  sentiment?: 'positive' | 'negative' | 'neutral'
  strength?: 'strong' | 'medium' | 'weak'
  key_quotes?: string[]
  tags?: string[]
}

interface AIAnalysisPayload {
  workspace_id: string
  analyzed_at?: string
  summary?: string
  insights: AIAnalyzedInsight[]
  themes?: Array<{ theme: string; count: number; sources: string[] }>
  action_items?: Array<{ action: string; urgency: 'high' | 'medium' | 'low' }>
}

// Legacy payload format for backwards compatibility
interface LegacyPayload {
  workspace_id: string
  source_system: 'slack' | 'notion' | 'mixpanel' | 'airtable'
  items: Array<{
    title: string
    content?: string
    url?: string
    strength?: string
    source_metadata?: Record<string, unknown>
  }>
}

// This endpoint receives insights from n8n workflows
// Supports both new AI-analyzed format and legacy format
// Uses service role key for direct database access (no RLS)
export async function POST(request: NextRequest) {
  try {
    // Verify webhook secret
    const webhookSecret = request.headers.get('x-webhook-secret')
    if (webhookSecret !== process.env.N8N_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Invalid webhook secret' }, { status: 401 })
    }

    const body = await request.json()

    // Use service role for webhook inserts (bypasses RLS)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Detect payload format: new AI-analyzed format has 'insights' array, legacy has 'items' array
    if (body.insights && Array.isArray(body.insights)) {
      return handleAIAnalyzedPayload(body as AIAnalysisPayload, supabase)
    } else if (body.items && Array.isArray(body.items)) {
      return handleLegacyPayload(body as LegacyPayload, supabase)
    } else {
      return NextResponse.json({
        error: 'Invalid payload format. Expected either "insights" array (AI-analyzed) or "items" array (legacy)'
      }, { status: 400 })
    }
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Handle new AI-analyzed payload from n8n
async function handleAIAnalyzedPayload(
  payload: AIAnalysisPayload,
  supabase: SupabaseClient
) {
  const { workspace_id, summary, insights, themes, action_items, analyzed_at } = payload

  if (!workspace_id || !insights || insights.length === 0) {
    return NextResponse.json({
      error: 'workspace_id and non-empty insights array are required'
    }, { status: 400 })
  }

  // Verify workspace exists
  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .select('id')
    .eq('id', workspace_id)
    .single()

  if (workspaceError || !workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  }

  const analysisDate = analyzed_at ? new Date(analyzed_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]

  // Create or update daily analysis record
  const sourcesIncluded = [...new Set(insights.map(i => i.source))]

  const { data: analysis, error: analysisError } = await supabase
    .from('daily_insights_analysis')
    .upsert({
      workspace_id,
      analysis_date: analysisDate,
      insight_count: insights.length,
      sources_included: sourcesIncluded,
      summary: summary || null,
      themes: themes || [],
      action_items: action_items || [],
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'workspace_id,analysis_date'
    })
    .select()
    .single()

  if (analysisError) {
    console.error('Error creating daily analysis:', analysisError)
  }

  // Insert insights with AI analysis fields
  const insightsToInsert = insights.map((insight) => ({
    workspace_id,
    source_system: insight.source,
    title: insight.title,
    content: insight.description || null,
    url: insight.source_url || null,
    source_url: insight.source_url || null,
    strength: insight.strength === 'strong' ? 'high' : insight.strength === 'weak' ? 'low' : 'medium',
    source_metadata: {},
    fetched_at: new Date().toISOString(),
    // AI analysis fields
    ai_summary: insight.description || null,
    ai_themes: [],
    ai_action_items: [],
    pain_points: insight.pain_points || [],
    feature_requests: insight.feature_requests || [],
    sentiment: insight.sentiment || null,
    key_quotes: insight.key_quotes || [],
    tags: insight.tags || [],
    analysis_id: analysis?.id || null,
  }))

  const { data: inserted, error: insertError } = await supabase
    .from('insights_feed')
    .insert(insightsToInsert)
    .select()

  if (insertError) {
    console.error('Error inserting insights:', insertError)
    return NextResponse.json({ error: 'Failed to insert insights' }, { status: 500 })
  }

  // Also add individual insights to Evidence Bank for referencing and vector search
  const evidenceBankItems = insights.map((insight) => ({
    workspace_id,
    title: insight.title,
    type: insight.source_url ? 'url' as const : 'text' as const,
    url: insight.source_url || null,
    content: insight.description || null,
    strength: insight.strength === 'strong' ? 'high' as const : insight.strength === 'weak' ? 'low' as const : 'medium' as const,
    source_system: insight.source,
    tags: insight.tags || [],
    sentiment: insight.sentiment || null,
    source_metadata: {
      pain_points: insight.pain_points || [],
      feature_requests: insight.feature_requests || [],
      key_quotes: insight.key_quotes || [],
      from_insights_feed: true,
      analysis_date: analysisDate,
    },
    created_by: null,
  }))

  let bankInserted: unknown[] | null = null
  let bankError: string | null = null

  // Insert one at a time to identify failures
  const bankResults: unknown[] = []
  for (const item of evidenceBankItems) {
    const { data, error } = await supabase
      .from('evidence_bank')
      .insert(item)
      .select()
      .single()

    if (error) {
      console.error('Evidence bank insert error:', error.message, error.details, error.hint)
      bankError = error.message
    } else if (data) {
      bankResults.push(data)
    }
  }
  bankInserted = bankResults.length > 0 ? bankResults : null

  // Update last_fetch_at in workspace settings
  await supabase
    .from('workspace_settings')
    .update({ last_fetch_at: new Date().toISOString() })
    .eq('workspace_id', workspace_id)

  return NextResponse.json({
    success: true,
    format: 'ai_analyzed',
    inserted: inserted?.length || 0,
    added_to_bank: bankInserted?.length || 0,
    bank_error: bankError,
    analysis_id: analysis?.id || null,
    sources: sourcesIncluded,
    message: `Successfully added ${inserted?.length || 0} AI-analyzed insights (${bankInserted?.length || 0} to Evidence Bank)${bankError ? ` [bank error: ${bankError}]` : ''}`
  })
}

// Handle legacy payload format for backwards compatibility
async function handleLegacyPayload(
  payload: LegacyPayload,
  supabase: SupabaseClient
) {
  const { workspace_id, source_system, items } = payload

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
  const insightsToInsert = items.map((item) => ({
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

  // Also add to Evidence Bank so items appear there and can be embedded
  const evidenceBankItems = items.map((item) => ({
    workspace_id,
    title: item.title,
    type: item.url ? 'url' as const : 'text' as const,
    url: item.url || null,
    content: item.content || null,
    strength: item.strength === 'high' ? 'high' as const : item.strength === 'low' ? 'low' as const : 'medium' as const,
    source_system,
    tags: [] as string[],
    source_metadata: item.source_metadata || {},
    created_by: null,
  }))

  let addedToBank = 0
  for (const item of evidenceBankItems) {
    const { error } = await supabase
      .from('evidence_bank')
      .insert(item)

    if (!error) addedToBank++
    else console.error('Legacy bank insert error:', error.message)
  }

  // Update last_fetch_at in workspace settings
  await supabase
    .from('workspace_settings')
    .update({ last_fetch_at: new Date().toISOString() })
    .eq('workspace_id', workspace_id)

  return NextResponse.json({
    success: true,
    format: 'legacy',
    inserted: inserted?.length || 0,
    added_to_bank: addedToBank,
    message: `Successfully added ${inserted?.length || 0} insights from ${source_system} (${addedToBank} to Evidence Bank)`
  })
}

// GET: Health check for n8n - documents both payload formats
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Insights webhook is active. Supports both AI-analyzed and legacy formats.',
    formats: {
      ai_analyzed: {
        description: 'New format with AI analysis from n8n OpenAI node',
        payload: {
          workspace_id: 'uuid (required)',
          analyzed_at: 'ISO timestamp (optional)',
          summary: '2-3 sentence overview (optional)',
          insights: [
            {
              title: 'string (required)',
              description: 'string (optional)',
              source: 'slack | notion | mixpanel | airtable (required)',
              source_url: 'link to original (optional)',
              pain_points: ['array of strings (optional)'],
              feature_requests: ['array of strings (optional)'],
              sentiment: 'positive | negative | neutral (optional)',
              strength: 'strong | medium | weak (optional)',
              key_quotes: ['array of strings (optional)'],
              tags: ['array of strings (optional)']
            }
          ],
          themes: [
            { theme: 'Theme name', count: 5, sources: ['slack', 'notion'] }
          ],
          action_items: [
            { action: 'Action description', urgency: 'high | medium | low' }
          ]
        }
      },
      legacy: {
        description: 'Original format for backwards compatibility',
        payload: {
          workspace_id: 'uuid (required)',
          source_system: 'slack | notion | mixpanel | airtable (required)',
          items: [
            {
              title: 'string (required)',
              content: 'string (optional)',
              url: 'string (optional)',
              strength: 'high | medium | low (optional)',
              source_metadata: 'object (optional)'
            }
          ]
        }
      }
    }
  })
}
