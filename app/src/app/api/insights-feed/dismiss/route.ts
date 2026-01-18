import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST: Dismiss an insight
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { insightId } = await request.json()

    if (!insightId) {
      return NextResponse.json({ error: 'insightId is required' }, { status: 400 })
    }

    // Get user's workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    // Mark insight as dismissed
    const { error } = await supabase
      .from('insights_feed')
      .update({ is_dismissed: true })
      .eq('id', insightId)
      .eq('workspace_id', membership.workspace_id)

    if (error) {
      console.error('Error dismissing insight:', error)
      return NextResponse.json({ error: 'Failed to dismiss insight' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Dismiss insight error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
