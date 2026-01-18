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

  // Load sticky note links separately
  const sectionIds = session.sections?.map((s: { id: string }) => s.id) || []
  let stickyNoteLinks: { id: string; source_note_id: string; target_note_id: string }[] = []

  if (sectionIds.length > 0) {
    const noteIds = session.sections?.flatMap((s: { sticky_notes: { id: string }[] }) =>
      s.sticky_notes?.map((n: { id: string }) => n.id) || []
    ) || []

    if (noteIds.length > 0) {
      const { data: links } = await supabase
        .from('sticky_note_links')
        .select('*')
        .in('source_note_id', noteIds)

      stickyNoteLinks = links || []
    }
  }

  return (
    <SessionCanvas
      session={session}
      stickyNoteLinks={stickyNoteLinks}
    />
  )
}
