/**
 * Agent Auto-Trigger Flow
 *
 * When evidence is linked to a sticky note, three agents fire automatically:
 * 1. Strength Calculator (local TypeScript, no LLM)
 * 2. Contradiction Detector (Railway, Haiku)
 * 3. Segment Identifier (Railway, Haiku)
 *
 * All run fire-and-forget — errors are logged but never block the response.
 */

const EMBEDDING_SERVICE_URL = process.env.EMBEDDING_SERVICE_URL || process.env.NEXT_PUBLIC_EMBEDDING_SERVICE_URL || ''
const EMBEDDING_API_KEY = process.env.EMBEDDING_API_KEY || ''

/**
 * Fire all three auto-triggered agents after evidence is linked to a sticky note.
 * Runs in parallel, fire-and-forget. Errors are logged but do not propagate.
 */
export async function triggerAgentsOnEvidenceLink(
  evidenceBankId: string,
  stickyNoteId: string,
  workspaceId: string,
): Promise<void> {
  const tasks = [
    runStrengthCalculator(evidenceBankId, stickyNoteId, workspaceId),
    runContradictionDetector(evidenceBankId, workspaceId),
    runSegmentIdentifier(evidenceBankId, workspaceId),
  ]

  // Fire all in parallel, catch individual errors
  await Promise.allSettled(tasks)
}

/**
 * Agent 1: Strength Calculator (pure logic, no LLM)
 * Re-calculates computed_strength for the evidence item based on
 * source weights, recency, and quality gates.
 */
async function runStrengthCalculator(
  evidenceBankId: string,
  stickyNoteId: string,
  workspaceId: string,
): Promise<void> {
  try {
    const { computeEvidenceStrength } = await import('./evidence-strength')
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()

    // Fetch the evidence item
    const { data: evidence } = await supabase
      .from('evidence_bank')
      .select('id, source_system, source_timestamp, created_at, segment, computed_strength')
      .eq('id', evidenceBankId)
      .single()

    if (!evidence) return

    // Fetch all evidence linked to this sticky note (for corroboration)
    const { data: links } = await supabase
      .from('sticky_note_evidence_links')
      .select('evidence_bank_id')
      .eq('sticky_note_id', stickyNoteId)

    const linkedIds = (links || []).map(l => l.evidence_bank_id).filter(id => id !== evidenceBankId)

    let relatedEvidence: Array<{
      id: string
      source_system: string | null
      source_timestamp: string | null
      created_at: string
      segment: string | null
      computed_strength: number | null
    }> = []

    if (linkedIds.length > 0) {
      const { data: linkedData } = await supabase
        .from('evidence_bank')
        .select('id, source_system, source_timestamp, created_at, segment, computed_strength')
        .in('id', linkedIds)

      relatedEvidence = linkedData || []
    }

    // Calculate strength using existing algorithm
    // Cast source_system to the expected type (function handles unknown values gracefully)
    const evidenceInput = {
      source_system: (evidence.source_system || 'manual') as 'manual',
      created_at: evidence.created_at,
      segment: evidence.segment,
      source_timestamp: evidence.source_timestamp,
    }

    const relatedInput = relatedEvidence.map(e => ({
      source_system: (e.source_system || 'manual') as 'manual',
      created_at: e.created_at,
      segment: e.segment,
      source_timestamp: e.source_timestamp,
    }))

    const result = computeEvidenceStrength(evidenceInput, relatedInput)

    // Update the specific evidence item's computed_strength
    await supabase
      .from('evidence_bank')
      .update({ computed_strength: result.computed_strength })
      .eq('id', evidenceBankId)

    console.log(`[StrengthCalculator] Updated evidence ${evidenceBankId}: ${result.computed_strength}% (${result.band})`)
  } catch (error) {
    console.error('[StrengthCalculator] Error:', error)
  }
}

/**
 * Agent 2: Contradiction Detector (Railway, Haiku)
 * Fire-and-forget call to Python service.
 */
async function runContradictionDetector(
  evidenceBankId: string,
  workspaceId: string,
): Promise<void> {
  if (!EMBEDDING_SERVICE_URL) {
    console.log('[ContradictionDetector] No EMBEDDING_SERVICE_URL configured, skipping')
    return
  }

  try {
    const response = await fetch(`${EMBEDDING_SERVICE_URL}/agent/detect-contradictions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(EMBEDDING_API_KEY ? { 'Authorization': `Bearer ${EMBEDDING_API_KEY}` } : {}),
      },
      body: JSON.stringify({
        evidence_id: evidenceBankId,
        workspace_id: workspaceId,
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      console.error(`[ContradictionDetector] Failed (${response.status}):`, text)
    } else {
      const result = await response.json()
      console.log(`[ContradictionDetector] Found ${result.contradictions_found || 0} contradictions`)
    }
  } catch (error) {
    console.error('[ContradictionDetector] Error:', error)
  }
}

/**
 * Agent 3: Segment Identifier (Railway, Haiku)
 * Fire-and-forget call to Python service.
 */
async function runSegmentIdentifier(
  evidenceBankId: string,
  workspaceId: string,
): Promise<void> {
  if (!EMBEDDING_SERVICE_URL) {
    console.log('[SegmentIdentifier] No EMBEDDING_SERVICE_URL configured, skipping')
    return
  }

  try {
    const response = await fetch(`${EMBEDDING_SERVICE_URL}/agent/segment-identify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(EMBEDDING_API_KEY ? { 'Authorization': `Bearer ${EMBEDDING_API_KEY}` } : {}),
      },
      body: JSON.stringify({
        evidence_id: evidenceBankId,
        workspace_id: workspaceId,
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      console.error(`[SegmentIdentifier] Failed (${response.status}):`, text)
    } else {
      const result = await response.json()
      console.log(`[SegmentIdentifier] Identified segment: ${result.segment || 'none'}`)
    }
  } catch (error) {
    console.error('[SegmentIdentifier] Error:', error)
  }
}
