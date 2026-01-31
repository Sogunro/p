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

  return (
    <div
      ref={noteRef}
      className={`absolute w-[100px] h-[100px] rounded-md shadow-md transition-all select-none ${
        note.has_evidence
          ? 'bg-green-50 border-2 border-green-400'
          : 'bg-yellow-50 border-2 border-yellow-400'
      } ${isDragging ? 'shadow-lg z-50' : 'hover:shadow-lg'} ${
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
      {/* Type Label */}
      <div className={`absolute -top-2.5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-[8px] font-medium uppercase tracking-wide ${
        note.has_evidence
          ? 'bg-green-500 text-white'
          : 'bg-yellow-500 text-white'
      }`}>
        {note.has_evidence ? 'Evidence' : 'Assumption'}
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
          <p className="text-xs text-gray-700 overflow-hidden flex-1 leading-tight">
            {content || <span className="italic text-gray-400">Double-click to edit</span>}
          </p>
        )}

        {/* Bottom toolbar */}
        <div className="flex justify-between items-center mt-auto pt-1">
          {/* Evidence indicator/button */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleEvidenceClick}
              className={`text-xs flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${
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
            {/* Computed strength score */}
            {(() => {
              const linked = note.linked_evidence || []
              const withStrength = linked.filter(e => e.computed_strength > 0)
              if (withStrength.length === 0) return null
              const avg = Math.round(withStrength.reduce((s, e) => s + e.computed_strength, 0) / withStrength.length)
              const band = getStrengthBand(avg)
              return (
                <span
                  className="text-[9px] font-bold px-1 py-0.5 rounded"
                  style={{
                    color: getStrengthBandColor(band),
                    backgroundColor: `${getStrengthBandColor(band)}20`,
                  }}
                  title={`Evidence strength: ${avg}/100`}
                >
                  {avg}
                </span>
              )
            })()}
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
