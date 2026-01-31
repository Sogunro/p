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
    const { hypothesis, decision_id } = body

    if (!hypothesis || !hypothesis.trim()) {
      return NextResponse.json({ error: 'Hypothesis is required' }, { status: 400 })
    }

    const response = await fetch(`${EMBEDDING_SERVICE_URL}/agent/hunt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(EMBEDDING_API_KEY ? { 'Authorization': `Bearer ${EMBEDDING_API_KEY}` } : {}),
      },
      body: JSON.stringify({
        hypothesis,
        workspace_id: membership.workspace_id,
        decision_id: decision_id || null,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json({ error: `Agent service error: ${errorText}` }, { status: 502 })
    }

    const result = await response.json()
    return NextResponse.json(result)
  } catch (error) {
    console.error('Evidence Hunter error:', error)
    return NextResponse.json({ error: 'Failed to run Evidence Hunter' }, { status: 500 })
  }
}
