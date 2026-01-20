'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { AirtableSourceConfig } from '@/types/database'

interface SourceConfig {
  slack_enabled: boolean
  slack_channel_ids: string[]
  slack_channel_links: string[] // Store original links for display
  notion_enabled: boolean
  notion_database_ids: string[]
  notion_database_links: string[] // Store original links for display
  airtable_enabled: boolean
  airtable_sources: AirtableSourceConfig[]
  airtable_links: string[] // Store original links for display
  mixpanel_enabled: boolean
  auto_fetch_enabled: boolean
  auto_fetch_time: string
  lookback_hours: number
}

const DEFAULT_CONFIG: SourceConfig = {
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
  auto_fetch_enabled: false,
  auto_fetch_time: '18:00',
  lookback_hours: 24,
}

// Helper functions to extract IDs from links
function extractSlackChannelId(link: string): string | null {
  // Slack channel links: https://workspace.slack.com/archives/C01ABC123DE
  // Or just the ID: C01ABC123DE
  const archivesMatch = link.match(/archives\/([A-Z0-9]+)/i)
  if (archivesMatch) return archivesMatch[1]

  // Check if it's already an ID (starts with C or G)
  const trimmed = link.trim()
  if (/^[CG][A-Z0-9]+$/i.test(trimmed)) return trimmed.toUpperCase()

  return null
}

function extractNotionDatabaseId(link: string): string | null {
  // Notion links: https://www.notion.so/workspace/abc123def456?v=...
  // Or https://notion.so/abc123def456-title-text?v=...
  // Or just the ID: abc123def456

  const trimmed = link.trim()

  // Try to extract from URL
  const urlMatch = trimmed.match(/notion\.so\/(?:[^\/]+\/)?([a-f0-9]{32})/i)
  if (urlMatch) return urlMatch[1]

  // Check if it's a hyphenated notion URL (like abc123def456-Some-Title)
  const hyphenMatch = trimmed.match(/notion\.so\/(?:[^\/]+\/)?([a-f0-9-]+?)(?:\?|$|-[A-Za-z])/i)
  if (hyphenMatch) {
    const id = hyphenMatch[1].replace(/-/g, '')
    if (id.length === 32) return id
  }

  // Check if it's already an ID (32 hex characters, with or without hyphens)
  const cleanId = trimmed.replace(/-/g, '')
  if (/^[a-f0-9]{32}$/i.test(cleanId)) return cleanId

  return null
}

function extractAirtableIds(link: string): { baseId: string; tableId: string } | null {
  // Airtable links: https://airtable.com/appXXX/tblYYY/...
  // Or separate: appXXX and tblYYY

  const trimmed = link.trim()

  // Try to extract from URL
  const urlMatch = trimmed.match(/airtable\.com\/(app[a-zA-Z0-9]+)\/(tbl[a-zA-Z0-9]+)/i)
  if (urlMatch) return { baseId: urlMatch[1], tableId: urlMatch[2] }

  // Check if it contains both app and tbl IDs
  const appMatch = trimmed.match(/(app[a-zA-Z0-9]+)/i)
  const tblMatch = trimmed.match(/(tbl[a-zA-Z0-9]+)/i)
  if (appMatch && tblMatch) return { baseId: appMatch[1], tableId: tblMatch[1] }

  return null
}

export default function EvidenceSourcesPage() {
  const [config, setConfig] = useState<SourceConfig>(DEFAULT_CONFIG)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [fetchResult, setFetchResult] = useState<{ success: boolean; message: string } | null>(null)
  const [role, setRole] = useState<string>('')
  const [lastFetchAt, setLastFetchAt] = useState<string | null>(null)

  // Form state for adding new items
  const [newSlackLink, setNewSlackLink] = useState('')
  const [newNotionLink, setNewNotionLink] = useState('')
  const [newAirtableLink, setNewAirtableLink] = useState('')
  const [newAirtableName, setNewAirtableName] = useState('')

  // Error states
  const [slackError, setSlackError] = useState('')
  const [notionError, setNotionError] = useState('')
  const [airtableError, setAirtableError] = useState('')

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
          auto_fetch_enabled: data.config.auto_fetch_enabled ?? false,
          auto_fetch_time: data.config.auto_fetch_time || '18:00',
          lookback_hours: data.config.lookback_hours || 24,
        })
        setRole(data.role)
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
      const response = await fetch('/api/workspace/evidence-sources', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
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

  const handleFetchNow = async () => {
    // First save the configuration
    await handleSave()

    setFetching(true)
    setFetchResult(null)
    try {
      const response = await fetch('/api/workspace/fetch-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lookback_hours: config.lookback_hours
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setFetchResult({
          success: true,
          message: data.message || `Fetch triggered! Sources: ${data.sourcesFetching?.join(', ') || 'all enabled'}`
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

  const addSlackLink = () => {
    setSlackError('')
    const link = newSlackLink.trim()
    if (!link) return

    const channelId = extractSlackChannelId(link)
    if (!channelId) {
      setSlackError('Invalid Slack link. Please paste a Slack channel link or channel ID.')
      return
    }

    if (config.slack_channel_ids.includes(channelId)) {
      setSlackError('This channel is already added.')
      return
    }

    setConfig({
      ...config,
      slack_channel_ids: [...config.slack_channel_ids, channelId],
      slack_channel_links: [...config.slack_channel_links, link]
    })
    setNewSlackLink('')
  }

  const removeSlackChannel = (index: number) => {
    setConfig({
      ...config,
      slack_channel_ids: config.slack_channel_ids.filter((_, i) => i !== index),
      slack_channel_links: config.slack_channel_links.filter((_, i) => i !== index)
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

    if (config.notion_database_ids.includes(databaseId)) {
      setNotionError('This database is already added.')
      return
    }

    setConfig({
      ...config,
      notion_database_ids: [...config.notion_database_ids, databaseId],
      notion_database_links: [...config.notion_database_links, link]
    })
    setNewNotionLink('')
  }

  const removeNotionDatabase = (index: number) => {
    setConfig({
      ...config,
      notion_database_ids: config.notion_database_ids.filter((_, i) => i !== index),
      notion_database_links: config.notion_database_links.filter((_, i) => i !== index)
    })
  }

  const addAirtableLink = () => {
    setAirtableError('')
    const link = newAirtableLink.trim()
    if (!link) return

    const ids = extractAirtableIds(link)
    if (!ids) {
      setAirtableError('Invalid Airtable link. Please paste an Airtable URL containing base ID (appXXX) and table ID (tblXXX).')
      return
    }

    // Check for duplicates
    const exists = config.airtable_sources.some(
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

    setConfig({
      ...config,
      airtable_sources: [...config.airtable_sources, newSource],
      airtable_links: [...config.airtable_links, link]
    })
    setNewAirtableLink('')
    setNewAirtableName('')
  }

  const removeAirtableSource = (index: number) => {
    setConfig({
      ...config,
      airtable_sources: config.airtable_sources.filter((_, i) => i !== index),
      airtable_links: config.airtable_links.filter((_, i) => i !== index)
    })
  }

  const canEdit = role === 'owner' || role === 'admin'
  const hasEnabledSources = config.slack_enabled || config.notion_enabled ||
                           config.airtable_enabled || config.mixpanel_enabled

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
              <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
                ← Back
              </Link>
              <h1 className="text-xl font-bold">Evidence Sources</h1>
            </div>
            <div className="flex items-center gap-2">
              {canEdit && (
                <>
                  <Button
                    variant="outline"
                    onClick={handleFetchNow}
                    disabled={fetching || !hasEnabledSources}
                  >
                    {fetching ? 'Fetching...' : 'Fetch Now'}
                  </Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </>
              )}
            </div>
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
              Only workspace owners and admins can modify evidence source settings.
            </p>
          </div>
        )}

        {/* Fetch Status */}
        <Card>
          <CardHeader>
            <CardTitle>Fetch Status</CardTitle>
            <CardDescription>
              Trigger evidence fetching from your configured sources
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Last fetched:</p>
                <p className="text-sm text-gray-500">
                  {lastFetchAt
                    ? new Date(lastFetchAt).toLocaleString()
                    : 'Never'}
                </p>
              </div>
              {canEdit && (
                <Button
                  onClick={handleFetchNow}
                  disabled={fetching || !hasEnabledSources}
                  size="lg"
                >
                  {fetching ? (
                    <>
                      <span className="animate-spin mr-2">⏳</span>
                      Fetching Evidence...
                    </>
                  ) : (
                    <>
                      🔄 Fetch Evidence Now
                    </>
                  )}
                </Button>
              )}
            </div>
            {!hasEnabledSources && (
              <p className="text-sm text-amber-600">
                Enable at least one source below to start fetching evidence.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Fetch Schedule */}
        <Card>
          <CardHeader>
            <CardTitle>Auto-Fetch Schedule</CardTitle>
            <CardDescription>
              Configure automatic daily evidence fetching
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="auto_fetch_enabled"
                checked={config.auto_fetch_enabled}
                onChange={(e) => setConfig({ ...config, auto_fetch_enabled: e.target.checked })}
                disabled={!canEdit}
                className="h-4 w-4"
              />
              <Label htmlFor="auto_fetch_enabled">Enable automatic daily fetch</Label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="auto_fetch_time">Fetch Time</Label>
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
                  disabled={!canEdit}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Slack Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">💬</span>
                <div>
                  <CardTitle>Slack</CardTitle>
                  <CardDescription>Paste Slack channel links to fetch from</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="slack_enabled"
                  checked={config.slack_enabled}
                  onChange={(e) => setConfig({ ...config, slack_enabled: e.target.checked })}
                  disabled={!canEdit}
                  className="h-4 w-4"
                />
                <Label htmlFor="slack_enabled">Enabled</Label>
              </div>
            </div>
          </CardHeader>
          {config.slack_enabled && (
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Add Slack Channel</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Paste Slack channel link (e.g., https://workspace.slack.com/archives/C01ABC123)"
                    value={newSlackLink}
                    onChange={(e) => { setNewSlackLink(e.target.value); setSlackError('') }}
                    onKeyDown={(e) => e.key === 'Enter' && addSlackLink()}
                    disabled={!canEdit}
                    className="flex-1"
                  />
                  <Button variant="outline" onClick={addSlackLink} disabled={!canEdit}>
                    Add
                  </Button>
                </div>
                {slackError && <p className="text-xs text-red-500">{slackError}</p>}
                <p className="text-xs text-gray-500">
                  Right-click a channel in Slack → Copy link, then paste here
                </p>
              </div>

              {config.slack_channel_ids.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm text-gray-500">Configured Channels ({config.slack_channel_ids.length})</Label>
                  <div className="space-y-2">
                    {config.slack_channel_ids.map((channelId, index) => (
                      <div key={channelId} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div>
                          <p className="font-mono text-sm">{channelId}</p>
                          {config.slack_channel_links[index] && config.slack_channel_links[index] !== channelId && (
                            <p className="text-xs text-gray-400 truncate max-w-md">
                              {config.slack_channel_links[index]}
                            </p>
                          )}
                        </div>
                        {canEdit && (
                          <Button variant="ghost" size="sm" onClick={() => removeSlackChannel(index)}>
                            Remove
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {/* Notion Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📝</span>
                <div>
                  <CardTitle>Notion</CardTitle>
                  <CardDescription>Paste Notion database links to fetch from</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="notion_enabled"
                  checked={config.notion_enabled}
                  onChange={(e) => setConfig({ ...config, notion_enabled: e.target.checked })}
                  disabled={!canEdit}
                  className="h-4 w-4"
                />
                <Label htmlFor="notion_enabled">Enabled</Label>
              </div>
            </div>
          </CardHeader>
          {config.notion_enabled && (
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Add Notion Database</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Paste Notion database link (e.g., https://notion.so/workspace/abc123...)"
                    value={newNotionLink}
                    onChange={(e) => { setNewNotionLink(e.target.value); setNotionError('') }}
                    onKeyDown={(e) => e.key === 'Enter' && addNotionLink()}
                    disabled={!canEdit}
                    className="flex-1"
                  />
                  <Button variant="outline" onClick={addNotionLink} disabled={!canEdit}>
                    Add
                  </Button>
                </div>
                {notionError && <p className="text-xs text-red-500">{notionError}</p>}
                <p className="text-xs text-gray-500">
                  Open your Notion database in full page view, copy the URL, then paste here
                </p>
              </div>

              {config.notion_database_ids.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm text-gray-500">Configured Databases ({config.notion_database_ids.length})</Label>
                  <div className="space-y-2">
                    {config.notion_database_ids.map((dbId, index) => (
                      <div key={dbId} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div>
                          <p className="font-mono text-sm">{dbId.slice(0, 8)}...{dbId.slice(-8)}</p>
                          {config.notion_database_links[index] && config.notion_database_links[index] !== dbId && (
                            <p className="text-xs text-gray-400 truncate max-w-md">
                              {config.notion_database_links[index]}
                            </p>
                          )}
                        </div>
                        {canEdit && (
                          <Button variant="ghost" size="sm" onClick={() => removeNotionDatabase(index)}>
                            Remove
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {/* Airtable Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📋</span>
                <div>
                  <CardTitle>Airtable</CardTitle>
                  <CardDescription>Paste Airtable table links to fetch from</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="airtable_enabled"
                  checked={config.airtable_enabled}
                  onChange={(e) => setConfig({ ...config, airtable_enabled: e.target.checked })}
                  disabled={!canEdit}
                  className="h-4 w-4"
                />
                <Label htmlFor="airtable_enabled">Enabled</Label>
              </div>
            </div>
          </CardHeader>
          {config.airtable_enabled && (
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Add Airtable Table</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Paste Airtable URL (e.g., https://airtable.com/appXXX/tblYYY/...)"
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
                      className="w-40"
                    />
                    <Button variant="outline" onClick={addAirtableLink} disabled={!canEdit}>
                      Add
                    </Button>
                  </div>
                  {airtableError && <p className="text-xs text-red-500">{airtableError}</p>}
                  <p className="text-xs text-gray-500">
                    Open your Airtable table, copy the URL from the browser, then paste here
                  </p>
                </div>
              </div>

              {config.airtable_sources.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm text-gray-500">Configured Tables ({config.airtable_sources.length})</Label>
                  <div className="space-y-2">
                    {config.airtable_sources.map((source, index) => (
                      <div
                        key={`${source.base_id}-${source.table_id}`}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{source.name || 'Unnamed Table'}</p>
                          <p className="text-xs text-gray-500 font-mono">
                            {source.base_id} / {source.table_id}
                          </p>
                          {config.airtable_links[index] && (
                            <p className="text-xs text-gray-400 truncate max-w-md">
                              {config.airtable_links[index]}
                            </p>
                          )}
                        </div>
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeAirtableSource(index)}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {/* Mixpanel Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📊</span>
                <div>
                  <CardTitle>Mixpanel</CardTitle>
                  <CardDescription>Workspace-wide analytics integration</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="mixpanel_enabled"
                  checked={config.mixpanel_enabled}
                  onChange={(e) => setConfig({ ...config, mixpanel_enabled: e.target.checked })}
                  disabled={!canEdit}
                  className="h-4 w-4"
                />
                <Label htmlFor="mixpanel_enabled">Enabled</Label>
              </div>
            </div>
          </CardHeader>
          {config.mixpanel_enabled && (
            <CardContent>
              <p className="text-sm text-gray-600">
                Mixpanel credentials are configured in n8n. When enabled, the workflow will
                fetch analytics data for your workspace using the configured project.
              </p>
            </CardContent>
          )}
        </Card>

        {/* Info about how it works */}
        <Card>
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-gray-600">
            <p>
              When you click <strong>Fetch Now</strong> or the auto-fetch runs:
            </p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Only enabled sources with configured links are fetched</li>
              <li>The n8n workflow fetches data from each source</li>
              <li>AI analyzes the evidence to extract insights</li>
              <li>Insights are saved to your workspace and visible in the Insights Feed</li>
            </ol>
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-blue-800 text-sm">
                <strong>Note:</strong> Evidence linked to sticky notes in your sessions is separate
                from this configuration. Only the sources you configure here will be fetched by n8n.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
