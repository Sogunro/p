'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { SidebarLayout } from '@/components/sidebar-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { Decision, DecisionStatus, EvidenceBank, EvidenceDecisionLink, OutcomeType } from '@/types/database'
import { getStrengthBand, getStrengthBandColor, getStrengthBandLabel } from '@/lib/evidence-strength'

type DecisionWithLinks = Decision & {
  evidence_decision_links: EvidenceDecisionLink[]
}

const STATUS_CONFIG: Record<DecisionStatus, { label: string; color: string; bg: string; icon: string }> = {
  commit: { label: 'Commit', color: 'text-green-700', bg: 'bg-green-100 border-green-300', icon: '🟢' },
  validate: { label: 'Validate', color: 'text-yellow-700', bg: 'bg-yellow-100 border-yellow-300', icon: '🟡' },
  park: { label: 'Park', color: 'text-red-700', bg: 'bg-red-100 border-red-300', icon: '🔴' },
}

const SOURCE_ICONS: Record<string, string> = {
  manual: '✏️', slack: '💬', notion: '📝', mixpanel: '📊', airtable: '📋',
  intercom: '💬', gong: '🎙️', interview: '🎤', support: '🎫', analytics: '📈', social: '🌐',
}

export default function DecisionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const decisionId = params.id as string

  const [decision, setDecision] = useState<DecisionWithLinks | null>(null)
  const [linkedEvidence, setLinkedEvidence] = useState<EvidenceBank[]>([])
  const [session, setSession] = useState<{ id: string; name: string; created_at: string } | null>(null)
  const [loading, setLoading] = useState(true)

  // Editing state
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editHypothesis, setEditHypothesis] = useState('')
  const [editDescription, setEditDescription] = useState('')

  // Override state
  const [showOverride, setShowOverride] = useState(false)
  const [overrideReason, setOverrideReason] = useState('')
  const [pendingStatus, setPendingStatus] = useState<DecisionStatus | null>(null)

  // Evidence linking
  const [showLinkEvidence, setShowLinkEvidence] = useState(false)
  const [bankEvidence, setBankEvidence] = useState<EvidenceBank[]>([])
  const [bankLoading, setBankLoading] = useState(false)
  const [bankSearch, setBankSearch] = useState('')

  // Brief
  const [brief, setBrief] = useState('')
  const [briefLoading, setBriefLoading] = useState(false)

  // Agent state
  const [decisionAlerts, setDecisionAlerts] = useState<Array<{ id: string; agent_type: string; alert_type: string; title: string; content: string; created_at: string }>>([])

  // Outcome state
  const [outcome, setOutcome] = useState<{
    id: string; outcome_type: OutcomeType; title: string;
    target_metrics: Array<{ name: string; target: string }>;
    actual_metrics: Array<{ name: string; actual: string }>;
    learnings: string | null; review_date: string | null;
  } | null>(null)
  const [showOutcomeForm, setShowOutcomeForm] = useState(false)
  const [outcomeType, setOutcomeType] = useState<OutcomeType>('pending')
  const [outcomeLearnings, setOutcomeLearnings] = useState('')
  const [outcomeReviewDate, setOutcomeReviewDate] = useState('')
  const [outcomeSaving, setOutcomeSaving] = useState(false)
  const [generatingOutcome, setGeneratingOutcome] = useState(false)

  // External push state
  const [pushingLinear, setPushingLinear] = useState(false)
  const [pushingJira, setPushingJira] = useState(false)
  const [pushResult, setPushResult] = useState<{ type: string; url?: string; error?: string } | null>(null)


  useEffect(() => {
    fetchDecision()
  }, [decisionId])

  async function fetchDecision() {
    try {
      const res = await fetch(`/api/decisions/${decisionId}`)
      if (!res.ok) {
        router.push('/decisions')
        return
      }
      const data = await res.json()
      setDecision(data.decision)
      setLinkedEvidence(data.linked_evidence || [])
      setSession(data.session || null)

      // Initialize edit state
      setEditTitle(data.decision.title)
      setEditHypothesis(data.decision.hypothesis || '')
      setEditDescription(data.decision.description || '')
    } catch (error) {
      console.error('Failed to fetch decision:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!decision) return

    try {
      const res = await fetch(`/api/decisions/${decisionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle.trim(),
          hypothesis: editHypothesis.trim() || null,
          description: editDescription.trim() || null,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setDecision(prev => prev ? { ...prev, ...data.decision } : null)
        setIsEditing(false)
      }
    } catch (error) {
      console.error('Failed to update decision:', error)
    }
  }

  async function handleStatusChange(newStatus: DecisionStatus) {
    if (!decision) return

    // Check if this requires an override
    if (decision.gate_recommendation && newStatus !== decision.gate_recommendation) {
      setPendingStatus(newStatus)
      setShowOverride(true)
      return
    }

    await applyStatusChange(newStatus)
  }

  async function applyStatusChange(newStatus: DecisionStatus, reason?: string) {
    try {
      const body: Record<string, unknown> = { status: newStatus }
      if (reason) body.override_reason = reason

      const res = await fetch(`/api/decisions/${decisionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        const data = await res.json()
        setDecision(prev => prev ? { ...prev, ...data.decision } : null)
        setShowOverride(false)
        setOverrideReason('')
        setPendingStatus(null)
      }
    } catch (error) {
      console.error('Failed to update status:', error)
    }
  }

  async function handleOverrideConfirm() {
    if (!pendingStatus || !overrideReason.trim()) return
    await applyStatusChange(pendingStatus, overrideReason.trim())
  }

  async function fetchBankEvidence() {
    setBankLoading(true)
    try {
      const res = await fetch('/api/evidence-bank')
      if (res.ok) {
        const data = await res.json()
        setBankEvidence(data.evidence || [])
      }
    } catch (error) {
      console.error('Failed to fetch bank evidence:', error)
    } finally {
      setBankLoading(false)
    }
  }

  async function handleLinkEvidence(evidenceId: string) {
    try {
      const res = await fetch(`/api/decisions/${decisionId}/evidence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evidence_id: evidenceId }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.decision) {
          setDecision(prev => prev ? { ...prev, ...data.decision } : null)
        }
        // Re-fetch to get updated linked evidence
        fetchDecision()
      }
    } catch (error) {
      console.error('Failed to link evidence:', error)
    }
  }

  async function handleUnlinkEvidence(evidenceId: string) {
    try {
      const res = await fetch(`/api/decisions/${decisionId}/evidence?evidence_id=${evidenceId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        const data = await res.json()
        if (data.decision) {
          setDecision(prev => prev ? { ...prev, ...data.decision } : null)
        }
        fetchDecision()
      }
    } catch (error) {
      console.error('Failed to unlink evidence:', error)
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this decision? This cannot be undone.')) return

    try {
      const res = await fetch(`/api/decisions/${decisionId}`, { method: 'DELETE' })
      if (res.ok) {
        router.push('/decisions')
      }
    } catch (error) {
      console.error('Failed to delete decision:', error)
    }
  }

  // Fetch alerts for this decision
  useEffect(() => {
    if (decisionId) {
      fetch(`/api/agent/alerts?decision_id=${decisionId}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => { if (data?.alerts) setDecisionAlerts(data.alerts) })
        .catch(() => {})
    }
  }, [decisionId])

  // Fetch outcome for this decision
  useEffect(() => {
    if (decisionId) {
      fetch(`/api/outcomes?decision_id=${decisionId}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.outcomes?.length > 0) setOutcome(data.outcomes[0])
        })
        .catch(() => {})
    }
  }, [decisionId])

  async function handleCreateOutcome() {
    setOutcomeSaving(true)
    try {
      const res = await fetch('/api/outcomes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision_id: decisionId,
          outcome_type: outcomeType,
          title: decision?.title ? `Outcome: ${decision.title}` : 'Outcome',
          learnings: outcomeLearnings || null,
          review_date: outcomeReviewDate || null,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setOutcome(data.outcome)
        setShowOutcomeForm(false)
        setOutcomeLearnings('')
        setOutcomeReviewDate('')
      }
    } catch (error) {
      console.error('Failed to create outcome:', error)
    } finally {
      setOutcomeSaving(false)
    }
  }

  async function handleUpdateOutcomeType(type: OutcomeType) {
    if (!outcome) return
    try {
      const res = await fetch(`/api/outcomes/${outcome.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcome_type: type }),
      })
      if (res.ok) {
        setOutcome(prev => prev ? { ...prev, outcome_type: type } : null)
      }
    } catch (error) {
      console.error('Failed to update outcome:', error)
    }
  }

  async function handleGenerateOutcome() {
    setGeneratingOutcome(true)
    try {
      const res = await fetch('/api/outcomes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision_id: decisionId }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.draft) {
          setOutcomeReviewDate(data.draft.review_date || '')
          setOutcomeLearnings(data.draft.success_criteria || '')
          setShowOutcomeForm(true)
        }
      }
    } catch (error) {
      console.error('Failed to generate outcome:', error)
    } finally {
      setGeneratingOutcome(false)
    }
  }

  async function handlePush(type: 'linear' | 'jira') {
    const setLoading = type === 'linear' ? setPushingLinear : setPushingJira
    setLoading(true)
    setPushResult(null)
    try {
      const res = await fetch(`/api/integrations/${type}/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision_id: decisionId }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setPushResult({ type, url: data.external_url })
        fetchDecision()
      } else {
        setPushResult({ type, error: data.error || 'Push failed' })
      }
    } catch (error) {
      console.error(`${type} push error:`, error)
      setPushResult({ type, error: 'Network error' })
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerateBrief() {
    setBriefLoading(true)
    try {
      const res = await fetch('/api/agent/generate-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision_id: decisionId }),
      })
      if (res.ok) {
        const data = await res.json()
        setBrief(data.brief || '')
        // Refresh alerts
        const alertsRes = await fetch(`/api/agent/alerts?decision_id=${decisionId}`)
        if (alertsRes.ok) {
          const alertsData = await alertsRes.json()
          setDecisionAlerts(alertsData.alerts || [])
        }
      }
    } catch (error) {
      console.error('Failed to generate brief:', error)
    } finally {
      setBriefLoading(false)
    }
  }

  if (loading) {
    return (
      <SidebarLayout>
        <div className="flex items-center justify-center py-12">
          <p className="text-gray-500">Loading decision...</p>
        </div>
      </SidebarLayout>
    )
  }

  if (!decision) {
    return (
      <SidebarLayout>
        <div className="flex items-center justify-center py-12">
          <p className="text-gray-500">Decision not found</p>
        </div>
      </SidebarLayout>
    )
  }

  const statusCfg = STATUS_CONFIG[decision.status]
  const gateCfg = decision.gate_recommendation ? STATUS_CONFIG[decision.gate_recommendation] : null
  const strengthBand = getStrengthBand(decision.evidence_strength)
  const strengthColor = getStrengthBandColor(strengthBand)
  const linkedIds = new Set(linkedEvidence.map(e => e.id))

  return (
    <SidebarLayout>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <Link href="/decisions" className="text-gray-500 hover:text-gray-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-xl font-bold text-gray-900">{decision.title}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleGenerateBrief} disabled={briefLoading} className="text-indigo-600 border-indigo-200 hover:bg-indigo-50">
            {briefLoading ? 'Generating...' : 'Generate Brief'}
          </Button>
          <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </div>

      <div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Decision Info */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-xl">
                    {isEditing ? (
                      <Input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="text-xl font-bold"
                      />
                    ) : (
                      decision.title
                    )}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                  >
                    {isEditing ? 'Save' : 'Edit'}
                  </Button>
                </div>
                {isEditing && (
                  <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Hypothesis */}
                <div>
                  <label className="text-sm font-medium text-gray-500 mb-1 block">Hypothesis</label>
                  {isEditing ? (
                    <Input
                      value={editHypothesis}
                      onChange={(e) => setEditHypothesis(e.target.value)}
                      placeholder="IF ... THEN ... BECAUSE ..."
                    />
                  ) : (
                    <p className="text-gray-700">
                      {decision.hypothesis || <span className="text-gray-400 italic">No hypothesis set</span>}
                    </p>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label className="text-sm font-medium text-gray-500 mb-1 block">Description</label>
                  {isEditing ? (
                    <Textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Additional context..."
                      rows={3}
                    />
                  ) : (
                    <p className="text-gray-700">
                      {decision.description || <span className="text-gray-400 italic">No description</span>}
                    </p>
                  )}
                </div>

                {/* Session link */}
                {session && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 mb-1 block">Linked Session</label>
                    <Link
                      href={`/session/${session.id}`}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      {session.name}
                    </Link>
                  </div>
                )}

                {/* External ref */}
                {decision.external_url && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 mb-1 block">External Link</label>
                    <a
                      href={decision.external_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-sm"
                    >
                      {decision.external_ref || decision.external_url}
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Linked Evidence */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg">Linked Evidence ({linkedEvidence.length})</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowLinkEvidence(!showLinkEvidence)
                      if (!showLinkEvidence && bankEvidence.length === 0) {
                        fetchBankEvidence()
                      }
                    }}
                  >
                    {showLinkEvidence ? 'Close' : '+ Link Evidence'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Current linked evidence */}
                {linkedEvidence.length === 0 ? (
                  <p className="text-sm text-gray-400 py-4 text-center">
                    No evidence linked yet. Link evidence from the bank to strengthen this decision.
                  </p>
                ) : (
                  <div className="space-y-3 mb-4">
                    {linkedEvidence.map((ev) => {
                      const band = getStrengthBand(ev.computed_strength)
                      return (
                        <div
                          key={ev.id}
                          className="flex items-start justify-between bg-gray-50 rounded-lg p-3 border"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span>{SOURCE_ICONS[ev.source_system] || '📎'}</span>
                              <span className="font-medium text-sm truncate">{ev.title}</span>
                              {ev.computed_strength > 0 && (
                                <span
                                  className="text-xs font-bold px-1.5 py-0.5 rounded"
                                  style={{
                                    color: getStrengthBandColor(band),
                                    backgroundColor: `${getStrengthBandColor(band)}15`,
                                  }}
                                >
                                  {Math.round(ev.computed_strength)}
                                </span>
                              )}
                            </div>
                            {ev.content && (
                              <p className="text-xs text-gray-500 line-clamp-2">{ev.content}</p>
                            )}
                          </div>
                          <button
                            onClick={() => handleUnlinkEvidence(ev.id)}
                            className="text-gray-400 hover:text-red-500 ml-2 shrink-0 p-1"
                            title="Unlink evidence"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Evidence Bank Browser */}
                {showLinkEvidence && (
                  <div className="border-t pt-4">
                    <Input
                      placeholder="Search evidence bank..."
                      value={bankSearch}
                      onChange={(e) => setBankSearch(e.target.value)}
                      className="mb-3"
                    />
                    <ScrollArea className="h-[250px]">
                      {bankLoading ? (
                        <p className="text-sm text-gray-400 text-center py-4">Loading evidence bank...</p>
                      ) : bankEvidence.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-4">
                          No evidence in bank.{' '}
                          <Link href="/evidence-bank" className="text-blue-600 hover:underline">
                            Add evidence
                          </Link>
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {bankEvidence
                            .filter(e =>
                              bankSearch === '' ||
                              e.title.toLowerCase().includes(bankSearch.toLowerCase()) ||
                              e.content?.toLowerCase().includes(bankSearch.toLowerCase())
                            )
                            .map((item) => {
                              const isLinked = linkedIds.has(item.id)
                              const band = getStrengthBand(item.computed_strength)
                              return (
                                <div
                                  key={item.id}
                                  className={`p-3 rounded border text-sm cursor-pointer transition-colors ${
                                    isLinked
                                      ? 'bg-green-50 border-green-300'
                                      : 'bg-white border-gray-200 hover:bg-gray-50'
                                  }`}
                                  onClick={() => {
                                    if (isLinked) {
                                      handleUnlinkEvidence(item.id)
                                    } else {
                                      handleLinkEvidence(item.id)
                                    }
                                  }}
                                >
                                  <div className="flex items-center gap-2 mb-1">
                                    <span>{SOURCE_ICONS[item.source_system] || '📎'}</span>
                                    {item.computed_strength > 0 && (
                                      <span
                                        className="text-xs font-bold px-1.5 py-0.5 rounded"
                                        style={{
                                          color: getStrengthBandColor(band),
                                          backgroundColor: `${getStrengthBandColor(band)}15`,
                                        }}
                                      >
                                        {Math.round(item.computed_strength)}
                                      </span>
                                    )}
                                    {isLinked && (
                                      <Badge className="text-[10px] px-1 py-0 bg-green-600">Linked</Badge>
                                    )}
                                  </div>
                                  <p className="font-medium truncate">{item.title}</p>
                                  {item.content && (
                                    <p className="text-gray-500 line-clamp-1 text-xs">{item.content}</p>
                                  )}
                                </div>
                              )
                            })}
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Executive Brief */}
            {brief && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Executive Brief</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none whitespace-pre-wrap text-gray-700">
                    {brief}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigator.clipboard.writeText(brief)}
                    >
                      Copy to Clipboard
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setBrief('')}
                    >
                      Dismiss
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Agent Alerts for this Decision */}
            {decisionAlerts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Agent Activity</CardTitle>
                  <CardDescription>{decisionAlerts.length} alert{decisionAlerts.length !== 1 ? 's' : ''} for this decision</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {decisionAlerts.map((alert) => {
                      const agentIcons: Record<string, string> = {
                        strength_calculator: '\uD83D\uDCAA',
                        contradiction_detector: '\u26A1',
                        segment_identifier: '\uD83C\uDFAF',
                        session_analyzer: '\uD83D\uDD2C',
                        brief_generator: '\uD83D\uDCCB',
                        decay_monitor: '\u23F0',
                        competitor_monitor: '\uD83D\uDCCA',
                        evidence_hunter: '\uD83D\uDD0D',
                        analysis_crew: '\uD83E\uDDE0',
                      }
                      const alertColors: Record<string, string> = {
                        info: 'bg-blue-50 border-blue-200',
                        warning: 'bg-yellow-50 border-yellow-200',
                        action_needed: 'bg-red-50 border-red-200',
                      }
                      return (
                        <div
                          key={alert.id}
                          className={`p-3 rounded-lg border ${alertColors[alert.alert_type] || 'bg-gray-50 border-gray-200'}`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg">{agentIcons[alert.agent_type] || '\uD83E\uDD16'}</span>
                            <span className="text-sm font-medium text-gray-900 flex-1 truncate">
                              {alert.title}
                            </span>
                            <span className="text-xs text-gray-400 shrink-0">
                              {new Date(alert.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                          {alert.content && (
                            <p className="text-xs text-gray-600 line-clamp-3 ml-7">
                              {alert.content.slice(0, 300)}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Outcome Tracking */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg">Outcome</CardTitle>
                  {!outcome && !showOutcomeForm && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleGenerateOutcome}
                        disabled={generatingOutcome}
                        className="text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                      >
                        {generatingOutcome ? 'Generating...' : 'AI Suggest'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowOutcomeForm(true)}
                      >
                        + Track Outcome
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {outcome ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      {(['success', 'partial', 'failure', 'pending'] as const).map(t => {
                        const labels: Record<OutcomeType, string> = { success: 'Success', partial: 'Partial', failure: 'Failure', pending: 'Pending' }
                        const colors: Record<OutcomeType, string> = { success: 'bg-green-100 text-green-700 border-green-300', partial: 'bg-yellow-100 text-yellow-700 border-yellow-300', failure: 'bg-red-100 text-red-700 border-red-300', pending: 'bg-gray-100 text-gray-700 border-gray-300' }
                        return (
                          <button
                            key={t}
                            onClick={() => handleUpdateOutcomeType(t)}
                            className={`flex-1 py-1.5 px-2 rounded border text-xs font-medium transition-all ${
                              outcome.outcome_type === t ? colors[t] + ' border-current' : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50'
                            }`}
                          >
                            {labels[t]}
                          </button>
                        )
                      })}
                    </div>
                    {outcome.learnings && (
                      <div>
                        <label className="text-xs font-medium text-gray-500 block mb-1">Learnings</label>
                        <p className="text-sm text-gray-700">{outcome.learnings}</p>
                      </div>
                    )}
                    {outcome.review_date && (
                      <div className="text-xs text-gray-400">
                        Review: {new Date(outcome.review_date).toLocaleDateString()}
                      </div>
                    )}
                    <Link href="/outcomes" className="text-xs text-blue-600 hover:underline">
                      View all outcomes
                    </Link>
                  </div>
                ) : showOutcomeForm ? (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-gray-500 block mb-1">Status</label>
                      <div className="flex gap-1">
                        {(['pending', 'success', 'partial', 'failure'] as const).map(t => {
                          const labels: Record<OutcomeType, string> = { success: 'Success', partial: 'Partial', failure: 'Failure', pending: 'Pending' }
                          return (
                            <button
                              key={t}
                              onClick={() => setOutcomeType(t)}
                              className={`flex-1 py-1.5 rounded border text-xs font-medium transition-all ${
                                outcomeType === t ? 'bg-gray-900 text-white' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                              }`}
                            >
                              {labels[t]}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 block mb-1">Learnings / Success Criteria</label>
                      <Textarea
                        placeholder="What did you learn?"
                        value={outcomeLearnings}
                        onChange={(e) => setOutcomeLearnings(e.target.value)}
                        rows={3}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 block mb-1">Review Date</label>
                      <Input
                        type="date"
                        value={outcomeReviewDate}
                        onChange={(e) => setOutcomeReviewDate(e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleCreateOutcome} disabled={outcomeSaving}>
                        {outcomeSaving ? 'Saving...' : 'Save'}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowOutcomeForm(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 py-4 text-center">
                    No outcome tracked yet. Track the result to close the feedback loop.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Gate & Status */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Decision Gate</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Evidence Strength */}
                <div className="text-center py-3">
                  <div
                    className="text-4xl font-bold"
                    style={{ color: strengthColor }}
                  >
                    {decision.evidence_strength > 0 ? Math.round(decision.evidence_strength) : '—'}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    {decision.evidence_strength > 0
                      ? getStrengthBandLabel(strengthBand)
                      : 'No evidence yet'}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {decision.evidence_count} evidence item{decision.evidence_count !== 1 ? 's' : ''}
                  </div>
                </div>

                {/* Gate Recommendation */}
                {gateCfg && (
                  <div className={`p-3 rounded-lg border ${gateCfg.bg}`}>
                    <div className="text-xs font-medium text-gray-500 mb-1">Gate Recommends</div>
                    <div className={`font-bold ${gateCfg.color}`}>
                      {gateCfg.icon} {gateCfg.label}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {decision.gate_recommendation === 'commit' && 'Evidence strength ≥70 — confident to ship'}
                      {decision.gate_recommendation === 'validate' && 'Strength 40-70 — needs more evidence'}
                      {decision.gate_recommendation === 'park' && 'Strength <40 — insufficient evidence'}
                    </div>
                  </div>
                )}

                {/* Current Status */}
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-2">Status</div>
                  <div className="flex gap-1">
                    {(['commit', 'validate', 'park'] as const).map((s) => {
                      const cfg = STATUS_CONFIG[s]
                      return (
                        <button
                          key={s}
                          onClick={() => handleStatusChange(s)}
                          className={`flex-1 py-2 px-2 rounded border text-sm font-medium transition-all ${
                            decision.status === s
                              ? cfg.bg + ' border-current'
                              : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-500'
                          }`}
                        >
                          {cfg.icon} {cfg.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Override indicator */}
                {decision.is_overridden && (
                  <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                    <div className="text-xs font-medium text-purple-700 mb-1">Override Active</div>
                    <p className="text-xs text-purple-600">{decision.override_reason}</p>
                    {decision.overridden_at && (
                      <p className="text-[10px] text-purple-400 mt-1">
                        {new Date(decision.overridden_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                )}

                {/* Override Dialog */}
                {showOverride && (
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <div className="text-sm font-medium text-amber-800 mb-2">
                      Override gate recommendation?
                    </div>
                    <p className="text-xs text-amber-600 mb-2">
                      Gate recommends <strong>{gateCfg?.label}</strong>, you're setting{' '}
                      <strong>{pendingStatus && STATUS_CONFIG[pendingStatus].label}</strong>.
                      A reason is required.
                    </p>
                    <Textarea
                      placeholder="Why are you overriding the recommendation?"
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      className="mb-2 text-sm"
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleOverrideConfirm} disabled={!overrideReason.trim()}>
                        Confirm Override
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setShowOverride(false); setPendingStatus(null); setOverrideReason('') }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Metadata */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-gray-500">Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Created</span>
                  <span>{new Date(decision.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Updated</span>
                  <span>{new Date(decision.updated_at).toLocaleDateString()}</span>
                </div>
                {decision.external_ref && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">External</span>
                    {decision.external_url ? (
                      <a href={decision.external_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        {decision.external_ref}
                      </a>
                    ) : (
                      <span>{decision.external_ref}</span>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Push to PM Tool */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-gray-500">Push to PM Tool</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => handlePush('linear')}
                  disabled={pushingLinear}
                >
                  {pushingLinear ? 'Pushing...' : 'Push to Linear'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => handlePush('jira')}
                  disabled={pushingJira}
                >
                  {pushingJira ? 'Pushing...' : 'Push to Jira'}
                </Button>
                {pushResult && (
                  <div className={`text-xs p-2 rounded ${pushResult.error ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                    {pushResult.error
                      ? pushResult.error
                      : (
                        <>
                          Pushed to {pushResult.type}.{' '}
                          {pushResult.url && (
                            <a href={pushResult.url} target="_blank" rel="noopener noreferrer" className="underline">
                              View
                            </a>
                          )}
                        </>
                      )
                    }
                  </div>
                )}
                <p className="text-[10px] text-gray-400">
                  <Link href="/settings/pm-tools" className="hover:underline">Configure integrations</Link>
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </SidebarLayout>
  )
}
