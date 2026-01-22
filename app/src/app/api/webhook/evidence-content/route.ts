import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Types for fetched evidence from n8n
interface FetchedEvidenceItem {
  evidence_id: string
  source_type: string
  url: string
  title: string
  content: string  // THE ACTUAL FETCHED CONTENT
  metadata?: Record<string, unknown>
  table?: 'evidence_bank' | 'evidence'  // Which table the evidence_id is from
}

interface FetchedEvidencePayload {
  workspace_id: string
  session_id?: string | null
  fetched_at?: string
  fetched_evidence: FetchedEvidenceItem[]
}

// POST /api/webhook/evidence-content
// Receives fetched content from n8n and stores it in evidence_bank
// This endpoint does NOT analyze - that happens when user clicks "Analyze"
export async function POST(request: NextRequest) {
  try {
    // Verify webhook secret
    const webhookSecret = request.headers.get('x-webhook-secret')
    if (webhookSecret !== process.env.N8N_WEBHOOK_SECRET) {
      console.error('Invalid webhook secret')
      return NextResponse.json({ error: 'Invalid webhook secret' }, { status: 401 })
    }

    const body = await request.json() as FetchedEvidencePayload

    const { workspace_id, session_id, fetched_evidence } = body

    if (!workspace_id || !fetched_evidence || !Array.isArray(fetched_evidence)) {
      return NextResponse.json({
        error: 'workspace_id and fetched_evidence array are required'
      }, { status: 400 })
    }

    // Use service role for webhook updates (bypasses RLS)
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
      console.error('Workspace not found:', workspace_id)
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    // Update each evidence record with fetched content
    const results = {
      updated: 0,
      failed: 0,
      errors: [] as string[]
    }

    for (const item of fetched_evidence) {
      if (!item.evidence_id) {
        results.failed++
        results.errors.push(`Missing evidence_id for URL: ${item.url}`)
        continue
      }

      // Determine which table to update based on the 'table' field
      const targetTable = item.table || 'evidence_bank'

      if (targetTable === 'evidence_bank') {
        // Update evidence_bank table (workspace-scoped)
        const { error: updateError } = await supabase
          .from('evidence_bank')
          .update({
            fetched_content: item.content,
            fetch_status: 'fetched',
            fetch_metadata: item.metadata || {},
            fetched_at: new Date().toISOString(),
            ...(item.title ? { title: item.title } : {}),
          })
          .eq('id', item.evidence_id)
          .eq('workspace_id', workspace_id)

        if (updateError) {
          console.error(`Failed to update evidence_bank ${item.evidence_id}:`, updateError)
          results.failed++
          results.errors.push(`Failed to update ${item.evidence_id}: ${updateError.message}`)
        } else {
          results.updated++
        }
      } else {
        // Update evidence table (sticky note evidence)
        // Note: evidence table may not have fetched_content columns, so we need to add them
        // or store the content differently. For now, we update what we can.
        const { error: updateError } = await supabase
          .from('evidence')
          .update({
            fetched_content: item.content,
            fetch_status: 'fetched',
            fetched_at: new Date().toISOString(),
            ...(item.title ? { title: item.title } : {}),
          })
          .eq('id', item.evidence_id)

        if (updateError) {
          console.error(`Failed to update evidence ${item.evidence_id}:`, updateError)
          results.failed++
          results.errors.push(`Failed to update ${item.evidence_id}: ${updateError.message}`)
        } else {
          results.updated++
        }
      }
    }

    // Update last_fetch_at in workspace settings
    await supabase
      .from('workspace_settings')
      .update({ last_fetch_at: new Date().toISOString() })
      .eq('workspace_id', workspace_id)

    console.log('Evidence content webhook results:', {
      workspace_id,
      session_id,
      total: fetched_evidence.length,
      updated: results.updated,
      failed: results.failed
    })

    return NextResponse.json({
      success: true,
      message: `Updated ${results.updated} evidence records`,
      total: fetched_evidence.length,
      updated: results.updated,
      failed: results.failed,
      errors: results.errors.length > 0 ? results.errors : undefined
    })
  } catch (error) {
    console.error('Evidence content webhook error:', error)
    return NextResponse.json(
      { error: 'Failed to process fetched evidence', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// GET: Health check and documentation
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Evidence content webhook is active. Use POST to submit fetched evidence.',
    expectedPayload: {
      workspace_id: 'uuid (required)',
      session_id: 'uuid (optional)',
      fetched_evidence: [
        {
          evidence_id: 'uuid (required) - ID of the record to update',
          source_type: 'notion | slack | airtable | manual',
          url: 'Original URL',
          title: 'Fetched title (optional)',
          content: 'THE ACTUAL FETCHED CONTENT (required)',
          metadata: 'object with additional info (optional)',
          table: 'evidence_bank | evidence (required) - which table the evidence_id is from'
        }
      ]
    },
    headers: {
      'x-webhook-secret': 'Required - must match N8N_WEBHOOK_SECRET env var'
    }
  })
}
