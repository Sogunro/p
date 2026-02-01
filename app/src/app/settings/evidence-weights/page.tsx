'use client'

import { useState, useEffect } from 'react'
import { SidebarLayout } from '@/components/sidebar-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { WeightConfig, RecencyConfig, WeightTemplate } from '@/types/database'

interface TemplateInfo {
  label: string
  description: string
}

const SOURCE_LABELS: Record<string, { label: string; icon: string }> = {
  interview: { label: 'User Interview', icon: '🎤' },
  support: { label: 'Support Ticket', icon: '🎫' },
  sales: { label: 'Sales Call', icon: '📞' },
  analytics: { label: 'Analytics', icon: '📈' },
  slack: { label: 'Slack', icon: '💬' },
  social: { label: 'Social Media', icon: '🌐' },
  internal: { label: 'Internal', icon: '🏢' },
  manual: { label: 'Manual Entry', icon: '✏️' },
  notion: { label: 'Notion', icon: '📝' },
  mixpanel: { label: 'Mixpanel', icon: '📊' },
  airtable: { label: 'Airtable', icon: '📋' },
  intercom: { label: 'Intercom', icon: '💬' },
  gong: { label: 'Gong', icon: '🎙️' },
}

export default function EvidenceWeightsPage() {
  const [weightConfig, setWeightConfig] = useState<WeightConfig>({})
  const [weightTemplate, setWeightTemplate] = useState<WeightTemplate>('default')
  const [recencyConfig, setRecencyConfig] = useState<RecencyConfig>({ ranges: [] })
  const [targetSegments, setTargetSegments] = useState<string[]>([])
  const [newSegment, setNewSegment] = useState('')
  const [templates, setTemplates] = useState<Record<string, WeightConfig>>({})
  const [templateInfo, setTemplateInfo] = useState<Record<string, TemplateInfo>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [recalculating, setRecalculating] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  useEffect(() => {
    fetchConfig()
  }, [])

  async function fetchConfig() {
    try {
      const res = await fetch('/api/workspace/weight-config')
      if (res.ok) {
        const data = await res.json()
        setWeightConfig(data.weight_config || {})
        setWeightTemplate(data.weight_template || 'default')
        setRecencyConfig(data.recency_config || { ranges: [] })
        setTargetSegments(data.target_segments || [])
        setTemplates(data.templates || {})
        setTemplateInfo(data.template_info || {})
      }
    } catch (error) {
      console.error('Failed to fetch weight config:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    setSaveMessage('')
    try {
      const res = await fetch('/api/workspace/weight-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weight_config: weightConfig,
          weight_template: weightTemplate,
          recency_config: recencyConfig,
          target_segments: targetSegments,
        }),
      })
      if (res.ok) {
        setSaveMessage('Configuration saved')
        setTimeout(() => setSaveMessage(''), 3000)
      } else {
        setSaveMessage('Failed to save')
      }
    } catch {
      setSaveMessage('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function handleRecalculate() {
    setRecalculating(true)
    setSaveMessage('')
    try {
      const res = await fetch('/api/evidence-bank/recalculate', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setSaveMessage(data.message)
        setTimeout(() => setSaveMessage(''), 5000)
      } else {
        setSaveMessage('Recalculation failed')
      }
    } catch {
      setSaveMessage('Recalculation failed')
    } finally {
      setRecalculating(false)
    }
  }

  function handleTemplateChange(template: WeightTemplate) {
    setWeightTemplate(template)
    if (templates[template]) {
      setWeightConfig({ ...templates[template] })
    }
  }

  function handleWeightChange(source: string, value: string) {
    const num = parseFloat(value)
    if (!isNaN(num) && num >= 0 && num <= 1) {
      setWeightConfig(prev => ({ ...prev, [source]: num }))
      // Switch to custom if user edits weights manually
      if (weightTemplate !== 'default') {
        const templateWeights = templates[weightTemplate]
        if (templateWeights && templateWeights[source] !== num) {
          // Keep template label but user has customized
        }
      }
    }
  }

  function addSegment() {
    const trimmed = newSegment.trim().toLowerCase()
    if (trimmed && !targetSegments.includes(trimmed)) {
      setTargetSegments(prev => [...prev, trimmed])
      setNewSegment('')
    }
  }

  function removeSegment(segment: string) {
    setTargetSegments(prev => prev.filter(s => s !== segment))
  }

  if (loading) {
    return (
      <SidebarLayout>
        <p className="text-gray-500">Loading configuration...</p>
      </SidebarLayout>
    )
  }

  return (
    <SidebarLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold text-gray-900">Evidence Weights</h1>
      </div>
      <p className="text-gray-500 mb-6">
        Configure how different evidence sources are weighted in strength calculations.
      </p>

      {/* Template Selection */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Weight Template</CardTitle>
          <CardDescription>
            Choose a preset or customize individual weights below
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(templateInfo).map(([key, info]) => (
              <button
                key={key}
                onClick={() => handleTemplateChange(key as WeightTemplate)}
                className={`p-3 rounded-lg border text-left transition-all ${
                  weightTemplate === key
                    ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-medium text-sm">{info.label}</div>
                <div className="text-xs text-gray-500 mt-1">{info.description}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Source Weights */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Source Weights</CardTitle>
          <CardDescription>
            Set how much each source type contributes to evidence strength (0.0 - 1.0)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(weightConfig)
              .sort(([, a], [, b]) => b - a)
              .map(([source, weight]) => {
                const info = SOURCE_LABELS[source] || { label: source, icon: '📎' }
                return (
                  <div key={source} className="flex items-center gap-3">
                    <span className="text-lg w-8">{info.icon}</span>
                    <Label className="flex-1 text-sm">{info.label}</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        max={1}
                        step={0.1}
                        value={weight}
                        onChange={(e) => handleWeightChange(source, e.target.value)}
                        className="w-20 text-center text-sm"
                      />
                      <div className="w-24 bg-gray-100 rounded-full h-2">
                        <div
                          className="bg-blue-500 rounded-full h-2 transition-all"
                          style={{ width: `${weight * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
          </div>
        </CardContent>
      </Card>

      {/* Recency Decay */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Recency Decay</CardTitle>
          <CardDescription>
            How evidence age affects its weight. Newer evidence scores higher.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recencyConfig.ranges.map((range, index) => (
              <div key={index} className="flex items-center gap-4">
                <div className="flex-1">
                  <span className="text-sm text-gray-600">
                    {index === 0
                      ? `0 - ${range.max_days} days`
                      : index === recencyConfig.ranges.length - 1
                        ? `${recencyConfig.ranges[index - 1].max_days}+ days`
                        : `${recencyConfig.ranges[index - 1].max_days} - ${range.max_days} days`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={1}
                    step={0.1}
                    value={range.factor}
                    onChange={(e) => {
                      const num = parseFloat(e.target.value)
                      if (!isNaN(num) && num >= 0 && num <= 1) {
                        setRecencyConfig(prev => ({
                          ranges: prev.ranges.map((r, i) =>
                            i === index ? { ...r, factor: num } : r
                          ),
                        }))
                      }
                    }}
                    className="w-20 text-center text-sm"
                  />
                  <Badge
                    variant="outline"
                    className={
                      range.factor >= 0.8
                        ? 'text-green-600 border-green-300'
                        : range.factor >= 0.5
                          ? 'text-yellow-600 border-yellow-300'
                          : 'text-red-600 border-red-300'
                    }
                  >
                    {Math.round(range.factor * 100)}%
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Target Segments */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Target Segments</CardTitle>
          <CardDescription>
            Define your target user segments. Evidence matching these segments gets a higher score.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            {targetSegments.map(segment => (
              <Badge
                key={segment}
                variant="secondary"
                className="cursor-pointer hover:bg-red-100 px-3 py-1"
                onClick={() => removeSegment(segment)}
              >
                {segment} ×
              </Badge>
            ))}
            {targetSegments.length === 0 && (
              <p className="text-sm text-gray-400">No target segments defined — all segments weighted equally</p>
            )}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="e.g., enterprise, smb, mid-market"
              value={newSegment}
              onChange={(e) => setNewSegment(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addSegment()}
              className="flex-1"
            />
            <Button variant="outline" onClick={addSegment} disabled={!newSegment.trim()}>
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Configuration'}
          </Button>
          <Button variant="outline" onClick={handleRecalculate} disabled={recalculating}>
            {recalculating ? 'Recalculating...' : 'Recalculate All Evidence'}
          </Button>
        </div>
        {saveMessage && (
          <span className="text-sm text-green-600">{saveMessage}</span>
        )}
      </div>
    </SidebarLayout>
  )
}
