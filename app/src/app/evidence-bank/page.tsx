'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import type { EvidenceBank, SourceSystem, SourceSystemExpanded, EvidenceStrength, InsightsFeed } from '@/types/database'

const SOURCE_ICONS: Record<SourceSystemExpanded, string> = {
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

const STRENGTH_COLORS: Record<EvidenceStrength, string> = {
  high: 'bg-green-100 text-green-800 border-green-300',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  low: 'bg-red-100 text-red-800 border-red-300',
}

export default function EvidenceBankPage() {
  const router = useRouter()
  const [evidence, setEvidence] = useState<EvidenceBank[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterSource, setFilterSource] = useState<SourceSystem | 'all'>('all')
  const [filterStrength, setFilterStrength] = useState<EvidenceStrength | 'all'>('all')

  // Add form state
  const [addType, setAddType] = useState<'url' | 'text'>('url')
  const [addTitle, setAddTitle] = useState('')
  const [addUrl, setAddUrl] = useState('')
  const [addContent, setAddContent] = useState('')
  const [addStrength, setAddStrength] = useState<EvidenceStrength>('medium')
  const [addSource, setAddSource] = useState<SourceSystem>('manual')
  const [addLoading, setAddLoading] = useState(false)

  // Fetch evidence state
  const [showFetchDialog, setShowFetchDialog] = useState(false)
  const [fetchLoading, setFetchLoading] = useState(false)
  const [enabledSources, setEnabledSources] = useState<SourceSystem[]>([])
  const [selectedFetchSources, setSelectedFetchSources] = useState<SourceSystem[]>([])
  const [fetchStatus, setFetchStatus] = useState<{
    lastFetchAt: string | null
    n8nConfigured: boolean
  } | null>(null)
  const [fetchResult, setFetchResult] = useState<{
    success: boolean
    message: string
    manualSetup?: boolean
    payload?: Record<string, unknown>
  } | null>(null)

  // Pending insights (not yet added to evidence bank)
  const [pendingInsights, setPendingInsights] = useState<InsightsFeed[]>([])
  const [showPendingSection, setShowPendingSection] = useState(true)

  useEffect(() => {
    fetchEvidence()
    fetchEvidenceStatus()
    fetchPendingInsights()
  }, [])

  const fetchPendingInsights = async () => {
    try {
      const response = await fetch('/api/insights-feed')
      if (response.ok) {
        const data = await response.json()
        setPendingInsights(data.insights || [])
      }
    } catch (error) {
      console.error('Failed to fetch pending insights:', error)
    }
  }

  const handleAddInsightToBank = async (insight: InsightsFeed, strength: EvidenceStrength = 'medium') => {
    try {
      const response = await fetch('/api/insights-feed/add-to-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          insightId: insight.id,
          strength,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        // Add to evidence list
        setEvidence([data.evidence, ...evidence])
        // Remove from pending
        setPendingInsights(pendingInsights.filter(i => i.id !== insight.id))
      }
    } catch (error) {
      console.error('Failed to add insight to bank:', error)
    }
  }

  const handleDismissInsight = async (insightId: string) => {
    try {
      const response = await fetch('/api/insights-feed/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ insightId }),
      })

      if (response.ok) {
        setPendingInsights(pendingInsights.filter(i => i.id !== insightId))
      }
    } catch (error) {
      console.error('Failed to dismiss insight:', error)
    }
  }

  const fetchEvidenceStatus = async () => {
    try {
      const response = await fetch('/api/workspace/fetch-now')
      if (response.ok) {
        const data = await response.json()
        setEnabledSources(data.enabledSources || [])
        setSelectedFetchSources(data.enabledSources || [])
        setFetchStatus({
          lastFetchAt: data.lastFetchAt,
          n8nConfigured: data.n8nConfigured,
        })
      }
    } catch (error) {
      console.error('Failed to fetch evidence status:', error)
    }
  }

  const fetchEvidence = async () => {
    try {
      const response = await fetch('/api/evidence-bank')
      if (response.ok) {
        const data = await response.json()
        setEvidence(data.evidence || [])
      }
    } catch (error) {
      console.error('Failed to fetch evidence:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddEvidence = async () => {
    if (!addTitle) return

    setAddLoading(true)
    try {
      const response = await fetch('/api/evidence-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: addTitle,
          type: addType,
          url: addType === 'url' ? addUrl : undefined,
          content: addType === 'text' ? addContent : undefined,
          strength: addStrength,
          source_system: addSource,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setEvidence([data.evidence, ...evidence])
        setShowAddDialog(false)
        resetAddForm()
      }
    } catch (error) {
      console.error('Failed to add evidence:', error)
    } finally {
      setAddLoading(false)
    }
  }

  const handleDeleteEvidence = async (id: string) => {
    try {
      const response = await fetch(`/api/evidence-bank?id=${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setEvidence(evidence.filter(e => e.id !== id))
      }
    } catch (error) {
      console.error('Failed to delete evidence:', error)
    }
  }

  const resetAddForm = () => {
    setAddType('url')
    setAddTitle('')
    setAddUrl('')
    setAddContent('')
    setAddStrength('medium')
    setAddSource('manual')
  }

  const handleFetchEvidence = async () => {
    if (selectedFetchSources.length === 0) return

    setFetchLoading(true)
    setFetchResult(null)

    try {
      const response = await fetch('/api/workspace/fetch-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sources: selectedFetchSources,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setFetchResult({
          success: data.success,
          message: data.message,
          manualSetup: data.manualSetup,
          payload: data.payload,
        })

        if (data.success && !data.manualSetup) {
          // Refresh evidence list after successful fetch trigger
          setTimeout(() => {
            fetchEvidence()
            setShowFetchDialog(false)
            setFetchResult(null)
          }, 2000)
        }
      } else {
        setFetchResult({
          success: false,
          message: data.error || 'Failed to trigger fetch',
        })
      }
    } catch (error) {
      console.error('Failed to fetch evidence:', error)
      setFetchResult({
        success: false,
        message: 'Network error occurred',
      })
    } finally {
      setFetchLoading(false)
    }
  }

  const toggleFetchSource = (source: SourceSystem) => {
    setSelectedFetchSources((prev) =>
      prev.includes(source)
        ? prev.filter((s) => s !== source)
        : [...prev, source]
    )
  }

  const filteredEvidence = evidence.filter(e => {
    const matchesSearch = e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.content?.toLowerCase().includes(searchQuery.toLowerCase()))
    const matchesSource = filterSource === 'all' || e.source_system === filterSource
    const matchesStrength = filterStrength === 'all' || e.strength === filterStrength
    return matchesSearch && matchesSource && matchesStrength
  })

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading evidence bank...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
                ← Back
              </Link>
              <h1 className="text-xl font-bold">Evidence Bank</h1>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/insights">
                <Button variant="outline">View Insights Feed</Button>
              </Link>
              <Button
                variant="outline"
                onClick={() => setShowFetchDialog(true)}
                className="flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Fetch Evidence
              </Button>
              <Button onClick={() => setShowAddDialog(true)}>+ Add Evidence</Button>
            </div>
          </div>
        </div>
      </header>

      {/* Source Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1 overflow-x-auto">
            {[
              { value: 'all', label: 'All', icon: '📚' },
              { value: 'manual', label: 'Manual', icon: '✏️' },
              { value: 'slack', label: 'Slack', icon: '💬' },
              { value: 'notion', label: 'Notion', icon: '📝' },
              { value: 'mixpanel', label: 'Mixpanel', icon: '📊' },
              { value: 'airtable', label: 'Airtable', icon: '📋' },
            ].map((tab) => {
              const count = tab.value === 'all'
                ? evidence.length
                : evidence.filter(e => e.source_system === tab.value).length
              return (
                <button
                  key={tab.value}
                  onClick={() => setFilterSource(tab.value as SourceSystem | 'all')}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
                    filterSource === tab.value
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                  {count > 0 && (
                    <span className={`px-1.5 py-0.5 rounded text-xs ${
                      filterSource === tab.value
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="Search evidence..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select
            className="border rounded-md px-3 py-2 text-sm"
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value as SourceSystem | 'all')}
          >
            <option value="all">📚 All Sources</option>
            <option value="manual">✏️ Manual</option>
            <option value="slack">💬 Slack</option>
            <option value="notion">📝 Notion</option>
            <option value="mixpanel">📊 Mixpanel</option>
            <option value="airtable">📋 Airtable</option>
          </select>
          <select
            className="border rounded-md px-3 py-2 text-sm"
            value={filterStrength}
            onChange={(e) => setFilterStrength(e.target.value as EvidenceStrength | 'all')}
          >
            <option value="all">All Strengths</option>
            <option value="high">🟢 High</option>
            <option value="medium">🟡 Medium</option>
            <option value="low">🔴 Low</option>
          </select>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4">
              <p className="text-2xl font-bold">{evidence.length}</p>
              <p className="text-sm text-gray-500">Total Evidence</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-2xl font-bold text-purple-600">
                {evidence.filter(e => e.source_system === 'manual').length}
              </p>
              <p className="text-sm text-gray-500">✏️ Manual</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-2xl font-bold text-green-600">
                {evidence.filter(e => e.strength === 'high').length}
              </p>
              <p className="text-sm text-gray-500">High Strength</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-2xl font-bold text-yellow-600">
                {evidence.filter(e => e.strength === 'medium').length}
              </p>
              <p className="text-sm text-gray-500">Medium Strength</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-2xl font-bold text-red-600">
                {evidence.filter(e => e.strength === 'low').length}
              </p>
              <p className="text-sm text-gray-500">Low Strength</p>
            </CardContent>
          </Card>
        </div>

        {/* Manually Added Evidence Section - For Session-Added Evidence */}
        {evidence.filter(e => e.source_system === 'manual').length > 0 && filterSource === 'all' && (
          <Card className="mb-6 border-purple-200 bg-purple-50/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <span>✏️</span>
                  Manually Added Evidence
                  <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                    {evidence.filter(e => e.source_system === 'manual').length}
                  </Badge>
                </CardTitle>
                <p className="text-xs text-gray-500">
                  Evidence added from sessions or manually entered
                </p>
              </div>
            </CardHeader>
          </Card>
        )}

        {/* Pending Insights Section - Unfetched Evidence */}
        {pendingInsights.length > 0 && (
          <Card className="mb-6 border-blue-200 bg-blue-50/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <span className="text-blue-600">📥</span>
                    Pending Insights
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                      {pendingInsights.length} new
                    </Badge>
                  </CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPendingSection(!showPendingSection)}
                >
                  {showPendingSection ? 'Hide' : 'Show'}
                </Button>
              </div>
              <p className="text-sm text-gray-600">
                Insights fetched from your sources that haven't been added to your evidence bank yet
              </p>
            </CardHeader>
            {showPendingSection && (
              <CardContent className="pt-0">
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {pendingInsights.map((insight) => (
                    <div
                      key={insight.id}
                      className="flex items-start justify-between p-3 bg-white rounded-lg border shadow-sm"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">{SOURCE_ICONS[insight.source_system]}</span>
                          <h4 className="font-medium text-sm truncate">{insight.title}</h4>
                        </div>
                        {insight.ai_summary && (
                          <p className="text-xs text-gray-600 line-clamp-2 mb-1">{insight.ai_summary}</p>
                        )}
                        {insight.content && !insight.ai_summary && (
                          <p className="text-xs text-gray-600 line-clamp-2 mb-1">{insight.content}</p>
                        )}
                        <p className="text-xs text-gray-400">
                          Fetched {new Date(insight.fetched_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <div className="flex flex-col gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 border-green-300 text-green-700 hover:bg-green-50"
                            onClick={() => handleAddInsightToBank(insight, 'high')}
                          >
                            + High
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 border-yellow-300 text-yellow-700 hover:bg-yellow-50"
                            onClick={() => handleAddInsightToBank(insight, 'medium')}
                          >
                            + Medium
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 border-red-300 text-red-700 hover:bg-red-50"
                            onClick={() => handleAddInsightToBank(insight, 'low')}
                          >
                            + Low
                          </Button>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs h-7 text-gray-400 hover:text-gray-600"
                          onClick={() => handleDismissInsight(insight.id)}
                        >
                          ✕
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t">
                  <Link href="/insights" className="text-sm text-blue-600 hover:underline">
                    View all in Insights Feed →
                  </Link>
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {/* Evidence List */}
        {filteredEvidence.length > 0 ? (
          <div className="grid gap-4">
            {filteredEvidence.map((item) => (
              <Card key={item.id} className="hover:shadow-md transition-shadow">
                <CardContent className="py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">{SOURCE_ICONS[item.source_system]}</span>
                        <h3 className="font-medium">{item.title}</h3>
                        <Badge className={STRENGTH_COLORS[item.strength]}>
                          {item.strength}
                        </Badge>
                        {item.source_system === 'manual' && (
                          <Badge variant="outline" className="text-purple-600 border-purple-300 bg-purple-50 text-xs">
                            Session Added
                          </Badge>
                        )}
                      </div>
                      {item.content && (
                        <p className="text-sm text-gray-600 mb-2 line-clamp-2">{item.content}</p>
                      )}
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline"
                        >
                          {item.url}
                        </a>
                      )}
                      <p className="text-xs text-gray-400 mt-2">
                        Added {formatDate(item.created_at)} via {item.source_system}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleDeleteEvidence(item.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="text-center py-12">
            <CardContent>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No evidence found</h3>
              <p className="text-gray-500 mb-4">
                {searchQuery || filterSource !== 'all' || filterStrength !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Start building your evidence bank by adding evidence manually or connecting your tools.'}
              </p>
              <Button onClick={() => setShowAddDialog(true)}>+ Add Evidence</Button>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Add Evidence Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Evidence</DialogTitle>
            <DialogDescription>
              Add evidence manually or link to an external source
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Source Picker */}
            <div className="space-y-2">
              <Label>Source</Label>
              <div className="grid grid-cols-5 gap-2">
                {(['manual', 'slack', 'notion', 'mixpanel', 'airtable'] as const).map((source) => (
                  <button
                    key={source}
                    type="button"
                    onClick={() => setAddSource(source)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-colors ${
                      addSource === source
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-xl">{SOURCE_ICONS[source]}</span>
                    <span className="text-xs capitalize">{source}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500">
                Select where this evidence came from to organize it by source
              </p>
            </div>

            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                placeholder="Brief description of this evidence"
                value={addTitle}
                onChange={(e) => setAddTitle(e.target.value)}
              />
            </div>

            <Tabs value={addType} onValueChange={(v) => setAddType(v as 'url' | 'text')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="url">URL</TabsTrigger>
                <TabsTrigger value="text">Text</TabsTrigger>
              </TabsList>
              <TabsContent value="url" className="space-y-2">
                <Label>URL</Label>
                <Input
                  placeholder={addSource === 'slack' ? 'https://workspace.slack.com/archives/...' :
                              addSource === 'notion' ? 'https://notion.so/...' :
                              addSource === 'airtable' ? 'https://airtable.com/...' :
                              'https://...'}
                  value={addUrl}
                  onChange={(e) => setAddUrl(e.target.value)}
                />
              </TabsContent>
              <TabsContent value="text" className="space-y-2">
                <Label>Content</Label>
                <Textarea
                  placeholder="Paste evidence text here..."
                  value={addContent}
                  onChange={(e) => setAddContent(e.target.value)}
                  rows={4}
                />
              </TabsContent>
            </Tabs>

            <div className="space-y-2">
              <Label>Evidence Strength</Label>
              <div className="flex gap-2">
                {(['high', 'medium', 'low'] as const).map((strength) => (
                  <Button
                    key={strength}
                    type="button"
                    variant={addStrength === strength ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setAddStrength(strength)}
                    className={addStrength === strength ? '' : STRENGTH_COLORS[strength]}
                  >
                    {strength.charAt(0).toUpperCase() + strength.slice(1)}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-gray-500">
                High: interviews, research, analytics | Medium: surveys, tickets | Low: anecdotal
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddEvidence} disabled={!addTitle || addLoading}>
              {addLoading ? 'Adding...' : 'Add Evidence'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fetch Evidence Dialog */}
      <Dialog open={showFetchDialog} onOpenChange={setShowFetchDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Fetch Evidence from Sources
            </DialogTitle>
            <DialogDescription>
              Trigger n8n to fetch evidence from your connected integrations.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Last fetch info */}
            {fetchStatus?.lastFetchAt && (
              <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-3">
                Last fetched: {new Date(fetchStatus.lastFetchAt).toLocaleString()}
              </div>
            )}

            {/* Source selection */}
            <div className="space-y-3">
              <Label>Select sources to fetch from:</Label>
              {enabledSources.length > 0 ? (
                <div className="space-y-2">
                  {(['slack', 'notion', 'mixpanel', 'airtable'] as const).map((source) => {
                    const isEnabled = enabledSources.includes(source)
                    const isSelected = selectedFetchSources.includes(source)
                    return (
                      <div
                        key={source}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                          isEnabled
                            ? isSelected
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                            : 'border-gray-100 bg-gray-50 opacity-50'
                        }`}
                      >
                        <Checkbox
                          id={`fetch-${source}`}
                          checked={isSelected}
                          onCheckedChange={() => isEnabled && toggleFetchSource(source)}
                          disabled={!isEnabled}
                        />
                        <label
                          htmlFor={`fetch-${source}`}
                          className={`flex items-center gap-2 flex-1 cursor-pointer ${
                            !isEnabled ? 'cursor-not-allowed' : ''
                          }`}
                        >
                          <span className="text-lg">{SOURCE_ICONS[source]}</span>
                          <span className="font-medium capitalize">{source}</span>
                          {!isEnabled && (
                            <span className="text-xs text-gray-400">(Not enabled)</span>
                          )}
                        </label>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500">
                  <p>No integrations enabled.</p>
                  <Link href="/settings/integrations" className="text-blue-600 hover:underline text-sm">
                    Enable integrations in Settings
                  </Link>
                </div>
              )}
            </div>

            {/* n8n configuration warning */}
            {fetchStatus && !fetchStatus.n8nConfigured && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p className="font-medium text-yellow-800">n8n not configured</p>
                    <p className="text-yellow-700">Set N8N_TRIGGER_URL in your environment to enable automatic fetching.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Fetch result */}
            {fetchResult && (
              <div className={`rounded-lg p-3 text-sm ${
                fetchResult.success
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-red-50 border border-red-200'
              }`}>
                <div className="flex items-start gap-2">
                  {fetchResult.success ? (
                    <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  <div>
                    <p className={fetchResult.success ? 'text-green-800' : 'text-red-800'}>
                      {fetchResult.message}
                    </p>
                    {fetchResult.manualSetup && fetchResult.payload && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-yellow-700 hover:text-yellow-800">
                          View payload for manual n8n setup
                        </summary>
                        <pre className="mt-2 bg-gray-800 text-gray-100 p-2 rounded text-xs overflow-x-auto">
                          {JSON.stringify(fetchResult.payload, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowFetchDialog(false)
              setFetchResult(null)
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleFetchEvidence}
              disabled={selectedFetchSources.length === 0 || fetchLoading}
              className="flex items-center gap-2"
            >
              {fetchLoading ? (
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
