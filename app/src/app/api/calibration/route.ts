import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET: Fetch calibration data for the workspace
export async function GET() {
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

    // Fetch calibration records
    const { data: calibration } = await supabase
      .from('pm_calibration')
      .select('*')
      .eq('workspace_id', membership.workspace_id)
      .order('period_end', { ascending: false })

    // Compute live stats from outcomes + decisions
    const { data: outcomes } = await supabase
      .from('outcomes')
      .select('outcome_type, decisions(status, evidence_strength)')
      .eq('workspace_id', membership.workspace_id)

    // Compute source reliability from evidence linked to decisions with outcomes
    const { data: decisionsWithOutcomes } = await supabase
      .from('outcomes')
      .select('decision_id, outcome_type')
      .eq('workspace_id', membership.workspace_id)
      .neq('outcome_type', 'pending')

    const decisionIds = (decisionsWithOutcomes || []).map(o => o.decision_id)
    let sourceReliability: Record<string, { total: number; successful: number }> = {}

    if (decisionIds.length > 0) {
      const { data: links } = await supabase
        .from('evidence_decision_links')
        .select('evidence_id, decision_id')
        .in('decision_id', decisionIds)

      if (links && links.length > 0) {
        const evidenceIds = [...new Set(links.map(l => l.evidence_id))]
        const { data: evidence } = await supabase
          .from('evidence_bank')
          .select('id, source_system')
          .in('id', evidenceIds)

        const evidenceSourceMap = new Map((evidence || []).map(e => [e.id, e.source_system]))
        const outcomeMap = new Map((decisionsWithOutcomes || []).map(o => [o.decision_id, o.outcome_type]))

        for (const link of links) {
          const source = evidenceSourceMap.get(link.evidence_id) || 'unknown'
          const outcomeType = outcomeMap.get(link.decision_id)
          if (!sourceReliability[source]) {
            sourceReliability[source] = { total: 0, successful: 0 }
          }
          sourceReliability[source].total++
          if (outcomeType === 'success') {
            sourceReliability[source].successful++
          }
        }
      }
    }

    // Compute overall accuracy
    const resolved = (outcomes || []).filter(o => o.outcome_type !== 'pending')
    const successful = resolved.filter(o => o.outcome_type === 'success')
    const overallAccuracy = resolved.length > 0
      ? Math.round((successful.length / resolved.length) * 100)
      : null

    // Compute accuracy by decision status
    const commitOutcomes = resolved.filter(o => {
      const dec = o.decisions as unknown as { status: string } | null
      return dec?.status === 'commit'
    })
    const commitSuccess = commitOutcomes.filter(o => o.outcome_type === 'success')
    const commitAccuracy = commitOutcomes.length > 0
      ? Math.round((commitSuccess.length / commitOutcomes.length) * 100)
      : null

    return NextResponse.json({
      calibration: calibration || [],
      stats: {
        overall_accuracy: overallAccuracy,
        total_resolved: resolved.length,
        total_success: successful.length,
        commit_accuracy: commitAccuracy,
        commit_total: commitOutcomes.length,
        source_reliability: sourceReliability,
      },
    })
  } catch (error) {
    console.error('Calibration GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
