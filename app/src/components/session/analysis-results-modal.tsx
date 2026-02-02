'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import type {
  SpecAnalysisData,
  SpecRankedProblem,
  SpecConstraintMatrixRow,
  SpecContradiction,
  SpecChecklistItem,
  SpecObjectiveCheck,
  SpecRecommendedAction,
  SpecNextStep,
} from '@/types/database'

// ============================================
// V1 types (backward compatible)
// ============================================

interface SessionDiagnosis {
  overall_quality?: string
  evidence_maturity?: string
  session_nature?: string
  key_strengths?: string[]
  key_gaps?: string[]
  readiness_to_build?: string
}

interface StrategicAlignment {
  vision_alignment_score?: number
  vision_alignment_explanation?: string
  goals_coverage?: Array<{ goal: string; impact: string; problems_addressed: string[] }>
  overall_alignment_score?: number
}

interface SolutionAnalysis {
  solution: string
  problem_solved: string
  recommendation: string
  budget_fit?: string
  timeline_fit?: string
  tech_feasibility?: string
  reasoning?: string
}

interface NextStepsV1 {
  build_now?: Array<{ action: string; reason: string; which_solutions?: string[] }>
  validate_first?: Array<{ action: string; method: string; sample_size?: string; questions?: string[] }>
  defer?: Array<{ item: string; reason: string; revisit_when?: string }>
}

interface EvidenceBackedItem {
  content: string
  section: string
  evidence_summary?: string
  confidence?: number
  confidence_tier?: string
}

interface AssumptionItem {
  content: string
  section: string
  confidence?: number
  validation_strategy?: string
}

interface ConstraintAnalysisItem {
  constraint: string
  status: string
  notes: string
}

interface ChecklistReviewItemV1 {
  item: string
  status: string
  notes: string
}

// V1 analysis data shape
export interface AnalysisDataV1 {
  spec_version?: 1
  id: string
  session_id: string
  created_at: string
  objective_score: number
  summary: string
  session_diagnosis: SessionDiagnosis | null
  strategic_alignment: StrategicAlignment | null
  solutions_analysis: SolutionAnalysis[]
  next_steps: NextStepsV1 | null
  evidence_backed: EvidenceBackedItem[]
  assumptions: AssumptionItem[]
  validation_recommendations: unknown[]
  constraint_analysis: ConstraintAnalysisItem[]
  checklist_review: ChecklistReviewItemV1[]
}

// V2 analysis data shape (extends SpecAnalysisData)
export interface AnalysisDataV2 extends SpecAnalysisData {
  id: string
  session_id: string
  created_at: string
  summary: string
  sessionTitle: string
}

// Union type
export type AnalysisData = (AnalysisDataV1 | AnalysisDataV2) & { sessionTitle?: string }

function isV2(data: AnalysisData): data is AnalysisDataV2 {
  return (data as AnalysisDataV2).spec_version === 2
}

// ============================================
// Shared UI components
// ============================================

function ProgressBar({ value, color = 'bg-green-500' }: { value: number; color?: string }) {
  return (
    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
      <div
        className={`h-full ${color} transition-all duration-300`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}

function getScoreColor(score: number): string {
  if (score >= 70) return 'bg-green-500'
  if (score >= 40) return 'bg-yellow-500'
  return 'bg-red-500'
}

function getScoreTextColor(score: number): string {
  if (score >= 70) return 'text-green-600'
  if (score >= 40) return 'text-yellow-600'
  return 'text-red-600'
}

function getBandColor(band: string): string {
  if (band === 'strong') return 'text-green-600'
  if (band === 'moderate') return 'text-yellow-600'
  return 'text-red-600'
}

function getBandBg(band: string): string {
  if (band === 'strong') return 'bg-green-500'
  if (band === 'moderate') return 'bg-yellow-500'
  return 'bg-red-500'
}

function getRecBadge(rec: string): string {
  if (rec === 'COMMIT') return 'bg-[#DCFCE7] text-[#166534] border border-[#86EFAC]'
  if (rec === 'VALIDATE') return 'bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D]'
  return 'bg-[#FEE2E2] text-[#991B1B] border border-[#FCA5A5]'
}

function getRecBorder(rec: string): string {
  if (rec === 'COMMIT') return 'border-green-200 bg-green-50/50'
  if (rec === 'VALIDATE') return 'border-yellow-200 bg-yellow-50/50'
  return 'border-red-200 bg-red-50/30'
}

// ============================================
// Props
// ============================================

interface AnalysisResultsModalProps {
  isOpen: boolean
  onClose: () => void
  analysisData: AnalysisData | null
  sessionTitle: string
  sessionId?: string
  onReanalyze: () => void
  onClearResults: () => void
  isReanalyzing?: boolean
  elapsedSeconds?: number
}

// ============================================
// V2 Tab Components
// ============================================

function OverviewTabV2({ data }: { data: AnalysisDataV2 }) {
  const h = data.sessionHeader
  const s = data.summaryStats

  return (
    <div className="space-y-6">
      {/* Session Header */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-xs text-gray-500">Objectives</p>
              <p className="text-xl font-bold">{h.objective_count}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Problems</p>
              <p className="text-xl font-bold">{h.problem_count}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Evidence Items</p>
              <p className="text-xl font-bold">{h.total_evidence}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Avg Strength</p>
              <p className={`text-xl font-bold ${getScoreTextColor(h.avg_strength)}`}>{h.avg_strength}%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-blue-200">
          <CardContent className="pt-4 text-center">
            <p className="text-xs text-gray-500">Evidence Coverage</p>
            <p className={`text-2xl font-bold ${getScoreTextColor(s.evidence_coverage_pct)}`}>{s.evidence_coverage_pct}%</p>
            <ProgressBar value={s.evidence_coverage_pct} color={getScoreColor(s.evidence_coverage_pct)} />
          </CardContent>
        </Card>
        <Card className="border-purple-200">
          <CardContent className="pt-4 text-center">
            <p className="text-xs text-gray-500">Voice Coverage</p>
            <p className={`text-2xl font-bold ${getScoreTextColor(s.voice_coverage_pct)}`}>{s.voice_coverage_pct}%</p>
            <ProgressBar value={s.voice_coverage_pct} color={getScoreColor(s.voice_coverage_pct)} />
          </CardContent>
        </Card>
        <Card className="border-green-200">
          <CardContent className="pt-4 text-center">
            <p className="text-xs text-gray-500">Constraint Pass Rate</p>
            <p className={`text-2xl font-bold ${getScoreTextColor(s.constraint_pass_rate)}`}>{s.constraint_pass_rate}%</p>
            <ProgressBar value={s.constraint_pass_rate} color={getScoreColor(s.constraint_pass_rate)} />
          </CardContent>
        </Card>
        <Card className="border-red-200">
          <CardContent className="pt-4 text-center">
            <p className="text-xs text-gray-500">Top Risk</p>
            <p className="text-sm font-medium text-red-600 line-clamp-2">{s.top_risk}</p>
          </CardContent>
        </Card>
      </div>

      {/* Summary */}
      {data.summary && (
        <Card>
          <CardContent className="pt-4">
            <h4 className="font-semibold mb-2">Summary</h4>
            <p className="text-gray-700">{data.summary}</p>
          </CardContent>
        </Card>
      )}

      {/* Objectives Check */}
      {data.objectivesCheck && data.objectivesCheck.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <h4 className="font-semibold mb-3">Objectives Check</h4>
            <div className="space-y-2">
              {data.objectivesCheck.map((obj: SpecObjectiveCheck, i: number) => (
                <div key={i} className="flex items-start gap-3 p-2 bg-gray-50 rounded">
                  <span className={`mt-0.5 text-lg ${obj.addressed ? 'text-green-500' : 'text-red-400'}`}>
                    {obj.addressed ? '✓' : '✗'}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{obj.text}</p>
                    {obj.relevant_problems.length > 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        Related: {obj.relevant_problems.join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function ProblemsTabV2({ data, onCommit }: {
  data: AnalysisDataV2
  onCommit: (title: string, strength: number) => void
}) {
  const [expandedProblem, setExpandedProblem] = useState<number | null>(null)
  const [activeFilters, setActiveFilters] = useState<string[]>(['ALL'])
  const [strengthFilters, setStrengthFilters] = useState<string[]>(['ALL'])
  const problems = data.rankedProblems || []

  // Counts
  const commitCount = problems.filter((p: SpecRankedProblem) => p.recommendation === 'COMMIT').length
  const validateCount = problems.filter((p: SpecRankedProblem) => p.recommendation === 'VALIDATE').length
  const parkCount = problems.filter((p: SpecRankedProblem) => p.recommendation === 'PARK').length
  const strongCount = problems.filter((p: SpecRankedProblem) => p.band === 'strong').length
  const moderateCount = problems.filter((p: SpecRankedProblem) => p.band === 'moderate').length
  const weakCount = problems.filter((p: SpecRankedProblem) => p.band === 'weak').length

  // Filter click handler (recommendation)
  const handleFilterClick = (filterId: string) => {
    if (filterId === 'ALL') {
      setActiveFilters(['ALL'])
      return
    }
    let newFilters = activeFilters.filter(f => f !== 'ALL')
    if (activeFilters.includes(filterId)) {
      newFilters = newFilters.filter(f => f !== filterId)
      if (newFilters.length === 0) newFilters = ['ALL']
    } else {
      newFilters = [...newFilters, filterId]
      if (newFilters.length === 3) newFilters = ['ALL']
    }
    setActiveFilters(newFilters)
  }

  // Filter click handler (strength band)
  const handleStrengthClick = (band: string) => {
    if (band === 'ALL') {
      setStrengthFilters(['ALL'])
      return
    }
    let newFilters = strengthFilters.filter(f => f !== 'ALL')
    if (strengthFilters.includes(band)) {
      newFilters = newFilters.filter(f => f !== band)
      if (newFilters.length === 0) newFilters = ['ALL']
    } else {
      newFilters = [...newFilters, band]
      if (newFilters.length === 3) newFilters = ['ALL']
    }
    setStrengthFilters(newFilters)
  }

  // Apply filters
  const filteredProblems = problems.filter((p: SpecRankedProblem) => {
    const passesRec = activeFilters.includes('ALL') || activeFilters.includes(p.recommendation)
    const passesStrength = strengthFilters.includes('ALL') || strengthFilters.includes(p.band)
    return passesRec && passesStrength
  })

  const clearAllFilters = () => {
    setActiveFilters(['ALL'])
    setStrengthFilters(['ALL'])
  }

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-gray-800 text-base">Ranked Problems ({problems.length})</h4>
        {/* Strength band pills */}
        <div className="flex gap-2 text-xs">
          <button
            onClick={() => handleStrengthClick('strong')}
            disabled={strongCount === 0}
            className={`px-2.5 py-1 rounded-md font-medium transition-all ${
              strongCount === 0 ? 'opacity-40 cursor-not-allowed' :
              strengthFilters.includes('strong') && !strengthFilters.includes('ALL')
                ? 'bg-[#DCFCE7] text-[#166534] ring-1 ring-green-400'
                : 'bg-green-50 text-green-700 hover:bg-green-100 cursor-pointer'
            }`}
          >
            {strongCount} Strong
          </button>
          <button
            onClick={() => handleStrengthClick('moderate')}
            disabled={moderateCount === 0}
            className={`px-2.5 py-1 rounded-md font-medium transition-all ${
              moderateCount === 0 ? 'opacity-40 cursor-not-allowed' :
              strengthFilters.includes('moderate') && !strengthFilters.includes('ALL')
                ? 'bg-[#FEF3C7] text-[#92400E] ring-1 ring-amber-400'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100 cursor-pointer'
            }`}
          >
            {moderateCount} Moderate
          </button>
          <button
            onClick={() => handleStrengthClick('weak')}
            disabled={weakCount === 0}
            className={`px-2.5 py-1 rounded-md font-medium transition-all ${
              weakCount === 0 ? 'opacity-40 cursor-not-allowed' :
              strengthFilters.includes('weak') && !strengthFilters.includes('ALL')
                ? 'bg-[#FEE2E2] text-[#991B1B] ring-1 ring-red-400'
                : 'bg-red-50 text-red-700 hover:bg-red-100 cursor-pointer'
            }`}
          >
            {weakCount} Weak
          </button>
        </div>
      </div>

      {/* Recommendation filter chips */}
      <div className="flex gap-2" role="group" aria-label="Filter by recommendation">
        <button
          onClick={() => handleFilterClick('ALL')}
          aria-pressed={activeFilters.includes('ALL')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer border ${
            activeFilters.includes('ALL')
              ? 'bg-gray-700 text-white border-gray-700'
              : 'bg-transparent border-gray-200 text-gray-500 hover:border-gray-300 hover:shadow-sm'
          }`}
        >
          All <span className="text-xs opacity-80">({problems.length})</span>
        </button>
        <button
          onClick={() => handleFilterClick('COMMIT')}
          disabled={commitCount === 0}
          aria-pressed={activeFilters.includes('COMMIT')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
            commitCount === 0 ? 'opacity-40 cursor-not-allowed border-gray-200 text-gray-400' :
            activeFilters.includes('COMMIT')
              ? 'bg-green-500/15 border-green-500 text-green-700 cursor-pointer'
              : 'bg-transparent border-gray-200 text-gray-500 hover:border-gray-300 hover:shadow-sm cursor-pointer'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-green-500" />
          COMMIT <span className="text-xs opacity-80">({commitCount})</span>
        </button>
        <button
          onClick={() => handleFilterClick('VALIDATE')}
          disabled={validateCount === 0}
          aria-pressed={activeFilters.includes('VALIDATE')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
            validateCount === 0 ? 'opacity-40 cursor-not-allowed border-gray-200 text-gray-400' :
            activeFilters.includes('VALIDATE')
              ? 'bg-amber-500/15 border-amber-500 text-amber-700 cursor-pointer'
              : 'bg-transparent border-gray-200 text-gray-500 hover:border-gray-300 hover:shadow-sm cursor-pointer'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          VALIDATE <span className="text-xs opacity-80">({validateCount})</span>
        </button>
        <button
          onClick={() => handleFilterClick('PARK')}
          disabled={parkCount === 0}
          aria-pressed={activeFilters.includes('PARK')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
            parkCount === 0 ? 'opacity-40 cursor-not-allowed border-gray-200 text-gray-400' :
            activeFilters.includes('PARK')
              ? 'bg-red-500/15 border-red-500 text-red-700 cursor-pointer'
              : 'bg-transparent border-gray-200 text-gray-500 hover:border-gray-300 hover:shadow-sm cursor-pointer'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-red-500" />
          PARK <span className="text-xs opacity-80">({parkCount})</span>
        </button>
      </div>

      {/* Problem cards */}
      {filteredProblems.length > 0 ? (
        <div className="space-y-3">
          {filteredProblems.map((problem: SpecRankedProblem, i: number) => {
            const originalIndex = problems.indexOf(problem)
            const isExpanded = expandedProblem === originalIndex
            const scoreColor = problem.band === 'strong' ? 'text-green-600' : problem.band === 'moderate' ? 'text-amber-600' : 'text-red-600'
            const barColor = problem.band === 'strong' ? 'bg-green-500' : problem.band === 'moderate' ? 'bg-amber-500' : 'bg-red-500'

            return (
              <Card key={originalIndex} className={`${getRecBorder(problem.recommendation)} transition-all duration-200`}>
                <CardContent className="py-4 px-5">
                  {/* Main row */}
                  <div className="flex items-center gap-4">
                    {/* Score display */}
                    <div className="flex flex-col items-center gap-1.5 min-w-[52px]">
                      <span className={`text-2xl font-bold ${scoreColor}`}>
                        {problem.strength_pct}
                      </span>
                      <div className="w-10 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${problem.strength_pct}%` }} />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900">{problem.title}</p>
                      {/* Meta row */}
                      <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-gray-500">
                        <span className="inline-flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          {problem.sources_count} sources
                        </span>
                        <span className="text-gray-300">·</span>
                        {problem.has_direct_voice ? (
                          <span className="text-green-600 font-medium">Direct voice</span>
                        ) : (
                          <span className="text-amber-600">No voice</span>
                        )}
                        <span className="text-gray-300">·</span>
                        <span className={problem.gaps.length > 0 ? 'text-red-600' : 'text-gray-400'}>
                          {problem.gaps.length} gap{problem.gaps.length !== 1 ? 's' : ''}
                        </span>
                        {problem.segments.length > 0 && (
                          <>
                            <span className="text-gray-300">·</span>
                            <span>{problem.segments.join(', ')}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Recommendation badge + actions */}
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge className={`${getRecBadge(problem.recommendation)} text-xs px-3 py-1`}>
                        {problem.recommendation}
                      </Badge>
                      <button
                        onClick={() => setExpandedProblem(isExpanded ? null : originalIndex)}
                        className="text-xs px-3 py-1.5 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors"
                      >
                        {isExpanded ? 'Collapse' : 'Details'}
                      </button>
                      {problem.recommendation === 'COMMIT' && (
                        <button
                          onClick={() => onCommit(problem.title, problem.strength_pct)}
                          className="text-xs px-3 py-1.5 rounded-md bg-green-600 text-white hover:bg-green-700 font-medium transition-colors"
                        >
                          Commit
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
                      {/* Evidence summary */}
                      {problem.evidence_summary.length > 0 && (
                        <div>
                          <p className="text-sm font-semibold text-gray-700 mb-2">Evidence Summary</p>
                          <div className="space-y-2">
                            {problem.evidence_summary.map((es, j) => (
                              <div key={j} className="text-sm bg-white p-3 rounded-lg border border-gray-100">
                                <span className="text-gray-400">&ldquo;</span>
                                <span className="text-gray-700 italic">{es.quote}</span>
                                <span className="text-gray-400">&rdquo;</span>
                                <span className="text-gray-400 ml-2 text-xs">— {es.source} (weight: {es.weight})</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Constraint checks */}
                      {problem.constraint_checks.length > 0 && (
                        <div>
                          <p className="text-sm font-semibold text-gray-700 mb-2">Constraint Checks</p>
                          <div className="space-y-1.5">
                            {problem.constraint_checks.map((cc, j) => (
                              <div key={j} className="flex items-center justify-between text-sm p-2.5 bg-white rounded-lg border border-gray-100">
                                <span className="text-gray-700">{cc.constraint}</span>
                                <div className="flex items-center gap-3">
                                  <span className="text-gray-400 text-xs max-w-[300px] truncate">{cc.note}</span>
                                  <span className={`px-2 py-0.5 rounded-md font-medium text-xs ${
                                    cc.status === 'pass' ? 'bg-green-100 text-green-700' :
                                    cc.status === 'fail' ? 'bg-red-100 text-red-700' :
                                    'bg-gray-100 text-gray-500'
                                  }`}>
                                    {cc.status === 'pass' ? 'Pass' : cc.status === 'fail' ? 'Fail' : 'N/A'}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Gaps */}
                      {problem.gaps.length > 0 && (
                        <div>
                          <p className="text-sm font-semibold text-gray-700 mb-2">Evidence Gaps</p>
                          <ul className="space-y-1.5">
                            {problem.gaps.map((gap, j) => (
                              <li key={j} className="text-sm text-orange-700 flex items-start gap-2 bg-orange-50 rounded-lg p-2.5 border border-orange-100">
                                <svg className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                </svg>
                                {gap}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : problems.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <svg className="w-10 h-10 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <p className="font-medium text-gray-500">No problems added yet</p>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-400">
          <svg className="w-10 h-10 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="font-medium text-gray-500 mb-2">No problems match current filters</p>
          <button
            onClick={clearAllFilters}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  )
}

function ConstraintsTabV2({ data }: { data: AnalysisDataV2 }) {
  const matrix = data.constraintMatrix || []

  return (
    <div className="space-y-4">
      <h4 className="font-semibold text-gray-700">Constraint Compliance Matrix</h4>

      {matrix.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left p-3 font-medium text-gray-600 border-b">Constraint</th>
                <th className="text-center p-3 font-medium text-green-600 border-b w-20">Pass</th>
                <th className="text-center p-3 font-medium text-red-600 border-b w-20">Fail</th>
                <th className="text-center p-3 font-medium text-gray-400 border-b w-20">N/A</th>
                <th className="text-left p-3 font-medium text-gray-600 border-b">Flagged Problems</th>
              </tr>
            </thead>
            <tbody>
              {matrix.map((row: SpecConstraintMatrixRow, i: number) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="p-3 font-medium text-gray-800 border-b">{row.constraint}</td>
                  <td className="p-3 text-center border-b">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-green-100 text-green-700 font-bold text-xs">
                      {row.pass_count}
                    </span>
                  </td>
                  <td className="p-3 text-center border-b">
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full font-bold text-xs ${
                      row.fail_count > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-400'
                    }`}>
                      {row.fail_count}
                    </span>
                  </td>
                  <td className="p-3 text-center border-b">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 text-gray-400 font-bold text-xs">
                      {row.not_tested}
                    </span>
                  </td>
                  <td className="p-3 border-b">
                    {row.flagged_problems.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {row.flagged_problems.map((fp, j) => (
                          <span key={j} className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-600 max-w-[200px] truncate">
                            {fp}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs">None</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-gray-500 text-center py-8">No constraints defined for this session.</p>
      )}
    </div>
  )
}

function QualityTabV2({ data }: { data: AnalysisDataV2 }) {
  const contradictions = data.contradictions || []
  const checklist = data.checklistReview || []

  return (
    <div className="space-y-6">
      {/* Contradictions & Warnings */}
      <Card>
        <CardContent className="pt-4">
          <h4 className="font-semibold mb-3">Contradictions & Warnings</h4>
          {contradictions.length > 0 ? (
            <div className="space-y-2">
              {contradictions.map((c: SpecContradiction, i: number) => (
                <div key={i} className={`p-3 rounded border ${
                  c.severity === 'high' ? 'border-red-200 bg-red-50' :
                  c.severity === 'medium' ? 'border-yellow-200 bg-yellow-50' :
                  'border-gray-200 bg-gray-50'
                }`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">{c.description}</p>
                      <p className="text-xs text-gray-500 mt-1">Type: {c.type}</p>
                      {c.affected_problems.length > 0 && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          Affects: {c.affected_problems.join(', ')}
                        </p>
                      )}
                    </div>
                    <Badge className={
                      c.severity === 'high' ? 'bg-red-100 text-red-800' :
                      c.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-600'
                    }>
                      {c.severity}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No contradictions or warnings detected.</p>
          )}
        </CardContent>
      </Card>

      {/* Checklist Review */}
      <Card>
        <CardContent className="pt-4">
          <h4 className="font-semibold mb-3">Checklist Review</h4>
          {checklist.length > 0 ? (
            <div className="space-y-2">
              {checklist.map((item: SpecChecklistItem, i: number) => (
                <div key={i} className="flex items-start justify-between p-2 bg-gray-50 rounded">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.text}</p>
                    <p className="text-xs text-gray-500">{item.note}</p>
                  </div>
                  <Badge className={
                    item.status === 'met' ? 'bg-green-100 text-green-800' :
                    item.status === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }>
                    {item.status === 'not_met' ? 'not met' : item.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No checklist items to review.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ActionsTabV2({ data }: { data: AnalysisDataV2 }) {
  const actions = data.recommendedActions || []
  const steps = data.nextSteps || []

  const commitActions = actions.filter((a: SpecRecommendedAction) => a.type === 'COMMIT')
  const validateActions = actions.filter((a: SpecRecommendedAction) => a.type === 'VALIDATE')
  const parkActions = actions.filter((a: SpecRecommendedAction) => a.type === 'PARK')

  return (
    <div className="space-y-6">
      {/* Recommended Actions by type */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-green-50 rounded-lg p-4">
          <h4 className="font-semibold text-green-700 mb-3 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
            COMMIT ({commitActions.length})
          </h4>
          {commitActions.length > 0 ? (
            <ul className="space-y-3">
              {commitActions.map((a: SpecRecommendedAction, i: number) => (
                <li key={i}>
                  <p className="font-medium text-sm text-gray-800">{a.problem}</p>
                  <p className="text-xs text-gray-600">{a.rationale}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No problems ready to commit.</p>
          )}
        </div>

        <div className="bg-yellow-50 rounded-lg p-4">
          <h4 className="font-semibold text-yellow-700 mb-3 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500"></span>
            VALIDATE ({validateActions.length})
          </h4>
          {validateActions.length > 0 ? (
            <ul className="space-y-3">
              {validateActions.map((a: SpecRecommendedAction, i: number) => (
                <li key={i}>
                  <p className="font-medium text-sm text-gray-800">{a.problem}</p>
                  <p className="text-xs text-gray-600">{a.rationale}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No problems need validation.</p>
          )}
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-gray-400"></span>
            PARK ({parkActions.length})
          </h4>
          {parkActions.length > 0 ? (
            <ul className="space-y-3">
              {parkActions.map((a: SpecRecommendedAction, i: number) => (
                <li key={i}>
                  <p className="font-medium text-sm text-gray-800">{a.problem}</p>
                  <p className="text-xs text-gray-600">{a.rationale}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No problems to park.</p>
          )}
        </div>
      </div>

      {/* Next Steps */}
      {steps.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <h4 className="font-semibold mb-3">Next Steps</h4>
            <div className="space-y-2">
              {steps.map((step: SpecNextStep, i: number) => (
                <div key={i} className="flex items-start gap-3 p-2 bg-gray-50 rounded">
                  <Badge className={
                    step.priority === 'high' ? 'bg-red-100 text-red-800' :
                    step.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-600'
                  }>
                    {step.priority}
                  </Badge>
                  <div>
                    <p className="text-sm font-medium">{step.action}</p>
                    <p className="text-xs text-gray-500">{step.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ============================================
// Main Modal
// ============================================

export function AnalysisResultsModal({
  isOpen,
  onClose,
  analysisData,
  sessionTitle,
  sessionId,
  onReanalyze,
  onClearResults,
  isReanalyzing = false,
  elapsedSeconds = 0,
}: AnalysisResultsModalProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('overview')
  const [copied, setCopied] = useState(false)

  // Commit dialog state
  const [showCommitDialog, setShowCommitDialog] = useState(false)
  const [commitItem, setCommitItem] = useState<{ title: string; strength: number } | null>(null)
  const [commitForm, setCommitForm] = useState({
    title: '',
    successMetric: '',
    owner: '',
    reviewDate: '',
  })
  const [isCommitting, setIsCommitting] = useState(false)

  if (!analysisData) return null

  const v2 = isV2(analysisData)

  const handleCommit = (title: string, strength: number) => {
    setCommitItem({ title, strength })
    setCommitForm({ title, successMetric: '', owner: '', reviewDate: '' })
    setShowCommitDialog(true)
  }

  const handleCommitToDecision = async () => {
    if (!commitForm.title.trim()) return
    setIsCommitting(true)
    try {
      const response = await fetch('/api/decisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: commitForm.title,
          description: `Committed from analysis — evidence strength: ${commitItem?.strength || 0}%`,
          status: 'committed',
          evidence_strength: commitItem?.strength || 0,
          success_metrics: commitForm.successMetric ? { primary: commitForm.successMetric } : {},
          owner: commitForm.owner || null,
          review_date: commitForm.reviewDate || null,
          session_id: sessionId || analysisData.session_id,
        }),
      })
      if (response.ok) {
        setShowCommitDialog(false)
        setCommitItem(null)
        setCommitForm({ title: '', successMetric: '', owner: '', reviewDate: '' })
      }
    } catch (error) {
      console.error('Failed to commit decision:', error)
    } finally {
      setIsCommitting(false)
    }
  }

  const handleExportMarkdown = () => {
    const lines: string[] = []
    lines.push(`# Discovery Analysis: ${sessionTitle}`)
    lines.push(``)

    if (v2) {
      const d = analysisData as AnalysisDataV2
      lines.push(`_Generated on ${d.sessionHeader.date}_`)
      lines.push(``)
      lines.push(`## Summary`)
      lines.push(d.summary || '')
      lines.push(``)
      lines.push(`## Stats`)
      lines.push(`- Evidence Coverage: ${d.summaryStats.evidence_coverage_pct}%`)
      lines.push(`- Voice Coverage: ${d.summaryStats.voice_coverage_pct}%`)
      lines.push(`- Constraint Pass Rate: ${d.summaryStats.constraint_pass_rate}%`)
      lines.push(`- Avg Strength: ${d.sessionHeader.avg_strength}%`)
      lines.push(``)
      lines.push(`## Ranked Problems`)
      d.rankedProblems.forEach((p, i) => {
        lines.push(`### ${i + 1}. ${p.title} — ${p.strength_pct}% (${p.recommendation})`)
        lines.push(`Sources: ${p.sources_count} | Voice: ${p.has_direct_voice ? 'Yes' : 'No'} | Band: ${p.band}`)
        if (p.evidence_summary.length > 0) {
          lines.push(`**Evidence:**`)
          p.evidence_summary.forEach(es => lines.push(`> "${es.quote}" — ${es.source}`))
        }
        if (p.gaps.length > 0) {
          lines.push(`**Gaps:** ${p.gaps.join('; ')}`)
        }
        lines.push(``)
      })
      lines.push(`## Recommended Actions`)
      d.recommendedActions.forEach(a => {
        lines.push(`- **${a.type}**: ${a.problem} — ${a.rationale}`)
      })
    } else {
      const d = analysisData as AnalysisDataV1
      lines.push(`_Generated on ${new Date(d.created_at).toLocaleDateString()}_`)
      lines.push(``)
      lines.push(`> ${d.summary}`)
    }

    lines.push(``)
    lines.push(`---`)
    lines.push(`*Generated by Discovery Board*`)

    const content = lines.join('\n')
    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${sessionTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-analysis.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-[95vw] h-[92vh] flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold">Discovery Analysis</DialogTitle>
                <p className="text-sm text-gray-500">{sessionTitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onReanalyze}
                disabled={isReanalyzing}
                className="gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {isReanalyzing ? `Analyzing... ${Math.floor(elapsedSeconds / 60)}:${String(elapsedSeconds % 60).padStart(2, '0')}` : 'Re-analyze'}
              </Button>
              <button
                onClick={onClearResults}
                className="text-sm text-red-600 hover:text-red-700"
              >
                Clear Results
              </button>
            </div>
          </div>
        </DialogHeader>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="px-6 pt-2 justify-start bg-transparent border-b rounded-none h-auto gap-0 shrink-0">
            {v2 ? (
              <>
                <TabsTrigger value="overview" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none px-4 py-2">
                  Overview
                </TabsTrigger>
                <TabsTrigger value="problems" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none px-4 py-2">
                  Problems
                </TabsTrigger>
                <TabsTrigger value="constraints" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none px-4 py-2">
                  Constraints
                </TabsTrigger>
                <TabsTrigger value="quality" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none px-4 py-2">
                  Quality
                </TabsTrigger>
                <TabsTrigger value="actions" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none px-4 py-2">
                  Actions
                </TabsTrigger>
              </>
            ) : (
              <>
                <TabsTrigger value="overview" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none px-4 py-2">
                  Overview
                </TabsTrigger>
                <TabsTrigger value="problems" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none px-4 py-2">
                  Problems
                </TabsTrigger>
                <TabsTrigger value="solutions" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none px-4 py-2">
                  Solutions
                </TabsTrigger>
                <TabsTrigger value="quality" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none px-4 py-2">
                  Quality
                </TabsTrigger>
              </>
            )}
          </TabsList>

          <ScrollArea className="flex-1">
            <div className="p-6">
              {v2 ? (
                <>
                  <TabsContent value="overview" className="mt-0">
                    <OverviewTabV2 data={analysisData as AnalysisDataV2} />
                  </TabsContent>
                  <TabsContent value="problems" className="mt-0">
                    <ProblemsTabV2
                      data={analysisData as AnalysisDataV2}
                      onCommit={handleCommit}
                    />
                  </TabsContent>
                  <TabsContent value="constraints" className="mt-0">
                    <ConstraintsTabV2 data={analysisData as AnalysisDataV2} />
                  </TabsContent>
                  <TabsContent value="quality" className="mt-0">
                    <QualityTabV2 data={analysisData as AnalysisDataV2} />
                  </TabsContent>
                  <TabsContent value="actions" className="mt-0">
                    <ActionsTabV2 data={analysisData as AnalysisDataV2} />
                  </TabsContent>
                </>
              ) : (
                <>
                  {/* V1 Overview */}
                  <TabsContent value="overview" className="mt-0 space-y-6">
                    <Card>
                      <CardContent className="pt-4">
                        <h4 className="font-semibold mb-2">Summary</h4>
                        <p className="text-gray-700">{(analysisData as AnalysisDataV1).summary}</p>
                      </CardContent>
                    </Card>
                    {(analysisData as AnalysisDataV1).session_diagnosis && (
                      <Card>
                        <CardContent className="pt-4">
                          <h4 className="font-semibold mb-3">Session Diagnosis</h4>
                          <div className="grid grid-cols-3 gap-4">
                            <div className="text-center p-3 bg-gray-50 rounded">
                              <p className="text-xs text-gray-500">Quality</p>
                              <Badge>{(analysisData as AnalysisDataV1).session_diagnosis?.overall_quality || 'N/A'}</Badge>
                            </div>
                            <div className="text-center p-3 bg-gray-50 rounded">
                              <p className="text-xs text-gray-500">Evidence</p>
                              <Badge variant="outline">{(analysisData as AnalysisDataV1).session_diagnosis?.evidence_maturity || 'N/A'}</Badge>
                            </div>
                            <div className="text-center p-3 bg-gray-50 rounded">
                              <p className="text-xs text-gray-500">Readiness</p>
                              <Badge variant="outline">{(analysisData as AnalysisDataV1).session_diagnosis?.readiness_to_build || 'N/A'}</Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>

                  {/* V1 Problems */}
                  <TabsContent value="problems" className="mt-0 space-y-4">
                    {(() => {
                      const d = analysisData as AnalysisDataV1
                      const all = [
                        ...d.evidence_backed.map(item => ({
                          title: item.content,
                          strength: item.confidence ? Math.round(item.confidence * 100) : 75,
                          rec: (item.confidence && item.confidence >= 0.7 ? 'COMMIT' : 'VALIDATE') as string,
                        })),
                        ...d.assumptions.map(item => ({
                          title: item.content,
                          strength: item.confidence ? Math.round(item.confidence * 100) : 15,
                          rec: 'PARK' as string,
                        })),
                      ].sort((a, b) => b.strength - a.strength)

                      return all.map((p, i) => (
                        <Card key={i} className={getRecBorder(p.rec)}>
                          <CardContent className="py-3">
                            <div className="flex items-center gap-3">
                              <span className={`text-lg font-bold ${getScoreTextColor(p.strength)}`}>{p.strength}</span>
                              <p className="flex-1 text-sm font-medium">{p.title}</p>
                              <Badge className={getRecBadge(p.rec)}>{p.rec}</Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    })()}
                  </TabsContent>

                  {/* V1 Solutions */}
                  <TabsContent value="solutions" className="mt-0 space-y-4">
                    {(analysisData as AnalysisDataV1).solutions_analysis?.map((sol, i) => (
                      <Card key={i}>
                        <CardContent className="py-4">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-medium">{sol.solution}</h4>
                            <Badge>{sol.recommendation?.replace('_', ' ')}</Badge>
                          </div>
                          <p className="text-sm text-gray-600">Addresses: {sol.problem_solved}</p>
                          {sol.reasoning && <p className="text-sm text-gray-500 mt-1 italic">{sol.reasoning}</p>}
                        </CardContent>
                      </Card>
                    ))}
                  </TabsContent>

                  {/* V1 Quality */}
                  <TabsContent value="quality" className="mt-0 space-y-6">
                    {(analysisData as AnalysisDataV1).checklist_review?.length > 0 && (
                      <Card>
                        <CardContent className="pt-4">
                          <h4 className="font-semibold mb-3">Checklist Review</h4>
                          {(analysisData as AnalysisDataV1).checklist_review.map((item, i) => (
                            <div key={i} className="flex items-start justify-between p-2 bg-gray-50 rounded mb-2">
                              <div>
                                <p className="text-sm font-medium">{item.item}</p>
                                <p className="text-xs text-gray-500">{item.notes}</p>
                              </div>
                              <Badge className={
                                item.status === 'met' ? 'bg-green-100 text-green-800' :
                                item.status === 'partially' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }>
                                {item.status}
                              </Badge>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    )}
                    {(analysisData as AnalysisDataV1).constraint_analysis?.length > 0 && (
                      <Card>
                        <CardContent className="pt-4">
                          <h4 className="font-semibold mb-3">Constraints</h4>
                          {(analysisData as AnalysisDataV1).constraint_analysis.map((item, i) => (
                            <div key={i} className="flex items-start justify-between p-2 bg-gray-50 rounded mb-2">
                              <div>
                                <p className="text-sm font-medium">{item.constraint}</p>
                                <p className="text-xs text-gray-500">{item.notes}</p>
                              </div>
                              <Badge className={
                                item.status === 'aligned' ? 'bg-green-100 text-green-800' :
                                item.status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }>
                                {item.status}
                              </Badge>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>
                </>
              )}
            </div>
          </ScrollArea>
        </Tabs>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t shrink-0 flex justify-between items-center">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportMarkdown}>
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopyLink}>
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              {copied ? 'Copied!' : 'Share'}
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              variant="default"
              onClick={() => {
                if (analysisData?.session_id) {
                  router.push(`/session/${analysisData.session_id}/analysis`)
                  onClose()
                }
              }}
            >
              View Full Analysis
            </Button>
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        </DialogFooter>
      </DialogContent>

      {/* Commit to Decision Dialog */}
      {showCommitDialog && commitItem && (
        <Dialog open={showCommitDialog} onOpenChange={setShowCommitDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                Commit to Decision
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm font-medium text-green-800">{commitItem.title}</p>
                <p className="text-xs text-green-600 mt-1">Evidence strength: {commitItem.strength}%</p>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">Decision Title</label>
                  <input
                    type="text"
                    value={commitForm.title}
                    onChange={(e) => setCommitForm(f => ({ ...f, title: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="What are we committing to?"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Success Metric</label>
                  <input
                    type="text"
                    value={commitForm.successMetric}
                    onChange={(e) => setCommitForm(f => ({ ...f, successMetric: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="How will we measure success?"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Owner</label>
                    <input
                      type="text"
                      value={commitForm.owner}
                      onChange={(e) => setCommitForm(f => ({ ...f, owner: e.target.value }))}
                      className="mt-1 w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="Who owns this?"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Review Date</label>
                    <input
                      type="date"
                      value={commitForm.reviewDate}
                      onChange={(e) => setCommitForm(f => ({ ...f, reviewDate: e.target.value }))}
                      className="mt-1 w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCommitDialog(false)}>Cancel</Button>
              <Button
                onClick={handleCommitToDecision}
                disabled={isCommitting || !commitForm.title.trim()}
                className="bg-green-600 hover:bg-green-700"
              >
                {isCommitting ? 'Committing...' : 'Commit Decision'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  )
}
