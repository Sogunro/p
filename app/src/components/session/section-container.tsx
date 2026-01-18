'use client'

import { useState, ReactNode, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Section, StickyNote, Evidence } from '@/types/database'

interface SectionContainerProps {
  section: Section & {
    sticky_notes: (StickyNote & { evidence: Evidence[] })[]
  }
  children: ReactNode
  onUpdateName: (name: string) => void
  onDelete: () => void
  onAddNote: () => void
  onPositionChange: (x: number, y: number) => void
  onSizeChange?: (width: number, height: number) => void
}

export function SectionContainer({
  section,
  children,
  onUpdateName,
  onDelete,
  onAddNote,
  onPositionChange,
  onSizeChange,
}: SectionContainerProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(section.name)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [position, setPosition] = useState({ x: section.position_x, y: section.position_y })
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isResizing, setIsResizing] = useState<'right' | 'bottom' | 'corner' | null>(null)
  const [size, setSize] = useState({ width: section.width || 340, height: section.height || 200 })
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 })
  const sectionRef = useRef<HTMLDivElement>(null)

  // Calculate dynamic height based on notes (minimum)
  const noteCount = section.sticky_notes.length
  const cols = Math.max(1, Math.floor((size.width - 20) / 110))
  const rows = Math.max(1, Math.ceil(noteCount / cols))
  const minHeight = 150
  const noteHeight = 110
  const padding = 80
  const autoHeight = Math.max(minHeight, rows * noteHeight + padding)
  const collapsedHeight = 52

  // Calculate health score (evidence ratio)
  const notesWithContent = section.sticky_notes.filter(n => n.content.trim())
  const evidenceCount = section.sticky_notes.filter(n => n.has_evidence).length
  const healthScore = notesWithContent.length > 0
    ? Math.round((evidenceCount / notesWithContent.length) * 100)
    : 0

  // Determine health color
  const getHealthColor = () => {
    if (notesWithContent.length === 0) return { bg: 'bg-muted', border: 'border-muted-foreground/20', text: 'text-muted-foreground' }
    if (healthScore >= 70) return { bg: 'bg-green-500/20', border: 'border-green-500', text: 'text-green-700' }
    if (healthScore >= 40) return { bg: 'bg-yellow-500/20', border: 'border-yellow-500', text: 'text-yellow-700' }
    return { bg: 'bg-red-500/20', border: 'border-red-500', text: 'text-red-700' }
  }
  const healthColors = getHealthColor()

  const handleSubmit = () => {
    if (name.trim()) {
      onUpdateName(name.trim())
    } else {
      setName(section.name)
    }
    setIsEditing(false)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag from header area
    if ((e.target as HTMLElement).closest('.section-header')) {
      e.stopPropagation()
      setIsDragging(true)
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      })
    }
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newX = e.clientX - dragStart.x
        const newY = e.clientY - dragStart.y
        setPosition({ x: newX, y: newY })
      }
      if (isResizing) {
        const deltaX = e.clientX - resizeStart.x
        const deltaY = e.clientY - resizeStart.y

        if (isResizing === 'right' || isResizing === 'corner') {
          setSize(prev => ({ ...prev, width: Math.max(250, resizeStart.width + deltaX) }))
        }
        if (isResizing === 'bottom' || isResizing === 'corner') {
          setSize(prev => ({ ...prev, height: Math.max(150, resizeStart.height + deltaY) }))
        }
      }
    }

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false)
        onPositionChange(position.x, position.y)
      }
      if (isResizing) {
        setIsResizing(null)
        onSizeChange?.(size.width, size.height)
      }
    }

    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, isResizing, dragStart, resizeStart, position, size, onPositionChange, onSizeChange])

  // Resize handlers
  const handleResizeStart = (e: React.MouseEvent, direction: 'right' | 'bottom' | 'corner') => {
    e.stopPropagation()
    e.preventDefault()
    setIsResizing(direction)
    setResizeStart({ x: e.clientX, y: e.clientY, width: size.width, height: size.height })
  }

  // Update position when section prop changes
  useEffect(() => {
    setPosition({ x: section.position_x, y: section.position_y })
  }, [section.position_x, section.position_y])

  // Use larger of manual size or auto-calculated size
  const displayHeight = isCollapsed ? collapsedHeight : Math.max(size.height, autoHeight)

  return (
    <div
      ref={sectionRef}
      className={`absolute bg-card rounded-xl shadow-lg border-2 flex flex-col ${
        isDragging || isResizing
          ? 'shadow-2xl z-50 border-primary'
          : notesWithContent.length > 0
            ? `${healthColors.border} hover:shadow-xl`
            : 'border-border hover:border-primary/50'
      }`}
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: displayHeight,
        transition: isResizing ? 'none' : 'height 0.2s ease-in-out',
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Section Header - Draggable Handle */}
      <div className="section-header px-4 py-3 border-b bg-muted/50 rounded-t-xl flex items-center justify-between cursor-move">
        <div className="flex items-center gap-2 flex-1">
          {/* Drag handle icon */}
          <div className="text-muted-foreground/50 cursor-move">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
            </svg>
          </div>

          {isEditing ? (
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit()
                if (e.key === 'Escape') {
                  setName(section.name)
                  setIsEditing(false)
                }
              }}
              className="h-7 text-sm font-semibold flex-1"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <h3
              className="font-semibold text-foreground cursor-text hover:text-primary transition-colors flex-1"
              onClick={(e) => {
                e.stopPropagation()
                setIsEditing(true)
              }}
              title="Click to edit"
            >
              {section.name}
            </h3>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Health Score Badge */}
          {notesWithContent.length > 0 && (
            <div
              className={`text-xs px-2 py-0.5 rounded-full ${healthColors.bg} ${healthColors.text} font-medium mr-1`}
              title={`${healthScore}% evidence-backed (${evidenceCount}/${notesWithContent.length} notes)`}
            >
              {healthScore}%
            </div>
          )}
          <span className="text-xs text-muted-foreground mr-1">
            {section.sticky_notes.length} notes
          </span>
          {/* Collapse/Expand toggle - More visible */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              setIsCollapsed(!isCollapsed)
            }}
            className={`flex items-center justify-center w-6 h-6 rounded border transition-all ${
              isCollapsed
                ? 'bg-primary/10 border-primary/30 text-primary hover:bg-primary/20'
                : 'bg-muted border-border text-muted-foreground hover:bg-muted/80 hover:text-foreground'
            }`}
            title={isCollapsed ? 'Expand section' : 'Collapse section'}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-4 w-4 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : 'rotate-0'}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded hover:bg-destructive/10"
            title="Delete section"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Notes Container - Hidden when collapsed */}
      {!isCollapsed && (
        <>
          <div className="relative flex-1 p-2 overflow-hidden">
            <div className="relative w-full h-full">
              {children}
            </div>

            {/* Empty state */}
            {section.sticky_notes.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-sm text-muted-foreground">Click + Add Note below</p>
              </div>
            )}
          </div>

          {/* Add Note Button */}
          <div className="px-3 py-2 border-t bg-muted/30 rounded-b-xl">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onAddNote()
              }}
              className="w-full text-muted-foreground hover:text-foreground hover:bg-primary/10"
            >
              + Add Note
            </Button>
          </div>
        </>
      )}

      {/* Resize Handles */}
      {!isCollapsed && (
        <>
          {/* Right edge */}
          <div
            className="absolute top-0 right-0 w-2 h-full cursor-ew-resize hover:bg-primary/20 transition-colors"
            onMouseDown={(e) => handleResizeStart(e, 'right')}
          />
          {/* Bottom edge */}
          <div
            className="absolute bottom-0 left-0 w-full h-2 cursor-ns-resize hover:bg-primary/20 transition-colors"
            onMouseDown={(e) => handleResizeStart(e, 'bottom')}
          />
          {/* Corner */}
          <div
            className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize hover:bg-primary/30 transition-colors rounded-br-xl"
            onMouseDown={(e) => handleResizeStart(e, 'corner')}
          >
            <svg className="w-full h-full text-muted-foreground/50" viewBox="0 0 16 16">
              <path d="M14 14L6 14L14 6L14 14Z" fill="currentColor"/>
            </svg>
          </div>
        </>
      )}
    </div>
  )
}
