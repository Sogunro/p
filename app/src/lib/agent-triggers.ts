/**
 * Agent Auto-Trigger Flow
 *
 * When evidence is linked to a sticky note, agents fire automatically.
 *
 * PRIMARY: LangGraph orchestrator (coordinates all agents as a graph)
 *   - Segment Identifier + Contradiction Detector (parallel)
 *   - Strength Calculator (uses segment from prior step)
 *   - Voice Detector (checks for direct user quotes)
 *   - Gap Analyzer (identifies coverage gaps)
 *
 * FALLBACK: Individual agents if orchestrator is unavailable
 *   1. Strength Calculator (local TypeScript, no LLM)
 *   2. Contradiction Detector (Railway, Haiku)
 *   3. Segment Identifier (Railway, Haiku)
 */

const EMBEDDING_SERVICE_URL = process.env.EMBEDDING_SERVICE_URL || process.env.NEXT_PUBLIC_EMBEDDING_SERVICE_URL || ''
const EMBEDDING_API_KEY = process.env.EMBEDDING_API_KEY || ''

/**
 * Fire agents after evidence is linked to a sticky note.
 * Tries orchestrator first, falls back to individual agents.
 */
export async function triggerAgentsOnEvidenceLink(
  evidenceBankId: string,
  stickyNoteId: string,
  workspaceId: string,
): Promise<void> {
  // Try LangGraph orchestrator first
  if (EMBEDDING_SERVICE_URL) {
    try {
      const orchestrated = await runOrchestratedFlow(evidenceBankId, stickyNoteId, workspaceId)
      if (orchestrated) {
        // Orchestrator handles everything — still run local strength calc
        await runStrengthCalculator(evidenceBankId, stickyNoteId, workspaceId).catch(() => {})
        return
      }
    } catch (error) {
      console.warn('[Orchestrator] Failed, falling back to individual agents:', error)
    }
  }

  // Fallback: individual agents
  const tasks = [
    runStrengthCalculator(evidenceBankId, stickyNoteId, workspaceId),
    runContradictionDetector(evidenceBankId, workspaceId),
    runSegmentIdentifier(evidenceBankId, workspaceId),
  ]
  await Promise.allSettled(tasks)
}

/**
 * LangGraph orchestrated flow — calls the Python service's /orchestrate/evidence-link
 * which coordinates segment, contradiction, strength, voice, and gap analysis.
 */
async function runOrchestratedFlow(
  evidenceBankId: string,
  stickyNoteId: string,
  workspaceId: string,
): Promise<boolean> {
  const response = await fetch(`${EMBEDDING_SERVICE_URL}/orchestrate/evidence-link`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(EMBEDDING_API_KEY ? { 'Authorization': `Bearer ${EMBEDDING_API_KEY}` } : {}),
    },
    body: JSON.stringify({
      evidence_id: evidenceBankId,
      workspace_id: workspaceId,
      sticky_note_id: stickyNoteId,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    console.error(`[Orchestrator] Failed (${response.status}):`, text)
    return false
  }

  const result = await response.json()
  console.log(
    `[Orchestrator] Completed: segment=${result.segment}, contradictions=${result.contradictions_found}, ` +
    `voice=${result.has_direct_voice}, gaps=${(result.gaps || []).length}`
  )
  return result.completed === true
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
