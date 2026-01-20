'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface ScheduleConfig {
  auto_fetch_enabled: boolean
  auto_fetch_time: string
  lookback_hours: number
}

interface SourceStatus {
  slack_enabled: boolean
  slack_count: number
  notion_enabled: boolean
  notion_count: number
  airtable_enabled: boolean
  airtable_count: number
  mixpanel_enabled: boolean
}

const DEFAULT_CONFIG: ScheduleConfig = {
  auto_fetch_enabled: false,
  auto_fetch_time: '18:00',
  lookback_hours: 24,
}

export default function InsightsSchedulePage() {
  const [config, setConfig] = useState<ScheduleConfig>(DEFAULT_CONFIG)
  const [sourceStatus, setSourceStatus] = useState<SourceStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [fetchResult, setFetchResult] = useState<{ success: boolean; message: string } | null>(null)
  const [role, setRole] = useState<string>('')
  const [lastFetchAt, setLastFetchAt] = useState<string | null>(null)

  // For "Run Now" with custom timeframe
  const [customLookback, setCustomLookback] = useState<number>(24)
  const [scheduleDate, setScheduleDate] = useState<string>('')
  const [scheduleTime, setScheduleTime] = useState<string>('')

  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    try {
      const [configResponse, statusResponse] = await Promise.all([
        fetch('/api/workspace/evidence-sources'),
        fetch('/api/workspace/fetch-now')
      ])

      if (configResponse.ok) {
        const data = await configResponse.json()
        setConfig({
          auto_fetch_enabled: data.config.auto_fetch_enabled ?? false,
          auto_fetch_time: data.config.auto_fetch_time || '18:00',
          lookback_hours: data.config.lookback_hours || 24,
        })
        setSourceStatus({
          slack_enabled: data.config.slack_enabled ?? false,
          slack_count: data.config.slack_channel_ids?.length || 0,
          notion_enabled: data.config.notion_enabled ?? false,
          notion_count: data.config.notion_database_ids?.length || 0,
          airtable_enabled: data.config.airtable_enabled ?? false,
          airtable_count: data.config.airtable_sources?.length || 0,
          mixpanel_enabled: data.config.mixpanel_enabled ?? false,
        })
        setRole(data.role)
        setCustomLookback(data.config.lookback_hours || 24)
      }

      if (statusResponse.ok) {
        const statusData = await statusResponse.json()
        setLastFetchAt(statusData.lastFetchAt)
      }
    } catch (error) {
      console.error('Failed to fetch config:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Fetch current full config first
      const currentResponse = await fetch('/api/workspace/evidence-sources')
      const currentData = await currentResponse.json()

      // Merge schedule config with existing source config
      const response = await fetch('/api/workspace/evidence-sources', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...currentData.config,
          auto_fetch_enabled: config.auto_fetch_enabled,
          auto_fetch_time: config.auto_fetch_time,
          lookback_hours: config.lookback_hours,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        alert(data.error || 'Failed to save')
      } else {
        setFetchResult({ success: true, message: 'Schedule saved successfully!' })
        setTimeout(() => setFetchResult(null), 3000)
      }
    } catch (error) {
      console.error('Failed to save config:', error)
      alert('Failed to save configuration')
    } finally {
      setSaving(false)
    }
  }

  const handleFetchNow = async () => {
    setFetching(true)
    setFetchResult(null)
    try {
      const response = await fetch('/api/workspace/fetch-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lookback_hours: customLookback
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setFetchResult({
          success: true,
          message: data.message || `Insights fetch triggered! Sources: ${data.sourcesFetching?.join(', ') || 'all enabled'}`
        })
        setLastFetchAt(new Date().toISOString())
      } else {
        setFetchResult({
          success: false,
          message: data.error || data.message || 'Failed to trigger fetch'
        })
      }
    } catch (error) {
      console.error('Fetch error:', error)
      setFetchResult({
        success: false,
        message: 'Failed to connect to fetch service'
      })
    } finally {
      setFetching(false)
    }
  }

  const handleScheduleFetch = async () => {
    if (!scheduleDate || !scheduleTime) {
      setFetchResult({ success: false, message: 'Please select both date and time' })
      return
    }

    setFetching(true)
    setFetchResult(null)
    try {
      const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`)

      const response = await fetch('/api/workspace/schedule-fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lookback_hours: customLookback,
          scheduled_at: scheduledAt.toISOString()
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setFetchResult({
          success: true,
          message: `Insights fetch scheduled for ${scheduledAt.toLocaleString()}`
        })
        setScheduleDate('')
        setScheduleTime('')
      } else {
        setFetchResult({
          success: false,
          message: data.error || 'Failed to schedule fetch'
        })
      }
    } catch (error) {
      console.error('Schedule error:', error)
      setFetchResult({
        success: false,
        message: 'Failed to schedule fetch'
      })
    } finally {
      setFetching(false)
    }
  }

  const canEdit = role === 'owner' || role === 'admin'
  const hasEnabledSources = sourceStatus && (
    sourceStatus.slack_enabled ||
    sourceStatus.notion_enabled ||
    sourceStatus.airtable_enabled ||
    sourceStatus.mixpanel_enabled
  )

  const enabledSourceCount = sourceStatus ? [
    sourceStatus.slack_enabled,
    sourceStatus.notion_enabled,
    sourceStatus.airtable_enabled,
    sourceStatus.mixpanel_enabled
  ].filter(Boolean).length : 0

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading configuration...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link href="/insights" className="text-gray-600 hover:text-gray-900">
                ← Back to Insights
              </Link>
              <h1 className="text-xl font-bold">Insights Schedule</h1>
            </div>
            {canEdit && (
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Schedule'}
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Fetch Result Alert */}
        {fetchResult && (
          <div className={`p-4 rounded-lg ${fetchResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <p className={fetchResult.success ? 'text-green-800' : 'text-red-800'}>
              {fetchResult.message}
            </p>
          </div>
        )}

        {!canEdit && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800 text-sm">
              Only workspace owners and admins can modify schedule settings.
            </p>
          </div>
        )}

        {/* Source Status */}
        <Card>
          <CardHeader>
            <CardTitle>Configured Sources</CardTitle>
            <CardDescription>
              These sources will be fetched when running analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sourceStatus && hasEnabledSources ? (
              <div className="flex flex-wrap gap-3">
                {sourceStatus.slack_enabled && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 rounded-lg">
                    <span className="text-lg">💬</span>
                    <span className="text-sm font-medium">Slack</span>
                    <span className="text-xs text-gray-500">({sourceStatus.slack_count} channels)</span>
                  </div>
                )}
                {sourceStatus.notion_enabled && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg">
                    <span className="text-lg">📝</span>
                    <span className="text-sm font-medium">Notion</span>
                    <span className="text-xs text-gray-500">({sourceStatus.notion_count} databases)</span>
                  </div>
                )}
                {sourceStatus.airtable_enabled && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 rounded-lg">
                    <span className="text-lg">📋</span>
                    <span className="text-sm font-medium">Airtable</span>
                    <span className="text-xs text-gray-500">({sourceStatus.airtable_count} tables)</span>
                  </div>
                )}
                {sourceStatus.mixpanel_enabled && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg">
                    <span className="text-lg">📊</span>
                    <span className="text-sm font-medium">Mixpanel</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-500 mb-3">No sources configured yet</p>
                <Link href="/settings/evidence-sources">
                  <Button variant="outline">Configure Sources</Button>
                </Link>
              </div>
            )}
            {hasEnabledSources && (
              <div className="mt-4 pt-4 border-t">
                <Link href="/settings/evidence-sources" className="text-sm text-blue-600 hover:underline">
                  Manage source configuration →
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Run Now */}
        <Card>
          <CardHeader>
            <CardTitle>Run Analysis Now</CardTitle>
            <CardDescription>
              Immediately fetch and analyze insights from your configured sources
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Last run:</p>
                <p className="text-sm text-gray-500">
                  {lastFetchAt
                    ? new Date(lastFetchAt).toLocaleString()
                    : 'Never'}
                </p>
              </div>
            </div>

            <div className="flex items-end gap-4">
              <div className="flex-1 space-y-2">
                <Label htmlFor="custom_lookback">Timeframe (hours)</Label>
                <Input
                  id="custom_lookback"
                  type="number"
                  min="1"
                  max="168"
                  value={customLookback}
                  onChange={(e) => setCustomLookback(parseInt(e.target.value) || 24)}
                  disabled={!canEdit}
                  className="w-32"
                />
                <p className="text-xs text-gray-500">Fetch insights from the last {customLookback} hours</p>
              </div>
              <Button
                onClick={handleFetchNow}
                disabled={fetching || !hasEnabledSources}
                size="lg"
              >
                {fetching ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    Running Analysis...
                  </>
                ) : (
                  <>
                    🔍 Run Analysis Now
                  </>
                )}
              </Button>
            </div>

            {!hasEnabledSources && (
              <p className="text-sm text-amber-600">
                Configure at least one source to run analysis.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Schedule for Later */}
        <Card>
          <CardHeader>
            <CardTitle>Schedule for Later</CardTitle>
            <CardDescription>
              Schedule a one-time analysis for a specific date and time
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="schedule_date">Date</Label>
                <Input
                  id="schedule_date"
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  disabled={!canEdit || !hasEnabledSources}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="schedule_time">Time</Label>
                <Input
                  id="schedule_time"
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  disabled={!canEdit || !hasEnabledSources}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="schedule_lookback">Timeframe (hours)</Label>
                <Input
                  id="schedule_lookback"
                  type="number"
                  min="1"
                  max="168"
                  value={customLookback}
                  onChange={(e) => setCustomLookback(parseInt(e.target.value) || 24)}
                  disabled={!canEdit || !hasEnabledSources}
                />
              </div>
            </div>
            <Button
              onClick={handleScheduleFetch}
              disabled={fetching || !hasEnabledSources || !scheduleDate || !scheduleTime}
              variant="outline"
            >
              📅 Schedule Analysis
            </Button>
          </CardContent>
        </Card>

        {/* Auto Schedule */}
        <Card>
          <CardHeader>
            <CardTitle>Recurring Schedule</CardTitle>
            <CardDescription>
              Automatically run analysis at a set time each day
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="auto_fetch_enabled"
                checked={config.auto_fetch_enabled}
                onChange={(e) => setConfig({ ...config, auto_fetch_enabled: e.target.checked })}
                disabled={!canEdit || !hasEnabledSources}
                className="h-4 w-4"
              />
              <Label htmlFor="auto_fetch_enabled">Enable daily automatic analysis</Label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="auto_fetch_time">Run At</Label>
                <Input
                  id="auto_fetch_time"
                  type="time"
                  value={config.auto_fetch_time}
                  onChange={(e) => setConfig({ ...config, auto_fetch_time: e.target.value })}
                  disabled={!canEdit || !config.auto_fetch_enabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lookback_hours">Lookback Period (hours)</Label>
                <Input
                  id="lookback_hours"
                  type="number"
                  min="1"
                  max="168"
                  value={config.lookback_hours}
                  onChange={(e) => setConfig({ ...config, lookback_hours: parseInt(e.target.value) || 24 })}
                  disabled={!canEdit || !config.auto_fetch_enabled}
                />
              </div>
            </div>

            {config.auto_fetch_enabled && (
              <p className="text-sm text-gray-600">
                Analysis will run daily at {config.auto_fetch_time}, fetching insights from the previous {config.lookback_hours} hours.
              </p>
            )}
          </CardContent>
        </Card>

        {/* How It Works */}
        <Card>
          <CardHeader>
            <CardTitle>How Insight Analysis Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-gray-600">
            <p>When you run analysis:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>n8n fetches data from your configured sources (Slack, Notion, etc.)</li>
              <li>AI analyzes the data to extract meaningful insights</li>
              <li>Individual insights are saved to your <Link href="/evidence-bank" className="text-blue-600 hover:underline">Evidence Bank</Link></li>
              <li>A summary and analysis appear in your <Link href="/insights" className="text-blue-600 hover:underline">Insights Feed</Link></li>
              <li>You can reference insights on sticky notes during sessions</li>
            </ol>
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-blue-800 text-sm">
                <strong>Tip:</strong> Run analysis before planning sessions to have fresh insights available
                to reference on your sticky notes.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
