'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'

// Type definitions
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
  objectives_alignment_score?: number
  objectives_alignment_explanation?: string
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

interface NextSteps {
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

interface ValidationRecommendation {
  item: string
  confidence: string
  reason: string
  method: string
  questions: string[]
  sample_size?: string
}

interface ConstraintAnalysisItem {
  constraint: string
  status: string
  notes: string
}

interface ChecklistReviewItem {
  item: string
  status: string
  notes: string
}

export interface AnalysisData {
  id: string
  session_id: string
  created_at: string
  objective_score: number
  summary: string
  session_diagnosis: SessionDiagnosis | null
  strategic_alignment: StrategicAlignment | null
  solutions_analysis: SolutionAnalysis[]
  next_steps: NextSteps | null
  evidence_backed: EvidenceBackedItem[]
  assumptions: AssumptionItem[]
  validation_recommendations: ValidationRecommendation[]
  constraint_analysis: ConstraintAnalysisItem[]
  checklist_review: ChecklistReviewItem[]
}

// Ranked problem from session analyzer
interface RankedProblem {
  title: string
  evidence_strength: number
  source_count: number
  segment_count: number
  has_direct_voice: boolean
  has_contradictions: boolean
  is_stale: boolean
  recommendation: 'commit' | 'validate' | 'park'
  constraint_violations: string[]
}

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

// Progress Bar Component
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

// Get color based on score
function getScoreColor(score: number): string {
  if (score >= 80) return 'bg-green-500'
  if (score >= 60) return 'bg-yellow-500'
  return 'bg-red-500'
}

function getScoreTextColor(score: number): string {
  if (score >= 80) return 'text-green-600'
  if (score >= 60) return 'text-yellow-600'
  return 'text-red-600'
}

function getImpactColor(impact: string): string {
  switch (impact?.toLowerCase()) {
    case 'high': return 'text-green-600'
    case 'medium': return 'text-yellow-600'
    case 'low': return 'text-gray-600'
    default: return 'text-gray-600'
  }
}

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
  const [activeTab, setActiveTab] = useState('alignment')
  const [copied, setCopied] = useState(false)

  // Commit to Decision dialog state
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

  const totalCards = analysisData.evidence_backed.length + analysisData.assumptions.length
  const evidenceScore = totalCards > 0
    ? Math.round((analysisData.evidence_backed.length / totalCards) * 100)
    : 0

  // Build ranked problems list from evidence_backed + assumptions
  const rankedProblems: RankedProblem[] = [
    ...analysisData.evidence_backed.map(item => ({
      title: item.content,
      evidence_strength: item.confidence ? Math.round(item.confidence * 100) : 75,
      source_count: 1,
      segment_count: 1,
      has_direct_voice: false,
      has_contradictions: false,
      is_stale: false,
      recommendation: (item.confidence && item.confidence >= 0.7 ? 'commit' : item.confidence && item.confidence >= 0.4 ? 'validate' : 'park') as 'commit' | 'validate' | 'park',
      constraint_violations: [],
    })),
    ...analysisData.assumptions.map(item => ({
      title: item.content,
      evidence_strength: item.confidence ? Math.round(item.confidence * 100) : 15,
      source_count: 0,
      segment_count: 0,
      has_direct_voice: false,
      has_contradictions: false,
      is_stale: false,
      recommendation: 'park' as const,
      constraint_violations: [],
    })),
  ].sort((a, b) => b.evidence_strength - a.evidence_strength)

  // Strength band stats
  const strongCount = rankedProblems.filter(p => p.evidence_strength >= 70).length
  const moderateCount = rankedProblems.filter(p => p.evidence_strength >= 40 && p.evidence_strength < 70).length
  const weakCount = rankedProblems.filter(p => p.evidence_strength < 40).length

  // Commit handler
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

  // Export markdown function
  const handleExportMarkdown = () => {
    const lines: string[] = []
    lines.push(`# Discovery Analysis: ${sessionTitle}`)
    lines.push(``)
    lines.push(`_Generated on ${new Date(analysisData.created_at).toLocaleDateString()}_`)
    lines.push(``)
    lines.push(`## Session Overview`)
    lines.push(`- **Objective Score:** ${analysisData.objective_score}%`)
    lines.push(`- **Evidence Score:** ${evidenceScore}%`)
    lines.push(`- **Evidence-based cards:** ${analysisData.evidence_backed.length}`)
    lines.push(`- **Assumption cards:** ${analysisData.assumptions.length}`)
    lines.push(``)
    lines.push(`> ${analysisData.summary}`)
    lines.push(``)
    lines.push(`---`)
    lines.push(`*Generated by Product Discovery Tool*`)

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
      <DialogContent className="max-w-6xl max-h-[95vh] w-[90vw] flex flex-col p-0">
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
            <TabsTrigger value="alignment" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none px-4 py-2">
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Alignment
            </TabsTrigger>
            <TabsTrigger value="overview" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none px-4 py-2">
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Overview
            </TabsTrigger>
            <TabsTrigger value="problems" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none px-4 py-2">
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Problems
            </TabsTrigger>
            <TabsTrigger value="solutions" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none px-4 py-2">
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Solutions
            </TabsTrigger>
            <TabsTrigger value="nextsteps" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none px-4 py-2">
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              Next Steps
            </TabsTrigger>
            <TabsTrigger value="quality" className="data-[state=active]:border-b-2 data-[state=active]:border-blue-500 rounded-none px-4 py-2">
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
              Quality
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1">
            <div className="p-6">
              {/* Alignment Tab */}
              <TabsContent value="alignment" className="mt-0 space-y-6">
                <div>
                  <h3 className="text-base font-semibold flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Session Strategic Alignment
                  </h3>
                  <p className="text-sm text-gray-500 mb-4">How well this discovery session aligns with your product strategy</p>

                  <Card className="mb-4">
                    <CardContent className="pt-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium">Overall Alignment</span>
                        <span className={`text-lg font-bold ${getScoreTextColor(analysisData.strategic_alignment?.overall_alignment_score || 0)}`}>
                          {analysisData.strategic_alignment?.overall_alignment_score || 0}%
                        </span>
                      </div>
                      <ProgressBar
                        value={analysisData.strategic_alignment?.overall_alignment_score || 0}
                        color={getScoreColor(analysisData.strategic_alignment?.overall_alignment_score || 0)}
                      />
                      {analysisData.strategic_alignment?.vision_alignment_explanation && (
                        <p className="text-sm text-gray-600 mt-3">
                          {analysisData.strategic_alignment.vision_alignment_explanation}
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium">Product Vision Alignment</span>
                        <span className={`text-sm font-semibold ${getScoreTextColor(analysisData.strategic_alignment?.vision_alignment_score || 0)}`}>
                          {analysisData.strategic_alignment?.vision_alignment_score || 0}%
                        </span>
                      </div>
                      <ProgressBar
                        value={analysisData.strategic_alignment?.vision_alignment_score || 0}
                        color={getScoreColor(analysisData.strategic_alignment?.vision_alignment_score || 0)}
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium">Session Objectives Alignment</span>
                        <span className={`text-sm font-semibold ${getScoreTextColor(analysisData.objective_score || 0)}`}>
                          {analysisData.objective_score || 0}%
                        </span>
                      </div>
                      <ProgressBar
                        value={analysisData.objective_score || 0}
                        color={getScoreColor(analysisData.objective_score || 0)}
                      />
                    </div>
                  </div>

                  {analysisData.strategic_alignment?.goals_coverage && analysisData.strategic_alignment.goals_coverage.length > 0 && (
                    <div className="mt-6">
                      <h4 className="text-sm font-semibold mb-3">Strategic Goals Coverage</h4>
                      <div className="space-y-3">
                        {analysisData.strategic_alignment.goals_coverage.map((goal, i) => (
                          <div key={i} className="flex items-center justify-between">
                            <span className="text-sm text-gray-700 flex-1">{goal.goal}</span>
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-medium ${getImpactColor(goal.impact)}`}>
                                {goal.impact === 'high' ? '75%' : goal.impact === 'medium' ? '50%' : '25%'}
                              </span>
                              {goal.impact === 'high' && (
                                <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Overview Tab — Strength Band Stats */}
              <TabsContent value="overview" className="mt-0 space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <p className="text-sm text-gray-500">Total</p>
                      <p className="text-2xl font-bold text-gray-700">{totalCards}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-green-200">
                    <CardContent className="pt-4 text-center">
                      <p className="text-sm text-green-600">Strong (&gt;70%)</p>
                      <p className="text-2xl font-bold text-green-600">{strongCount}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-yellow-200">
                    <CardContent className="pt-4 text-center">
                      <p className="text-sm text-yellow-600">Moderate (40-70%)</p>
                      <p className="text-2xl font-bold text-yellow-600">{moderateCount}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-red-200">
                    <CardContent className="pt-4 text-center">
                      <p className="text-sm text-red-600">Weak/Assumed (&lt;40%)</p>
                      <p className="text-2xl font-bold text-red-600">{weakCount}</p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardContent className="pt-4">
                    <h4 className="font-semibold mb-2">Summary</h4>
                    <p className="text-gray-700">{analysisData.summary}</p>
                  </CardContent>
                </Card>

                {analysisData.session_diagnosis && (
                  <Card>
                    <CardContent className="pt-4">
                      <h4 className="font-semibold mb-3">Session Diagnosis</h4>
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="text-center p-3 bg-gray-50 rounded">
                          <p className="text-xs text-gray-500">Quality</p>
                          <Badge className={
                            analysisData.session_diagnosis.overall_quality === 'good' ? 'bg-green-100 text-green-800' :
                            analysisData.session_diagnosis.overall_quality === 'fair' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }>
                            {analysisData.session_diagnosis.overall_quality || 'N/A'}
                          </Badge>
                        </div>
                        <div className="text-center p-3 bg-gray-50 rounded">
                          <p className="text-xs text-gray-500">Evidence Maturity</p>
                          <Badge variant="outline">{analysisData.session_diagnosis.evidence_maturity || 'N/A'}</Badge>
                        </div>
                        <div className="text-center p-3 bg-gray-50 rounded">
                          <p className="text-xs text-gray-500">Readiness</p>
                          <Badge variant="outline">{analysisData.session_diagnosis.readiness_to_build || 'N/A'}</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Problems Tab — Ranked by Evidence Strength */}
              <TabsContent value="problems" className="mt-0 space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-gray-700">
                    Ranked Problems ({rankedProblems.length})
                  </h4>
                  <div className="flex gap-2 text-xs">
                    <span className="px-2 py-0.5 rounded bg-green-100 text-green-700">COMMIT</span>
                    <span className="px-2 py-0.5 rounded bg-yellow-100 text-yellow-700">VALIDATE</span>
                    <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600">PARK</span>
                  </div>
                </div>

                {rankedProblems.length > 0 ? (
                  <div className="space-y-2">
                    {rankedProblems.map((problem, i) => {
                      const recBorder = problem.recommendation === 'commit' ? 'border-green-200 bg-green-50' :
                        problem.recommendation === 'validate' ? 'border-yellow-200 bg-yellow-50' :
                        'border-gray-200 bg-gray-50'
                      const recBadge = problem.recommendation === 'commit' ? 'bg-green-100 text-green-800' :
                        problem.recommendation === 'validate' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-600'
                      const strengthColor = problem.evidence_strength >= 70 ? 'text-green-600' :
                        problem.evidence_strength >= 40 ? 'text-yellow-600' : 'text-red-600'
                      const strengthBg = problem.evidence_strength >= 70 ? 'bg-green-500' :
                        problem.evidence_strength >= 40 ? 'bg-yellow-500' : 'bg-red-500'

                      return (
                        <Card key={i} className={recBorder}>
                          <CardContent className="py-3">
                            <div className="flex items-start gap-3">
                              {/* Strength bar */}
                              <div className="flex flex-col items-center gap-1 min-w-[40px]">
                                <span className={`text-lg font-bold ${strengthColor}`}>
                                  {problem.evidence_strength}
                                </span>
                                <div className="w-8 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                  <div className={`h-full ${strengthBg} rounded-full`} style={{ width: `${problem.evidence_strength}%` }} />
                                </div>
                              </div>

                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-900 text-sm">{problem.title}</p>
                                {/* Flags row */}
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {!problem.has_direct_voice && problem.evidence_strength > 0 && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">No voice</span>
                                  )}
                                  {problem.segment_count <= 1 && problem.evidence_strength > 0 && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">Single segment</span>
                                  )}
                                  {problem.has_contradictions && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700">Contradictions</span>
                                  )}
                                  {problem.is_stale && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">Stale</span>
                                  )}
                                  {problem.constraint_violations.length > 0 && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                                      Constraint: {problem.constraint_violations[0]}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Recommendation + Commit */}
                              <div className="flex flex-col items-end gap-1.5 shrink-0">
                                <Badge className={recBadge}>
                                  {problem.recommendation.toUpperCase()}
                                </Badge>
                                {problem.recommendation === 'commit' && (
                                  <button
                                    onClick={() => {
                                      setCommitItem({ title: problem.title, strength: problem.evidence_strength })
                                      setCommitForm({
                                        title: problem.title,
                                        successMetric: '',
                                        owner: '',
                                        reviewDate: '',
                                      })
                                      setShowCommitDialog(true)
                                    }}
                                    className="text-[10px] px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700 transition-colors font-medium"
                                  >
                                    Commit
                                  </button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">No problems analyzed yet.</p>
                )}
              </TabsContent>

              {/* Solutions Tab */}
              <TabsContent value="solutions" className="mt-0 space-y-4">
                {analysisData.solutions_analysis && analysisData.solutions_analysis.length > 0 ? (
                  analysisData.solutions_analysis.map((sol, i) => {
                    const recColor = sol.recommendation === 'BUILD_NOW' ? 'border-green-300 bg-green-50' :
                      sol.recommendation === 'VALIDATE_FIRST' ? 'border-yellow-300 bg-yellow-50' :
                      sol.recommendation === 'DEFER' ? 'border-orange-300 bg-orange-50' :
                      'border-red-300 bg-red-50'
                    const badgeColor = sol.recommendation === 'BUILD_NOW' ? 'bg-green-100 text-green-800' :
                      sol.recommendation === 'VALIDATE_FIRST' ? 'bg-yellow-100 text-yellow-800' :
                      sol.recommendation === 'DEFER' ? 'bg-orange-100 text-orange-800' :
                      'bg-red-100 text-red-800'

                    return (
                      <Card key={i} className={recColor}>
                        <CardContent className="py-4">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-medium">{sol.solution}</h4>
                            <Badge className={badgeColor}>
                              {sol.recommendation?.replace('_', ' ')}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">
                            <strong>Addresses:</strong> {sol.problem_solved}
                          </p>
                          <div className="flex gap-4 text-xs text-gray-500">
                            {sol.budget_fit && <span>Budget: {sol.budget_fit}</span>}
                            {sol.timeline_fit && <span>Timeline: {sol.timeline_fit}</span>}
                            {sol.tech_feasibility && <span>Tech: {sol.tech_feasibility}</span>}
                          </div>
                          {sol.reasoning && (
                            <p className="text-sm text-gray-600 mt-2 italic">{sol.reasoning}</p>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })
                ) : (
                  <p className="text-gray-500 text-center py-8">No solutions analyzed yet.</p>
                )}
              </TabsContent>

              {/* Next Steps Tab */}
              <TabsContent value="nextsteps" className="mt-0">
                <div className="grid md:grid-cols-3 gap-4">
                  {/* Build Now */}
                  <div className="bg-green-50 rounded-lg p-4">
                    <h4 className="font-semibold text-green-700 mb-3 flex items-center gap-2">
                      <span className="text-lg">🚀</span> Build Now
                    </h4>
                    {analysisData.next_steps?.build_now && analysisData.next_steps.build_now.length > 0 ? (
                      <ul className="space-y-3">
                        {analysisData.next_steps.build_now.map((item, i) => (
                          <li key={i}>
                            <p className="font-medium text-sm text-gray-800">{item.action}</p>
                            <p className="text-xs text-gray-600">{item.reason}</p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-500">No items ready to build yet.</p>
                    )}
                  </div>

                  {/* Validate First */}
                  <div className="bg-yellow-50 rounded-lg p-4">
                    <h4 className="font-semibold text-yellow-700 mb-3 flex items-center gap-2">
                      <span className="text-lg">🔬</span> Validate First
                    </h4>
                    {analysisData.next_steps?.validate_first && analysisData.next_steps.validate_first.length > 0 ? (
                      <ul className="space-y-3">
                        {analysisData.next_steps.validate_first.map((item, i) => (
                          <li key={i}>
                            <p className="font-medium text-sm text-gray-800">{item.action}</p>
                            <p className="text-xs text-gray-600">Method: {item.method}</p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-500">No items need validation.</p>
                    )}
                  </div>

                  {/* Defer */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <span className="text-lg">⏸️</span> Defer
                    </h4>
                    {analysisData.next_steps?.defer && analysisData.next_steps.defer.length > 0 ? (
                      <ul className="space-y-3">
                        {analysisData.next_steps.defer.map((item, i) => (
                          <li key={i}>
                            <p className="font-medium text-sm text-gray-800">{item.item}</p>
                            <p className="text-xs text-gray-600">{item.reason}</p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-500">No items to defer.</p>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* Quality Tab */}
              <TabsContent value="quality" className="mt-0 space-y-6">
                {/* Session Diagnosis */}
                {analysisData.session_diagnosis && (
                  <Card>
                    <CardContent className="pt-4">
                      <h4 className="font-semibold mb-3">Session Diagnosis</h4>
                      <div className="grid md:grid-cols-2 gap-4">
                        {analysisData.session_diagnosis.key_strengths && analysisData.session_diagnosis.key_strengths.length > 0 && (
                          <div>
                            <p className="text-sm font-medium text-green-700 mb-2">Strengths</p>
                            <ul className="space-y-1">
                              {analysisData.session_diagnosis.key_strengths.map((s, i) => (
                                <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                                  <span className="text-green-500">✓</span> {s}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {analysisData.session_diagnosis.key_gaps && analysisData.session_diagnosis.key_gaps.length > 0 && (
                          <div>
                            <p className="text-sm font-medium text-red-700 mb-2">Gaps</p>
                            <ul className="space-y-1">
                              {analysisData.session_diagnosis.key_gaps.map((g, i) => (
                                <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                                  <span className="text-red-500">!</span> {g}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Checklist Review */}
                {analysisData.checklist_review && analysisData.checklist_review.length > 0 && (
                  <Card>
                    <CardContent className="pt-4">
                      <h4 className="font-semibold mb-3">Checklist Review</h4>
                      <div className="space-y-2">
                        {analysisData.checklist_review.map((item, i) => (
                          <div key={i} className="flex items-start justify-between p-2 bg-gray-50 rounded">
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
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Constraint Analysis */}
                {analysisData.constraint_analysis && analysisData.constraint_analysis.length > 0 && (
                  <Card>
                    <CardContent className="pt-4">
                      <h4 className="font-semibold mb-3">Constraint Alignment</h4>
                      <div className="space-y-2">
                        {analysisData.constraint_analysis.map((item, i) => (
                          <div key={i} className="flex items-start justify-between p-2 bg-gray-50 rounded">
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
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
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
              Export Markdown
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Export PDF
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
