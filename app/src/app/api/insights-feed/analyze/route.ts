import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { SourceSystem } from '@/types/database'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

interface InsightItem {
  id: string
  title: string
  content: string | null
  source_system: SourceSystem
  strength: string
  url: string | null
}

export async function POST(request: NextRequest) {
  try {
    const { date } = await request.json()

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

    // Determine the analysis date (default to today)
    const analysisDate = date ? new Date(date) : new Date()
    const dateStr = analysisDate.toISOString().split('T')[0]

    // Check if analysis already exists for this date
    const { data: existingAnalysis } = await supabase
      .from('daily_insights_analysis')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('analysis_date', dateStr)
      .maybeSingle()

    if (existingAnalysis) {
      return NextResponse.json({
        success: true,
        analysis: existingAnalysis,
        cached: true,
      })
    }

    // Fetch all insights for this date
    const startOfDay = `${dateStr}T00:00:00.000Z`
    const endOfDay = `${dateStr}T23:59:59.999Z`

    const { data: insights, error: insightsError } = await supabase
      .from('insights_feed')
      .select('*')
      .eq('workspace_id', workspaceId)
      .gte('fetched_at', startOfDay)
      .lte('fetched_at', endOfDay)
      .order('source_system')

    if (insightsError) {
      return NextResponse.json({ error: 'Failed to fetch insights' }, { status: 500 })
    }

    if (!insights || insights.length === 0) {
      return NextResponse.json({
        error: 'No insights found for this date',
        date: dateStr,
      }, { status: 404 })
    }

    // Group insights by source
    const groupedBySource: Record<string, InsightItem[]> = {
      slack: [],
      notion: [],
      mixpanel: [],
      airtable: [],
    }

    insights.forEach((insight) => {
      const source = insight.source_system as keyof typeof groupedBySource
      if (groupedBySource[source]) {
        groupedBySource[source].push({
          id: insight.id,
          title: insight.title,
          content: insight.content,
          source_system: insight.source_system,
          strength: insight.strength,
          url: insight.url,
        })
      }
    })

    // Build the AI prompt
    const sourceSections = Object.entries(groupedBySource)
      .filter(([, items]) => items.length > 0)
      .map(([source, items]) => {
        const sourceUpper = source.toUpperCase()
        const itemList = items
          .map((item) => `- [${item.id}] ${item.title}${item.content ? `: ${item.content.substring(0, 200)}` : ''}`)
          .join('\n')
        return `=== ${sourceUpper} (${items.length} items) ===\n${itemList}`
      })
      .join('\n\n')

    const sourcesIncluded = Object.entries(groupedBySource)
      .filter(([, items]) => items.length > 0)
      .map(([source]) => source)

    const prompt = `You are a product discovery expert analyzing daily user insights gathered from multiple sources (Slack, Notion, Mixpanel, Airtable).

DATE: ${dateStr}
TOTAL INSIGHTS: ${insights.length}

INSIGHTS BY SOURCE:

${sourceSections}

Analyze these insights and identify:
1. Common THEMES across sources - what topics keep coming up?
2. PATTERNS - are there recurring issues, increasing concerns, or new topics?
3. PRIORITIES - which insights need immediate attention? Score each from 1-10.
4. CROSS-SOURCE CONNECTIONS - when multiple sources mention related topics, that's significant.
5. ACTION ITEMS - what should the product team do based on these insights?

Provide your analysis in the following JSON format:
{
  "summary": "<2-3 sentence overview of today's insights - what's the main takeaway?>",
  "themes": [
    {
      "theme": "<theme name>",
      "count": <number of related insights>,
      "sources": ["<source1>", "<source2>"],
      "examples": ["<brief example 1>", "<brief example 2>"]
    }
  ],
  "patterns": [
    {
      "pattern": "<pattern description>",
      "trend": "<increasing|stable|new>",
      "related_themes": ["<theme1>", "<theme2>"]
    }
  ],
  "priorities": [
    {
      "insight_id": "<the insight id from the list>",
      "title": "<insight title>",
      "priority_score": <1-10>,
      "reason": "<why this is high priority>"
    }
  ],
  "cross_source_connections": [
    {
      "sources": ["<source1>", "<source2>"],
      "connection": "<what's the connection between these sources?>",
      "insight_ids": ["<id1>", "<id2>"]
    }
  ],
  "action_items": [
    {
      "action": "<recommended action>",
      "urgency": "<high|medium|low>",
      "related_insights": ["<insight_id1>", "<insight_id2>"]
    }
  ]
}

Only return valid JSON, no other text. Focus on actionable insights that help the product team make decisions.`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        { role: 'user', content: prompt }
      ],
    })

    // Parse the response
    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    let analysis

    try {
      analysis = JSON.parse(responseText)
    } catch {
      // If JSON parsing fails, try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('Failed to parse analysis response')
      }
    }

    // Save analysis to database
    const { data: savedAnalysis, error: saveError } = await supabase
      .from('daily_insights_analysis')
      .insert({
        workspace_id: workspaceId,
        analysis_date: dateStr,
        insight_count: insights.length,
        sources_included: sourcesIncluded,
        summary: analysis.summary,
        themes: analysis.themes,
        patterns: analysis.patterns,
        priorities: analysis.priorities,
        cross_source_connections: analysis.cross_source_connections,
        action_items: analysis.action_items,
        raw_response: message,
      })
      .select()
      .single()

    if (saveError) {
      console.error('Failed to save analysis:', saveError)
      return NextResponse.json({ error: 'Failed to save analysis' }, { status: 500 })
    }

    // Update insights with analysis_id
    await supabase
      .from('insights_feed')
      .update({ analysis_id: savedAnalysis.id })
      .eq('workspace_id', workspaceId)
      .gte('fetched_at', startOfDay)
      .lte('fetched_at', endOfDay)

    return NextResponse.json({
      success: true,
      analysis: savedAnalysis,
      cached: false,
    })
  } catch (error) {
    console.error('Analysis error:', error)
    return NextResponse.json(
      { error: 'Analysis failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
