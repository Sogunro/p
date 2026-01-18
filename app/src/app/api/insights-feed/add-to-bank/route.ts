import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST: Add insight to evidence bank
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

    // Get the insight
    const { data: insight, error: fetchError } = await supabase
      .from('insights_feed')
      .select('*')
      .eq('id', insightId)
      .eq('workspace_id', membership.workspace_id)
      .single()

    if (fetchError || !insight) {
      return NextResponse.json({ error: 'Insight not found' }, { status: 404 })
    }

    // Create evidence bank entry
    const { data: evidence, error: insertError } = await supabase
      .from('evidence_bank')
      .insert({
        workspace_id: membership.workspace_id,
        title: insight.title,
        type: insight.url ? 'url' : 'text',
        url: insight.url,
        content: insight.content,
        strength: insight.strength,
        source_system: insight.source_system,
        source_metadata: insight.source_metadata,
        created_by: user.id,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error adding to bank:', insertError)
      return NextResponse.json({ error: 'Failed to add to evidence bank' }, { status: 500 })
    }

    // Mark insight as added
    await supabase
      .from('insights_feed')
      .update({ is_added_to_bank: true })
      .eq('id', insightId)

    return NextResponse.json({ evidence })
  } catch (error) {
    console.error('Add to bank error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
