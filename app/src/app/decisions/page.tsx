'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Decision, DecisionStatus } from '@/types/database'

type DecisionWithLinks = Decision & {
  evidence_decision_links: { id: string; evidence_id: string }[]
}

const STATUS_CONFIG: Record<DecisionStatus, { label: string; color: string; icon: string }> = {
  commit: { label: 'Commit', color: 'bg-green-100 text-green-800 border-green-300', icon: '🟢' },
  validate: { label: 'Validate', color: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: '🟡' },
  park: { label: 'Park', color: 'bg-red-100 text-red-800 border-red-300', icon: '🔴' },
}

export default function DecisionLogPage() {
  const router = useRouter()
  const [decisions, setDecisions] = useState<DecisionWithLinks[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<DecisionStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newHypothesis, setNewHypothesis] = useState('')

  useEffect(() => {
    fetchDecisions()
  }, [filter])

  async function fetchDecisions() {
    try {
      const params = new URLSearchParams()
      if (filter !== 'all') params.set('status', filter)
      if (search) params.set('search', search)

      const res = await fetch(`/api/decisions?${params}`)
      if (res.ok) {
        const data = await res.json()
        setDecisions(data.decisions || [])
      }
    } catch (error) {
      console.error('Failed to fetch decisions:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    if (!newTitle.trim()) return

    try {
      const res = await fetch('/api/decisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          hypothesis: newHypothesis.trim() || null,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setNewTitle('')
        setNewHypothesis('')
        setCreating(false)
        // Navigate to the new decision
        router.push(`/decisions/${data.decision.id}`)
      }
    } catch (error) {
      console.error('Failed to create decision:', error)
    }
  }

  function handleSearch() {
    setLoading(true)
    fetchDecisions()
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const getStrengthColor = (strength: number) => {
    if (strength >= 70) return 'text-green-700 bg-green-100'
    if (strength >= 40) return 'text-yellow-700 bg-yellow-100'
    return 'text-red-700 bg-red-100'
  }

  // Summary stats
  const stats = {
    total: decisions.length,
    commit: decisions.filter(d => d.status === 'commit').length,
    validate: decisions.filter(d => d.status === 'validate').length,
    park: decisions.filter(d => d.status === 'park').length,
    overridden: decisions.filter(d => d.is_overridden).length,
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="text-gray-500 hover:text-gray-700">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <h1 className="text-xl font-bold text-gray-900">Decision Log</h1>
            </div>
            <Button onClick={() => setCreating(true)}>
              + New Decision
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg border p-3 text-center">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-xs text-gray-500">Total</div>
          </div>
          <div className="bg-white rounded-lg border p-3 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.commit}</div>
            <div className="text-xs text-gray-500">Commit</div>
          </div>
          <div className="bg-white rounded-lg border p-3 text-center">
            <div className="text-2xl font-bold text-yellow-600">{stats.validate}</div>
            <div className="text-xs text-gray-500">Validate</div>
          </div>
          <div className="bg-white rounded-lg border p-3 text-center">
            <div className="text-2xl font-bold text-red-600">{stats.park}</div>
            <div className="text-xs text-gray-500">Park</div>
          </div>
          <div className="bg-white rounded-lg border p-3 text-center">
            <div className="text-2xl font-bold text-purple-600">{stats.overridden}</div>
            <div className="text-xs text-gray-500">Overridden</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex gap-1">
            {(['all', 'commit', 'validate', 'park'] as const).map((s) => (
              <button
                key={s}
                onClick={() => { setFilter(s); setLoading(true) }}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  filter === s
                    ? s === 'all'
                      ? 'bg-gray-900 text-white'
                      : STATUS_CONFIG[s].color + ' border'
                    : 'bg-white text-gray-600 border hover:bg-gray-50'
                }`}
              >
                {s === 'all' ? 'All' : STATUS_CONFIG[s].icon + ' ' + STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 flex-1">
            <Input
              placeholder="Search decisions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="max-w-sm"
            />
            {search && (
              <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setLoading(true); fetchDecisions() }}>
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Create Decision Form */}
        {creating && (
          <Card className="mb-6 border-blue-200 bg-blue-50/50">
            <CardContent className="pt-6">
              <div className="space-y-3">
                <Input
                  placeholder="Decision title — what are you deciding?"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  autoFocus
                />
                <Input
                  placeholder="Hypothesis (optional) — IF ... THEN ... BECAUSE ..."
                  value={newHypothesis}
                  onChange={(e) => setNewHypothesis(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
                <div className="flex gap-2">
                  <Button onClick={handleCreate} disabled={!newTitle.trim()}>
                    Create Decision
                  </Button>
                  <Button variant="ghost" onClick={() => { setCreating(false); setNewTitle(''); setNewHypothesis('') }}>
                    Cancel
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Decision List */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading decisions...</div>
        ) : decisions.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No decisions yet</h3>
              <p className="text-gray-500 mb-4">
                Create your first decision record to start tracking evidence-backed product decisions.
              </p>
              <Button onClick={() => setCreating(true)}>Create Your First Decision</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {decisions.map((decision) => {
              const statusCfg = STATUS_CONFIG[decision.status]
              const hasOverride = decision.is_overridden
              const evidenceCount = decision.evidence_decision_links?.length || 0

              return (
                <Link key={decision.id} href={`/decisions/${decision.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer mb-3">
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between gap-4">
                        {/* Left: Status + Title */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm">{statusCfg.icon}</span>
                            <Badge variant="outline" className={statusCfg.color}>
                              {statusCfg.label}
                            </Badge>
                            {hasOverride && (
                              <Badge variant="outline" className="text-purple-700 bg-purple-50 border-purple-300">
                                Overridden
                              </Badge>
                            )}
                            {decision.gate_recommendation && decision.gate_recommendation !== decision.status && (
                              <span className="text-xs text-gray-400">
                                Gate: {STATUS_CONFIG[decision.gate_recommendation].label}
                              </span>
                            )}
                          </div>
                          <h3 className="font-medium text-gray-900 truncate">{decision.title}</h3>
                          {decision.hypothesis && (
                            <p className="text-sm text-gray-500 truncate mt-0.5">{decision.hypothesis}</p>
                          )}
                        </div>

                        {/* Right: Evidence strength + metadata */}
                        <div className="flex items-center gap-3 shrink-0">
                          {/* Evidence count */}
                          <div className="text-center">
                            <div className="text-xs text-gray-400">Evidence</div>
                            <div className="text-sm font-medium text-gray-600">{evidenceCount}</div>
                          </div>

                          {/* Strength score */}
                          <div className="text-center">
                            <div className="text-xs text-gray-400">Strength</div>
                            <div className={`text-sm font-bold px-2 py-0.5 rounded ${getStrengthColor(decision.evidence_strength)}`}>
                              {decision.evidence_strength > 0 ? Math.round(decision.evidence_strength) : '—'}
                            </div>
                          </div>

                          {/* Date */}
                          <div className="text-xs text-gray-400 w-20 text-right">
                            {formatDate(decision.created_at)}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
