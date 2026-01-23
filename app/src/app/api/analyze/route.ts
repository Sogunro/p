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

    const prompt = `You are a product discovery expert analyzing a discovery session. Analyze the following session data and provide a structured assessment.

SESSION OBJECTIVES:
${objectives.map((o: string, i: number) => `${i + 1}. ${o}`).join('\n')}

CONSTRAINTS:
${constraints.map((c: { label: string; value: string | null }) => `- ${c.label}: ${c.value || 'Not specified'}`).join('\n')}

CHECKLIST STATUS:
${checklistItems.map((c: { item: string; checked: boolean }) => `- [${c.checked ? 'x' : ' '}] ${c.item}`).join('\n')}

STICKY NOTES BY SECTION:
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
[${note.section}] ${note.hasEvidence ? '🟢 EVIDENCE-BACKED' : '🟡 ASSUMPTION'}
Content: ${note.content}
${totalEvidence > 0 ? `
EVIDENCE ATTACHED (${totalEvidence} sources${totalFetchedCount > 0 ? `, ${totalFetchedCount} with fetched content` : ''}):
${note.directEvidence.map((e, i) => `
  ${i + 1}. "${e.title || 'Untitled'}" (${e.type}, Strength: ${e.strength.toUpperCase()})
     ${e.fetch_status === 'fetched' && e.fetched_content ? `
     FETCHED CONTENT:
     ---
     ${e.fetched_content.substring(0, 2000)}${e.fetched_content.length > 2000 ? '...[truncated]' : ''}
     ---
     ` : e.type === 'url' ? `URL: ${e.url}${e.fetch_status !== 'fetched' ? ' (NOT FETCHED)' : ''}` : `Content: ${e.content?.substring(0, 200)}...`}
`).join('')}
${note.linkedEvidence.map((e, i) => `
  ${note.directEvidence.length + i + 1}. "${e.title}" (${e.source_system}, Strength: ${e.strength.toUpperCase()})
     ${e.fetch_status === 'fetched' && e.fetched_content ? `
     FETCHED CONTENT:
     ---
     ${e.fetched_content.substring(0, 2000)}${e.fetched_content.length > 2000 ? '...[truncated]' : ''}
     ---
     ` : e.url ? `URL: ${e.url} (NOT FETCHED)` : `Content: ${e.original_content?.substring(0, 200)}...`}
`).join('')}
` : ''}
`
}).join('\n')}

LINKED NOTES (Related Concepts):
${linkedNotes.length > 0 ? linkedNotes.map((link: { from: { content: string; section: string }; to: { content: string; section: string } }) => `- [${link.from.section}] "${link.from.content}" ↔ [${link.to.section}] "${link.to.content}"`).join('\n') : 'No linked notes'}

EVIDENCE QUALITY FRAMEWORK:
- HIGH QUALITY (0.7-0.95 confidence): 3+ independent sources, quantitative data, behavioral evidence
- MEDIUM QUALITY (0.4-0.6): 1-2 sources, some quantification or specific examples
- LOW QUALITY (0.2-0.4): Single anecdotal source, no quantification
- NO EVIDENCE (0.1-0.3): Pure assumption, no evidence attached

IMPORTANT: When fetched content is available, analyze the ACTUAL CONTENT to assess evidence quality. Look for:
- Specific quotes and examples
- Numbers and metrics
- Multiple people reporting similar issues
- Behavioral data vs opinions

ANALYSIS INSTRUCTIONS:
1. Assess evidence quality for each card using the framework above
2. Classify problems into 3 tiers by evidence strength:
   - TIER 1 (Strongly Validated): Confidence 0.6-1.0, multiple independent sources
   - TIER 2 (Preliminary Evidence): Confidence 0.3-0.6, 1-2 sources, needs validation
   - TIER 3 (Assumptions): Confidence 0-0.3, no evidence, validate first
3. Score strategic alignment against constraints
4. For items needing validation, provide specific validation strategies

Provide your analysis in the following JSON format:
{
  "objective_score": <0-100 score on how well objectives were addressed>,
  "summary": "<2-3 sentence overall summary>",
  "session_diagnosis": {
    "overall_quality": "<excellent/good/fair/poor>",
    "evidence_maturity": "<strong/medium/weak>",
    "key_strengths": ["<strength 1>", "<strength 2>"],
    "key_gaps": ["<gap 1>", "<gap 2>"]
  },
  "problems_strongly_validated": [
    {
      "content": "<problem>",
      "section": "<section>",
      "confidence": <0.6-1.0>,
      "evidence_summary": "<what evidence supports this>",
      "sources_count": <number>
    }
  ],
  "problems_with_preliminary_evidence": [
    {
      "content": "<problem>",
      "section": "<section>",
      "confidence": <0.3-0.6>,
      "current_evidence": "<what we have>",
      "validation_needed": "<what's missing>"
    }
  ],
  "problems_assumed": [
    {
      "content": "<assumption>",
      "section": "<section>",
      "confidence": <0.1-0.3>,
      "validation_strategy": "<how to validate>",
      "research_questions": ["<question 1>", "<question 2>"]
    }
  ],
  "validation_recommendations": [
    {
      "item": "<item needing validation>",
      "confidence": "<low/medium/high>",
      "reason": "<why it needs validation>",
      "method": "<suggested validation method>",
      "questions": ["<question 1>", "<question 2>"],
      "success_criteria": "<what would prove this>",
      "sample_size": "<recommended sample size>"
    }
  ],
  "constraint_analysis": [
    {"constraint": "<constraint name>", "status": "<aligned/warning/conflict>", "notes": "<explanation>"}
  ],
  "checklist_review": [
    {"item": "<checklist item>", "status": "<met/partially/not_met>", "notes": "<explanation>"}
  ]
}

Only return valid JSON, no other text.`

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

    // Save analysis to database
    const { data: savedAnalysis, error: saveError } = await supabase
      .from('session_analyses')
      .insert({
        session_id: sessionId,
        objective_score: analysis.objective_score,
        summary: analysis.summary,
        assumptions: analysis.assumptions,
        evidence_backed: analysis.evidence_backed,
        validation_recommendations: analysis.validation_recommendations,
        constraint_analysis: analysis.constraint_analysis,
        checklist_review: analysis.checklist_review,
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
