import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET: Diagnostic endpoint to check evidence pipeline status
// Shows what's in each table and any issues
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's workspace
    const { data: membership, error: membershipError } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single()

    if (membershipError || !membership) {
      return NextResponse.json({
        error: 'No workspace found',
        membershipError: membershipError?.message,
        userId: user.id,
      }, { status: 404 })
    }

    const workspaceId = membership.workspace_id

    // Check evidence_bank - simple query without joins
    const { data: evidenceRaw, error: evidenceError } = await supabase
      .from('evidence_bank')
      .select('id, title, source_system, created_at')
      .eq('workspace_id', workspaceId)
      .limit(5)

    // Check evidence_bank with the profiles join (the one that might fail)
    const { data: evidenceWithJoin, error: joinError } = await supabase
      .from('evidence_bank')
      .select('*, profiles:created_by(full_name)')
      .eq('workspace_id', workspaceId)
      .limit(3)

    // Check insights_feed
    const { data: insightsAll, error: insightsAllError } = await supabase
      .from('insights_feed')
      .select('id, title, source_system, is_added_to_bank, is_dismissed, created_at')
      .eq('workspace_id', workspaceId)
      .limit(10)

    // Check pending insights specifically
    const { data: insightsPending, error: insightsPendingError } = await supabase
      .from('insights_feed')
      .select('id, title')
      .eq('workspace_id', workspaceId)
      .eq('is_added_to_bank', false)
      .eq('is_dismissed', false)
      .limit(5)

    // Check workspace settings
    const { data: settings, error: settingsError } = await supabase
      .from('workspace_settings')
      .select('last_fetch_at, feed_schedule_time')
      .eq('workspace_id', workspaceId)
      .single()

    // Get evidence_bank column info by trying a count
    const { count: evidenceCount, error: countError } = await supabase
      .from('evidence_bank')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)

    const { count: insightsCount } = await supabase
      .from('insights_feed')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)

    return NextResponse.json({
      workspaceId,
      userId: user.id,
      evidence_bank: {
        total_count: evidenceCount,
        count_error: countError?.message || null,
        sample_raw: evidenceRaw,
        raw_error: evidenceError?.message || null,
        join_error: joinError?.message || null,
        join_sample: evidenceWithJoin ? evidenceWithJoin.length : 0,
      },
      insights_feed: {
        total_count: insightsCount,
        all_error: insightsAllError?.message || null,
        all_sample: insightsAll,
        pending_count: insightsPending?.length || 0,
        pending_error: insightsPendingError?.message || null,
        pending_sample: insightsPending,
      },
      workspace_settings: {
        last_fetch_at: settings?.last_fetch_at || null,
        error: settingsError?.message || null,
      },
      diagnosis: getDiagnosis(
        evidenceCount,
        evidenceError,
        joinError,
        insightsCount,
        insightsAllError,
        insightsPending?.length || 0,
        settings?.last_fetch_at
      ),
    })
  } catch (error) {
    console.error('Debug error:', error)
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 })
  }
}

function getDiagnosis(
  evidenceCount: number | null,
  evidenceError: { message: string } | null,
  joinError: { message: string } | null,
  insightsCount: number | null,
  insightsError: { message: string } | null,
  pendingCount: number,
  lastFetchAt: string | null | undefined,
): string[] {
  const issues: string[] = []

  if (evidenceError) {
    issues.push(`evidence_bank query failed: ${evidenceError.message}. Check if the table exists and RLS policies are correct.`)
  }

  if (joinError) {
    issues.push(`evidence_bank profiles join failed: ${joinError.message}. The column might be named 'user_id' instead of 'created_by'. Run: ALTER TABLE evidence_bank RENAME COLUMN user_id TO created_by; ALTER TABLE evidence_bank ALTER COLUMN created_by DROP NOT NULL;`)
  }

  if (evidenceCount === 0 && !evidenceError) {
    issues.push('evidence_bank table is empty for this workspace. No evidence has been added (manually or via webhook).')
  }

  if (insightsError) {
    issues.push(`insights_feed query failed: ${insightsError.message}. Check if the table exists.`)
  }

  if ((insightsCount || 0) === 0) {
    issues.push('insights_feed table is empty. n8n has not sent any insights via the webhook yet. Make sure n8n is configured to call POST /api/webhook/insights.')
  }

  if ((insightsCount || 0) > 0 && pendingCount === 0) {
    issues.push('insights_feed has data but all items are marked as added_to_bank or dismissed. No pending items to sync.')
  }

  if ((insightsCount || 0) > 0 && pendingCount > 0 && evidenceCount === 0) {
    issues.push(`There are ${pendingCount} pending insights that can be synced to Evidence Bank. Use the Sync button or POST /api/insights-feed/sync-to-bank.`)
  }

  if (!lastFetchAt) {
    issues.push('No last_fetch_at recorded in workspace_settings. n8n may not have completed a fetch cycle yet.')
  }

  if (issues.length === 0) {
    issues.push('No issues detected. Data pipeline appears healthy.')
  }

  return issues
}
