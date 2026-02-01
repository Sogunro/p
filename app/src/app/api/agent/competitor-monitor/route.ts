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

    const response = await fetch(`${EMBEDDING_SERVICE_URL}/agent/competitor-monitor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(EMBEDDING_API_KEY ? { 'Authorization': `Bearer ${EMBEDDING_API_KEY}` } : {}),
      },
      body: JSON.stringify({
        workspace_id: membership.workspace_id,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json({ error: `Agent service error: ${errorText}` }, { status: 502 })
    }

    const result = await response.json()
    return NextResponse.json(result)
  } catch (error) {
    console.error('Competitor Monitor error:', error)
    return NextResponse.json({ error: 'Failed to run Competitor Monitor' }, { status: 500 })
  }
}
