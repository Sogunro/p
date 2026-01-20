'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import type { AirtableSourceConfig } from '@/types/database'

interface ScheduleConfig {
  auto_fetch_enabled: boolean
  auto_fetch_time: string
  lookback_hours: number
}

interface SourceConfig {
  slack_enabled: boolean
  slack_channel_ids: string[]
  slack_channel_links: string[]
  notion_enabled: boolean
  notion_database_ids: string[]
  notion_database_links: string[]
  airtable_enabled: boolean
  airtable_sources: AirtableSourceConfig[]
  airtable_links: string[]
  mixpanel_enabled: boolean
}

const DEFAULT_SCHEDULE: ScheduleConfig = {
  auto_fetch_enabled: false,
  auto_fetch_time: '18:00',
  lookback_hours: 24,
}

const DEFAULT_SOURCE_CONFIG: SourceConfig = {
  slack_enabled: false,
  slack_channel_ids: [],
  slack_channel_links: [],
  notion_enabled: false,
  notion_database_ids: [],
  notion_database_links: [],
  airtable_enabled: false,
  airtable_sources: [],
  airtable_links: [],
  mixpanel_enabled: false,
}

// Helper functions to extract IDs from links
function extractSlackChannelId(link: string): string | null {
  const archivesMatch = link.match(/archives\/([A-Z0-9]+)/i)
  if (archivesMatch) return archivesMatch[1]
  const trimmed = link.trim()
  if (/^[CG][A-Z0-9]+$/i.test(trimmed)) return trimmed.toUpperCase()
  return null
}

function extractNotionDatabaseId(link: string): string | null {
  const trimmed = link.trim()
  const urlMatch = trimmed.match(/notion\.so\/(?:[^\/]+\/)?([a-f0-9]{32})/i)
  if (urlMatch) return urlMatch[1]
  const hyphenMatch = trimmed.match(/notion\.so\/(?:[^\/]+\/)?([a-f0-9-]+?)(?:\?|$|-[A-Za-z])/i)
  if (hyphenMatch) {
    const id = hyphenMatch[1].replace(/-/g, '')
    if (id.length === 32) return id
  }
  const cleanId = trimmed.replace(/-/g, '')
  if (/^[a-f0-9]{32}$/i.test(cleanId)) return cleanId
  return null
}

function extractAirtableIds(link: string): { baseId: string; tableId: string } | null {
  const trimmed = link.trim()
  const urlMatch = trimmed.match(/airtable\.com\/(app[a-zA-Z0-9]+)\/(tbl[a-zA-Z0-9]+)/i)
  if (urlMatch) return { baseId: urlMatch[1], tableId: urlMatch[2] }
  const appMatch = trimmed.match(/(app[a-zA-Z0-9]+)/i)
  const tblMatch = trimmed.match(/(tbl[a-zA-Z0-9]+)/i)
  if (appMatch && tblMatch) return { baseId: appMatch[1], tableId: tblMatch[1] }
  return null
}

export default function InsightsSchedulePage() {
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig>(DEFAULT_SCHEDULE)
  const [sourceConfig, setSourceConfig] = useState<SourceConfig>(DEFAULT_SOURCE_CONFIG)
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

  // Form state for adding sources
  const [newSlackLink, setNewSlackLink] = useState('')
  const [newNotionLink, setNewNotionLink] = useState('')
  const [newAirtableLink, setNewAirtableLink] = useState('')
  const [newAirtableName, setNewAirtableName] = useState('')
  const [slackError, setSlackError] = useState('')
  const [notionError, setNotionError] = useState('')
  const [airtableError, setAirtableError] = useState('')

  // Tab state for sources section
  const [activeSourceTab, setActiveSourceTab] = useState<'slack' | 'notion' | 'airtable' | 'mixpanel'>('slack')

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
        setScheduleConfig({
          auto_fetch_enabled: data.config.auto_fetch_enabled ?? false,
          auto_fetch_time: data.config.auto_fetch_time || '18:00',
          lookback_hours: data.config.lookback_hours || 24,
        })
        setSourceConfig({
          slack_enabled: data.config.slack_enabled ?? false,
          slack_channel_ids: data.config.slack_channel_ids || [],
          slack_channel_links: data.config.slack_channel_links || data.config.slack_channel_ids || [],
          notion_enabled: data.config.notion_enabled ?? false,
          notion_database_ids: data.config.notion_database_ids || [],
          notion_database_links: data.config.notion_database_links || data.config.notion_database_ids || [],
          airtable_enabled: data.config.airtable_enabled ?? false,
          airtable_sources: data.config.airtable_sources || [],
          airtable_links: data.config.airtable_links || [],
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
      // Save both source config and schedule config together
      const response = await fetch('/api/workspace/evidence-sources', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...sourceConfig,
          auto_fetch_enabled: scheduleConfig.auto_fetch_enabled,
          auto_fetch_time: scheduleConfig.auto_fetch_time,
          lookback_hours: scheduleConfig.lookback_hours,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        alert(data.error || 'Failed to save')
      } else {
        setFetchResult({ success: true, message: 'Configuration saved successfully!' })
        setTimeout(() => setFetchResult(null), 3000)
      }
    } catch (error) {
      console.error('Failed to save config:', error)
      alert('Failed to save configuration')
    } finally {
      setSaving(false)
    }
  }

  // Source management functions
  const addSlackLink = () => {
    setSlackError('')
    const link = newSlackLink.trim()
    if (!link) return
    const channelId = extractSlackChannelId(link)
    if (!channelId) {
      setSlackError('Invalid Slack link. Please paste a Slack channel link or channel ID.')
      return
    }
    if (sourceConfig.slack_channel_ids.includes(channelId)) {
      setSlackError('This channel is already added.')
      return
    }
    setSourceConfig({
      ...sourceConfig,
      slack_channel_ids: [...sourceConfig.slack_channel_ids, channelId],
      slack_channel_links: [...sourceConfig.slack_channel_links, link]
    })
    setNewSlackLink('')
  }

  const removeSlackChannel = (index: number) => {
    setSourceConfig({
      ...sourceConfig,
      slack_channel_ids: sourceConfig.slack_channel_ids.filter((_, i) => i !== index),
      slack_channel_links: sourceConfig.slack_channel_links.filter((_, i) => i !== index)
    })
  }

  const addNotionLink = () => {
    setNotionError('')
    const link = newNotionLink.trim()
    if (!link) return
    const databaseId = extractNotionDatabaseId(link)
    if (!databaseId) {
      setNotionError('Invalid Notion link. Please paste a Notion database link or ID.')
      return
    }
    if (sourceConfig.notion_database_ids.includes(databaseId)) {
      setNotionError('This database is already added.')
      return
    }
    setSourceConfig({
      ...sourceConfig,
      notion_database_ids: [...sourceConfig.notion_database_ids, databaseId],
      notion_database_links: [...sourceConfig.notion_database_links, link]
    })
    setNewNotionLink('')
  }

  const removeNotionDatabase = (index: number) => {
    setSourceConfig({
      ...sourceConfig,
      notion_database_ids: sourceConfig.notion_database_ids.filter((_, i) => i !== index),
      notion_database_links: sourceConfig.notion_database_links.filter((_, i) => i !== index)
    })
  }

  const addAirtableLink = () => {
    setAirtableError('')
    const link = newAirtableLink.trim()
    if (!link) return
    const ids = extractAirtableIds(link)
    if (!ids) {
      setAirtableError('Invalid Airtable link. Please paste an Airtable URL.')
      return
    }
    const exists = sourceConfig.airtable_sources.some(
      s => s.base_id === ids.baseId && s.table_id === ids.tableId
    )
    if (exists) {
      setAirtableError('This Airtable source is already added.')
      return
    }
    const newSource: AirtableSourceConfig = {
      base_id: ids.baseId,
      table_id: ids.tableId,
      name: newAirtableName.trim() || undefined
    }
    setSourceConfig({
      ...sourceConfig,
      airtable_sources: [...sourceConfig.airtable_sources, newSource],
      airtable_links: [...sourceConfig.airtable_links, link]
    })
    setNewAirtableLink('')
    setNewAirtableName('')
  }

  const removeAirtableSource = (index: number) => {
    setSourceConfig({
      ...sourceConfig,
      airtable_sources: sourceConfig.airtable_sources.filter((_, i) => i !== index),
      airtable_links: sourceConfig.airtable_links.filter((_, i) => i !== index)
    })
  }

  const handleFetchNow = async () => {
    // First save any changes
    if (hasUnsavedChanges) {
      await handleSave()
    }

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
  const hasEnabledSources = (
    sourceConfig.slack_enabled ||
    sourceConfig.notion_enabled ||
    sourceConfig.airtable_enabled ||
    sourceConfig.mixpanel_enabled
  )

  const enabledSourceCount = [
    sourceConfig.slack_enabled,
    sourceConfig.notion_enabled,
    sourceConfig.airtable_enabled,
    sourceConfig.mixpanel_enabled
  ].filter(Boolean).length

  // Track unsaved changes
  const hasUnsavedChanges = saving === false && loading === false

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
              <h1 className="text-xl font-bold">Insights Configuration</h1>
            </div>
            {canEdit && (
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
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
              Only workspace owners and admins can modify settings.
            </p>
          </div>
        )}

        {/* Source Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Configure Sources</CardTitle>
            <CardDescription>
              Add and configure the sources to fetch insights from ({enabledSourceCount} enabled)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Source Tabs */}
            <div className="flex gap-2 border-b pb-2">
              {(['slack', 'notion', 'airtable', 'mixpanel'] as const).map((source) => {
                const isEnabled = sourceConfig[`${source}_enabled` as keyof SourceConfig]
                const icons = { slack: '💬', notion: '📝', airtable: '📋', mixpanel: '📊' }
                return (
                  <button
                    key={source}
                    onClick={() => setActiveSourceTab(source)}
                    className={`px-4 py-2 rounded-t-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                      activeSourceTab === source
                        ? 'bg-white border border-b-0 border-gray-200 -mb-[1px]'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <span>{icons[source]}</span>
                    <span className="capitalize">{source}</span>
                    {isEnabled && <span className="w-2 h-2 bg-green-500 rounded-full" />}
                  </button>
                )
              })}
            </div>

            {/* Slack Tab */}
            {activeSourceTab === 'slack' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Label htmlFor="slack_enabled" className="font-medium">Enable Slack</Label>
                  </div>
                  <Checkbox
                    id="slack_enabled"
                    checked={sourceConfig.slack_enabled}
                    onCheckedChange={(checked) => setSourceConfig({ ...sourceConfig, slack_enabled: checked === true })}
                    disabled={!canEdit}
                  />
                </div>
                {sourceConfig.slack_enabled && (
                  <div className="space-y-3 pl-4 border-l-2 border-purple-200">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Paste Slack channel link..."
                        value={newSlackLink}
                        onChange={(e) => { setNewSlackLink(e.target.value); setSlackError('') }}
                        onKeyDown={(e) => e.key === 'Enter' && addSlackLink()}
                        disabled={!canEdit}
                        className="flex-1"
                      />
                      <Button variant="outline" onClick={addSlackLink} disabled={!canEdit}>Add</Button>
                    </div>
                    {slackError && <p className="text-xs text-red-500">{slackError}</p>}
                    {sourceConfig.slack_channel_ids.length > 0 && (
                      <div className="space-y-2">
                        {sourceConfig.slack_channel_ids.map((id, index) => (
                          <div key={id} className="flex items-center justify-between p-2 bg-purple-50 rounded">
                            <span className="font-mono text-sm">{id}</span>
                            {canEdit && (
                              <Button variant="ghost" size="sm" onClick={() => removeSlackChannel(index)}>Remove</Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Notion Tab */}
            {activeSourceTab === 'notion' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="notion_enabled" className="font-medium">Enable Notion</Label>
                  <Checkbox
                    id="notion_enabled"
                    checked={sourceConfig.notion_enabled}
                    onCheckedChange={(checked) => setSourceConfig({ ...sourceConfig, notion_enabled: checked === true })}
                    disabled={!canEdit}
                  />
                </div>
                {sourceConfig.notion_enabled && (
                  <div className="space-y-3 pl-4 border-l-2 border-gray-300">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Paste Notion database link..."
                        value={newNotionLink}
                        onChange={(e) => { setNewNotionLink(e.target.value); setNotionError('') }}
                        onKeyDown={(e) => e.key === 'Enter' && addNotionLink()}
                        disabled={!canEdit}
                        className="flex-1"
                      />
                      <Button variant="outline" onClick={addNotionLink} disabled={!canEdit}>Add</Button>
                    </div>
                    {notionError && <p className="text-xs text-red-500">{notionError}</p>}
                    {sourceConfig.notion_database_ids.length > 0 && (
                      <div className="space-y-2">
                        {sourceConfig.notion_database_ids.map((id, index) => (
                          <div key={id} className="flex items-center justify-between p-2 bg-gray-100 rounded">
                            <span className="font-mono text-sm">{id.slice(0, 8)}...{id.slice(-8)}</span>
                            {canEdit && (
                              <Button variant="ghost" size="sm" onClick={() => removeNotionDatabase(index)}>Remove</Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Airtable Tab */}
            {activeSourceTab === 'airtable' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="airtable_enabled" className="font-medium">Enable Airtable</Label>
                  <Checkbox
                    id="airtable_enabled"
                    checked={sourceConfig.airtable_enabled}
                    onCheckedChange={(checked) => setSourceConfig({ ...sourceConfig, airtable_enabled: checked === true })}
                    disabled={!canEdit}
                  />
                </div>
                {sourceConfig.airtable_enabled && (
                  <div className="space-y-3 pl-4 border-l-2 border-yellow-300">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Paste Airtable URL..."
                        value={newAirtableLink}
                        onChange={(e) => { setNewAirtableLink(e.target.value); setAirtableError('') }}
                        disabled={!canEdit}
                        className="flex-1"
                      />
                      <Input
                        placeholder="Name (optional)"
                        value={newAirtableName}
                        onChange={(e) => setNewAirtableName(e.target.value)}
                        disabled={!canEdit}
                        className="w-32"
                      />
                      <Button variant="outline" onClick={addAirtableLink} disabled={!canEdit}>Add</Button>
                    </div>
                    {airtableError && <p className="text-xs text-red-500">{airtableError}</p>}
                    {sourceConfig.airtable_sources.length > 0 && (
                      <div className="space-y-2">
                        {sourceConfig.airtable_sources.map((source, index) => (
                          <div key={`${source.base_id}-${source.table_id}`} className="flex items-center justify-between p-2 bg-yellow-50 rounded">
                            <div>
                              <p className="font-medium">{source.name || 'Unnamed Table'}</p>
                              <p className="text-xs text-gray-500 font-mono">{source.base_id} / {source.table_id}</p>
                            </div>
                            {canEdit && (
                              <Button variant="ghost" size="sm" onClick={() => removeAirtableSource(index)}>Remove</Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Mixpanel Tab */}
            {activeSourceTab === 'mixpanel' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="mixpanel_enabled" className="font-medium">Enable Mixpanel</Label>
                  <Checkbox
                    id="mixpanel_enabled"
                    checked={sourceConfig.mixpanel_enabled}
                    onCheckedChange={(checked) => setSourceConfig({ ...sourceConfig, mixpanel_enabled: checked === true })}
                    disabled={!canEdit}
                  />
                </div>
                {sourceConfig.mixpanel_enabled && (
                  <div className="pl-4 border-l-2 border-blue-300">
                    <p className="text-sm text-gray-600">
                      Mixpanel credentials are configured in n8n. When enabled, the workflow will
                      fetch analytics data for your workspace using the configured project.
                    </p>
                  </div>
                )}
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
              <div className="flex items-center gap-2 text-sm text-gray-500">
                {enabledSourceCount} source{enabledSourceCount !== 1 ? 's' : ''} enabled
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
                Enable at least one source above to run analysis.
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
            {!hasEnabledSources && (
              <p className="text-xs text-gray-500">Enable at least one source to schedule analysis.</p>
            )}
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
            <div className="flex items-center gap-3">
              <Checkbox
                id="auto_fetch_enabled"
                checked={scheduleConfig.auto_fetch_enabled}
                onCheckedChange={(checked) => setScheduleConfig({ ...scheduleConfig, auto_fetch_enabled: checked === true })}
                disabled={!canEdit}
              />
              <Label htmlFor="auto_fetch_enabled" className="cursor-pointer">Enable daily automatic analysis</Label>
            </div>

            {scheduleConfig.auto_fetch_enabled && (
              <div className="grid grid-cols-2 gap-4 pl-7">
                <div className="space-y-2">
                  <Label htmlFor="auto_fetch_time">Run At</Label>
                  <Input
                    id="auto_fetch_time"
                    type="time"
                    value={scheduleConfig.auto_fetch_time}
                    onChange={(e) => setScheduleConfig({ ...scheduleConfig, auto_fetch_time: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lookback_hours">Lookback Period (hours)</Label>
                  <Input
                    id="lookback_hours"
                    type="number"
                    min="1"
                    max="168"
                    value={scheduleConfig.lookback_hours}
                    onChange={(e) => setScheduleConfig({ ...scheduleConfig, lookback_hours: parseInt(e.target.value) || 24 })}
                  />
                </div>
              </div>
            )}

            {scheduleConfig.auto_fetch_enabled && (
              <p className="text-sm text-gray-600 pl-7">
                Analysis will run daily at {scheduleConfig.auto_fetch_time}, fetching insights from the previous {scheduleConfig.lookback_hours} hours.
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
