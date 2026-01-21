import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SessionCanvas } from '@/components/session/session-canvas'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function SessionPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Load session with all related data
  const { data: session, error } = await supabase
    .from('sessions')
    .select(`
      *,
      templates (name),
      session_objectives (*),
      session_checklist_items (*),
      session_constraints (
        constraint_id,
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
    .eq('id', id)
    .single()

  if (error || !session) {
    redirect('/dashboard')
  }

  // Get all sticky note IDs
  const noteIds = session.sections?.flatMap((s: { sticky_notes: { id: string }[] }) =>
    s.sticky_notes?.map((n: { id: string }) => n.id) || []
  ) || []

  let stickyNoteLinks: { id: string; source_note_id: string; target_note_id: string }[] = []

  // Load sticky note links and linked evidence
  if (noteIds.length > 0) {
    // Load note-to-note links
    const { data: links } = await supabase
      .from('sticky_note_links')
      .select('*')
      .in('source_note_id', noteIds)

    stickyNoteLinks = links || []

    // Load linked evidence from Evidence Bank
    const { data: evidenceLinks } = await supabase
      .from('sticky_note_evidence_links')
      .select('sticky_note_id, evidence_bank:evidence_bank_id(*)')
      .in('sticky_note_id', noteIds)

    // Create a lookup map for linked evidence
    const linkedByNote = new Map<string, any[]>()
    evidenceLinks?.forEach((link: { sticky_note_id: string; evidence_bank: any }) => {
      const existing = linkedByNote.get(link.sticky_note_id) || []
      linkedByNote.set(link.sticky_note_id, [...existing, link.evidence_bank])
    })

    // Merge linked evidence into sticky notes
    session.sections = session.sections?.map((s: any) => ({
      ...s,
      sticky_notes: s.sticky_notes?.map((n: any) => ({
        ...n,
        linked_evidence: linkedByNote.get(n.id) || [],
      })),
    }))
  }

  return (
    <SessionCanvas
      session={session}
      stickyNoteLinks={stickyNoteLinks}
    />
  )
}
