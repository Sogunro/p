'use client'

import { useState, useCallback, useRef, useEffect, MouseEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { StickyNote } from './sticky-note'
import { SectionContainer } from './section-container'
import { EvidencePopover } from './evidence-popover'
import type { Session, Section, StickyNote as StickyNoteType, Evidence, EvidenceBank } from '@/types/database'

type SourceSystem = 'manual' | 'slack' | 'notion' | 'airtable'

interface SessionData extends Session {
  templates: { name: string } | null
  session_objectives: { id: string; content: string; order_index: number }[]
  session_checklist_items: { id: string; content: string; is_checked: boolean; order_index: number }[]
  session_constraints: {
    constraint_id: string
    constraints: { id: string; label: string; value: string | null; type: string }
  }[]
  sections: (Section & {
    sticky_notes: (StickyNoteType & { evidence: Evidence[]; linked_evidence?: EvidenceBank[] })[]
  })[]
}

interface SessionCanvasProps {
  session: SessionData
  stickyNoteLinks: { id: string; source_note_id: string; target_note_id: string }[]
}

export function SessionCanvas({ session: initialSession, stickyNoteLinks }: SessionCanvasProps) {
  const router = useRouter()
  const supabase = createClient()
  const [session, setSession] = useState(initialSession)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [showChecklist, setShowChecklist] = useState(false)
  const [showConstraints, setShowConstraints] = useState(false)
  const [activeEvidenceNote, setActiveEvidenceNote] = useState<string | null>(null)
  const [evidencePosition, setEvidencePosition] = useState({ x: 0, y: 0 })

  // Canvas pan state
  const canvasRef = useRef<HTMLDivElement>(null)
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 })
  const [scale, setScale] = useState(1)

  // Constraint editing
  const [editingConstraint, setEditingConstraint] = useState<string | null>(null)
  const [constraintValue, setConstraintValue] = useState('')

  // Smart Linking state
  const [isLinkMode, setIsLinkMode] = useState(false)
  const [linkSource, setLinkSource] = useState<string | null>(null)
  const [noteLinks, setNoteLinks] = useState(stickyNoteLinks)
  const [notePositions, setNotePositions] = useState<Map<string, { x: number; y: number; sectionX: number; sectionY: number }>>(new Map())

  // Canvas panning handlers
  const handleCanvasMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    // Only pan if clicking on the canvas itself, not on sections
    if (e.target === canvasRef.current || (e.target as HTMLElement).classList.contains('canvas-background')) {
      setIsPanning(true)
      setPanStart({ x: e.clientX - canvasOffset.x, y: e.clientY - canvasOffset.y })
    }
  }

  const handleCanvasMouseMove = useCallback((e: globalThis.MouseEvent) => {
    if (isPanning) {
      setCanvasOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      })
    }
  }, [isPanning, panStart])

  const handleCanvasMouseUp = useCallback(() => {
    setIsPanning(false)
  }, [])

  // Zoom with mouse wheel
  const handleWheel = useCallback((e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      setScale(s => Math.min(Math.max(0.25, s * delta), 2))
    }
  }, [])

  useEffect(() => {
    window.addEventListener('mousemove', handleCanvasMouseMove)
    window.addEventListener('mouseup', handleCanvasMouseUp)
    const canvas = canvasRef.current
    if (canvas) {
      canvas.addEventListener('wheel', handleWheel, { passive: false })
    }
    return () => {
      window.removeEventListener('mousemove', handleCanvasMouseMove)
      window.removeEventListener('mouseup', handleCanvasMouseUp)
      if (canvas) {
        canvas.removeEventListener('wheel', handleWheel)
      }
    }
  }, [handleCanvasMouseMove, handleCanvasMouseUp, handleWheel])

  const handleAddSection = async () => {
    const maxX = session.sections.reduce((max, s) => Math.max(max, s.position_x), 0)

    const { data, error } = await supabase
      .from('sections')
      .insert({
        session_id: session.id,
        name: 'New Section',
        position_x: maxX + 350,
        position_y: 50,
      })
      .select()
      .single()

    if (!error && data) {
      setSession((prev) => ({
        ...prev,
        sections: [...prev.sections, { ...data, sticky_notes: [] }],
      }))
    }
  }

  const handleUpdateSection = async (sectionId: string, name: string) => {
    await supabase
      .from('sections')
      .update({ name })
      .eq('id', sectionId)

    setSession((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId ? { ...s, name } : s
      ),
    }))
  }

  const handleDeleteSection = async (sectionId: string) => {
    await supabase.from('sections').delete().eq('id', sectionId)

    setSession((prev) => ({
      ...prev,
      sections: prev.sections.filter((s) => s.id !== sectionId),
    }))
  }

  const handleSectionPositionChange = async (sectionId: string, x: number, y: number) => {
    await supabase
      .from('sections')
      .update({ position_x: x, position_y: y })
      .eq('id', sectionId)

    setSession((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId ? { ...s, position_x: x, position_y: y } : s
      ),
    }))
  }

  const handleSectionSizeChange = async (sectionId: string, width: number, height: number) => {
    await supabase
      .from('sections')
      .update({ width, height })
      .eq('id', sectionId)

    setSession((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId ? { ...s, width, height } : s
      ),
    }))
  }

  const handleAddNote = async (sectionId: string) => {
    const section = session.sections.find((s) => s.id === sectionId)
    const noteCount = section?.sticky_notes.length || 0
    const cols = 3
    const noteWidth = 110
    const noteHeight = 110

    const { data, error } = await supabase
      .from('sticky_notes')
      .insert({
        section_id: sectionId,
        content: '',
        position_x: 10 + (noteCount % cols) * noteWidth,
        position_y: 10 + Math.floor(noteCount / cols) * noteHeight,
      })
      .select()
      .single()

    if (!error && data) {
      setSession((prev) => ({
        ...prev,
        sections: prev.sections.map((s) =>
          s.id === sectionId
            ? { ...s, sticky_notes: [...s.sticky_notes, { ...data, evidence: [] }] }
            : s
        ),
      }))
    }
  }

  const handleUpdateNote = async (noteId: string, content: string) => {
    await supabase
      .from('sticky_notes')
      .update({ content })
      .eq('id', noteId)

    setSession((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => ({
        ...s,
        sticky_notes: s.sticky_notes.map((n) =>
          n.id === noteId ? { ...n, content } : n
        ),
      })),
    }))
  }

  const handleDeleteNote = async (sectionId: string, noteId: string) => {
    await supabase.from('sticky_notes').delete().eq('id', noteId)

    setSession((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId
          ? { ...s, sticky_notes: s.sticky_notes.filter((n) => n.id !== noteId) }
          : s
      ),
    }))
  }

  const handleNotePositionChange = async (noteId: string, sectionId: string, x: number, y: number) => {
    await supabase
      .from('sticky_notes')
      .update({ position_x: x, position_y: y })
      .eq('id', noteId)

    setSession((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              sticky_notes: s.sticky_notes.map((n) =>
                n.id === noteId ? { ...n, position_x: x, position_y: y } : n
              ),
            }
          : s
      ),
    }))
  }

  const handleOpenEvidence = (noteId: string, rect: DOMRect) => {
    setActiveEvidenceNote(noteId)
    setEvidencePosition({ x: rect.right + 10, y: rect.top })
  }

  const handleAddEvidence = async (noteId: string, evidence: {
    type: 'url' | 'text'
    url?: string
    content?: string
    title?: string
    strength?: 'high' | 'medium' | 'low'
    source_system?: SourceSystem
  }) => {
    // 1. Save to Evidence Bank first
    let bankItem: EvidenceBank | null = null
    try {
      const bankResponse = await fetch('/api/evidence-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: evidence.title || (evidence.type === 'url' ? evidence.url : 'Text Evidence'),
          type: evidence.type,
          url: evidence.url,
          content: evidence.content,
          strength: evidence.strength || 'medium',
          source_system: evidence.source_system || 'manual',
        }),
      })

      if (bankResponse.ok) {
        const bankData = await bankResponse.json()
        bankItem = bankData.evidence
        console.log('Saved to Evidence Bank:', bankItem)
      } else {
        const errorData = await bankResponse.json()
        console.error('Failed to save to Evidence Bank:', bankResponse.status, errorData)
      }
    } catch (error) {
      console.error('Failed to save to Evidence Bank:', error)
    }

    // 2. Save to direct evidence table (for backward compatibility)
    const { data, error } = await supabase
      .from('evidence')
      .insert({
        sticky_note_id: noteId,
        type: evidence.type,
        url: evidence.url,
        content: evidence.content,
        title: evidence.title,
        strength: evidence.strength || 'medium',
      })
      .select()
      .single()

    // 3. Link bank item to sticky note
    if (bankItem) {
      try {
        await fetch('/api/evidence-bank/link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stickyNoteId: noteId,
            evidenceBankId: bankItem.id,
          }),
        })
      } catch (error) {
        console.error('Failed to link evidence to note:', error)
      }
    }

    // 4. Update state
    if (!error && data) {
      await supabase
        .from('sticky_notes')
        .update({ has_evidence: true })
        .eq('id', noteId)

      setSession((prev) => ({
        ...prev,
        sections: prev.sections.map((s) => ({
          ...s,
          sticky_notes: s.sticky_notes.map((n) =>
            n.id === noteId
              ? {
                  ...n,
                  evidence: [...n.evidence, data],
                  has_evidence: true,
                  linked_evidence: bankItem
                    ? [...(n.linked_evidence || []), bankItem]
                    : n.linked_evidence,
                }
              : n
          ),
        })),
      }))
    }
  }

  const handleRemoveEvidence = async (noteId: string, evidenceId: string) => {
    await supabase.from('evidence').delete().eq('id', evidenceId)

    setSession((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => ({
        ...s,
        sticky_notes: s.sticky_notes.map((n) => {
          if (n.id === noteId) {
            const newEvidence = n.evidence.filter((e) => e.id !== evidenceId)
            return { ...n, evidence: newEvidence, has_evidence: newEvidence.length > 0 }
          }
          return n
        }),
      })),
    }))
  }

  const handleLinkEvidence = async (noteId: string, evidenceBankId: string) => {
    try {
      const response = await fetch('/api/evidence-bank/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stickyNoteId: noteId, evidenceBankId }),
      })

      if (response.ok) {
        // Fetch the bank item to add to local state
        const bankResponse = await fetch(`/api/evidence-bank?id=${evidenceBankId}`)
        let bankItem: EvidenceBank | null = null
        if (bankResponse.ok) {
          const data = await bankResponse.json()
          // Find the specific item from the list
          bankItem = data.evidence?.find((e: EvidenceBank) => e.id === evidenceBankId) || null
        }

        setSession((prev) => ({
          ...prev,
          sections: prev.sections.map((s) => ({
            ...s,
            sticky_notes: s.sticky_notes.map((n) =>
              n.id === noteId
                ? {
                    ...n,
                    has_evidence: true,
                    linked_evidence: bankItem
                      ? [...(n.linked_evidence || []), bankItem]
                      : n.linked_evidence,
                  }
                : n
            ),
          })),
        }))
      }
    } catch (error) {
      console.error('Failed to link evidence:', error)
    }
  }

  const handleUnlinkEvidence = async (noteId: string, evidenceBankId: string) => {
    try {
      await fetch(`/api/evidence-bank/link?stickyNoteId=${noteId}&evidenceBankId=${evidenceBankId}`, {
        method: 'DELETE',
      })

      setSession((prev) => ({
        ...prev,
        sections: prev.sections.map((s) => ({
          ...s,
          sticky_notes: s.sticky_notes.map((n) => {
            if (n.id === noteId) {
              const newLinked = (n.linked_evidence || []).filter((e) => e.id !== evidenceBankId)
              return {
                ...n,
                linked_evidence: newLinked,
                has_evidence: n.evidence.length > 0 || newLinked.length > 0,
              }
            }
            return n
          }),
        })),
      }))
    } catch (error) {
      console.error('Failed to unlink evidence:', error)
    }
  }

  const handleToggleChecklist = async (itemId: string, checked: boolean) => {
    await supabase
      .from('session_checklist_items')
      .update({ is_checked: checked })
      .eq('id', itemId)

    setSession((prev) => ({
      ...prev,
      session_checklist_items: prev.session_checklist_items.map((item) =>
        item.id === itemId ? { ...item, is_checked: checked } : item
      ),
    }))
  }

  const handleUpdateConstraintValue = async (constraintId: string) => {
    await supabase
      .from('constraints')
      .update({ value: constraintValue })
      .eq('id', constraintId)

    setSession((prev) => ({
      ...prev,
      session_constraints: prev.session_constraints.map((sc) =>
        sc.constraint_id === constraintId
          ? { ...sc, constraints: { ...sc.constraints, value: constraintValue } }
          : sc
      ),
    }))

    setEditingConstraint(null)
    setConstraintValue('')
  }

  const [showEvidenceWarning, setShowEvidenceWarning] = useState(false)
  const [evidenceWarningMessage, setEvidenceWarningMessage] = useState('')

  // Pre-analysis dialog state
  const [showAnalyzeDialog, setShowAnalyzeDialog] = useState(false)
  const [analyzeWithEvidence, setAnalyzeWithEvidence] = useState(true)
  const [isFetchingEvidence, setIsFetchingEvidence] = useState(false)
  const [fetchEvidenceResult, setFetchEvidenceResult] = useState<{
    success: boolean
    message: string
  } | null>(null)
  const [enabledSources, setEnabledSources] = useState<string[]>([])
  const [lastFetchAt, setLastFetchAt] = useState<string | null>(null)

  // Fetch evidence status when opening analyze dialog
  const fetchEvidenceStatus = async () => {
    try {
      const response = await fetch('/api/workspace/fetch-now')
      if (response.ok) {
        const data = await response.json()
        setEnabledSources(data.enabledSources || [])
        setLastFetchAt(data.lastFetchAt)
      }
    } catch (error) {
      console.error('Failed to fetch evidence status:', error)
    }
  }

  const handleOpenAnalyzeDialog = () => {
    setShowAnalyzeDialog(true)
    setFetchEvidenceResult(null)
    fetchEvidenceStatus()
  }

  const handleFetchEvidenceNow = async () => {
    setIsFetchingEvidence(true)
    setFetchEvidenceResult(null)

    try {
      const response = await fetch('/api/workspace/fetch-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sources: enabledSources,
          sessionId: session.id,
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setFetchEvidenceResult({
          success: true,
          message: data.message,
        })
        setLastFetchAt(new Date().toISOString())
      } else {
        setFetchEvidenceResult({
          success: false,
          message: data.error || data.message || 'Failed to fetch evidence',
        })
      }
    } catch (error) {
      console.error('Failed to fetch evidence:', error)
      setFetchEvidenceResult({
        success: false,
        message: 'Network error occurred',
      })
    } finally {
      setIsFetchingEvidence(false)
    }
  }

  const handleStartAnalysis = async () => {
    setShowAnalyzeDialog(false)
    setIsAnalyzing(true)

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          skipEvidenceCheck: true,
          includeEvidence: analyzeWithEvidence,
        }),
      })

      if (response.ok) {
        router.push(`/session/${session.id}/analysis`)
      } else {
        console.error('Analysis failed:', response.statusText)
        setIsAnalyzing(false)
      }
    } catch (error) {
      console.error('Analysis failed:', error)
      setIsAnalyzing(false)
    }
  }

  const handleAnalyze = async (skipEvidenceCheck = false) => {
    setIsAnalyzing(true)
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id, skipEvidenceCheck }),
      })

      if (response.ok) {
        router.push(`/session/${session.id}/analysis`)
      } else if (response.status === 428) {
        // Evidence stale warning
        const data = await response.json()
        setEvidenceWarningMessage(data.message)
        setShowEvidenceWarning(true)
        setIsAnalyzing(false)
      } else {
        console.error('Analysis failed:', response.statusText)
        setIsAnalyzing(false)
      }
    } catch (error) {
      console.error('Analysis failed:', error)
      setIsAnalyzing(false)
    }
  }

  const resetView = () => {
    setCanvasOffset({ x: 0, y: 0 })
    setScale(1)
  }

  // Smart linking handlers
  const handleNoteClick = async (noteId: string) => {
    if (!isLinkMode) return

    if (!linkSource) {
      // First click - set source
      setLinkSource(noteId)
    } else if (linkSource !== noteId) {
      // Second click - create link
      const existingLink = noteLinks.find(
        (l) =>
          (l.source_note_id === linkSource && l.target_note_id === noteId) ||
          (l.source_note_id === noteId && l.target_note_id === linkSource)
      )

      if (existingLink) {
        // Remove existing link
        await supabase.from('sticky_note_links').delete().eq('id', existingLink.id)
        setNoteLinks((prev) => prev.filter((l) => l.id !== existingLink.id))
      } else {
        // Create new link
        const { data, error } = await supabase
          .from('sticky_note_links')
          .insert({ source_note_id: linkSource, target_note_id: noteId })
          .select()
          .single()

        if (!error && data) {
          setNoteLinks((prev) => [...prev, data])
        }
      }
      setLinkSource(null)
    }
  }

  const toggleLinkMode = () => {
    setIsLinkMode(!isLinkMode)
    setLinkSource(null)
  }

  // Update note positions for link drawing
  const updateNotePosition = (noteId: string, x: number, y: number, sectionX: number, sectionY: number) => {
    setNotePositions((prev) => {
      const newMap = new Map(prev)
      newMap.set(noteId, { x, y, sectionX, sectionY })
      return newMap
    })
  }

  // Count assumptions vs evidence-backed
  const allNotes = session.sections.flatMap((s) => s.sticky_notes)
  const evidenceCount = allNotes.filter((n) => n.has_evidence).length
  const assumptionCount = allNotes.filter((n) => !n.has_evidence && n.content.trim()).length

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top Toolbar */}
      <header className="bg-card border-b px-4 py-2 flex justify-between items-center shrink-0 z-20">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
            ← Back
          </Link>
          <h1 className="font-semibold text-lg">{session.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div className="flex items-center gap-1 mr-2 text-sm text-muted-foreground">
            <Button variant="ghost" size="sm" onClick={() => setScale(s => Math.max(0.25, s - 0.1))}>−</Button>
            <span className="w-12 text-center">{Math.round(scale * 100)}%</span>
            <Button variant="ghost" size="sm" onClick={() => setScale(s => Math.min(2, s + 0.1))}>+</Button>
            <Button variant="ghost" size="sm" onClick={resetView}>Reset</Button>
          </div>
          {/* Link Mode Toggle */}
          <Button
            variant={isLinkMode ? 'default' : 'outline'}
            size="sm"
            onClick={toggleLinkMode}
            className={isLinkMode ? 'bg-purple-600 hover:bg-purple-700' : ''}
          >
            {isLinkMode ? '🔗 Linking...' : '🔗 Link Notes'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowChecklist(true)}>
            Checklist
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowConstraints(true)}>
            Constraints
          </Button>
          <Button variant="outline" size="sm" onClick={handleAddSection}>
            + Section
          </Button>
          {/* Fetch Evidence Button - Show if there are evidence-backed notes */}
          {evidenceCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleFetchEvidenceNow}
              disabled={isFetchingEvidence}
              className="flex items-center gap-1"
            >
              {isFetchingEvidence ? (
                <>
                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Fetching...
                </>
              ) : (
                <>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Fetch Evidence
                </>
              )}
            </Button>
          )}
          <Button onClick={handleOpenAnalyzeDialog} disabled={isAnalyzing}>
            {isAnalyzing ? 'Analyzing...' : 'Analyze Session'}
          </Button>
        </div>
      </header>

      {/* Objectives Bar - Compact Centered Layout */}
      <div className="bg-primary/5 border-b border-primary/20 px-4 py-2 shrink-0 z-10">
        <div className="flex items-center justify-center gap-4 flex-wrap">
          {/* Label */}
          <span className="text-xs font-semibold text-primary uppercase tracking-wide">Objectives:</span>

          {/* Objectives */}
          {session.session_objectives
            .sort((a, b) => a.order_index - b.order_index)
            .map((obj, i) => (
              <div key={obj.id} className="bg-card border border-primary/30 rounded px-2 py-1 text-xs">
                <span className="text-primary font-semibold">{i + 1}.</span> {obj.content}
              </div>
            ))}
          {session.session_objectives.length === 0 && (
            <span className="text-xs text-muted-foreground italic">No objectives defined</span>
          )}

          {/* Divider */}
          <div className="h-4 w-px bg-border"></div>

          {/* Stats */}
          <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/30 text-xs px-2 py-0.5">
            ✓ {evidenceCount}
          </Badge>
          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 border-yellow-500/30 text-xs px-2 py-0.5">
            ? {assumptionCount}
          </Badge>
        </div>
      </div>

      {/* Infinite Canvas */}
      <div
        ref={canvasRef}
        className="flex-1 overflow-hidden relative cursor-grab active:cursor-grabbing canvas-background"
        style={{ backgroundColor: 'var(--muted)' }}
        onMouseDown={handleCanvasMouseDown}
      >
        {/* Grid pattern */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle, var(--border) 1px, transparent 1px)`,
            backgroundSize: `${20 * scale}px ${20 * scale}px`,
            backgroundPosition: `${canvasOffset.x % (20 * scale)}px ${canvasOffset.y % (20 * scale)}px`,
          }}
        />

        {/* Canvas content */}
        <div
          className="absolute"
          style={{
            transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${scale})`,
            transformOrigin: '0 0',
          }}
        >
          {/* SVG layer for drawing links between notes */}
          <svg className="absolute inset-0 pointer-events-none overflow-visible" style={{ width: '10000px', height: '10000px' }}>
            {noteLinks.map((link) => {
              // Find the notes and their sections
              let sourceNote = null
              let targetNote = null
              let sourceSection = null
              let targetSection = null

              for (const section of session.sections) {
                const foundSource = section.sticky_notes.find(n => n.id === link.source_note_id)
                const foundTarget = section.sticky_notes.find(n => n.id === link.target_note_id)
                if (foundSource) { sourceNote = foundSource; sourceSection = section }
                if (foundTarget) { targetNote = foundTarget; targetSection = section }
              }

              if (!sourceNote || !targetNote || !sourceSection || !targetSection) return null

              // Calculate positions (note position + section position + center offset)
              const x1 = sourceSection.position_x + sourceNote.position_x + 50
              const y1 = sourceSection.position_y + sourceNote.position_y + 50 + 52 // +52 for header
              const x2 = targetSection.position_x + targetNote.position_x + 50
              const y2 = targetSection.position_y + targetNote.position_y + 50 + 52

              return (
                <g key={link.id}>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="#9333ea"
                    strokeWidth="2"
                    strokeDasharray="5,5"
                    opacity="0.6"
                  />
                  {/* Arrow at midpoint */}
                  <circle
                    cx={(x1 + x2) / 2}
                    cy={(y1 + y2) / 2}
                    r="6"
                    fill="#9333ea"
                    opacity="0.8"
                  />
                </g>
              )
            })}
          </svg>

          {session.sections.map((section) => (
            <SectionContainer
              key={section.id}
              section={section}
              onUpdateName={(name) => handleUpdateSection(section.id, name)}
              onDelete={() => handleDeleteSection(section.id)}
              onAddNote={() => handleAddNote(section.id)}
              onPositionChange={(x, y) => handleSectionPositionChange(section.id, x, y)}
              onSizeChange={(w, h) => handleSectionSizeChange(section.id, w, h)}
            >
              {section.sticky_notes.map((note) => (
                <StickyNote
                  key={note.id}
                  note={note}
                  onUpdate={(content) => handleUpdateNote(note.id, content)}
                  onDelete={() => handleDeleteNote(section.id, note.id)}
                  onOpenEvidence={(rect) => handleOpenEvidence(note.id, rect)}
                  onPositionChange={(x, y) => handleNotePositionChange(note.id, section.id, x, y)}
                  isLinkMode={isLinkMode}
                  isLinkSource={linkSource === note.id}
                  onLinkClick={() => handleNoteClick(note.id)}
                />
              ))}
            </SectionContainer>
          ))}
        </div>

        {/* Empty state */}
        {session.sections.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center bg-card rounded-xl p-8 shadow-lg border">
              <p className="text-muted-foreground mb-4">No sections yet. Start by adding a section.</p>
              <Button onClick={handleAddSection}>+ Add Section</Button>
            </div>
          </div>
        )}

        {/* Canvas instructions */}
        <div className="absolute bottom-4 left-4 text-xs text-muted-foreground bg-card/80 backdrop-blur px-3 py-2 rounded-lg">
          {isLinkMode ? (
            <span className="text-purple-600 font-medium">
              🔗 Link Mode: Click a note to select, then click another to link/unlink
            </span>
          ) : (
            'Drag canvas to pan • Ctrl+Scroll to zoom • Drag sections to move'
          )}
        </div>

        {/* Link mode indicator */}
        {isLinkMode && linkSource && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-purple-600 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg">
            Now click another note to create a link
          </div>
        )}
      </div>

      {/* Evidence Popover */}
      {activeEvidenceNote && (
        <EvidencePopover
          noteId={activeEvidenceNote}
          note={allNotes.find((n) => n.id === activeEvidenceNote)!}
          position={evidencePosition}
          onClose={() => setActiveEvidenceNote(null)}
          onAddEvidence={(evidence) => handleAddEvidence(activeEvidenceNote, evidence)}
          onRemoveEvidence={(evidenceId) => handleRemoveEvidence(activeEvidenceNote, evidenceId)}
          onLinkEvidence={(evidenceBankId) => handleLinkEvidence(activeEvidenceNote, evidenceBankId)}
          onUnlinkEvidence={(evidenceBankId) => handleUnlinkEvidence(activeEvidenceNote, evidenceBankId)}
        />
      )}

      {/* Checklist Dialog */}
      <Dialog open={showChecklist} onOpenChange={setShowChecklist}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Session Checklist</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-3">
              {session.session_checklist_items
                .sort((a, b) => a.order_index - b.order_index)
                .map((item) => (
                  <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted">
                    <Checkbox
                      checked={item.is_checked}
                      onCheckedChange={(checked) =>
                        handleToggleChecklist(item.id, checked as boolean)
                      }
                    />
                    <span className={item.is_checked ? 'line-through text-muted-foreground' : ''}>
                      {item.content}
                    </span>
                  </div>
                ))}
              {session.session_checklist_items.length === 0 && (
                <p className="text-muted-foreground text-center py-4">No checklist items</p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Constraints Dialog - Now Editable */}
      <Dialog open={showConstraints} onOpenChange={setShowConstraints}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Session Constraints</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-3">
              {session.session_constraints.map((sc) => (
                <div key={sc.constraint_id} className="border rounded-lg p-4">
                  <div className="font-medium text-sm mb-2">{sc.constraints.label}</div>
                  {editingConstraint === sc.constraint_id ? (
                    <div className="flex gap-2">
                      <Input
                        value={constraintValue}
                        onChange={(e) => setConstraintValue(e.target.value)}
                        placeholder="Enter value..."
                        className="flex-1"
                        autoFocus
                      />
                      <Button size="sm" onClick={() => handleUpdateConstraintValue(sc.constraint_id)}>
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingConstraint(null)}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div
                      className="text-muted-foreground cursor-pointer hover:bg-muted p-2 rounded border border-dashed border-muted-foreground/30"
                      onClick={() => {
                        setEditingConstraint(sc.constraint_id)
                        setConstraintValue(sc.constraints.value || '')
                      }}
                    >
                      {sc.constraints.value || (
                        <span className="italic text-muted-foreground/50">Click to add value...</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {session.session_constraints.length === 0 && (
                <p className="text-muted-foreground text-center py-4">No constraints applied to this session</p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Evidence Warning Dialog */}
      <Dialog open={showEvidenceWarning} onOpenChange={setShowEvidenceWarning}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Evidence Not Recently Fetched</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{evidenceWarningMessage}</p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => router.push('/insights')}>
                Fetch Insights
              </Button>
              <Button
                onClick={() => {
                  setShowEvidenceWarning(false)
                  handleAnalyze(true)
                }}
              >
                Proceed Anyway
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pre-Analysis Dialog - Choose evidence options */}
      <Dialog open={showAnalyzeDialog} onOpenChange={setShowAnalyzeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Analyze Session
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Evidence status */}
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Evidence Status</span>
                {lastFetchAt ? (
                  <span className="text-xs text-muted-foreground">
                    Last fetched: {new Date(lastFetchAt).toLocaleString()}
                  </span>
                ) : (
                  <span className="text-xs text-yellow-600">Never fetched</span>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Enabled sources:</span>
                {enabledSources.length > 0 ? (
                  <div className="flex gap-1">
                    {enabledSources.map((source) => (
                      <Badge key={source} variant="secondary" className="text-xs">
                        {source === 'slack' && '💬'}
                        {source === 'notion' && '📝'}
                        {source === 'mixpanel' && '📊'}
                        {source === 'airtable' && '📋'}
                        {' '}{source}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <span className="text-yellow-600 text-xs">None configured</span>
                )}
              </div>
            </div>

            {/* Fetch evidence option */}
            {enabledSources.length > 0 && (
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-sm">Fetch Latest Evidence</h4>
                    <p className="text-xs text-muted-foreground">
                      Get the most recent insights from your connected sources
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleFetchEvidenceNow}
                    disabled={isFetchingEvidence}
                    className="flex items-center gap-2"
                  >
                    {isFetchingEvidence ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Fetching...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Fetch Now
                      </>
                    )}
                  </Button>
                </div>
                {fetchEvidenceResult && (
                  <div className={`mt-3 text-sm p-2 rounded ${
                    fetchEvidenceResult.success
                      ? 'bg-green-50 text-green-700'
                      : 'bg-red-50 text-red-700'
                  }`}>
                    {fetchEvidenceResult.message}
                  </div>
                )}
              </div>
            )}

            {/* Analysis mode selection */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Analysis Mode</label>
              <div className="space-y-2">
                <div
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    analyzeWithEvidence
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setAnalyzeWithEvidence(true)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      analyzeWithEvidence ? 'border-blue-500' : 'border-gray-300'
                    }`}>
                      {analyzeWithEvidence && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">Analyze with Evidence</h4>
                      <p className="text-xs text-muted-foreground">
                        Include insights from Slack, Notion, Mixpanel, and Airtable in the analysis
                      </p>
                    </div>
                  </div>
                </div>
                <div
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    !analyzeWithEvidence
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setAnalyzeWithEvidence(false)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      !analyzeWithEvidence ? 'border-blue-500' : 'border-gray-300'
                    }`}>
                      {!analyzeWithEvidence && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">Analyze without Evidence</h4>
                      <p className="text-xs text-muted-foreground">
                        Analyze session content only, without external evidence
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Warning if evidence notes exist but not recently fetched */}
          {evidenceCount > 0 && !lastFetchAt && analyzeWithEvidence && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p className="font-medium text-yellow-800">Evidence not fetched</p>
                  <p className="text-yellow-700 text-xs">
                    You have {evidenceCount} evidence-backed notes. Fetch evidence first for better analysis, or analyze without evidence.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setShowAnalyzeDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleStartAnalysis}
              disabled={isAnalyzing || (evidenceCount > 0 && !lastFetchAt && analyzeWithEvidence)}
            >
              {isAnalyzing ? 'Analyzing...' : 'Start Analysis'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
