import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST: Backfill orphaned evidence items into evidence_bank
// Finds evidence items (on sticky notes) that don't have corresponding evidence_bank entries
// Creates evidence_bank entries and links them
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

    // Get all sessions for this user (sessions may have null workspace_id)
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id')
      .eq('user_id', user.id)

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({ message: 'No sessions found for user', backfilled: 0 })
    }

    const sessionIds = sessions.map(s => s.id)

    // Get all sections for these sessions
    const { data: sections } = await supabase
      .from('sections')
      .select('id')
      .in('session_id', sessionIds)

    if (!sections || sections.length === 0) {
      return NextResponse.json({ message: 'No sections found', backfilled: 0 })
    }

    const sectionIds = sections.map(s => s.id)

    // Get all sticky notes for these sections
    const { data: notes } = await supabase
      .from('sticky_notes')
      .select('id')
      .in('section_id', sectionIds)

    if (!notes || notes.length === 0) {
      return NextResponse.json({ message: 'No sticky notes found', backfilled: 0 })
    }

    const noteIds = notes.map(n => n.id)

    // Get all evidence items for these sticky notes
    const { data: evidenceItems, error: evidenceError } = await supabase
      .from('evidence')
      .select('*')
      .in('sticky_note_id', noteIds)

    if (evidenceError) {
      return NextResponse.json({ error: 'Failed to fetch evidence', details: evidenceError.message }, { status: 500 })
    }

    if (!evidenceItems || evidenceItems.length === 0) {
      return NextResponse.json({ message: 'No evidence items found on sticky notes', backfilled: 0 })
    }

    // Get existing links to see which evidence items already have bank entries
    const { data: existingLinks } = await supabase
      .from('sticky_note_evidence_links')
      .select('sticky_note_id, evidence_bank_id')
      .in('sticky_note_id', noteIds)

    const linkedNoteIds = new Set((existingLinks || []).map(l => l.sticky_note_id))

    let backfilled = 0
    let alreadyLinked = 0
    const errors: string[] = []

    for (const item of evidenceItems) {
      // Check if this note already has a bank link
      if (linkedNoteIds.has(item.sticky_note_id)) {
        alreadyLinked++
        continue
      }

      // Create evidence_bank entry
      const { data: bankItem, error: bankError } = await supabase
        .from('evidence_bank')
        .insert({
          workspace_id: membership.workspace_id,
          title: item.title || (item.type === 'url' ? item.url : 'Text Evidence') || 'Untitled Evidence',
          type: item.type,
          url: item.url || null,
          content: item.content || null,
          strength: item.strength || 'medium',
          source_system: 'manual',
          tags: [],
          created_by: user.id,
        })
        .select()
        .single()

      if (bankError) {
        errors.push(`Failed to create bank entry for evidence ${item.id}: ${bankError.message}`)
        continue
      }

      // Link bank item to sticky note
      const { error: linkError } = await supabase
        .from('sticky_note_evidence_links')
        .insert({
          sticky_note_id: item.sticky_note_id,
          evidence_bank_id: bankItem.id,
        })

      if (linkError) {
        errors.push(`Failed to link evidence ${item.id}: ${linkError.message}`)
      } else {
        backfilled++
      }
    }

    return NextResponse.json({
      message: `Backfilled ${backfilled} evidence items to Evidence Bank`,
      total_evidence: evidenceItems.length,
      backfilled,
      already_linked: alreadyLinked,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('Backfill error:', error)
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 })
  }
}
