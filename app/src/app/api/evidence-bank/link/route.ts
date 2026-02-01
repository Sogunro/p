import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { triggerAgentsOnEvidenceLink } from '@/lib/agent-triggers'

// POST: Link evidence bank item to sticky note
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { stickyNoteId, evidenceBankId } = await request.json()

    if (!stickyNoteId || !evidenceBankId) {
      return NextResponse.json({ error: 'stickyNoteId and evidenceBankId are required' }, { status: 400 })
    }

    // Create the link
    const { data: link, error } = await supabase
      .from('sticky_note_evidence_links')
      .insert({
        sticky_note_id: stickyNoteId,
        evidence_bank_id: evidenceBankId,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Evidence already linked to this note' }, { status: 409 })
      }
      console.error('Error linking evidence:', error)
      return NextResponse.json({ error: 'Failed to link evidence' }, { status: 500 })
    }

    // Update sticky note has_evidence flag
    await supabase
      .from('sticky_notes')
      .update({ has_evidence: true })
      .eq('id', stickyNoteId)

    // Auto-trigger agents (fire-and-forget)
    const { data: evidenceItem } = await supabase
      .from('evidence_bank')
      .select('workspace_id')
      .eq('id', evidenceBankId)
      .single()

    if (evidenceItem?.workspace_id) {
      triggerAgentsOnEvidenceLink(evidenceBankId, stickyNoteId, evidenceItem.workspace_id)
        .catch(err => console.error('Agent trigger error (non-blocking):', err))
    }

    return NextResponse.json({ link })
  } catch (error) {
    console.error('Link evidence error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE: Unlink evidence bank item from sticky note
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const stickyNoteId = searchParams.get('stickyNoteId')
    const evidenceBankId = searchParams.get('evidenceBankId')

    if (!stickyNoteId || !evidenceBankId) {
      return NextResponse.json({ error: 'stickyNoteId and evidenceBankId are required' }, { status: 400 })
    }

    // Delete the link
    const { error } = await supabase
      .from('sticky_note_evidence_links')
      .delete()
      .eq('sticky_note_id', stickyNoteId)
      .eq('evidence_bank_id', evidenceBankId)

    if (error) {
      console.error('Error unlinking evidence:', error)
      return NextResponse.json({ error: 'Failed to unlink evidence' }, { status: 500 })
    }

    // Check if note still has any evidence (direct or linked)
    const { data: directEvidence } = await supabase
      .from('evidence')
      .select('id')
      .eq('sticky_note_id', stickyNoteId)
      .limit(1)

    const { data: linkedEvidence } = await supabase
      .from('sticky_note_evidence_links')
      .select('id')
      .eq('sticky_note_id', stickyNoteId)
      .limit(1)

    const hasEvidence = (directEvidence && directEvidence.length > 0) || (linkedEvidence && linkedEvidence.length > 0)

    await supabase
      .from('sticky_notes')
      .update({ has_evidence: hasEvidence })
      .eq('id', stickyNoteId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unlink evidence error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
