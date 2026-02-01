'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { SidebarLayout } from '@/components/sidebar-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { OutcomeType } from '@/types/database'

interface OutcomeRow {
  id: string
  decision_id: string
  outcome_type: OutcomeType
  title: string
  target_metrics: Array<{ name: string; target: string }>
  actual_metrics: Array<{ name: string; actual: string }>
  learnings: string | null
  source_retrospective: string | null
  review_date: string | null
  created_at: string
  updated_at: string
  decisions: { id: string; title: string; status: string; evidence_strength: number } | null
}

const OUTCOME_CONFIG: Record<OutcomeType, { label: string; color: string; bg: string }> = {
  success: { label: 'Success', color: 'text-green-700', bg: 'bg-green-100 text-green-700' },
  partial: { label: 'Partial', color: 'text-yellow-700', bg: 'bg-yellow-100 text-yellow-700' },
  failure: { label: 'Failure', color: 'text-red-700', bg: 'bg-red-100 text-red-700' },
  pending: { label: 'Pending', color: 'text-gray-700', bg: 'bg-gray-100 text-gray-700' },
}

export default function OutcomesPage() {
  const [outcomes, setOutcomes] = useState<OutcomeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')

  // Create form state
  const [showCreate, setShowCreate] = useState(false)
  const [decisions, setDecisions] = useState<Array<{ id: string; title: string }>>([])
  const [formDecisionId, setFormDecisionId] = useState('')
  const [formTitle, setFormTitle] = useState('')
  const [formType, setFormType] = useState<OutcomeType>('pending')
  const [formLearnings, setFormLearnings] = useState('')
  const [formReviewDate, setFormReviewDate] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchOutcomes()
  }, [])

  async function fetchOutcomes() {
    try {
      const res = await fetch('/api/outcomes')
      if (res.ok) {
        const data = await res.json()
        setOutcomes(data.outcomes || [])
      }
    } catch (error) {
      console.error('Failed to fetch outcomes:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchDecisions() {
    try {
      const res = await fetch('/api/decisions')
      if (res.ok) {
        const data = await res.json()
        setDecisions((data.decisions || []).map((d: { id: string; title: string }) => ({ id: d.id, title: d.title })))
      }
    } catch (error) {
      console.error('Failed to fetch decisions:', error)
    }
  }

  async function handleCreate() {
    if (!formDecisionId) return
    setSaving(true)
    try {
      const res = await fetch('/api/outcomes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision_id: formDecisionId,
          outcome_type: formType,
          title: formTitle || 'Outcome',
          learnings: formLearnings || null,
          review_date: formReviewDate || null,
        }),
      })
      if (res.ok) {
        setShowCreate(false)
        setFormDecisionId('')
        setFormTitle('')
        setFormType('pending')
        setFormLearnings('')
        setFormReviewDate('')
        fetchOutcomes()
      }
    } catch (error) {
      console.error('Failed to create outcome:', error)
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdateType(id: string, outcome_type: OutcomeType) {
    try {
      const res = await fetch(`/api/outcomes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcome_type }),
      })
      if (res.ok) {
        setOutcomes(prev =>
          prev.map(o => o.id === id ? { ...o, outcome_type } : o)
        )
      }
    } catch (error) {
      console.error('Failed to update outcome:', error)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this outcome?')) return
    try {
      const res = await fetch(`/api/outcomes/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setOutcomes(prev => prev.filter(o => o.id !== id))
      }
    } catch (error) {
      console.error('Failed to delete outcome:', error)
    }
  }

  const filtered = filter === 'all' ? outcomes : outcomes.filter(o => o.outcome_type === filter)

  const stats = {
    total: outcomes.length,
    success: outcomes.filter(o => o.outcome_type === 'success').length,
    partial: outcomes.filter(o => o.outcome_type === 'partial').length,
    failure: outcomes.filter(o => o.outcome_type === 'failure').length,
    pending: outcomes.filter(o => o.outcome_type === 'pending').length,
  }

  const accuracy = stats.total > 0 && (stats.total - stats.pending) > 0
    ? Math.round((stats.success / (stats.total - stats.pending)) * 100)
    : null

  return (
    <SidebarLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold text-gray-900">Outcomes</h1>
        <Button
          size="sm"
          onClick={() => {
            setShowCreate(!showCreate)
            if (!showCreate && decisions.length === 0) fetchDecisions()
          }}
        >
          {showCreate ? 'Cancel' : '+ Track Outcome'}
        </Button>
      </div>

      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="text-center">
            <CardContent className="pt-4 pb-3">
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
              <div className="text-xs text-gray-500">Total</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-4 pb-3">
              <div className="text-2xl font-bold text-green-600">{stats.success}</div>
              <div className="text-xs text-gray-500">Success</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-4 pb-3">
              <div className="text-2xl font-bold text-yellow-600">{stats.partial}</div>
              <div className="text-xs text-gray-500">Partial</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-4 pb-3">
              <div className="text-2xl font-bold text-red-600">{stats.failure}</div>
              <div className="text-xs text-gray-500">Failure</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-4 pb-3">
              <div className="text-2xl font-bold text-blue-600">{accuracy !== null ? `${accuracy}%` : '--'}</div>
              <div className="text-xs text-gray-500">Accuracy</div>
            </CardContent>
          </Card>
        </div>

        {/* Create Form */}
        {showCreate && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Track New Outcome</CardTitle>
              <CardDescription>Link an outcome to a decision to close the feedback loop</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Decision</label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                  value={formDecisionId}
                  onChange={(e) => setFormDecisionId(e.target.value)}
                >
                  <option value="">Select a decision...</option>
                  {decisions.map(d => (
                    <option key={d.id} value={d.id}>{d.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Title</label>
                <Input
                  placeholder="Outcome title..."
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Status</label>
                <div className="flex gap-2">
                  {(['pending', 'success', 'partial', 'failure'] as const).map(t => {
                    const cfg = OUTCOME_CONFIG[t]
                    return (
                      <button
                        key={t}
                        onClick={() => setFormType(t)}
                        className={`px-3 py-1.5 rounded border text-sm font-medium transition-all ${
                          formType === t ? cfg.bg + ' border-current' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {cfg.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Learnings</label>
                <Textarea
                  placeholder="What did you learn from this outcome?"
                  value={formLearnings}
                  onChange={(e) => setFormLearnings(e.target.value)}
                  rows={3}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Review Date</label>
                <Input
                  type="date"
                  value={formReviewDate}
                  onChange={(e) => setFormReviewDate(e.target.value)}
                />
              </div>
              <Button onClick={handleCreate} disabled={!formDecisionId || saving} size="sm">
                {saving ? 'Saving...' : 'Create Outcome'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <div className="flex gap-2">
          {['all', 'pending', 'success', 'partial', 'failure'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                filter === f ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f === 'all' ? 'All' : OUTCOME_CONFIG[f as OutcomeType].label}
            </button>
          ))}
        </div>

        {/* Outcomes List */}
        {loading ? (
          <p className="text-gray-500 text-center py-8">Loading outcomes...</p>
        ) : filtered.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {outcomes.length === 0 ? 'No outcomes yet' : 'No matching outcomes'}
              </h3>
              <p className="text-gray-500 mb-4">
                Track outcomes to close the feedback loop on your decisions.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filtered.map(outcome => {
              const cfg = OUTCOME_CONFIG[outcome.outcome_type]
              return (
                <Card key={outcome.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={cfg.bg}>{cfg.label}</Badge>
                          <span className="font-medium text-gray-900 truncate">
                            {outcome.title || 'Untitled'}
                          </span>
                        </div>
                        {outcome.decisions && (
                          <Link
                            href={`/decisions/${outcome.decisions.id}`}
                            className="text-sm text-blue-600 hover:underline"
                          >
                            {outcome.decisions.title}
                          </Link>
                        )}
                        {outcome.learnings && (
                          <p className="text-sm text-gray-600 mt-2 line-clamp-2">{outcome.learnings}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                          <span>{new Date(outcome.created_at).toLocaleDateString()}</span>
                          {outcome.review_date && (
                            <span>Review: {new Date(outcome.review_date).toLocaleDateString()}</span>
                          )}
                          {outcome.decisions && (
                            <span>Evidence: {Math.round(outcome.decisions.evidence_strength)}%</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 ml-4">
                        {/* Quick status change */}
                        <div className="flex gap-1">
                          {(['success', 'partial', 'failure', 'pending'] as const).map(t => {
                            const tc = OUTCOME_CONFIG[t]
                            return (
                              <button
                                key={t}
                                onClick={() => handleUpdateType(outcome.id, t)}
                                className={`w-6 h-6 rounded text-xs font-bold transition-all ${
                                  outcome.outcome_type === t
                                    ? tc.bg + ' border border-current'
                                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                }`}
                                title={tc.label}
                              >
                                {t[0].toUpperCase()}
                              </button>
                            )
                          })}
                        </div>
                        <button
                          onClick={() => handleDelete(outcome.id)}
                          className="text-gray-400 hover:text-red-500 ml-2 p-1"
                          title="Delete"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </SidebarLayout>
  )
}
