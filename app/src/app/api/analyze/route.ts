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

    const { data: noteLinks } = await supabase
      .from('sticky_note_links')
      .select('*')
      .or(`source_note_id.in.(${allNoteIds.join(',')}),target_note_id.in.(${allNoteIds.join(',')})`)

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

    const stickyNotes = session.sections.flatMap((section: { name: string; sticky_notes: { id: string; content: string; has_evidence: boolean; evidence: { type: string; url: string | null; content: string | null; title: string | null; strength: string | null }[] }[] }) =>
      section.sticky_notes.map((note: { id: string; content: string; has_evidence: boolean; evidence: { type: string; url: string | null; content: string | null; title: string | null; strength: string | null }[] }) => ({
        id: note.id,
        section: section.name,
        content: note.content,
        hasEvidence: note.has_evidence,
        evidence: note.evidence.map((e: { type: string; url: string | null; content: string | null; title: string | null; strength: string | null }) => ({
          type: e.type,
          source: e.type === 'url' ? e.url : e.content,
          title: e.title,
          strength: e.strength || 'medium',
        })),
      }))
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
${stickyNotes.map((note: { section: string; content: string; hasEvidence: boolean; evidence: { type: string; source: string | null; title: string | null; strength: string }[] }) => `
[${note.section}] ${note.hasEvidence ? '🟢 EVIDENCE-BACKED' : '🟡 ASSUMPTION'}
Content: ${note.content}
${note.evidence.length > 0 ? `Evidence: ${note.evidence.map((e: { title: string | null; source: string | null; strength: string }) => `${e.title || e.source} (Strength: ${e.strength.toUpperCase()})`).join(', ')}` : ''}
`).join('\n')}

LINKED NOTES (Related Concepts):
${linkedNotes.length > 0 ? linkedNotes.map((link: { from: { content: string; section: string }; to: { content: string; section: string } }) => `- [${link.from.section}] "${link.from.content}" ↔ [${link.to.section}] "${link.to.content}"`).join('\n') : 'No linked notes'}

EVIDENCE STRENGTH GUIDE:
- HIGH: Customer interviews, user research, analytics data, A/B test results (most reliable)
- MEDIUM: Surveys, support tickets, competitor analysis (moderately reliable)
- LOW: Anecdotal feedback, assumptions, internal opinions (least reliable)

Consider evidence strength when assessing confidence levels - items backed by HIGH strength evidence should have higher confidence than those with only LOW strength evidence.

Provide your analysis in the following JSON format:
{
  "objective_score": <0-100 score on how well objectives were addressed>,
  "summary": "<2-3 sentence overall summary>",
  "assumptions": [
    {"content": "<assumption>", "section": "<section name>"}
  ],
  "evidence_backed": [
    {"content": "<evidence-backed item>", "section": "<section name>", "evidence_summary": "<brief description of evidence>"}
  ],
  "validation_recommendations": [
    {
      "item": "<item needing validation>",
      "confidence": "<low/medium/high>",
      "reason": "<why it needs validation>",
      "method": "<suggested validation method>",
      "questions": ["<question 1>", "<question 2>"]
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
