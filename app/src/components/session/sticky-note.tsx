'use client'

import { useState, useRef, useEffect } from 'react'
import type { StickyNote as StickyNoteType, Evidence, EvidenceBank, SectionType } from '@/types/database'
import { getStrengthBand, getStrengthBandColor } from '@/lib/evidence-strength'

interface ConstraintInfo {
  label: string
  value: string | null
}

interface StickyNoteProps {
  note: StickyNoteType & { evidence: Evidence[]; linked_evidence?: EvidenceBank[] }
  onUpdate: (content: string) => void
  onDelete: () => void
  onOpenEvidence: (rect: DOMRect) => void
  onPositionChange: (x: number, y: number) => void
  isLinkMode?: boolean
  isLinkSource?: boolean
  onLinkClick?: () => void
  constraints?: ConstraintInfo[]
  sectionType?: SectionType
  isUnvalidated?: boolean
  contradictionCount?: number
  segments?: string[]
}

export function StickyNote({
  note,
  onUpdate,
  onDelete,
  onOpenEvidence,
  onPositionChange,
  isLinkMode = false,
  isLinkSource = false,
  onLinkClick,
  constraints = [],
  sectionType,
  isUnvalidated = false,
  contradictionCount = 0,
  segments = [],
}: StickyNoteProps) {
  const [isEditing, setIsEditing] = useState(!note.content)
  const [content, setContent] = useState(note.content)
  const [isDragging, setIsDragging] = useState(false)
  const [position, setPosition] = useState({ x: note.position_x, y: note.position_y })
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const noteRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.select()
    }
  }, [isEditing])

  const handleBlur = () => {
    setIsEditing(false)
    if (content !== note.content) {
      onUpdate(content)
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isEditing) return
    if ((e.target as HTMLElement).closest('button')) return

    setIsDragging(true)
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    })
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return

    const newX = Math.max(0, e.clientX - dragStart.x)
    const newY = Math.max(0, e.clientY - dragStart.y)
    setPosition({ x: newX, y: newY })
  }

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false)
      onPositionChange(position.x, position.y)
    }
  }

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, dragStart])

  const handleEvidenceClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (noteRef.current) {
      onOpenEvidence(noteRef.current.getBoundingClientRect())
    }
  }

  const handleClick = (e: React.MouseEvent) => {
    if (isLinkMode && onLinkClick) {
      e.stopPropagation()
      onLinkClick()
    }
  }

  // Constraint match check: see if note content mentions any constraint values
  const constraintMatches = constraints
    .filter(c => c.value && note.content)
    .map(c => {
      const matches = note.content.toLowerCase().includes(c.value!.toLowerCase())
      return { label: c.label, matches }
    })
    .filter(c => c.matches || c.label) // keep all constraints for display
  const matchCount = constraintMatches.filter(c => c.matches).length
  const totalConstraints = constraints.filter(c => c.value).length

  // Compute strength-based data for the note
  const linked = note.linked_evidence || []
  const withStrength = linked.filter(e => e.computed_strength > 0)
  const avgStrength = withStrength.length > 0
    ? Math.round(withStrength.reduce((s, e) => s + e.computed_strength, 0) / withStrength.length)
    : 0
  const strengthBand = note.has_evidence && withStrength.length > 0 ? getStrengthBand(avgStrength) : null

  // Dynamic border/bg colors based on strength band
  const getBorderColor = () => {
    if (!note.has_evidence) return 'border-yellow-400 bg-yellow-50'
    if (!strengthBand) return 'border-gray-300 bg-gray-50' // evidence linked but no strength computed
    switch (strengthBand) {
      case 'strong': return 'border-green-400 bg-green-50'
      case 'moderate': return 'border-yellow-400 bg-yellow-50'
      case 'weak': return 'border-red-300 bg-red-50'
    }
  }

  const getBadgeColor = () => {
    if (!note.has_evidence) return 'bg-yellow-500 text-white'
    if (!strengthBand) return 'bg-gray-400 text-white'
    switch (strengthBand) {
      case 'strong': return 'bg-green-500 text-white'
      case 'moderate': return 'bg-yellow-500 text-white'
      case 'weak': return 'bg-red-500 text-white'
    }
  }

  // Gap warnings computation
  const hasDirectVoice = linked.some(e => e.has_direct_voice)
  const uniqueSegments = [...new Set(linked.map(e => e.segment).filter((s): s is string => !!s))]
  const newestEvidence = linked.length > 0
    ? Math.max(...linked.map(e => new Date(e.created_at).getTime()))
    : 0
  const daysSinceNewest = newestEvidence > 0
    ? Math.floor((Date.now() - newestEvidence) / (1000 * 60 * 60 * 24))
    : -1

  const gapWarnings: string[] = []
  if (note.has_evidence && linked.length > 0) {
    if (!hasDirectVoice) gapWarnings.push('No user voice')
    if (uniqueSegments.length <= 1 && linked.length > 0) gapWarnings.push('Single segment')
    if (daysSinceNewest > 30) gapWarnings.push('Stale (>' + daysSinceNewest + 'd)')
  }

  return (
    <div
      ref={noteRef}
      className={`absolute w-[100px] h-[100px] rounded-md shadow-md transition-all select-none border-2 ${getBorderColor()} ${isDragging ? 'shadow-lg z-50' : 'hover:shadow-lg'} ${
        isLinkMode ? 'cursor-crosshair hover:ring-2 hover:ring-purple-400' : 'cursor-move'
      } ${isLinkSource ? 'ring-2 ring-purple-500 ring-offset-2' : ''}${
        isUnvalidated ? ' ring-1 ring-orange-400 ring-offset-1' : ''
      }`}
      style={{
        left: position.x,
        top: position.y,
        cursor: isEditing ? 'text' : isLinkMode ? 'crosshair' : 'move',
      }}
      onMouseDown={isLinkMode ? undefined : handleMouseDown}
      onClick={handleClick}
      onDoubleClick={() => !isLinkMode && setIsEditing(true)}
    >
      {/* Type Label with strength */}
      <div className={`absolute -top-2.5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-[8px] font-medium uppercase tracking-wide ${getBadgeColor()}`}>
        {note.has_evidence
          ? withStrength.length > 0 ? `${avgStrength}%` : 'Evidence'
          : 'Assumption'
        }
      </div>

      {/* Constraint match indicator (top-right corner) */}
      {totalConstraints > 0 && note.content.trim() && (
        <div
          className={`absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold ${
            matchCount === totalConstraints
              ? 'bg-green-500 text-white'
              : matchCount > 0
                ? 'bg-yellow-500 text-white'
                : 'bg-gray-300 text-gray-600'
          }`}
          title={`Constraint match: ${matchCount}/${totalConstraints}\n${constraintMatches.map(c => `${c.matches ? '✓' : '✗'} ${c.label}`).join('\n')}`}
        >
          {matchCount === totalConstraints ? '✓' : matchCount > 0 ? '~' : '✗'}
        </div>
      )}

      {/* Unvalidated warning (top-left corner) */}
      {isUnvalidated && (
        <div
          className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-orange-500 text-white flex items-center justify-center text-[8px] font-bold"
          title="Solution lacks validated problem — validate the linked problem first"
        >
          !
        </div>
      )}

      {/* Voice indicator (bottom-right, outside card) */}
      {note.has_evidence && linked.length > 0 && (
        <div
          className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] ${
            hasDirectVoice
              ? 'bg-green-500 text-white'
              : 'bg-gray-300 text-gray-600'
          }`}
          title={hasDirectVoice ? 'Has direct user voice' : 'No direct user voice'}
        >
          {hasDirectVoice ? '!' : '?'}
        </div>
      )}

      {/* Content */}
      <div className="p-2 pt-3 h-full flex flex-col">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setContent(note.content)
                setIsEditing(false)
              }
            }}
            className="w-full h-full bg-transparent border-none outline-none resize-none text-xs"
            placeholder="Type here..."
          />
        ) : (
          <>
            <p className="text-xs text-gray-700 overflow-hidden flex-1 leading-tight">
              {content || <span className="italic text-gray-400">Double-click to edit</span>}
            </p>
            {/* Gap warnings */}
            {gapWarnings.length > 0 && (
              <div className="flex flex-wrap gap-0.5 mt-0.5">
                {gapWarnings.map((w, i) => (
                  <span key={i} className="text-[7px] px-1 rounded bg-orange-100 text-orange-700 leading-tight">
                    {w}
                  </span>
                ))}
              </div>
            )}
          </>
        )}

        {/* Bottom toolbar */}
        <div className="flex justify-between items-center mt-auto pt-0.5">
          {/* Evidence indicator/button */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={handleEvidenceClick}
              className={`text-xs flex items-center gap-0.5 px-1 py-0.5 rounded transition-colors ${
                note.has_evidence
                  ? 'text-green-700 bg-green-200 hover:bg-green-300'
                  : 'text-gray-500 hover:bg-gray-200'
              }`}
              title={note.has_evidence ? `${note.evidence.length} evidence` : 'Add evidence'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              {note.has_evidence && <span>{note.evidence.length}</span>}
            </button>
            {/* Contradiction badge */}
            {contradictionCount > 0 && (
              <span
                className="text-[9px] font-bold px-1 py-0.5 rounded bg-red-100 text-red-600"
                title={`${contradictionCount} contradiction${contradictionCount !== 1 ? 's' : ''} detected`}
              >
                !{contradictionCount}
              </span>
            )}
            {/* Segment badge */}
            {segments.length > 0 && (
              <span
                className="text-[9px] px-1 py-0.5 rounded bg-blue-100 text-blue-600 truncate max-w-[40px]"
                title={`Segment: ${segments.join(', ')}`}
              >
                {segments[0].slice(0, 4)}
              </span>
            )}
          </div>

          {/* Delete button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="text-gray-400 hover:text-red-500 transition-colors p-0.5"
            title="Delete note"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
