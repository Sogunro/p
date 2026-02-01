import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST: Recalculate calibration for current period
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

    // Calculate for current month
    const now = new Date()
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

    // Fetch all resolved outcomes for this workspace in the period
    const { data: outcomes } = await supabase
      .from('outcomes')
      .select('outcome_type, created_by')
      .eq('workspace_id', membership.workspace_id)
      .neq('outcome_type', 'pending')
      .gte('created_at', periodStart)
      .lte('created_at', periodEnd + 'T23:59:59')

    if (!outcomes || outcomes.length === 0) {
      return NextResponse.json({ message: 'No resolved outcomes in current period' })
    }

    // Group by user
    const userStats: Record<string, { total: number; correct: number }> = {}
    for (const o of outcomes) {
      const uid = o.created_by || user.id
      if (!userStats[uid]) userStats[uid] = { total: 0, correct: 0 }
      userStats[uid].total++
      if (o.outcome_type === 'success') userStats[uid].correct++
    }

    // Compute source reliability
    const { data: resolvedOutcomes } = await supabase
      .from('outcomes')
      .select('decision_id, outcome_type')
      .eq('workspace_id', membership.workspace_id)
      .neq('outcome_type', 'pending')
      .gte('created_at', periodStart)
      .lte('created_at', periodEnd + 'T23:59:59')

    const decisionIds = (resolvedOutcomes || []).map(o => o.decision_id)
    const sourceReliability: Record<string, { total: number; successful: number }> = {}

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
        const outcomeMap = new Map((resolvedOutcomes || []).map(o => [o.decision_id, o.outcome_type]))

        for (const link of links) {
          const source = evidenceSourceMap.get(link.evidence_id) || 'unknown'
          const outcomeType = outcomeMap.get(link.decision_id)
          if (!sourceReliability[source]) {
            sourceReliability[source] = { total: 0, successful: 0 }
          }
          sourceReliability[source].total++
          if (outcomeType === 'success') sourceReliability[source].successful++
        }
      }
    }

    // Upsert calibration records per user
    const results = []
    for (const [uid, stats] of Object.entries(userStats)) {
      const accuracy = stats.total > 0
        ? Math.round((stats.correct / stats.total) * 100 * 100) / 100
        : 0

      const { data, error } = await supabase
        .from('pm_calibration')
        .upsert({
          workspace_id: membership.workspace_id,
          user_id: uid,
          total_predictions: stats.total,
          correct_predictions: stats.correct,
          prediction_accuracy: accuracy,
          source_reliability: sourceReliability,
          period_start: periodStart,
          period_end: periodEnd,
        }, {
          onConflict: 'workspace_id,user_id,period_start,period_end',
        })
        .select()
        .single()

      if (error) {
        console.error('Upsert calibration error:', error)
      } else {
        results.push(data)
      }
    }

    return NextResponse.json({ calibration: results, recalculated: true })
  } catch (error) {
    console.error('Calibration recalculate error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
