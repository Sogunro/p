import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  computeEvidenceStrength,
  calculateRecencyFactor,
  getSourceWeight,
  DEFAULT_WEIGHT_CONFIG,
  DEFAULT_RECENCY_CONFIG,
} from '@/lib/evidence-strength'
import type { WeightConfig, RecencyConfig, SourceSystemExpanded } from '@/types/database'

// POST: Recalculate evidence strength for all evidence in workspace
export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    // Get workspace weight config
    const { data: settings } = await supabase
      .from('workspace_settings')
      .select('weight_config, recency_config, target_segments')
      .eq('workspace_id', membership.workspace_id)
      .single()

    const weightConfig = (settings?.weight_config as WeightConfig) ?? DEFAULT_WEIGHT_CONFIG
    const recencyConfig = (settings?.recency_config as RecencyConfig) ?? DEFAULT_RECENCY_CONFIG
    const targetSegments = (settings?.target_segments as string[]) ?? []

    // Get all evidence in workspace
    const { data: evidenceItems, error: fetchError } = await supabase
      .from('evidence_bank')
      .select('id, source_system, created_at, segment, source_timestamp')
      .eq('workspace_id', membership.workspace_id)

    if (fetchError) {
      console.error('Error fetching evidence:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch evidence' }, { status: 500 })
    }

    if (!evidenceItems || evidenceItems.length === 0) {
      return NextResponse.json({ updated: 0, message: 'No evidence to recalculate' })
    }

    // Recalculate each evidence item
    let updated = 0
    for (const item of evidenceItems) {
      const otherItems = evidenceItems.filter(e => e.id !== item.id)
      const result = computeEvidenceStrength(
        item as { source_system: SourceSystemExpanded; created_at: string; segment: string | null; source_timestamp: string | null },
        otherItems as { source_system: SourceSystemExpanded; created_at: string; segment: string | null; source_timestamp: string | null }[],
        { weightConfig, recencyConfig, targetSegments }
      )

      const sourceWeight = getSourceWeight(item.source_system as SourceSystemExpanded, weightConfig)
      const recencyFactor = calculateRecencyFactor(item.source_timestamp || item.created_at, recencyConfig)

      const { error: updateError } = await supabase
        .from('evidence_bank')
        .update({
          source_weight: sourceWeight,
          recency_factor: recencyFactor,
          computed_strength: result.computed_strength,
        })
        .eq('id', item.id)

      if (!updateError) updated++
    }

    return NextResponse.json({
      updated,
      total: evidenceItems.length,
      message: `Recalculated ${updated} of ${evidenceItems.length} evidence items`,
    })
  } catch (error) {
    console.error('Recalculate error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
