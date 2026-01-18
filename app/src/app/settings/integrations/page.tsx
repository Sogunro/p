'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { WorkspaceSettings } from '@/types/database'

interface Integration {
  id: 'slack' | 'notion' | 'mixpanel' | 'airtable'
  name: string
  description: string
  icon: string
  strengthDefault: 'high' | 'medium' | 'low'
}

const INTEGRATIONS: Integration[] = [
  {
    id: 'slack',
    name: 'Slack',
    description: 'Capture customer feedback from channels and support threads',
    icon: '💬',
    strengthDefault: 'medium',
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Pull research docs, meeting notes, and user interview summaries',
    icon: '📝',
    strengthDefault: 'high',
  },
  {
    id: 'mixpanel',
    name: 'Mixpanel',
    description: 'Import usage data, feature adoption metrics, and behavior insights',
    icon: '📊',
    strengthDefault: 'high',
  },
  {
    id: 'airtable',
    name: 'Airtable',
    description: 'Sync from feedback databases and feature request trackers',
    icon: '📋',
    strengthDefault: 'medium',
  },
]

export default function IntegrationsPage() {
  const [settings, setSettings] = useState<Partial<WorkspaceSettings>>({
    feed_schedule_time: '09:00',
    feed_timezone: 'UTC',
    feed_enabled: true,
    slack_enabled: false,
    notion_enabled: false,
    mixpanel_enabled: false,
    airtable_enabled: false,
  })
  const [workspaceId, setWorkspaceId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/workspace/settings')
      if (response.ok) {
        const data = await response.json()
        setSettings(data.settings)
        setWorkspaceId(data.workspace?.id || '')
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/workspace/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })

      if (response.ok) {
        // Success notification could be added here
      }
    } catch (error) {
      console.error('Failed to save settings:', error)
    } finally {
      setSaving(false)
    }
  }

  const toggleIntegration = (id: 'slack' | 'notion' | 'mixpanel' | 'airtable') => {
    const key = `${id}_enabled` as keyof WorkspaceSettings
    setSettings({ ...settings, [key]: !settings[key] })
  }

  const copyWebhookUrl = () => {
    const webhookUrl = `${window.location.origin}/api/webhook/insights`
    navigator.clipboard.writeText(webhookUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading settings...</p>
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
              <h1 className="text-xl font-bold">Integration Settings</h1>
            </div>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Feed Schedule */}
        <Card>
          <CardHeader>
            <CardTitle>Insights Feed Schedule</CardTitle>
            <CardDescription>
              Configure when n8n should fetch new insights from your connected tools
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="feed_enabled"
                  checked={settings.feed_enabled}
                  onChange={(e) => setSettings({ ...settings, feed_enabled: e.target.checked })}
                  className="h-4 w-4"
                />
                <Label htmlFor="feed_enabled">Enable daily insights feed</Label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="schedule_time">Fetch Time</Label>
                <Input
                  id="schedule_time"
                  type="time"
                  value={settings.feed_schedule_time || '09:00'}
                  onChange={(e) => setSettings({ ...settings, feed_schedule_time: e.target.value })}
                  disabled={!settings.feed_enabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <select
                  id="timezone"
                  className="w-full border rounded-md px-3 py-2 text-sm"
                  value={settings.feed_timezone || 'UTC'}
                  onChange={(e) => setSettings({ ...settings, feed_timezone: e.target.value })}
                  disabled={!settings.feed_enabled}
                >
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">Eastern Time</option>
                  <option value="America/Chicago">Central Time</option>
                  <option value="America/Denver">Mountain Time</option>
                  <option value="America/Los_Angeles">Pacific Time</option>
                  <option value="Europe/London">London</option>
                  <option value="Europe/Paris">Paris</option>
                  <option value="Asia/Tokyo">Tokyo</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Webhook URL for n8n */}
        <Card>
          <CardHeader>
            <CardTitle>n8n Webhook Configuration</CardTitle>
            <CardDescription>
              Use this URL in your n8n workflows to send insights to your Evidence Bank
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Webhook URL</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={`${typeof window !== 'undefined' ? window.location.origin : ''}/api/webhook/insights`}
                  className="font-mono text-sm"
                />
                <Button variant="outline" onClick={copyWebhookUrl}>
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Workspace ID</Label>
              <Input readOnly value={workspaceId} className="font-mono text-sm" />
              <p className="text-xs text-gray-500">
                Include this in your n8n workflow payload as &quot;workspace_id&quot;
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <Label className="mb-2 block">Example n8n Payload</Label>
              <pre className="text-xs bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto">
{`{
  "workspace_id": "${workspaceId || 'your-workspace-id'}",
  "source_system": "slack",
  "items": [
    {
      "title": "Customer feedback",
      "content": "User said...",
      "url": "https://...",
      "strength": "medium",
      "source_metadata": {
        "channel": "#feedback"
      }
    }
  ]
}`}
              </pre>
            </div>
          </CardContent>
        </Card>

        {/* Integrations */}
        <Card>
          <CardHeader>
            <CardTitle>Connected Tools</CardTitle>
            <CardDescription>
              Enable integrations to receive insights from your tools via n8n
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {INTEGRATIONS.map((integration) => {
                const key = `${integration.id}_enabled` as keyof WorkspaceSettings
                const isEnabled = settings[key] as boolean

                return (
                  <div
                    key={integration.id}
                    className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                      isEnabled ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{integration.icon}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{integration.name}</h3>
                          <Badge variant="outline" className="text-xs">
                            Default: {integration.strengthDefault}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-500">{integration.description}</p>
                      </div>
                    </div>
                    <Button
                      variant={isEnabled ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggleIntegration(integration.id)}
                    >
                      {isEnabled ? 'Enabled' : 'Enable'}
                    </Button>
                  </div>
                )
              })}
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Setting up n8n workflows</h4>
              <p className="text-sm text-blue-800">
                Create n8n workflows for each enabled integration. Use the HTTP Request node
                to POST to the webhook URL above with your workspace_id and insights data.
                The workflow should run on your configured schedule.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
