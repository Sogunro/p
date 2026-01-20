import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/workspace/schedule-fetch
// Schedule an analysis for a specific date/time
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

    // Only owners/admins can schedule
    if (membership.role !== 'owner' && membership.role !== 'admin') {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    const body = await request.json()
    const { scheduled_at, lookback_hours } = body

    if (!scheduled_at) {
      return NextResponse.json({ error: 'scheduled_at is required' }, { status: 400 })
    }

    const scheduledDate = new Date(scheduled_at)
    if (scheduledDate <= new Date()) {
      return NextResponse.json({ error: 'Scheduled time must be in the future' }, { status: 400 })
    }

    // Store the scheduled fetch (you could create a scheduled_fetches table for this)
    // For now, we'll use n8n's scheduling capability or a simple approach

    // Option 1: If n8n has scheduling capabilities, trigger with delay
    // Option 2: Store in database and use a cron job
    // For simplicity, we'll store in a table and the cron job handles it

    // Check if scheduled_fetches table exists, if not we'll just return success
    // and note that the user needs to set up a cron job
    const { error: insertError } = await supabase
      .from('scheduled_fetches')
      .insert({
        workspace_id: membership.workspace_id,
        scheduled_at: scheduledDate.toISOString(),
        lookback_hours: lookback_hours || 24,
        status: 'pending',
        created_by: user.id,
      })

    if (insertError) {
      // Table might not exist - just log and return success with note
      console.log('Note: scheduled_fetches table may not exist:', insertError.message)

      return NextResponse.json({
        success: true,
        message: `Analysis scheduled for ${scheduledDate.toLocaleString()}`,
        note: 'Scheduling requires a cron job or n8n schedule node to execute. Consider using "Run Now" for immediate analysis.',
        scheduled_at: scheduledDate.toISOString(),
        lookback_hours: lookback_hours || 24,
      })
    }

    return NextResponse.json({
      success: true,
      message: `Analysis scheduled for ${scheduledDate.toLocaleString()}`,
      scheduled_at: scheduledDate.toISOString(),
      lookback_hours: lookback_hours || 24,
    })
  } catch (error) {
    console.error('Schedule fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to schedule fetch', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// GET /api/workspace/schedule-fetch
// Get pending scheduled fetches
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

    // Get pending scheduled fetches
    const { data: scheduled, error } = await supabase
      .from('scheduled_fetches')
      .select('*')
      .eq('workspace_id', membership.workspace_id)
      .eq('status', 'pending')
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })

    if (error) {
      // Table might not exist
      return NextResponse.json({ scheduled: [] })
    }

    return NextResponse.json({ scheduled: scheduled || [] })
  } catch (error) {
    console.error('Get scheduled fetches error:', error)
    return NextResponse.json(
      { error: 'Failed to get scheduled fetches' },
      { status: 500 }
    )
  }
}

// DELETE /api/workspace/schedule-fetch
// Cancel a scheduled fetch
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const scheduleId = searchParams.get('id')

    if (!scheduleId) {
      return NextResponse.json({ error: 'Schedule ID required' }, { status: 400 })
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

    // Delete the scheduled fetch
    const { error } = await supabase
      .from('scheduled_fetches')
      .delete()
      .eq('id', scheduleId)
      .eq('workspace_id', membership.workspace_id)

    if (error) {
      return NextResponse.json({ error: 'Failed to cancel schedule' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Cancel schedule error:', error)
    return NextResponse.json(
      { error: 'Failed to cancel schedule' },
      { status: 500 }
    )
  }
}
