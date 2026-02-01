import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const EMBEDDING_SERVICE_URL = process.env.EMBEDDING_SERVICE_URL || ''
const EMBEDDING_API_KEY = process.env.EMBEDDING_API_KEY || ''

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    if (!EMBEDDING_SERVICE_URL) {
      return NextResponse.json({ error: 'Agent service not configured' }, { status: 503 })
    }

    const body = await request.json()
    const { flow, evidence_id, sticky_note_id, session_id } = body

    if (!flow) {
      return NextResponse.json({ error: 'flow is required (evidence-link or session-analysis)' }, { status: 400 })
    }

    let endpoint: string
    let payload: Record<string, unknown>

    switch (flow) {
      case 'evidence-link':
        if (!evidence_id) {
          return NextResponse.json({ error: 'evidence_id is required for evidence-link flow' }, { status: 400 })
        }
        endpoint = '/orchestrate/evidence-link'
        payload = {
          evidence_id,
          workspace_id: membership.workspace_id,
          sticky_note_id: sticky_note_id || null,
        }
        break

      case 'session-analysis':
        if (!session_id) {
          return NextResponse.json({ error: 'session_id is required for session-analysis flow' }, { status: 400 })
        }
        endpoint = '/orchestrate/session-analysis'
        payload = {
          session_id,
          workspace_id: membership.workspace_id,
        }
        break

      default:
        return NextResponse.json({ error: `Unknown flow: ${flow}` }, { status: 400 })
    }

    const response = await fetch(`${EMBEDDING_SERVICE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(EMBEDDING_API_KEY ? { 'Authorization': `Bearer ${EMBEDDING_API_KEY}` } : {}),
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json({ error: `Orchestration error: ${errorText}` }, { status: 502 })
    }

    const result = await response.json()
    return NextResponse.json(result)
  } catch (error) {
    console.error('Orchestration error:', error)
    return NextResponse.json({ error: 'Failed to run orchestration' }, { status: 500 })
  }
}
