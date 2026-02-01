'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SidebarLayout } from '@/components/sidebar-layout'

interface CalibrationStats {
  overall_accuracy: number | null
  total_resolved: number
  total_success: number
  commit_accuracy: number | null
  commit_total: number
  source_reliability: Record<string, { total: number; successful: number }>
}

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Manual',
  slack: 'Slack',
  notion: 'Notion',
  mixpanel: 'Mixpanel',
  airtable: 'Airtable',
  intercom: 'Intercom',
  gong: 'Gong',
  interview: 'Interview',
  support: 'Support',
  analytics: 'Analytics',
  social: 'Social',
}

export default function CalibrationPage() {
  const [stats, setStats] = useState<CalibrationStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [recalculating, setRecalculating] = useState(false)

  useEffect(() => {
    fetchCalibration()
  }, [])

  async function fetchCalibration() {
    try {
      const res = await fetch('/api/calibration')
      if (res.ok) {
        const data = await res.json()
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Failed to fetch calibration:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleRecalculate() {
    setRecalculating(true)
    try {
      await fetch('/api/calibration/recalculate', { method: 'POST' })
      await fetchCalibration()
    } catch (error) {
      console.error('Failed to recalculate:', error)
    } finally {
      setRecalculating(false)
    }
  }

  const sourceEntries = stats?.source_reliability
    ? Object.entries(stats.source_reliability)
        .map(([source, data]) => ({
          source,
          label: SOURCE_LABELS[source] || source,
          total: data.total,
          successful: data.successful,
          rate: data.total > 0 ? Math.round((data.successful / data.total) * 100) : 0,
        }))
        .sort((a, b) => b.rate - a.rate)
    : []

  return (
    <SidebarLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold text-gray-900">Calibration Dashboard</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRecalculate}
          disabled={recalculating}
        >
          {recalculating ? 'Recalculating...' : 'Recalculate'}
        </Button>
      </div>

      <div className="space-y-6">
        {loading ? (
          <p className="text-gray-500 text-center py-8">Loading calibration data...</p>
        ) : !stats || stats.total_resolved === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No calibration data yet</h3>
              <p className="text-gray-500 mb-4">
                Track outcomes on your decisions to see calibration metrics. Start by{' '}
                <Link href="/outcomes" className="text-blue-600 hover:underline">tracking outcomes</Link>.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Overview Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Overall Accuracy</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end gap-2">
                    <span className={`text-4xl font-bold ${
                      stats.overall_accuracy !== null
                        ? stats.overall_accuracy >= 70 ? 'text-green-600'
                        : stats.overall_accuracy >= 40 ? 'text-yellow-600'
                        : 'text-red-600'
                        : 'text-gray-400'
                    }`}>
                      {stats.overall_accuracy !== null ? `${stats.overall_accuracy}%` : '--'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {stats.total_success} successful / {stats.total_resolved} resolved
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Commit Accuracy</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end gap-2">
                    <span className={`text-4xl font-bold ${
                      stats.commit_accuracy !== null
                        ? stats.commit_accuracy >= 70 ? 'text-green-600'
                        : stats.commit_accuracy >= 40 ? 'text-yellow-600'
                        : 'text-red-600'
                        : 'text-gray-400'
                    }`}>
                      {stats.commit_accuracy !== null ? `${stats.commit_accuracy}%` : '--'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Of {stats.commit_total} committed decisions
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Decisions Tracked</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-gray-900">{stats.total_resolved}</div>
                  <p className="text-xs text-gray-500 mt-1">With resolved outcomes</p>
                </CardContent>
              </Card>
            </div>

            {/* Source Reliability */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Source Reliability</CardTitle>
                <CardDescription>
                  Which evidence sources lead to successful outcomes?
                </CardDescription>
              </CardHeader>
              <CardContent>
                {sourceEntries.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">
                    No source data available yet. Link evidence to decisions and track outcomes.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {sourceEntries.map(entry => (
                      <div key={entry.source} className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-700">{entry.label}</span>
                          <span className="text-sm text-gray-500">
                            {entry.rate}% ({entry.successful}/{entry.total})
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              entry.rate >= 70 ? 'bg-green-500'
                              : entry.rate >= 40 ? 'bg-yellow-500'
                              : 'bg-red-500'
                            }`}
                            style={{ width: `${entry.rate}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Interpretation Guide */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-gray-500">How to Read This</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-gray-600 space-y-2">
                <p>
                  <strong>Overall Accuracy</strong> shows the percentage of decisions that led to
                  successful outcomes. Higher is better, but 100% may indicate you're only making safe bets.
                </p>
                <p>
                  <strong>Commit Accuracy</strong> specifically tracks decisions you committed to
                  (evidence strength &ge; 70%). This validates whether your evidence threshold is well-calibrated.
                </p>
                <p>
                  <strong>Source Reliability</strong> shows which evidence sources correlate with
                  successful outcomes. Deprioritize sources with low reliability in future decisions.
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </SidebarLayout>
  )
}
