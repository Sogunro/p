'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { StickyNote, Evidence, EvidenceBank, SourceSystemExpanded, VectorSearchResult } from '@/types/database'
import { getStrengthBand, getStrengthBandColor } from '@/lib/evidence-strength'

interface EvidencePopoverProps {
  noteId: string
  note: StickyNote & { evidence: Evidence[]; linked_evidence?: EvidenceBank[] }
  position: { x: number; y: number }
  onClose: () => void
  onAddEvidence: (evidence: {
    type: 'url' | 'text'
    url?: string
    content?: string
    title?: string
    strength?: 'high' | 'medium' | 'low'
    source_system?: SourceSystemExpanded
  }) => void
  onRemoveEvidence: (evidenceId: string) => void
  onLinkEvidence?: (evidenceBankId: string) => void
  onUnlinkEvidence?: (evidenceBankId: string) => void
}

const strengthLabels = {
  high: { label: 'High', desc: 'Customer interviews, analytics, A/B tests', color: 'bg-green-100 text-green-700 border-green-300' },
  medium: { label: 'Medium', desc: 'Surveys, support tickets, competitor analysis', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  low: { label: 'Low', desc: 'Anecdotal feedback, assumptions', color: 'bg-red-100 text-red-700 border-red-300' },
}

const SOURCE_ICONS: Record<string, string> = {
  manual: '✏️',
  slack: '💬',
  notion: '📝',
  mixpanel: '📊',
  airtable: '📋',
  intercom: '💬',
  gong: '🎙️',
  interview: '🎤',
  support: '🎫',
  analytics: '📈',
  social: '🌐',
}

export function EvidencePopover({
  noteId,
  note,
  position,
  onClose,
  onAddEvidence,
  onRemoveEvidence,
  onLinkEvidence,
  onUnlinkEvidence,
}: EvidencePopoverProps) {
  const [tab, setTab] = useState<'url' | 'text' | 'bank' | 'search'>('url')
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [title, setTitle] = useState('')
  const [strength, setStrength] = useState<'high' | 'medium' | 'low'>('medium')
  const [source, setSource] = useState<SourceSystemExpanded>('manual')
  const [bankEvidence, setBankEvidence] = useState<EvidenceBank[]>([])
  const [bankLoading, setBankLoading] = useState(false)
  const [bankSearch, setBankSearch] = useState('')
  const [semanticQuery, setSemanticQuery] = useState('')
  const [semanticResults, setSemanticResults] = useState<VectorSearchResult[]>([])
  const [semanticLoading, setSemanticLoading] = useState(false)
  const [semanticError, setSemanticError] = useState('')
  const popoverRef = useRef<HTMLDivElement>(null)

  // Fetch evidence bank when bank tab is selected
  useEffect(() => {
    if (tab === 'bank' && bankEvidence.length === 0) {
      fetchBankEvidence()
    }
  }, [tab])

  const fetchBankEvidence = async () => {
    setBankLoading(true)
    try {
      const response = await fetch('/api/evidence-bank')
      if (response.ok) {
        const data = await response.json()
        setBankEvidence(data.evidence || [])
      }
    } catch (error) {
      console.error('Failed to fetch bank evidence:', error)
    } finally {
      setBankLoading(false)
    }
  }

  const handleSemanticSearch = async () => {
    if (!semanticQuery.trim()) return
    setSemanticLoading(true)
    setSemanticError('')
    try {
      const response = await fetch('/api/evidence-bank/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: semanticQuery, limit: 10 }),
      })
      if (response.ok) {
        const data = await response.json()
        setSemanticResults(data.results || [])
      } else {
        const data = await response.json()
        setSemanticError(data.error || 'Search failed')
      }
    } catch (error) {
      console.error('Semantic search failed:', error)
      setSemanticError('Search unavailable')
    } finally {
      setSemanticLoading(false)
    }
  }

  const linkedBankIds = new Set(note.linked_evidence?.map(e => e.id) || [])

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  // Adjust position to stay within viewport
  const adjustedPosition = {
    x: Math.min(position.x, window.innerWidth - 320),
    y: Math.min(position.y, window.innerHeight - 400),
  }

  const handleAdd = () => {
    if (tab === 'url' && url.trim()) {
      onAddEvidence({
        type: 'url',
        url: url.trim(),
        title: title.trim() || undefined,
        strength,
        source_system: source,
      })
      setUrl('')
      setTitle('')
      setStrength('medium')
      setSource('manual')
    } else if (tab === 'text' && text.trim()) {
      onAddEvidence({
        type: 'text',
        content: text.trim(),
        title: title.trim() || undefined,
        strength,
        source_system: source,
      })
      setText('')
      setTitle('')
      setStrength('medium')
      setSource('manual')
    }
  }

  return (
    <div
      ref={popoverRef}
      className="fixed bg-white rounded-lg shadow-xl border border-gray-200 w-[300px] z-50"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
      }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b flex justify-between items-center">
        <h3 className="font-medium text-sm">Evidence</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Existing Evidence */}
      {note.evidence.length > 0 && (
        <div className="px-4 py-2 border-b max-h-[150px] overflow-y-auto">
          <div className="space-y-2">
            {note.evidence.map((ev) => (
              <div key={ev.id} className="flex items-start justify-between bg-gray-50 rounded p-2 text-xs">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 mb-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${strengthLabels[ev.strength || 'medium'].color}`}>
                      {strengthLabels[ev.strength || 'medium'].label}
                    </span>
                  </div>
                  {ev.type === 'url' ? (
                    <a
                      href={ev.url || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline truncate block"
                    >
                      {ev.title || ev.url}
                    </a>
                  ) : (
                    <p className="text-gray-700 line-clamp-2">{ev.title || ev.content}</p>
                  )}
                </div>
                <button
                  onClick={() => onRemoveEvidence(ev.id)}
                  className="text-gray-400 hover:text-red-500 ml-2 shrink-0"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Evidence */}
      <div className="p-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'url' | 'text' | 'bank' | 'search')}>
          <TabsList className="grid w-full grid-cols-4 mb-3">
            <TabsTrigger value="url" className="text-xs">URL</TabsTrigger>
            <TabsTrigger value="text" className="text-xs">Text</TabsTrigger>
            <TabsTrigger value="bank" className="text-xs">Bank</TabsTrigger>
            <TabsTrigger value="search" className="text-xs">Search</TabsTrigger>
          </TabsList>

          <TabsContent value="url" className="space-y-2 mt-0">
            {/* Source Selector - Only show if no evidence exists yet */}
            {note.evidence.length === 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600">Source</label>
                <div className="grid grid-cols-4 gap-1">
                  {(['manual', 'slack', 'notion', 'airtable'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSource(s)}
                      className={`flex flex-col items-center gap-0.5 p-1.5 rounded border text-xs transition-colors ${
                        source === s
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <span>{SOURCE_ICONS[s]}</span>
                      <span className="capitalize text-[10px]">{s}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <Input
              placeholder="Title (optional)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-xs h-8"
            />
            <Input
              placeholder="https://..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="text-xs h-8"
            />
          </TabsContent>

          <TabsContent value="text" className="space-y-2 mt-0">
            {/* Source Selector - Only show if no evidence exists yet */}
            {note.evidence.length === 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600">Source</label>
                <div className="grid grid-cols-4 gap-1">
                  {(['manual', 'slack', 'notion', 'airtable'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSource(s)}
                      className={`flex flex-col items-center gap-0.5 p-1.5 rounded border text-xs transition-colors ${
                        source === s
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <span>{SOURCE_ICONS[s]}</span>
                      <span className="capitalize text-[10px]">{s}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <Input
              placeholder="Title (optional)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-xs h-8"
            />
            <Textarea
              placeholder="Paste evidence text..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="text-xs min-h-[60px]"
            />
          </TabsContent>

          <TabsContent value="bank" className="mt-0">
            <Input
              placeholder="Search evidence bank..."
              value={bankSearch}
              onChange={(e) => setBankSearch(e.target.value)}
              className="text-xs h-8 mb-2"
            />
            <ScrollArea className="h-[180px]">
              {bankLoading ? (
                <p className="text-xs text-gray-400 text-center py-4">Loading...</p>
              ) : bankEvidence.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">
                  No evidence in bank yet.
                  <br />
                  <a href="/evidence-bank" className="text-blue-600 hover:underline">
                    Add evidence
                  </a>
                </p>
              ) : (
                <div className="space-y-2">
                  {bankEvidence
                    .filter(e =>
                      bankSearch === '' ||
                      e.title.toLowerCase().includes(bankSearch.toLowerCase()) ||
                      e.content?.toLowerCase().includes(bankSearch.toLowerCase())
                    )
                    .map((item) => {
                      const isLinked = linkedBankIds.has(item.id)
                      return (
                        <div
                          key={item.id}
                          className={`p-2 rounded border text-xs cursor-pointer transition-colors ${
                            isLinked
                              ? 'bg-green-50 border-green-300'
                              : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                          }`}
                          onClick={() => {
                            if (isLinked) {
                              onUnlinkEvidence?.(item.id)
                            } else {
                              onLinkEvidence?.(item.id)
                            }
                          }}
                        >
                          <div className="flex items-center gap-1 mb-1">
                            <span>{SOURCE_ICONS[item.source_system] || '📎'}</span>
                            {item.computed_strength > 0 ? (
                              <span
                                className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                                style={{
                                  color: getStrengthBandColor(getStrengthBand(item.computed_strength)),
                                  backgroundColor: `${getStrengthBandColor(getStrengthBand(item.computed_strength))}15`,
                                }}
                              >
                                {Math.round(item.computed_strength)}
                              </span>
                            ) : (
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-1 py-0 ${strengthLabels[item.strength].color}`}
                              >
                                {item.strength}
                              </Badge>
                            )}
                            {isLinked && (
                              <Badge className="text-[10px] px-1 py-0 bg-green-600">Linked</Badge>
                            )}
                          </div>
                          <p className="font-medium truncate">{item.title}</p>
                          {item.content && (
                            <p className="text-gray-500 line-clamp-1">{item.content}</p>
                          )}
                        </div>
                      )
                    })}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="search" className="mt-0">
            <div className="flex gap-1 mb-2">
              <Input
                placeholder="Describe what you're looking for..."
                value={semanticQuery}
                onChange={(e) => setSemanticQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSemanticSearch()
                }}
                className="text-xs h-8"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleSemanticSearch}
                disabled={semanticLoading || !semanticQuery.trim()}
                className="h-8 px-2 shrink-0"
              >
                {semanticLoading ? (
                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                )}
              </Button>
            </div>
            <ScrollArea className="h-[180px]">
              {semanticError ? (
                <p className="text-xs text-red-500 text-center py-4">{semanticError}</p>
              ) : semanticResults.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">
                  {semanticQuery ? 'No matching evidence found.' : 'Search evidence by meaning, not just keywords.'}
                </p>
              ) : (
                <div className="space-y-2">
                  {semanticResults.map((item) => {
                    const isLinked = linkedBankIds.has(item.id)
                    return (
                      <div
                        key={item.id}
                        className={`p-2 rounded border text-xs cursor-pointer transition-colors ${
                          isLinked
                            ? 'bg-green-50 border-green-300'
                            : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                        }`}
                        onClick={() => {
                          if (isLinked) {
                            onUnlinkEvidence?.(item.id)
                          } else {
                            onLinkEvidence?.(item.id)
                          }
                        }}
                      >
                        <div className="flex items-center gap-1 mb-1">
                          <span>{SOURCE_ICONS[item.source_system] || '📎'}</span>
                          {item.computed_strength > 0 && (
                            <span
                              className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                              style={{
                                color: getStrengthBandColor(getStrengthBand(item.computed_strength)),
                                backgroundColor: `${getStrengthBandColor(getStrengthBand(item.computed_strength))}15`,
                              }}
                            >
                              {Math.round(item.computed_strength)}
                            </span>
                          )}
                          <span className="text-[10px] text-purple-600 font-medium ml-auto">
                            {Math.round(item.similarity * 100)}% match
                          </span>
                          {isLinked && (
                            <Badge className="text-[10px] px-1 py-0 bg-green-600">Linked</Badge>
                          )}
                        </div>
                        <p className="font-medium truncate">{item.title}</p>
                        {item.content && (
                          <p className="text-gray-500 line-clamp-1">{item.content}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {/* Evidence Strength Selector - Only show for URL/Text tabs */}
        {tab !== 'bank' && tab !== 'search' && (
          <div className="mt-3">
            <label className="text-xs font-medium text-gray-600 mb-1.5 block">Evidence Strength</label>
            <div className="flex gap-1">
              {(['high', 'medium', 'low'] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setStrength(level)}
                  className={`flex-1 text-xs py-1.5 px-2 rounded border transition-all ${
                    strength === level
                      ? strengthLabels[level].color + ' border-current font-medium'
                      : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                  }`}
                  title={strengthLabels[level].desc}
                >
                  {strengthLabels[level].label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 mt-1">{strengthLabels[strength].desc}</p>
          </div>
        )}

        {tab !== 'bank' && tab !== 'search' && (
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={(tab === 'url' && !url.trim()) || (tab === 'text' && !text.trim())}
            className="w-full mt-3"
          >
            Add Evidence
          </Button>
        )}
      </div>
    </div>
  )
}
