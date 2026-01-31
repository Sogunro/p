import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST: Bulk sync all pending insights to evidence bank
export async function POST() {
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

    // Get all pending insights (not added to bank, not dismissed)
    const { data: insights, error: fetchError } = await supabase
      .from('insights_feed')
      .select('*')
      .eq('workspace_id', membership.workspace_id)
      .eq('is_added_to_bank', false)
      .eq('is_dismissed', false)

    if (fetchError) {
      return NextResponse.json({ error: 'Failed to fetch insights' }, { status: 500 })
    }

    if (!insights || insights.length === 0) {
      return NextResponse.json({ synced: 0, message: 'No pending insights to sync' })
    }

    let synced = 0
    const errors: string[] = []

    for (const insight of insights) {
      const { error: insertError } = await supabase
        .from('evidence_bank')
        .insert({
          workspace_id: membership.workspace_id,
          title: insight.title,
          type: insight.url ? 'url' : 'text',
          url: insight.url || null,
          content: insight.content || null,
          strength: insight.strength || 'medium',
          source_system: insight.source_system,
          tags: insight.tags || [],
          sentiment: insight.sentiment || null,
          source_metadata: insight.source_metadata || {},
          created_by: user.id,
        })

      if (insertError) {
        errors.push(`${insight.title}: ${insertError.message}`)
      } else {
        synced++
        // Mark insight as added to bank
        await supabase
          .from('insights_feed')
          .update({ is_added_to_bank: true })
          .eq('id', insight.id)
      }
    }

    return NextResponse.json({
      synced,
      total: insights.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Synced ${synced}/${insights.length} insights to Evidence Bank${errors.length > 0 ? ` (${errors.length} failed)` : ''}`,
    })
  } catch (error) {
    console.error('Sync to bank error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
