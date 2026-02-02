import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import {
  computeAggregateStrength,
  isDirectVoiceSource,
} from '@/lib/evidence-strength'
import type { SourceSystemExpanded, SpecAnalysisData, SpecRankedProblem } from '@/types/database'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// ============================================
// Pre-computation helpers
// ============================================

interface LinkedEvidence {
  id: string
  title: string
  url: string | null
  content: string | null
  fetched_content: string | null
  fetch_status: string | null
  source_system: string
  strength: string
  computed_strength: number
  segment: string | null
  has_direct_voice: boolean
  source_weight: number
  source_timestamp: string | null
  created_at: string
}

interface ProblemStats {
  noteId: string
  noteContent: string
  sectionName: string
  evidenceItems: LinkedEvidence[]
  aggregateStrength: number
  strengthBand: 'weak' | 'moderate' | 'strong'
  sourcesCount: number
  segments: string[]
  hasDirectVoice: boolean
  evidenceAgeDays: number
}

function computeProblemStats(
  noteId: string,
  noteContent: string,
  sectionName: string,
  evidenceItems: LinkedEvidence[]
): ProblemStats {
  if (evidenceItems.length === 0) {
    return {
      noteId,
      noteContent,
      sectionName,
      evidenceItems: [],
      aggregateStrength: 0,
      strengthBand: 'weak',
      sourcesCount: 0,
      segments: [],
      hasDirectVoice: false,
      evidenceAgeDays: 0,
    }
  }

  // Compute aggregate strength using evidence-strength lib
  const forStrength = evidenceItems.map(e => ({
    source_system: e.source_system as SourceSystemExpanded,
    created_at: e.source_timestamp || e.created_at,
    segment: e.segment,
    source_timestamp: e.source_timestamp,
  }))
  const agg = computeAggregateStrength(forStrength)

  const segments = [...new Set(evidenceItems.map(e => e.segment).filter(Boolean) as string[])]
  const hasDirectVoice = evidenceItems.some(e =>
    e.has_direct_voice || isDirectVoiceSource(e.source_system as SourceSystemExpanded)
  )

  // Average evidence age in days
  const now = Date.now()
  const avgAge = evidenceItems.reduce((sum, e) => {
    const date = new Date(e.source_timestamp || e.created_at).getTime()
    return sum + (now - date) / (1000 * 60 * 60 * 24)
  }, 0) / evidenceItems.length

  return {
    noteId,
    noteContent,
    sectionName,
    evidenceItems,
    aggregateStrength: agg.average_strength,
    strengthBand: agg.band,
    sourcesCount: agg.item_count,
    segments,
    hasDirectVoice,
    evidenceAgeDays: Math.round(avgAge),
  }
}

function getRecommendation(
  strength: number,
  hasDirectVoice: boolean,
  constraintsPassed: number,
  totalConstraints: number
): 'COMMIT' | 'VALIDATE' | 'PARK' {
  const passRate = totalConstraints > 0 ? constraintsPassed / totalConstraints : 1
  if (strength >= 70) {
    if (hasDirectVoice && passRate >= 0.8) return 'COMMIT'
    return 'VALIDATE'
  }
  if (strength >= 40) return 'VALIDATE'
  return 'PARK'
}

// ============================================
// Main POST handler
// ============================================

export async function POST(request: NextRequest) {
  try {
    const { sessionId, skipEvidenceCheck } = await request.json()

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }

    const supabase = await createClient()

    // Verify user owns this session
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if evidence has been fetched recently (unless skipped)
    if (!skipEvidenceCheck) {
      const { data: membership } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .single()

      if (membership) {
        const { data: settings } = await supabase
          .from('workspace_settings')
          .select('last_fetch_at, feed_enabled')
          .eq('workspace_id', membership.workspace_id)
          .single()

        if (settings?.feed_enabled) {
          const lastFetch = settings.last_fetch_at ? new Date(settings.last_fetch_at) : null
          const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

          if (!lastFetch || lastFetch < oneDayAgo) {
            return NextResponse.json({
              error: 'evidence_stale',
              message: 'Evidence has not been fetched recently. Would you like to proceed anyway or fetch latest insights first?',
              lastFetchAt: settings.last_fetch_at,
            }, { status: 428 })
          }
        }
      }
    }

    // Fetch complete session data
    const { data: session, error } = await supabase
      .from('sessions')
      .select(`
        *,
        session_objectives (*),
        session_checklist_items (*),
        session_constraints (
          constraints (*)
        ),
        sections (
          *,
          sticky_notes (
            *,
            evidence (*)
          )
        )
      `)
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single()

    if (error || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Collect all note IDs
    const allNoteIds = session.sections.flatMap((s: { sticky_notes: { id: string }[] }) =>
      s.sticky_notes.map((n: { id: string }) => n.id)
    )

    // Fetch direct evidence with fetched_content
    const { data: allEvidenceData } = await supabase
      .from('evidence')
      .select('id, sticky_note_id, type, url, content, title, strength, fetched_content, fetch_status, fetched_at')
      .in('sticky_note_id', allNoteIds)

    const evidenceByNoteId = new Map<string, Array<{
      id: string
      type: string
      url: string | null
      content: string | null
      title: string | null
      strength: string | null
      fetched_content: string | null
      fetch_status: string | null
    }>>()

    ;(allEvidenceData || []).forEach((e) => {
      const existing = evidenceByNoteId.get(e.sticky_note_id) || []
      evidenceByNoteId.set(e.sticky_note_id, [...existing, e])
    })

    // Fetch note links
    const { data: noteLinks } = await supabase
      .from('sticky_note_links')
      .select('*')
      .or(`source_note_id.in.(${allNoteIds.join(',')}),target_note_id.in.(${allNoteIds.join(',')})`)

    // Fetch linked evidence_bank items WITH rich fields
    const { data: linkedEvidenceData } = await supabase
      .from('sticky_note_evidence_links')
      .select('sticky_note_id, evidence_bank:evidence_bank_id(*)')
      .in('sticky_note_id', allNoteIds)

    // Build linked evidence map with full evidence_bank fields
    const linkedEvidenceMap = new Map<string, LinkedEvidence[]>()

    ;(linkedEvidenceData || []).forEach((link: { sticky_note_id: string; evidence_bank: unknown }) => {
      const bank = link.evidence_bank as {
        id: string
        title: string
        url: string | null
        content: string | null
        fetched_content: string | null
        fetch_status: string | null
        source_system: string
        strength: string
        computed_strength: number
        segment: string | null
        has_direct_voice: boolean
        source_weight: number
        source_timestamp: string | null
        created_at: string
      } | null
      if (bank) {
        const existing = linkedEvidenceMap.get(link.sticky_note_id) || []
        linkedEvidenceMap.set(link.sticky_note_id, [...existing, {
          id: bank.id,
          title: bank.title,
          url: bank.url,
          content: bank.content,
          fetched_content: bank.fetched_content,
          fetch_status: bank.fetch_status,
          source_system: bank.source_system,
          strength: bank.strength,
          computed_strength: bank.computed_strength ?? 50,
          segment: bank.segment,
          has_direct_voice: bank.has_direct_voice ?? false,
          source_weight: bank.source_weight ?? 0.5,
          source_timestamp: bank.source_timestamp,
          created_at: bank.created_at,
        }])
      }
    })

    // Note content map for link resolution
    const noteMap = new Map<string, { content: string; section: string }>()
    session.sections.forEach((section: { name: string; sticky_notes: { id: string; content: string }[] }) => {
      section.sticky_notes.forEach((note: { id: string; content: string }) => {
        noteMap.set(note.id, { content: note.content, section: section.name })
      })
    })

    // ============================================
    // PRE-COMPUTE per-problem stats
    // ============================================
    const objectives = session.session_objectives.map((o: { content: string }) => o.content)
    const checklistItems = session.session_checklist_items.map((c: { content: string; is_checked: boolean }) => ({
      item: c.content,
      checked: c.is_checked,
    }))
    const constraints = session.session_constraints.map((sc: { constraints: { label: string; value: string | null } }) => ({
      label: sc.constraints.label,
      value: sc.constraints.value,
    }))

    const problemStatsList: ProblemStats[] = []

    session.sections.forEach((section: { name: string; sticky_notes: { id: string; content: string; has_evidence: boolean }[] }) => {
      section.sticky_notes.forEach((note: { id: string; content: string; has_evidence: boolean }) => {
        const linked = linkedEvidenceMap.get(note.id) || []
        // Also map direct evidence into LinkedEvidence shape
        const direct = (evidenceByNoteId.get(note.id) || []).map(e => ({
          id: e.id,
          title: e.title || 'Untitled',
          url: e.url,
          content: e.content,
          fetched_content: e.fetched_content,
          fetch_status: e.fetch_status,
          source_system: 'manual',
          strength: e.strength || 'medium',
          computed_strength: e.strength === 'high' ? 75 : e.strength === 'low' ? 25 : 50,
          segment: null,
          has_direct_voice: false,
          source_weight: 0.5,
          source_timestamp: null,
          created_at: new Date().toISOString(),
        }))
        const allEvidence = [...linked, ...direct]

        const stats = computeProblemStats(note.id, note.content, section.name, allEvidence)
        problemStatsList.push(stats)
      })
    })

    // Linked notes for context
    const linkedNotes: { from: { content: string; section: string }; to: { content: string; section: string } }[] = []
    ;(noteLinks || []).forEach((link: { source_note_id: string; target_note_id: string }) => {
      const source = noteMap.get(link.source_note_id)
      const target = noteMap.get(link.target_note_id)
      if (source && target) {
        linkedNotes.push({
          from: { content: source.content, section: source.section },
          to: { content: target.content, section: target.section },
        })
      }
    })

    // ============================================
    // BUILD PROMPT — v2 spec-aligned
    // ============================================

    const prompt = `You are an expert product discovery analyst. Analyze the session data below and return a structured JSON analysis.

=== SESSION CONTEXT ===
Title: ${session.title}
Date: ${new Date().toISOString().split('T')[0]}
Objectives (${objectives.length}): ${objectives.join(' | ')}

=== CONSTRAINTS (${constraints.length}) ===
${constraints.map((c: { label: string; value: string | null }) => `- ${c.label}: ${c.value || 'Not specified'}`).join('\n')}

=== CHECKLIST (${checklistItems.length}) ===
${checklistItems.map((c: { item: string; checked: boolean }) => `[${c.checked ? 'x' : ' '}] ${c.item}`).join('\n')}

=== PROBLEMS WITH PRE-COMPUTED STATS ===
The following problems have been pre-analyzed with ground-truth statistics from the evidence database.
DO NOT change the numeric values (strength %, source count, segments, voice flag). These are computed facts.
Your job is QUALITATIVE analysis: constraint checks, contradiction detection, gap identification, evidence summaries with quotes.

${problemStatsList.map((p, i) => {
  const evidenceDetails = p.evidenceItems.map(e => {
    const contentPreview = e.fetched_content
      ? e.fetched_content.substring(0, 2000)
      : e.content
        ? e.content.substring(0, 500)
        : e.url || 'No content'
    return `    - "${e.title}" (${e.source_system}, weight: ${e.source_weight}, strength: ${e.computed_strength})
      Content: ${contentPreview}`
  }).join('\n')

  return `
PROBLEM ${i + 1}: "${p.noteContent}"
  Section: ${p.sectionName}
  Aggregate Strength: ${p.aggregateStrength}% (${p.strengthBand})
  Sources: ${p.sourcesCount}
  Segments: ${p.segments.length > 0 ? p.segments.join(', ') : 'none'}
  Direct Voice: ${p.hasDirectVoice ? 'YES' : 'NO'}
  Evidence Age: ${p.evidenceAgeDays} days avg
${p.evidenceItems.length > 0 ? `  Evidence:\n${evidenceDetails}` : '  Evidence: NONE (assumption)'}`
}).join('\n---\n')}

=== LINKED NOTES ===
${linkedNotes.length > 0 ? linkedNotes.map(link => `- [${link.from.section}] "${link.from.content}" <-> [${link.to.section}] "${link.to.content}"`).join('\n') : 'No linked notes'}

=== ANALYSIS INSTRUCTIONS ===

Return a JSON object with these sections. Use the pre-computed stats as ground truth.

{
  "objectivesCheck": [
    {
      "text": "<objective text>",
      "addressed": <true if any problem addresses this objective>,
      "relevant_problems": ["<problem title>"]
    }
  ],

  "rankedProblems": [
    For EACH problem above, produce:
    {
      "title": "<problem content>",
      "evidence_summary": [
        { "quote": "<key quote or data point from evidence content>", "source": "<source title>", "weight": <source_weight> }
      ],
      "constraint_checks": [
        For EACH constraint, evaluate whether this problem's evidence satisfies it:
        { "constraint": "<constraint label>", "status": "<pass|fail|not_tested>", "note": "<brief explanation>" }
      ],
      "gaps": ["<what evidence is missing for this problem>"]
    }
  ],

  "constraintMatrix": [
    For EACH constraint, aggregate across all problems:
    {
      "constraint": "<constraint label>",
      "pass_count": <number of problems that pass>,
      "fail_count": <number that fail>,
      "not_tested": <number not tested>,
      "flagged_problems": ["<problems that fail this constraint>"]
    }
  ],

  "checklistReview": [
    For EACH checklist item:
    { "text": "<item text>", "status": "<met|not_met|partial>", "note": "<explanation>" }
  ],

  "contradictions": [
    { "type": "<evidence_conflict|source_disagreement|constraint_violation>", "description": "<what contradicts>", "affected_problems": ["<problem>"], "severity": "<high|medium|low>" }
  ],

  "nextSteps": [
    { "action": "<specific next action>", "reason": "<why this matters>", "priority": "<high|medium|low>" }
  ],

  "summary": "<2-3 sentence overall assessment>"
}

IMPORTANT:
- Only return valid JSON, no other text
- For rankedProblems, use the EXACT problem titles from the PROBLEM list above
- For evidence_summary quotes, extract ACTUAL quotes/data from the evidence content provided
- For constraint_checks, evaluate each constraint for each problem
- Do NOT invent or change the numeric stats (strength, sources, etc.) — those are pre-computed`

    // DEBUG modes
    const debugMode = request.headers.get('x-debug-evidence') === 'true'
    const debugPromptMode = request.headers.get('x-debug-prompt') === 'true'

    if (debugMode) {
      return NextResponse.json({
        debug: true,
        sessionId,
        problemCount: problemStatsList.length,
        problems: problemStatsList.map(p => ({
          content: p.noteContent,
          strength: p.aggregateStrength,
          band: p.strengthBand,
          sources: p.sourcesCount,
          hasVoice: p.hasDirectVoice,
        })),
      })
    }

    if (debugPromptMode) {
      return NextResponse.json({
        debug: true,
        debugType: 'prompt',
        sessionId,
        promptLength: prompt.length,
        promptPreview: prompt.substring(0, 1000),
        problemCount: problemStatsList.length,
      })
    }

    // ============================================
    // CALL CLAUDE
    // ============================================

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      messages: [
        { role: 'user', content: prompt }
      ],
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    let claudeAnalysis: Record<string, unknown>

    try {
      claudeAnalysis = JSON.parse(responseText)
    } catch {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        claudeAnalysis = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('Failed to parse analysis response')
      }
    }

    // ============================================
    // POST-PROCESSING: Merge pre-computed stats with Claude qualitative analysis
    // ============================================

    // Build the rankedProblems with ground-truth stats + Claude's qualitative fields
    const claudeProblems = (claudeAnalysis.rankedProblems || []) as Array<{
      title: string
      evidence_summary: Array<{ quote: string; source: string; weight: number }>
      constraint_checks: Array<{ constraint: string; status: string; note: string }>
      gaps: string[]
    }>

    // Match Claude's problem analysis back to our pre-computed stats
    const rankedProblems: SpecRankedProblem[] = problemStatsList
      .map(stats => {
        // Find matching Claude analysis (fuzzy match on title)
        const claudeMatch = claudeProblems.find(cp =>
          cp.title === stats.noteContent ||
          cp.title.toLowerCase().includes(stats.noteContent.toLowerCase().substring(0, 30)) ||
          stats.noteContent.toLowerCase().includes(cp.title.toLowerCase().substring(0, 30))
        )

        const constraintChecks = (claudeMatch?.constraint_checks || []).map(cc => ({
          constraint: cc.constraint,
          status: cc.status as 'pass' | 'fail' | 'not_tested',
          note: cc.note,
        }))

        // Compute recommendation using spec algorithm
        const constraintsPassed = constraintChecks.filter(cc => cc.status === 'pass').length
        const totalConstraintsTested = constraintChecks.filter(cc => cc.status !== 'not_tested').length
        const recommendation = getRecommendation(
          stats.aggregateStrength,
          stats.hasDirectVoice,
          constraintsPassed,
          totalConstraintsTested
        )

        return {
          title: stats.noteContent,
          strength_pct: Math.round(stats.aggregateStrength),
          band: stats.strengthBand,
          recommendation,
          sources_count: stats.sourcesCount,
          segments: stats.segments,
          has_direct_voice: stats.hasDirectVoice,
          evidence_age_days: stats.evidenceAgeDays,
          evidence_summary: claudeMatch?.evidence_summary || [],
          constraint_checks: constraintChecks,
          gaps: claudeMatch?.gaps || [],
        } satisfies SpecRankedProblem
      })
      .sort((a, b) => b.strength_pct - a.strength_pct)

    // Build constraint matrix from rankedProblems constraint checks
    const constraintMatrix = constraints.map((c: { label: string }) => {
      let passCount = 0
      let failCount = 0
      let notTested = 0
      const flaggedProblems: string[] = []

      rankedProblems.forEach(p => {
        const check = p.constraint_checks.find(cc => cc.constraint === c.label)
        if (!check || check.status === 'not_tested') {
          notTested++
        } else if (check.status === 'pass') {
          passCount++
        } else {
          failCount++
          flaggedProblems.push(p.title)
        }
      })

      return {
        constraint: c.label,
        pass_count: passCount,
        fail_count: failCount,
        not_tested: notTested,
        flagged_problems: flaggedProblems,
      }
    })

    // Build recommended actions from ranked problems
    const recommendedActions = rankedProblems.map(p => ({
      type: p.recommendation,
      problem: p.title,
      rationale: p.recommendation === 'COMMIT'
        ? `Strong evidence (${p.strength_pct}%) with direct voice and constraints passed`
        : p.recommendation === 'VALIDATE'
          ? `Moderate evidence (${p.strength_pct}%) — needs more validation`
          : `Weak evidence (${p.strength_pct}%) — park until more data available`,
    }))

    // Compute summary stats
    const problemsWithEvidence = problemStatsList.filter(p => p.sourcesCount > 0)
    const evidenceCoveragePct = problemStatsList.length > 0
      ? Math.round((problemsWithEvidence.length / problemStatsList.length) * 100)
      : 0
    const voiceCoveragePct = problemStatsList.length > 0
      ? Math.round((problemStatsList.filter(p => p.hasDirectVoice).length / problemStatsList.length) * 100)
      : 0
    const totalConstraintChecks = constraintMatrix.reduce((s: number, c: { pass_count: number; fail_count: number }) => s + c.pass_count + c.fail_count, 0)
    const totalPasses = constraintMatrix.reduce((s: number, c: { pass_count: number }) => s + c.pass_count, 0)
    const constraintPassRate = totalConstraintChecks > 0 ? Math.round((totalPasses / totalConstraintChecks) * 100) : 100

    const topRisk = rankedProblems.length > 0
      ? rankedProblems.find(p => p.recommendation === 'PARK')?.title || rankedProblems[rankedProblems.length - 1].title
      : 'No problems identified'

    const avgStrength = problemStatsList.length > 0
      ? Math.round(problemStatsList.reduce((s, p) => s + p.aggregateStrength, 0) / problemStatsList.length)
      : 0

    // Build final v2 analysis object
    const specAnalysis: SpecAnalysisData = {
      spec_version: 2,
      sessionHeader: {
        title: session.title,
        date: new Date().toISOString().split('T')[0],
        objective_count: objectives.length,
        problem_count: problemStatsList.length,
        total_evidence: problemStatsList.reduce((s, p) => s + p.sourcesCount, 0),
        avg_strength: avgStrength,
      },
      summaryStats: {
        evidence_coverage_pct: evidenceCoveragePct,
        voice_coverage_pct: voiceCoveragePct,
        constraint_pass_rate: constraintPassRate,
        top_risk: topRisk,
      },
      objectivesCheck: ((claudeAnalysis.objectivesCheck || []) as Array<{ text: string; addressed: boolean; relevant_problems: string[] }>).map(o => ({
        text: o.text,
        addressed: o.addressed,
        relevant_problems: o.relevant_problems || [],
      })),
      rankedProblems,
      constraintMatrix,
      checklistReview: ((claudeAnalysis.checklistReview || []) as Array<{ text: string; status: string; note: string }>).map(c => ({
        text: c.text,
        status: c.status as 'met' | 'not_met' | 'partial',
        note: c.note,
      })),
      contradictions: ((claudeAnalysis.contradictions || []) as Array<{ type: string; description: string; affected_problems: string[]; severity: string }>).map(c => ({
        type: c.type,
        description: c.description,
        affected_problems: c.affected_problems || [],
        severity: c.severity as 'high' | 'medium' | 'low',
      })),
      recommendedActions,
      nextSteps: ((claudeAnalysis.nextSteps || []) as Array<{ action: string; reason: string; priority: string }>).map(n => ({
        action: n.action,
        reason: n.reason,
        priority: n.priority as 'high' | 'medium' | 'low',
      })),
    }

    const summary = (claudeAnalysis.summary as string) || ''

    // ============================================
    // SAVE TO DATABASE
    // ============================================

    const { data: savedAnalysis, error: saveError } = await supabase
      .from('session_analyses')
      .insert({
        session_id: sessionId,
        objective_score: avgStrength,
        summary: summary,
        raw_response: specAnalysis as unknown as Record<string, unknown>,
      })
      .select()
      .single()

    if (saveError) {
      console.error('Failed to save analysis:', saveError)
      return NextResponse.json({ error: 'Failed to save analysis' }, { status: 500 })
    }

    // Update session status
    await supabase
      .from('sessions')
      .update({ status: 'completed' })
      .eq('id', sessionId)

    return NextResponse.json({
      success: true,
      analysisId: savedAnalysis.id,
      analysis: {
        ...specAnalysis,
        id: savedAnalysis.id,
        session_id: sessionId,
        created_at: savedAnalysis.created_at,
        summary,
        sessionTitle: session.title,
      },
    })
  } catch (error) {
    console.error('Analysis error:', error)
    return NextResponse.json(
      { error: 'Analysis failed' },
      { status: 500 }
    )
  }
}
