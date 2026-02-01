'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface IntegrationConfig {
  id?: string
  is_active: boolean
  team_id?: string
  base_url?: string
  project_key?: string
  config?: Record<string, string>
}

export default function PMToolsSettingsPage() {
  // Linear state
  const [linear, setLinear] = useState<IntegrationConfig | null>(null)
  const [linearApiKey, setLinearApiKey] = useState('')
  const [linearTeamId, setLinearTeamId] = useState('')
  const [linearSaving, setLinearSaving] = useState(false)
  const [linearStatus, setLinearStatus] = useState('')

  // Jira state
  const [jira, setJira] = useState<IntegrationConfig | null>(null)
  const [jiraApiKey, setJiraApiKey] = useState('')
  const [jiraBaseUrl, setJiraBaseUrl] = useState('')
  const [jiraProjectKey, setJiraProjectKey] = useState('')
  const [jiraEmail, setJiraEmail] = useState('')
  const [jiraSaving, setJiraSaving] = useState(false)
  const [jiraStatus, setJiraStatus] = useState('')

  useEffect(() => {
    fetchLinear()
    fetchJira()
  }, [])

  async function fetchLinear() {
    try {
      const res = await fetch('/api/integrations/linear')
      if (res.ok) {
        const data = await res.json()
        if (data.integration) {
          setLinear(data.integration)
          setLinearTeamId(data.integration.team_id || '')
        }
      }
    } catch (error) {
      console.error('Failed to fetch Linear config:', error)
    }
  }

  async function fetchJira() {
    try {
      const res = await fetch('/api/integrations/jira')
      if (res.ok) {
        const data = await res.json()
        if (data.integration) {
          setJira(data.integration)
          setJiraBaseUrl(data.integration.base_url || '')
          setJiraProjectKey(data.integration.project_key || '')
          setJiraEmail(data.integration.config?.email || '')
        }
      }
    } catch (error) {
      console.error('Failed to fetch Jira config:', error)
    }
  }

  async function handleSaveLinear() {
    setLinearSaving(true)
    setLinearStatus('')
    try {
      const res = await fetch('/api/integrations/linear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: linearApiKey || undefined,
          team_id: linearTeamId || undefined,
          is_active: true,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setLinear(data.integration)
        setLinearApiKey('')
        setLinearStatus('Saved successfully')
      } else {
        setLinearStatus('Failed to save')
      }
    } catch {
      setLinearStatus('Error saving')
    } finally {
      setLinearSaving(false)
    }
  }

  async function handleDisableLinear() {
    try {
      await fetch('/api/integrations/linear', { method: 'DELETE' })
      setLinear(null)
      setLinearApiKey('')
      setLinearTeamId('')
      setLinearStatus('Integration removed')
    } catch {
      setLinearStatus('Error removing')
    }
  }

  async function handleSaveJira() {
    setJiraSaving(true)
    setJiraStatus('')
    try {
      const res = await fetch('/api/integrations/jira', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: jiraApiKey || undefined,
          base_url: jiraBaseUrl || undefined,
          project_key: jiraProjectKey || undefined,
          email: jiraEmail || undefined,
          is_active: true,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setJira(data.integration)
        setJiraApiKey('')
        setJiraStatus('Saved successfully')
      } else {
        setJiraStatus('Failed to save')
      }
    } catch {
      setJiraStatus('Error saving')
    } finally {
      setJiraSaving(false)
    }
  }

  async function handleDisableJira() {
    try {
      await fetch('/api/integrations/jira', { method: 'DELETE' })
      setJira(null)
      setJiraApiKey('')
      setJiraBaseUrl('')
      setJiraProjectKey('')
      setJiraEmail('')
      setJiraStatus('Integration removed')
    } catch {
      setJiraStatus('Error removing')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <Link href="/dashboard" className="text-gray-500 hover:text-gray-700">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <h1 className="text-xl font-bold text-gray-900">PM Tool Integrations</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Linear */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-lg">Linear</CardTitle>
                <CardDescription>Push decisions to Linear as issues</CardDescription>
              </div>
              {linear?.is_active && (
                <Badge className="bg-green-100 text-green-700">Active</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">API Key</label>
              <Input
                type="password"
                placeholder={linear?.is_active ? '••••••••' : 'lin_api_...'}
                value={linearApiKey}
                onChange={(e) => setLinearApiKey(e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1">
                Generate at Linear Settings &gt; API &gt; Personal API Keys
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Team ID (optional)</label>
              <Input
                placeholder="Team UUID"
                value={linearTeamId}
                onChange={(e) => setLinearTeamId(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={handleSaveLinear} disabled={linearSaving} size="sm">
                {linearSaving ? 'Saving...' : linear?.is_active ? 'Update' : 'Enable'}
              </Button>
              {linear?.is_active && (
                <Button variant="ghost" size="sm" className="text-red-500" onClick={handleDisableLinear}>
                  Remove
                </Button>
              )}
              {linearStatus && (
                <span className="text-sm text-gray-500">{linearStatus}</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Jira */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-lg">Jira</CardTitle>
                <CardDescription>Push decisions to Jira as tickets</CardDescription>
              </div>
              {jira?.is_active && (
                <Badge className="bg-green-100 text-green-700">Active</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Email</label>
              <Input
                type="email"
                placeholder="your@email.com"
                value={jiraEmail}
                onChange={(e) => setJiraEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">API Token</label>
              <Input
                type="password"
                placeholder={jira?.is_active ? '••••••••' : 'Jira API token'}
                value={jiraApiKey}
                onChange={(e) => setJiraApiKey(e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1">
                Generate at id.atlassian.com &gt; Security &gt; API tokens
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Base URL</label>
              <Input
                placeholder="https://yourcompany.atlassian.net"
                value={jiraBaseUrl}
                onChange={(e) => setJiraBaseUrl(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Project Key</label>
              <Input
                placeholder="PROJ"
                value={jiraProjectKey}
                onChange={(e) => setJiraProjectKey(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={handleSaveJira} disabled={jiraSaving} size="sm">
                {jiraSaving ? 'Saving...' : jira?.is_active ? 'Update' : 'Enable'}
              </Button>
              {jira?.is_active && (
                <Button variant="ghost" size="sm" className="text-red-500" onClick={handleDisableJira}>
                  Remove
                </Button>
              )}
              {jiraStatus && (
                <span className="text-sm text-gray-500">{jiraStatus}</span>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
