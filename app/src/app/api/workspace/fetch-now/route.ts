import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/workspace/fetch-now
// Sends evidence from Evidence Bank to n8n for AI analysis
// Body: { sessionId?: string, lookback_hours?: number }
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

    // Parse request body
    const body = await request.json().catch(() => ({}))
    const sessionId = body.sessionId as string | undefined
    const lookbackHours = body.lookback_hours as number | undefined

    // Calculate the date cutoff based on lookback hours
    const lookbackDate = new Date()
    lookbackDate.setHours(lookbackDate.getHours() - (lookbackHours || 24))

    // Fetch evidence from Evidence Bank
    let query = supabase
      .from('evidence_bank')
      .select('*')
      .eq('workspace_id', membership.workspace_id)
      .gte('created_at', lookbackDate.toISOString())
      .order('created_at', { ascending: false })

    const { data: evidenceItems, error: evidenceError } = await query

    console.log('Evidence bank query result:', {
      count: evidenceItems?.length || 0,
      workspaceId: membership.workspace_id,
      lookbackDate: lookbackDate.toISOString(),
      error: evidenceError?.message
    })

    if (evidenceError) {
      console.error('Failed to fetch evidence from bank:', evidenceError)
      // Don't return error yet - we'll also try direct evidence table
    }

    // Also query direct evidence from sticky notes
    // First, get all session IDs for this user (sessions have workspace_id)
    const { data: userSessions } = await supabase
      .from('sessions')
      .select('id')
      .eq('user_id', user.id)

    const sessionIds = (userSessions || []).map(s => s.id)

    let workspaceDirectEvidence: any[] = []

    if (sessionIds.length > 0) {
      // Get sections for these sessions
      const { data: userSections } = await supabase
        .from('sections')
        .select('id')
        .in('session_id', sessionIds)

      const sectionIds = (userSections || []).map(s => s.id)

      if (sectionIds.length > 0) {
        // Get sticky notes for these sections
        const { data: userNotes } = await supabase
          .from('sticky_notes')
          .select('id')
          .in('section_id', sectionIds)

        const noteIds = (userNotes || []).map(n => n.id)

        if (noteIds.length > 0) {
          // Finally, get evidence for these sticky notes
          const { data: directEvidence, error: directError } = await supabase
            .from('evidence')
            .select('id, type, url, title, created_at')
            .in('sticky_note_id', noteIds)
            .not('url', 'is', null)
            .gte('created_at', lookbackDate.toISOString())
            .order('created_at', { ascending: false })

          if (directError) {
            console.error('Failed to fetch direct evidence:', directError)
          } else {
            workspaceDirectEvidence = directEvidence || []
          }
        }
      }
    }

    console.log('Direct evidence found:', workspaceDirectEvidence.length)

    // Helper function to detect source type from URL
    const detectSourceFromUrl = (url: string): string => {
      const lowerUrl = url.toLowerCase()
      if (lowerUrl.includes('slack.com') || lowerUrl.includes('slack://')) {
        return 'slack'
      }
      if (lowerUrl.includes('notion.so') || lowerUrl.includes('notion.site')) {
        return 'notion'
      }
      if (lowerUrl.includes('airtable.com')) {
        return 'airtable'
      }
      return 'manual'
    }

    // Combine evidence from both sources
    const bankWithUrls = (evidenceItems || []).filter(item => item.url)

    // Merge and deduplicate by URL
    const seenUrls = new Set<string>()
    const allEvidence: { id: string; source_type: string; url: string }[] = []

    // Add bank evidence first (has source_system)
    for (const item of bankWithUrls) {
      if (item.url && !seenUrls.has(item.url)) {
        seenUrls.add(item.url)
        allEvidence.push({
          id: item.id,
          source_type: item.source_system || detectSourceFromUrl(item.url),
          url: item.url,
        })
      }
    }

    // Add direct evidence - detect source from URL
    for (const item of workspaceDirectEvidence) {
      if (item.url && !seenUrls.has(item.url)) {
        seenUrls.add(item.url)
        allEvidence.push({
          id: item.id,
          source_type: detectSourceFromUrl(item.url),
          url: item.url,
        })
      }
    }

    // Check if we found any evidence
    const totalFound = (evidenceItems?.length || 0) + workspaceDirectEvidence.length
    if (totalFound === 0) {
      return NextResponse.json({
        success: false,
        message: 'No evidence found in the specified time range',
        evidenceCount: 0,
      })
    }

    if (allEvidence.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No evidence with URLs found. Add URLs to your evidence for n8n to fetch.',
        evidenceCount: totalFound,
        urlCount: 0,
      })
    }

    // Use allEvidence as the payload
    const evidencePayload = allEvidence

    // Check if N8N_TRIGGER_URL is configured
    const n8nTriggerUrl = process.env.N8N_TRIGGER_URL

    if (!n8nTriggerUrl) {
      // If no n8n URL configured, return info for manual setup
      return NextResponse.json({
        success: false,
        message: 'n8n trigger URL not configured',
        manualSetup: true,
        evidenceCount: allEvidence.length,
        evidence: evidencePayload,
        webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://your-app.vercel.app'}/api/webhook/insights`,
      })
    }

    // Send evidence URLs to n8n for fetching and analysis
    const n8nResponse = await fetch(n8nTriggerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': process.env.N8N_WEBHOOK_SECRET || '',
      },
      body: JSON.stringify({
        workspace_id: membership.workspace_id,
        session_id: sessionId || null,
        callback_url: `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/webhook/insights`,
        evidence_count: allEvidence.length,
        evidence: evidencePayload,
      }),
    })

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text()
      console.error('n8n trigger failed:', errorText)
      return NextResponse.json({
        error: 'Failed to send evidence to n8n',
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
      message: `Sent ${allEvidence.length} evidence URLs to n8n for fetching`,
      evidenceCount: allEvidence.length,
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
// Returns the current fetch status and evidence count
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

    // Get workspace settings for last_fetch_at
    const { data: settings } = await supabase
      .from('workspace_settings')
      .select('last_fetch_at')
      .eq('workspace_id', membership.workspace_id)
      .single()

    // Count evidence in the bank
    const { count: totalEvidence } = await supabase
      .from('evidence_bank')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', membership.workspace_id)

    // Count evidence from last 24 hours
    const yesterday = new Date()
    yesterday.setHours(yesterday.getHours() - 24)
    const { count: recentEvidence } = await supabase
      .from('evidence_bank')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', membership.workspace_id)
      .gte('created_at', yesterday.toISOString())

    return NextResponse.json({
      workspaceId: membership.workspace_id,
      lastFetchAt: settings?.last_fetch_at || null,
      n8nConfigured: !!process.env.N8N_TRIGGER_URL,
      totalEvidence: totalEvidence || 0,
      recentEvidence: recentEvidence || 0,
    })
  } catch (error) {
    console.error('Fetch status error:', error)
    return NextResponse.json(
      { error: 'Failed to get fetch status' },
      { status: 500 }
    )
  }
}
