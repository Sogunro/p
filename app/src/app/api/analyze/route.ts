import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

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

        // Check if feed is enabled and last fetch was more than 24 hours ago
        if (settings?.feed_enabled) {
          const lastFetch = settings.last_fetch_at ? new Date(settings.last_fetch_at) : null
          const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

          if (!lastFetch || lastFetch < oneDayAgo) {
            return NextResponse.json({
              error: 'evidence_stale',
              message: 'Evidence has not been fetched recently. Would you like to proceed anyway or fetch latest insights first?',
              lastFetchAt: settings.last_fetch_at,
            }, { status: 428 }) // 428 Precondition Required
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

    // Fetch sticky note links for relationship analysis
    const allNoteIds = session.sections.flatMap((s: { sticky_notes: { id: string }[] }) =>
      s.sticky_notes.map((n: { id: string }) => n.id)
    )

    // Fetch evidence separately to ensure we get fetched_content columns
    // This is more reliable than nested query which may not return new columns
    const { data: allEvidenceData } = await supabase
      .from('evidence')
      .select('id, sticky_note_id, type, url, content, title, strength, fetched_content, fetch_status, fetched_at')
      .in('sticky_note_id', allNoteIds)

    // Create a map of sticky_note_id to evidence items
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

    // DEBUG: Return evidence info instead of running analysis (temporary)
    const debugMode = request.headers.get('x-debug-evidence') === 'true'
    const debugPromptMode = request.headers.get('x-debug-prompt') === 'true'
    if (debugMode) {
      const evidenceDebug = (allEvidenceData || []).map(e => ({
        id: e.id,
        sticky_note_id: e.sticky_note_id,
        type: e.type,
        url: e.url?.substring(0, 50),
        fetch_status: e.fetch_status,
        has_fetched_content: !!e.fetched_content,
        fetched_content_preview: e.fetched_content?.substring(0, 100),
      }))

      return NextResponse.json({
        debug: true,
        sessionId,
        allNoteIds,
        evidenceCount: allEvidenceData?.length || 0,
        evidenceItems: evidenceDebug,
        message: 'Debug mode - showing evidence data without running analysis'
      })
    }

    console.log('=== EVIDENCE FETCH DEBUG ===')
    console.log(`Total evidence items fetched: ${allEvidenceData?.length || 0}`)
    console.log(`Sticky notes with evidence: ${evidenceByNoteId.size}`)
    ;(allEvidenceData || []).forEach((e, i) => {
      console.log(`  ${i + 1}. note_id: ${e.sticky_note_id}, fetch_status: ${e.fetch_status}, has_content: ${!!e.fetched_content}`)
    })
    console.log('=== END EVIDENCE FETCH DEBUG ===')

    const { data: noteLinks } = await supabase
      .from('sticky_note_links')
      .select('*')
      .or(`source_note_id.in.(${allNoteIds.join(',')}),target_note_id.in.(${allNoteIds.join(',')})`)

    // Fetch linked evidence_bank items with fetched content
    const { data: linkedEvidenceData } = await supabase
      .from('sticky_note_evidence_links')
      .select('sticky_note_id, evidence_bank:evidence_bank_id(*)')
      .in('sticky_note_id', allNoteIds)

    // Create a map of note IDs to their linked evidence bank items
    const linkedEvidenceMap = new Map<string, Array<{
      id: string
      title: string
      url: string | null
      content: string | null
      fetched_content: string | null
      fetch_status: string | null
      source_system: string
      strength: string
    }>>()

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
      } | null
      if (bank) {
        const existing = linkedEvidenceMap.get(link.sticky_note_id) || []
        linkedEvidenceMap.set(link.sticky_note_id, [...existing, bank])
      }
    })

    // Create a map of note IDs to their content for link resolution
    const noteMap = new Map<string, { content: string; section: string }>()
    session.sections.forEach((section: { name: string; sticky_notes: { id: string; content: string }[] }) => {
      section.sticky_notes.forEach((note: { id: string; content: string }) => {
        noteMap.set(note.id, { content: note.content, section: section.name })
      })
    })

    // Prepare data for analysis
    const objectives = session.session_objectives.map((o: { content: string }) => o.content)
    const checklistItems = session.session_checklist_items.map((c: { content: string; is_checked: boolean }) => ({
      item: c.content,
      checked: c.is_checked,
    }))
    const constraints = session.session_constraints.map((sc: { constraints: { label: string; value: string | null } }) => ({
      label: sc.constraints.label,
      value: sc.constraints.value,
    }))

    const stickyNotes = session.sections.flatMap((section: { name: string; sticky_notes: { id: string; content: string; has_evidence: boolean }[] }) =>
      section.sticky_notes.map((note: { id: string; content: string; has_evidence: boolean }) => {
        // Get linked evidence from evidence_bank (with fetched content)
        const linkedEvidence = linkedEvidenceMap.get(note.id) || []
        // Get direct evidence from separate query (ensures fetched_content is included)
        const directEvidenceItems = evidenceByNoteId.get(note.id) || []

        return {
          id: note.id,
          section: section.name,
          content: note.content,
          hasEvidence: note.has_evidence || linkedEvidence.length > 0 || directEvidenceItems.length > 0,
          // Direct evidence from separate query (ensures fetched_content columns are included)
          directEvidence: directEvidenceItems.map((e) => ({
            type: e.type,
            url: e.url,
            content: e.content,
            title: e.title,
            strength: e.strength || 'medium',
            fetched_content: e.fetched_content,
            fetch_status: e.fetch_status,
          })),
          // Linked evidence from evidence_bank with fetched content
          linkedEvidence: linkedEvidence.map(e => ({
            title: e.title,
            url: e.url,
            source_system: e.source_system,
            strength: e.strength || 'medium',
            fetch_status: e.fetch_status,
            // This is the key - include fetched content if available
            fetched_content: e.fetched_content,
            original_content: e.content,
          })),
        }
      })
    )

    // Process note links into readable format
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

    // Extract vision, budget, timeline from constraints for strategic alignment
    const visionConstraint = constraints.find((c: { label: string }) => c.label.toLowerCase().includes('vision'))
    const budgetConstraint = constraints.find((c: { label: string }) => c.label.toLowerCase().includes('budget'))
    const timelineConstraint = constraints.find((c: { label: string }) => c.label.toLowerCase().includes('timeline'))

    const prompt = `You are an expert product discovery analyst. Analyze the session data below and provide a COMPREHENSIVE analysis following ALL 10 capabilities from the Product Discovery Framework.

=== SESSION CONTEXT ===
Title: ${session.title}
Objectives: ${objectives.join(', ')}

=== CONSTRAINTS ===
${constraints.map((c: { label: string; value: string | null }) => `- ${c.label}: ${c.value || 'Not specified'}`).join('\n')}
Product Vision: ${visionConstraint?.value || 'Not specified'}
Budget: ${budgetConstraint?.value || 'Not specified'}
Timeline: ${timelineConstraint?.value || 'Not specified'}

=== CHECKLIST STATUS ===
${checklistItems.map((c: { item: string; checked: boolean }) => `[${c.checked ? 'x' : ' '}] ${c.item}`).join('\n')}

=== STICKY NOTES (CARDS) ===
${stickyNotes.map((note: {
  section: string
  content: string
  hasEvidence: boolean
  directEvidence: { type: string; url: string | null; content: string | null; title: string | null; strength: string; fetched_content: string | null; fetch_status: string | null }[]
  linkedEvidence: { title: string; url: string | null; source_system: string; strength: string; fetch_status: string | null; fetched_content: string | null; original_content: string | null }[]
}) => {
  const totalEvidence = note.directEvidence.length + note.linkedEvidence.length
  const directFetchedCount = note.directEvidence.filter(e => e.fetch_status === 'fetched').length
  const linkedFetchedCount = note.linkedEvidence.filter(e => e.fetch_status === 'fetched').length
  const totalFetchedCount = directFetchedCount + linkedFetchedCount

  return `
[SECTION: ${note.section}]
${note.hasEvidence ? '🟢 EVIDENCE-BACKED' : '🟡 ASSUMPTION'}
CONTENT: "${note.content}"
EVIDENCE COUNT: ${totalEvidence} sources${totalFetchedCount > 0 ? `, ${totalFetchedCount} with fetched content` : ''}
${note.directEvidence.length > 0 ? `
EVIDENCE DETAILS:
${note.directEvidence.map((e, i) => `
  ${i + 1}. "${e.title || 'Untitled'}" (${e.type}, Strength: ${e.strength.toUpperCase()})
  ${e.fetch_status === 'fetched' && e.fetched_content ? `
  FETCHED CONTENT:
  ---
  ${e.fetched_content.substring(0, 3000)}${e.fetched_content.length > 3000 ? '...[truncated]' : ''}
  ---` : e.type === 'url' ? `URL: ${e.url}` : `Content: ${e.content?.substring(0, 300)}...`}
`).join('')}` : ''}
${note.linkedEvidence.length > 0 ? `
LINKED EVIDENCE:
${note.linkedEvidence.map((e, i) => `
  ${i + 1}. "${e.title}" (${e.source_system}, Strength: ${e.strength.toUpperCase()})
  ${e.fetch_status === 'fetched' && e.fetched_content ? `
  FETCHED CONTENT:
  ---
  ${e.fetched_content.substring(0, 3000)}${e.fetched_content.length > 3000 ? '...[truncated]' : ''}
  ---` : e.url ? `URL: ${e.url}` : `Content: ${e.original_content?.substring(0, 300)}...`}
`).join('')}` : ''}
`
}).join('\n---\n')}

=== LINKED NOTES (Related Concepts) ===
${linkedNotes.length > 0 ? linkedNotes.map((link: { from: { content: string; section: string }; to: { content: string; section: string } }) => `- [${link.from.section}] "${link.from.content}" ↔ [${link.to.section}] "${link.to.content}"`).join('\n') : 'No linked notes'}

=== ANALYSIS INSTRUCTIONS ===

You MUST perform ALL 10 analysis capabilities from the Product Discovery Framework:

**CLASSIFICATION RULES (MANDATORY):**
- 🟢 EVIDENCE-BACKED items → MUST go in "problems_strongly_validated" OR "problems_with_preliminary_evidence"
- 🟡 ASSUMPTION items → MUST go in "problems_assumed"
- NEVER put items with evidence in the assumed category

**CONFIDENCE SCORING:**
- 3+ evidence sources OR quantitative data → "problems_strongly_validated" (confidence 0.6-0.95)
- 1-2 evidence sources → "problems_with_preliminary_evidence" (confidence 0.3-0.6)
- No evidence → "problems_assumed" (confidence 0.1-0.3)

**EVIDENCE QUALITY ASSESSMENT:**
Strong Evidence (High Confidence): Multiple independent sources (3+), mix of types (interviews + analytics + support), numbers/data, behavioral evidence
Weak Evidence (Low Confidence): Single source, opinions only, no data, vague statements
No Evidence (Assumption): Nothing attached, just an idea

Return a JSON object with ALL of these sections:

{
  "objective_score": <0-100>,
  "summary": "<2-3 sentence overview>",

  "session_diagnosis": {
    "overall_quality": "<good | fair | poor>",
    "evidence_maturity": "<high | medium | low>",
    "session_nature": "<validated | hybrid | assumption-heavy>",
    "key_strengths": ["<strength 1>", "<strength 2>"],
    "key_gaps": ["<gap 1>", "<gap 2>"],
    "readiness_to_build": "<ready | needs_validation | not_ready>"
  },

  "evidence_assessment": {
    "total_sources": <number>,
    "source_types": ["interview", "analytics", "support_ticket", "user_feedback"],
    "quality_breakdown": {
      "strong": <count with 3+ sources or quantitative data>,
      "weak": <count with 1-2 sources>,
      "none": <count with no evidence>
    },
    "evidence_quality_score": <0-100>
  },

  "problems_strongly_validated": [
    {
      "content": "<problem>",
      "section": "<section>",
      "confidence": <0.6-0.95>,
      "evidence_summary": "<summary of supporting evidence>",
      "sources_count": <number>,
      "key_quotes": ["<quote from evidence>"],
      "user_impact": "<high/medium/low>"
    }
  ],
  "problems_with_preliminary_evidence": [
    {
      "content": "<problem>",
      "section": "<section>",
      "confidence": <0.3-0.6>,
      "current_evidence": "<what we have>",
      "validation_needed": "<what's missing>",
      "suggested_research": "<specific research recommendation>"
    }
  ],
  "problems_assumed": [
    {
      "content": "<assumption>",
      "section": "<section>",
      "confidence": <0.1-0.3>,
      "validation_strategy": "<how to validate>",
      "research_questions": ["<question 1>", "<question 2>"],
      "risk_if_wrong": "<consequence of invalid assumption>"
    }
  ],

  "strategic_alignment": {
    "vision_alignment_score": <0-100>,
    "vision_alignment_explanation": "<how problems align with vision>",
    "goals_coverage": [
      {
        "goal": "<strategic goal from constraints>",
        "impact": "<high/medium/low/none>",
        "problems_addressed": ["<problem content>"]
      }
    ],
    "kpi_impact": [
      {
        "kpi": "<KPI name>",
        "estimated_impact": "<e.g., 'NPS -12 points', 'Churn +8%'>",
        "confidence": "<high/medium/low>"
      }
    ],
    "overall_alignment_score": <0-100>
  },

  "solutions_analysis": [
    {
      "solution": "<solution content>",
      "problem_solved": "<which problem this addresses>",
      "recommendation": "<BUILD_NOW | VALIDATE_FIRST | DEFER | BLOCKED>",
      "budget_fit": "<within_budget | exceeds_by_X | tight>",
      "timeline_fit": "<fits | needs_X_extra_weeks>",
      "tech_feasibility": "<uses_existing | requires_new_capability>",
      "guardrails_check": "<compliant | violates_X>",
      "reasoning": "<why this recommendation>"
    }
  ],

  "checklist_review": [
    {
      "item": "<checklist item>",
      "status": "<met | partially | not_met | cannot_auto_check>",
      "auto_checked": true,
      "notes": "<explanation of status>"
    }
  ],

  "pattern_detection": {
    "shared_evidence": [
      {
        "evidence_title": "<evidence that supports multiple problems>",
        "used_by_problems": ["<problem 1>", "<problem 2>"]
      }
    ],
    "convergent_patterns": [
      {
        "pattern": "<what multiple sources are pointing to>",
        "source_count": <number>,
        "sources": ["<source types>"],
        "confidence_boost": "<increases confidence because...>"
      }
    ],
    "contradictions": [
      {
        "issue": "<where sources contradict>",
        "sources_conflicting": ["<source 1>", "<source 2>"],
        "resolution_needed": "<how to resolve>"
      }
    ],
    "evidence_gaps": ["<type of evidence missing>"]
  },

  "priority_ranking": [
    {
      "rank": 1,
      "item": "<problem or solution>",
      "type": "<problem | solution>",
      "total_score": <0-100>,
      "score_breakdown": {
        "evidence_strength": <0-25>,
        "user_impact": <0-25>,
        "strategic_alignment": <0-25>,
        "frequency_mentioned": <0-25>
      },
      "why_this_rank": "<transparent explanation>"
    }
  ],

  "next_steps": {
    "build_now": [
      {
        "action": "<what to build>",
        "reason": "<why high confidence>",
        "which_solutions": ["<solution content>"]
      }
    ],
    "validate_first": [
      {
        "action": "<what to validate>",
        "method": "<specific method: survey, interview, analytics>",
        "sample_size": "<recommended sample>",
        "questions": ["<specific questions to answer>"],
        "timeline": "<estimated time to validate>"
      }
    ],
    "defer": [
      {
        "item": "<what to defer>",
        "reason": "<why defer: budget, timeline, off-strategy>",
        "revisit_when": "<condition to revisit>"
      }
    ]
  },

  "conflicts": [
    {
      "type": "<budget_exceeded | timeline_exceeded | off_strategy | evidence_weak | guardrail_violation>",
      "item": "<what's in conflict>",
      "details": "<specific numbers or explanation>",
      "suggestion": "<alternative approach or action>"
    }
  ],

  "hypotheses": [
    {
      "for_problem": "<problem content>",
      "hypothesis": {
        "if": "<IF we do this>",
        "then": "<THEN this outcome>",
        "because": "<BECAUSE evidence suggests>"
      },
      "research_questions": ["<specific question 1>", "<specific question 2>"],
      "success_criteria": "<what would prove this hypothesis>",
      "sample_size_recommendation": "<how many users/data points needed>"
    }
  ],

  "validation_recommendations": [
    {
      "item": "<item needing validation>",
      "confidence": "<low | medium | high>",
      "reason": "<why it needs validation>",
      "method": "<survey | interview | analytics | prototype_test | A_B_test>",
      "questions": ["<question 1>", "<question 2>"],
      "success_criteria": "<what would validate this>",
      "sample_size": "<recommended sample>"
    }
  ],

  "constraint_analysis": [
    {
      "constraint": "<constraint name>",
      "status": "<aligned | warning | conflict>",
      "notes": "<explanation>"
    }
  ]
}

IMPORTANT: Only return valid JSON, no other text. Use the FETCHED CONTENT when analyzing evidence quality - extract quotes, numbers, and specific user behaviors.`

    // DEBUG: Return the prompt without running analysis
    if (debugPromptMode) {
      // Count evidence in the prompt
      const evidenceInPrompt = stickyNotes.reduce((count: number, note: { directEvidence: { fetch_status: string | null; fetched_content: string | null }[]; linkedEvidence: { fetch_status: string | null; fetched_content: string | null }[] }) => {
        const directFetched = note.directEvidence.filter(e => e.fetch_status === 'fetched' && e.fetched_content).length
        const linkedFetched = note.linkedEvidence.filter(e => e.fetch_status === 'fetched' && e.fetched_content).length
        return count + directFetched + linkedFetched
      }, 0)

      return NextResponse.json({
        debug: true,
        debugType: 'prompt',
        sessionId,
        promptLength: prompt.length,
        promptPreview: prompt.substring(0, 500) + '...',
        promptMiddle: prompt.substring(Math.floor(prompt.length / 2) - 500, Math.floor(prompt.length / 2) + 500),
        evidenceWithFetchedContentInPrompt: evidenceInPrompt,
        stickyNotesWithEvidence: stickyNotes.filter((n: { directEvidence: unknown[]; linkedEvidence: unknown[] }) => n.directEvidence.length > 0 || n.linkedEvidence.length > 0).length,
        totalStickyNotes: stickyNotes.length,
        // Show the part of prompt that should contain evidence
        evidenceSection: prompt.includes('FETCHED CONTENT:') ? 'Found FETCHED CONTENT sections' : 'NO FETCHED CONTENT sections found',
        message: 'Debug mode - showing prompt without running analysis'
      })
    }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        { role: 'user', content: prompt }
      ],
    })

    // Parse the response
    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    let analysis

    try {
      analysis = JSON.parse(responseText)
    } catch {
      // If JSON parsing fails, try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('Failed to parse analysis response')
      }
    }

    // Map the new AI response format to database columns
    // The AI returns: problems_assumed, problems_strongly_validated, problems_with_preliminary_evidence
    // The database expects: assumptions, evidence_backed
    //
    // IMPORTANT: Items WITH evidence (🟢) go to evidence_backed
    //            Items WITHOUT evidence (🟡) go to assumptions
    //            This is the MANDATORY classification rule from the reference document.

    // Tier 3 ONLY: Pure assumptions (NO evidence attached)
    const mappedAssumptions = (analysis.problems_assumed || []).map((p: { content: string; section: string; validation_strategy?: string; research_questions?: string[]; risk_if_wrong?: string }) => ({
      content: p.content,
      section: p.section,
      confidence_tier: 'assumed',
      validation_strategy: p.validation_strategy,
      research_questions: p.research_questions,
      risk_if_wrong: p.risk_if_wrong,
    }))

    // Tier 1 + Tier 2: ALL items with evidence attached
    const mappedEvidenceBacked = [
      // Tier 1: Strongly validated (3+ sources, confidence 0.6-0.95)
      ...(analysis.problems_strongly_validated || []).map((p: { content: string; section: string; evidence_summary?: string; confidence?: number; sources_count?: number; key_quotes?: string[]; user_impact?: string }) => ({
        content: p.content,
        section: p.section,
        evidence_summary: p.evidence_summary || '',
        confidence: p.confidence,
        sources_count: p.sources_count,
        confidence_tier: 'validated',
        key_quotes: p.key_quotes,
        user_impact: p.user_impact,
      })),
      // Tier 2: Preliminary evidence (1-2 sources, confidence 0.3-0.6) - MOVED HERE FROM ASSUMPTIONS
      ...(analysis.problems_with_preliminary_evidence || []).map((p: { content: string; section: string; confidence?: number; current_evidence?: string; validation_needed?: string; suggested_research?: string }) => ({
        content: p.content,
        section: p.section,
        evidence_summary: p.current_evidence || '',
        confidence: p.confidence,
        confidence_tier: 'preliminary',
        validation_needed: p.validation_needed,
        suggested_research: p.suggested_research,
      })),
    ]

    // Save analysis to database with all analysis fields
    const { data: savedAnalysis, error: saveError } = await supabase
      .from('session_analyses')
      .insert({
        session_id: sessionId,
        objective_score: analysis.objective_score,
        summary: analysis.summary,
        // Map new AI response format to database columns
        assumptions: mappedAssumptions,
        evidence_backed: mappedEvidenceBacked,
        validation_recommendations: analysis.validation_recommendations,
        constraint_analysis: analysis.constraint_analysis,
        checklist_review: analysis.checklist_review,
        // New comprehensive analysis fields (requires migration)
        session_diagnosis: analysis.session_diagnosis || null,
        evidence_assessment: analysis.evidence_assessment || null,
        strategic_alignment: analysis.strategic_alignment || null,
        solutions_analysis: analysis.solutions_analysis || null,
        pattern_detection: analysis.pattern_detection || null,
        priority_ranking: analysis.priority_ranking || null,
        next_steps: analysis.next_steps || null,
        hypotheses: analysis.hypotheses || null,
        conflicts: analysis.conflicts || null,
        raw_response: message,
      })
      .select()
      .single()

    if (saveError) {
      console.error('Failed to save analysis:', saveError)
      return NextResponse.json({ error: 'Failed to save analysis' }, { status: 500 })
    }

    // Update session status to completed
    await supabase
      .from('sessions')
      .update({ status: 'completed' })
      .eq('id', sessionId)

    return NextResponse.json({ success: true, analysisId: savedAnalysis.id })
  } catch (error) {
    console.error('Analysis error:', error)
    return NextResponse.json(
      { error: 'Analysis failed' },
      { status: 500 }
    )
  }
}
