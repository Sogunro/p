'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import InsightsSourceGroup from '@/components/insights/InsightsSourceGroup'
import DailyDigestCard from '@/components/insights/DailyDigestCard'
import InsightsAnalysisPanel from '@/components/insights/InsightsAnalysisPanel'
import type { InsightsFeed, SourceSystem, EvidenceStrength, DailyInsightsAnalysis } from '@/types/database'

const SOURCE_ICONS: Record<SourceSystem, string> = {
  manual: '✏️',
  slack: '💬',
  notion: '📝',
  mixpanel: '📊',
  airtable: '📋',
}

const SOURCE_COLORS: Record<string, string> = {
  slack: 'bg-purple-100 text-purple-800',
  notion: 'bg-gray-100 text-gray-800',
  mixpanel: 'bg-blue-100 text-blue-800',
  airtable: 'bg-yellow-100 text-yellow-800',
}

const STRENGTH_COLORS: Record<EvidenceStrength, string> = {
  high: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-red-100 text-red-800',
}

type TabType = 'all' | 'by-source' | 'daily-digest'

interface GroupedBySource {
  [key: string]: {
    items: InsightsFeed[]
    count: number
  }
}

interface GroupedByDate {
  [key: string]: {
    items: InsightsFeed[]
    count: number
    sources: string[]
  }
}

export default function InsightsFeedPage() {
  const [insights, setInsights] = useState<InsightsFeed[]>([])
  const [groupedBySource, setGroupedBySource] = useState<GroupedBySource | null>(null)
  const [groupedByDate, setGroupedByDate] = useState<GroupedByDate | null>(null)
  const [analyses, setAnalyses] = useState<Record<string, DailyInsightsAnalysis>>({})
  const [loading, setLoading] = useState(true)
  const [lastFetchAt, setLastFetchAt] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('all')
  const [analyzingDate, setAnalyzingDate] = useState<string | null>(null)
  const [selectedAnalysis, setSelectedAnalysis] = useState<DailyInsightsAnalysis | null>(null)

  useEffect(() => {
    fetchInsights()
  }, [showAll, activeTab])

  useEffect(() => {
    if (activeTab === 'daily-digest') {
      fetchAnalysesHistory()
    }
  }, [activeTab])

  const fetchInsights = async () => {
    try {
      let url = '/api/insights-feed'
      const params = new URLSearchParams()

      if (showAll) params.append('all', 'true')

      if (activeTab === 'by-source') {
        params.append('groupBy', 'source')
      } else if (activeTab === 'daily-digest') {
        params.append('groupBy', 'date')
        params.append('all', 'true')
      }

      if (params.toString()) {
        url += '?' + params.toString()
      }

      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setInsights(data.insights || [])
        setLastFetchAt(data.lastFetchAt)

        if (data.groupedBySource) {
          setGroupedBySource(data.groupedBySource)
        }
        if (data.groupedByDate) {
          setGroupedByDate(data.groupedByDate)
        }
      }
    } catch (error) {
      console.error('Failed to fetch insights:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAnalysesHistory = async () => {
    try {
      const response = await fetch('/api/insights-feed/analysis?history=true&limit=14')
      if (response.ok) {
        const data = await response.json()
        const analysesMap: Record<string, DailyInsightsAnalysis> = {}
        ;(data.analyses || []).forEach((a: DailyInsightsAnalysis) => {
          analysesMap[a.analysis_date] = a
        })
        setAnalyses(analysesMap)
      }
    } catch (error) {
      console.error('Failed to fetch analyses:', error)
    }
  }

  const handleAnalyze = async (date: string) => {
    setAnalyzingDate(date)
    try {
      const response = await fetch('/api/insights-feed/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date }),
      })

      if (response.ok) {
        const data = await response.json()
        setAnalyses(prev => ({
          ...prev,
          [date]: data.analysis,
        }))
      }
    } catch (error) {
      console.error('Failed to analyze:', error)
    } finally {
      setAnalyzingDate(null)
    }
  }

  const handleAddToBank = async (insightId: string) => {
    setActionLoading(insightId)
    try {
      const response = await fetch('/api/insights-feed/add-to-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ insightId }),
      })

      if (response.ok) {
        setInsights(insights.map(i =>
          i.id === insightId ? { ...i, is_added_to_bank: true } : i
        ))
        // Refresh to update grouped data
        fetchInsights()
      }
    } catch (error) {
      console.error('Failed to add to bank:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const handleDismiss = async (insightId: string) => {
    setActionLoading(insightId)
    try {
      const response = await fetch('/api/insights-feed/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ insightId }),
      })

      if (response.ok) {
        setInsights(insights.map(i =>
          i.id === insightId ? { ...i, is_dismissed: true } : i
        ))
        // Refresh to update grouped data
        fetchInsights()
      }
    } catch (error) {
      console.error('Failed to dismiss:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const pendingInsights = insights.filter(i => !i.is_added_to_bank && !i.is_dismissed)
  const processedInsights = insights.filter(i => i.is_added_to_bank || i.is_dismissed)

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading insights...</p>
      </div>
    )
  }

  // Modal for full analysis view
  if (selectedAnalysis) {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-4xl mx-auto">
          <InsightsAnalysisPanel
            analysis={selectedAnalysis}
            onClose={() => setSelectedAnalysis(null)}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
                ← Back
              </Link>
              <h1 className="text-xl font-bold">User Insights Feed</h1>
              {pendingInsights.length > 0 && (
                <Badge className="bg-blue-100 text-blue-800">
                  {pendingInsights.length} new
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Link href="/evidence-bank">
                <Button variant="outline">View Evidence Bank</Button>
              </Link>
              <Link href="/settings/integrations">
                <Button variant="outline">Settings</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'all'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              All Insights
            </button>
            <button
              onClick={() => setActiveTab('by-source')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'by-source'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              By Source
            </button>
            <button
              onClick={() => setActiveTab('daily-digest')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'daily-digest'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Daily Digest
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Last Fetch Info */}
        <div className="mb-6 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            {lastFetchAt ? (
              <>Last updated: {formatDate(lastFetchAt)}</>
            ) : (
              <>No insights fetched yet. Configure your integrations to start receiving insights.</>
            )}
          </div>
          {activeTab === 'all' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? 'Show Pending Only' : 'Show All'}
            </Button>
          )}
        </div>

        {/* ALL INSIGHTS TAB */}
        {activeTab === 'all' && (
          <>
            {/* Pending Insights */}
            {pendingInsights.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold mb-4">Pending Review ({pendingInsights.length})</h2>
                <div className="space-y-4">
                  {pendingInsights.map((insight) => (
                    <Card key={insight.id} className="border-l-4 border-l-blue-500">
                      <CardContent className="py-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-lg">{SOURCE_ICONS[insight.source_system]}</span>
                              <Badge className={SOURCE_COLORS[insight.source_system]}>
                                {insight.source_system}
                              </Badge>
                              <Badge className={STRENGTH_COLORS[insight.strength]}>
                                {insight.strength}
                              </Badge>
                            </div>
                            <h3 className="font-medium mb-1">{insight.title}</h3>
                            {insight.content && (
                              <p className="text-sm text-gray-600 mb-2">{insight.content}</p>
                            )}
                            {insight.url && (
                              <a
                                href={insight.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 hover:underline"
                              >
                                View source
                              </a>
                            )}
                            <p className="text-xs text-gray-400 mt-2">
                              Fetched {formatDate(insight.fetched_at)}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleAddToBank(insight.id)}
                              disabled={actionLoading === insight.id}
                            >
                              {actionLoading === insight.id ? '...' : 'Add to Bank'}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDismiss(insight.id)}
                              disabled={actionLoading === insight.id}
                            >
                              Dismiss
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Processed Insights (when showing all) */}
            {showAll && processedInsights.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4 text-gray-500">
                  Processed ({processedInsights.length})
                </h2>
                <div className="space-y-4 opacity-60">
                  {processedInsights.map((insight) => (
                    <Card key={insight.id}>
                      <CardContent className="py-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span>{SOURCE_ICONS[insight.source_system]}</span>
                              <h3 className="font-medium">{insight.title}</h3>
                              {insight.is_added_to_bank && (
                                <Badge className="bg-green-100 text-green-800">Added to Bank</Badge>
                              )}
                              {insight.is_dismissed && (
                                <Badge variant="outline">Dismissed</Badge>
                              )}
                            </div>
                            <p className="text-xs text-gray-400">
                              {formatDate(insight.fetched_at)}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {insights.length === 0 && (
              <Card className="text-center py-12">
                <CardContent>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No insights yet</h3>
                  <p className="text-gray-500 mb-4">
                    Configure your integrations to start receiving insights from Slack, Notion, Mixpanel, and Airtable.
                  </p>
                  <Link href="/settings/integrations">
                    <Button>Configure Integrations</Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            {pendingInsights.length === 0 && insights.length > 0 && !showAll && (
              <Card className="text-center py-12">
                <CardContent>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">All caught up!</h3>
                  <p className="text-gray-500 mb-4">
                    You&apos;ve reviewed all pending insights. New insights will appear here when fetched.
                  </p>
                  <Button variant="outline" onClick={() => setShowAll(true)}>
                    View Processed Insights
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* BY SOURCE TAB */}
        {activeTab === 'by-source' && groupedBySource && (
          <div className="space-y-4">
            {(['slack', 'notion', 'mixpanel', 'airtable'] as SourceSystem[]).map((source) => (
              <InsightsSourceGroup
                key={source}
                source={source}
                items={groupedBySource[source]?.items.filter(i => !i.is_added_to_bank && !i.is_dismissed) || []}
                onAddToBank={handleAddToBank}
                onDismiss={handleDismiss}
              />
            ))}

            {Object.values(groupedBySource).every(g =>
              g.items.filter(i => !i.is_added_to_bank && !i.is_dismissed).length === 0
            ) && (
              <Card className="text-center py-12">
                <CardContent>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No pending insights</h3>
                  <p className="text-gray-500">
                    All insights have been processed.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* DAILY DIGEST TAB */}
        {activeTab === 'daily-digest' && groupedByDate && (
          <div className="space-y-4">
            {Object.entries(groupedByDate)
              .sort(([a], [b]) => b.localeCompare(a))
              .map(([date, data]) => (
                <DailyDigestCard
                  key={date}
                  date={date}
                  insightCount={data.count}
                  sources={data.sources}
                  analysis={analyses[date] || null}
                  onAnalyze={handleAnalyze}
                  isAnalyzing={analyzingDate === date}
                  onViewDetails={(d) => analyses[d] && setSelectedAnalysis(analyses[d])}
                />
              ))}

            {Object.keys(groupedByDate).length === 0 && (
              <Card className="text-center py-12">
                <CardContent>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No insights yet</h3>
                  <p className="text-gray-500">
                    Insights will appear here grouped by day once they are fetched.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
