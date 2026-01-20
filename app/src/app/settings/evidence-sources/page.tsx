'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { WorkspaceEvidenceSources, AirtableSourceConfig } from '@/types/database'

interface SourceConfig {
  slack_enabled: boolean
  slack_channel_ids: string[]
  notion_enabled: boolean
  notion_database_ids: string[]
  airtable_enabled: boolean
  airtable_sources: AirtableSourceConfig[]
  mixpanel_enabled: boolean
  auto_fetch_enabled: boolean
  auto_fetch_time: string
  lookback_hours: number
}

const DEFAULT_CONFIG: SourceConfig = {
  slack_enabled: false,
  slack_channel_ids: [],
  notion_enabled: false,
  notion_database_ids: [],
  airtable_enabled: false,
  airtable_sources: [],
  mixpanel_enabled: false,
  auto_fetch_enabled: false,
  auto_fetch_time: '18:00',
  lookback_hours: 24,
}

export default function EvidenceSourcesPage() {
  const [config, setConfig] = useState<SourceConfig>(DEFAULT_CONFIG)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [role, setRole] = useState<string>('')

  // Form state for adding new items
  const [newSlackChannel, setNewSlackChannel] = useState('')
  const [newNotionDatabase, setNewNotionDatabase] = useState('')
  const [newAirtableBase, setNewAirtableBase] = useState('')
  const [newAirtableTable, setNewAirtableTable] = useState('')
  const [newAirtableName, setNewAirtableName] = useState('')

  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/workspace/evidence-sources')
      if (response.ok) {
        const data = await response.json()
        setConfig({
          slack_enabled: data.config.slack_enabled ?? false,
          slack_channel_ids: data.config.slack_channel_ids || [],
          notion_enabled: data.config.notion_enabled ?? false,
          notion_database_ids: data.config.notion_database_ids || [],
          airtable_enabled: data.config.airtable_enabled ?? false,
          airtable_sources: data.config.airtable_sources || [],
          mixpanel_enabled: data.config.mixpanel_enabled ?? false,
          auto_fetch_enabled: data.config.auto_fetch_enabled ?? false,
          auto_fetch_time: data.config.auto_fetch_time || '18:00',
          lookback_hours: data.config.lookback_hours || 24,
        })
        setRole(data.role)
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
      }
    } catch (error) {
      console.error('Failed to save config:', error)
      alert('Failed to save configuration')
    } finally {
      setSaving(false)
    }
  }

  const addSlackChannel = () => {
    if (newSlackChannel.trim() && !config.slack_channel_ids.includes(newSlackChannel.trim())) {
      setConfig({
        ...config,
        slack_channel_ids: [...config.slack_channel_ids, newSlackChannel.trim()]
      })
      setNewSlackChannel('')
    }
  }

  const removeSlackChannel = (channel: string) => {
    setConfig({
      ...config,
      slack_channel_ids: config.slack_channel_ids.filter(c => c !== channel)
    })
  }

  const addNotionDatabase = () => {
    if (newNotionDatabase.trim() && !config.notion_database_ids.includes(newNotionDatabase.trim())) {
      setConfig({
        ...config,
        notion_database_ids: [...config.notion_database_ids, newNotionDatabase.trim()]
      })
      setNewNotionDatabase('')
    }
  }

  const removeNotionDatabase = (dbId: string) => {
    setConfig({
      ...config,
      notion_database_ids: config.notion_database_ids.filter(id => id !== dbId)
    })
  }

  const addAirtableSource = () => {
    if (newAirtableBase.trim() && newAirtableTable.trim()) {
      const newSource: AirtableSourceConfig = {
        base_id: newAirtableBase.trim(),
        table_id: newAirtableTable.trim(),
        name: newAirtableName.trim() || undefined
      }
      // Check for duplicates
      const exists = config.airtable_sources.some(
        s => s.base_id === newSource.base_id && s.table_id === newSource.table_id
      )
      if (!exists) {
        setConfig({
          ...config,
          airtable_sources: [...config.airtable_sources, newSource]
        })
        setNewAirtableBase('')
        setNewAirtableTable('')
        setNewAirtableName('')
      }
    }
  }

  const removeAirtableSource = (baseId: string, tableId: string) => {
    setConfig({
      ...config,
      airtable_sources: config.airtable_sources.filter(
        s => !(s.base_id === baseId && s.table_id === tableId)
      )
    })
  }

  const canEdit = role === 'owner' || role === 'admin'

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
        {!canEdit && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800 text-sm">
              Only workspace owners and admins can modify evidence source settings.
            </p>
          </div>
        )}

        {/* Fetch Schedule */}
        <Card>
          <CardHeader>
            <CardTitle>Fetch Schedule</CardTitle>
            <CardDescription>
              Configure when to automatically fetch evidence from your sources
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
                  <CardDescription>Configure Slack channels to fetch from</CardDescription>
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
                <Label>Channel IDs</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g., C01ABC123DE"
                    value={newSlackChannel}
                    onChange={(e) => setNewSlackChannel(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addSlackChannel()}
                    disabled={!canEdit}
                  />
                  <Button variant="outline" onClick={addSlackChannel} disabled={!canEdit}>
                    Add
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  Find channel IDs by right-clicking a channel in Slack → Copy link → extract the ID
                </p>
              </div>

              {config.slack_channel_ids.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {config.slack_channel_ids.map((channel) => (
                    <Badge key={channel} variant="secondary" className="flex items-center gap-1">
                      {channel}
                      {canEdit && (
                        <button
                          onClick={() => removeSlackChannel(channel)}
                          className="ml-1 text-gray-500 hover:text-gray-700"
                        >
                          ×
                        </button>
                      )}
                    </Badge>
                  ))}
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
                  <CardDescription>Configure Notion databases to fetch from</CardDescription>
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
                <Label>Database IDs</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g., abc123def456..."
                    value={newNotionDatabase}
                    onChange={(e) => setNewNotionDatabase(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addNotionDatabase()}
                    disabled={!canEdit}
                  />
                  <Button variant="outline" onClick={addNotionDatabase} disabled={!canEdit}>
                    Add
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  Find database IDs from the Notion URL: notion.so/workspace/[database-id]?v=...
                </p>
              </div>

              {config.notion_database_ids.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {config.notion_database_ids.map((dbId) => (
                    <Badge key={dbId} variant="secondary" className="flex items-center gap-1">
                      {dbId.slice(0, 8)}...
                      {canEdit && (
                        <button
                          onClick={() => removeNotionDatabase(dbId)}
                          className="ml-1 text-gray-500 hover:text-gray-700"
                        >
                          ×
                        </button>
                      )}
                    </Badge>
                  ))}
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
                  <CardDescription>Configure Airtable bases and tables to fetch from</CardDescription>
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
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label>Base ID</Label>
                    <Input
                      placeholder="appXXXXXX"
                      value={newAirtableBase}
                      onChange={(e) => setNewAirtableBase(e.target.value)}
                      disabled={!canEdit}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Table ID</Label>
                    <Input
                      placeholder="tblXXXXXX"
                      value={newAirtableTable}
                      onChange={(e) => setNewAirtableTable(e.target.value)}
                      disabled={!canEdit}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Name (optional)</Label>
                    <Input
                      placeholder="Feedback"
                      value={newAirtableName}
                      onChange={(e) => setNewAirtableName(e.target.value)}
                      disabled={!canEdit}
                    />
                  </div>
                </div>
                <Button variant="outline" onClick={addAirtableSource} disabled={!canEdit}>
                  Add Airtable Source
                </Button>
                <p className="text-xs text-gray-500">
                  Find Base ID from airtable.com/[base-id]/... and Table ID from the API docs
                </p>
              </div>

              {config.airtable_sources.length > 0 && (
                <div className="space-y-2">
                  {config.airtable_sources.map((source) => (
                    <div
                      key={`${source.base_id}-${source.table_id}`}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{source.name || 'Unnamed Source'}</p>
                        <p className="text-xs text-gray-500">
                          Base: {source.base_id} | Table: {source.table_id}
                        </p>
                      </div>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeAirtableSource(source.base_id, source.table_id)}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  ))}
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
                  <CardDescription>Workspace-wide analytics integration (no per-source config)</CardDescription>
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

        {/* Info about n8n workflow */}
        <Card>
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-gray-600">
            <p>
              When you trigger a fetch (manually or via schedule), this configuration is sent to
              the n8n workflow which:
            </p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Fetches data from each enabled source using your specified IDs</li>
              <li>Analyzes the evidence with AI to extract insights</li>
              <li>Sends only the analyzed insights back to your workspace</li>
            </ol>
            <p className="mt-4">
              <strong>Note:</strong> Make sure your n8n workflow has the correct credentials
              configured for each service (Slack OAuth, Notion API Key, Airtable API Key, etc.)
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
