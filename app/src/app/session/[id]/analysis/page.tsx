import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ExportAnalysisButton } from '@/components/export-analysis-button'

interface PageProps {
  params: Promise<{ id: string }>
}

// Type definitions
type SessionDiagnosis = {
  overall_quality?: string
  evidence_maturity?: string
  session_nature?: string
  key_strengths?: string[]
  key_gaps?: string[]
  readiness_to_build?: string
}

type EvidenceAssessment = {
  total_sources?: number
  source_types?: string[]
  quality_breakdown?: {
    strong?: number
    weak?: number
    none?: number
  }
  evidence_quality_score?: number
}

type StrategicAlignment = {
  vision_alignment_score?: number
  vision_alignment_explanation?: string
  goals_coverage?: Array<{ goal: string; impact: string; problems_addressed: string[] }>
  overall_alignment_score?: number
  objectives_alignment_score?: number
  objectives_alignment_explanation?: string
}

type SolutionAnalysis = {
  solution: string
  problem_solved: string
  recommendation: string
  budget_fit?: string
  timeline_fit?: string
  tech_feasibility?: string
  reasoning?: string
}

type NextSteps = {
  build_now?: Array<{ action: string; reason: string; which_solutions?: string[] }>
  validate_first?: Array<{ action: string; method: string; sample_size?: string; questions?: string[]; timeline?: string }>
  defer?: Array<{ item: string; reason: string; revisit_when?: string }>
}

type AssumptionItem = {
  content: string
  section: string
  confidence?: number
  validation_strategy?: string
  research_questions?: string[]
  risk_if_wrong?: string
}

type EvidenceBackedItem = {
  content: string
  section: string
  evidence_summary?: string
  confidence?: number
  confidence_tier?: string
  sources_count?: number
  key_quotes?: string[]
  user_impact?: string
}

export default async function AnalysisPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get the latest analysis for this session
  const { data: analysis, error } = await supabase
    .from('session_analyses')
    .select('*')
    .eq('session_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !analysis) {
    redirect(`/session/${id}`)
  }

  const { data: session } = await supabase
    .from('sessions')
    .select('title')
    .eq('id', id)
    .single()

  // Parse data from analysis
  const assumptions = (analysis.assumptions as AssumptionItem[]) || []
  const evidenceBacked = (analysis.evidence_backed as EvidenceBackedItem[]) || []
  const validationRecs = analysis.validation_recommendations as {
    item: string
    confidence: string
    reason: string
    method: string
    questions: string[]
    sample_size?: string
  }[] || []
  const constraintAnalysis = analysis.constraint_analysis as { constraint: string; status: string; notes: string }[] || []
  const checklistReview = analysis.checklist_review as { item: string; status: string; notes: string }[] || []

  // Get additional fields from database or raw_response
  let sessionDiagnosis: SessionDiagnosis | null = analysis.session_diagnosis as SessionDiagnosis | null
  let evidenceAssessment: EvidenceAssessment | null = analysis.evidence_assessment as EvidenceAssessment | null
  let strategicAlignment: StrategicAlignment | null = analysis.strategic_alignment as StrategicAlignment | null
  let solutionsAnalysis: SolutionAnalysis[] = (analysis.solutions_analysis as SolutionAnalysis[]) || []
  let nextSteps: NextSteps | null = analysis.next_steps as NextSteps | null

  // Fallback: Parse from raw_response if database columns are empty (for older analyses)
  const rawResponse = analysis.raw_response as { content?: Array<{ text?: string }> } | null
  if (!sessionDiagnosis && rawResponse?.content?.[0]?.text) {
    try {
      const parsed = JSON.parse(rawResponse.content[0].text)
      sessionDiagnosis = parsed.session_diagnosis || null
      strategicAlignment = strategicAlignment || parsed.strategic_alignment || null
      solutionsAnalysis = solutionsAnalysis.length > 0 ? solutionsAnalysis : (parsed.solutions_analysis || [])
      nextSteps = nextSteps || parsed.next_steps || null
    } catch {
      // Fallback if parsing fails
    }
  }

  // Calculate derived values
  const totalCards = evidenceBacked.length + assumptions.length
  const evidenceScore = evidenceAssessment?.evidence_quality_score ||
    (totalCards > 0 ? Math.round((evidenceBacked.length / totalCards) * 100) : 0)

  // Determine session nature
  const sessionNature = sessionDiagnosis?.session_nature ||
    (evidenceScore >= 70 ? 'validated' : evidenceScore >= 40 ? 'hybrid' : 'assumption_driven')

  // Extract focus areas from sections
  const focusAreas = new Map<string, number>()
  ;[...evidenceBacked, ...assumptions].forEach(item => {
    if (item.section) {
      focusAreas.set(item.section, (focusAreas.get(item.section) || 0) + 1)
    }
  })
  const sortedFocusAreas = Array.from(focusAreas.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  // Helper functions
  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600'
    if (score >= 40) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getSessionNatureBadge = (nature: string) => {
    switch (nature) {
      case 'validated':
        return <Badge className="bg-green-100 text-green-800">Validated</Badge>
      case 'hybrid':
        return <Badge className="bg-yellow-100 text-yellow-800">Hybrid</Badge>
      case 'assumption_driven':
        return <Badge className="bg-red-100 text-red-800">Assumption-Driven</Badge>
      default:
        return <Badge variant="outline">{nature}</Badge>
    }
  }

  const getPriorityBadge = (confidence?: number) => {
    if (!confidence) return <Badge variant="outline">Unknown</Badge>
    if (confidence >= 60) return <Badge className="bg-green-100 text-green-800">High Priority</Badge>
    if (confidence >= 30) return <Badge className="bg-yellow-100 text-yellow-800">Medium Priority</Badge>
    return <Badge className="bg-red-100 text-red-800">Low Priority</Badge>
  }

  const getRecommendationBadge = (rec: string) => {
    switch (rec?.toUpperCase()) {
      case 'BUILD_NOW':
        return <Badge className="bg-green-100 text-green-800 border border-green-300">Build Now</Badge>
      case 'VALIDATE_FIRST':
        return <Badge className="bg-yellow-100 text-yellow-800 border border-yellow-300">Validate First</Badge>
      case 'DEFER':
        return <Badge className="bg-orange-100 text-orange-800 border border-orange-300">Defer</Badge>
      case 'BLOCKED':
        return <Badge className="bg-red-100 text-red-800 border border-red-300">Blocked</Badge>
      default:
        return <Badge variant="outline">{rec}</Badge>
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href={`/session/${id}`} className="text-gray-600 hover:text-gray-900 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Session
            </Link>
            <div className="flex items-center gap-3">
              <ExportAnalysisButton
                analysis={{
                  sessionTitle: session?.title || 'Untitled Session',
                  createdAt: analysis.created_at,
                  objectiveScore: analysis.objective_score || 0,
                  summary: analysis.summary || '',
                  assumptions,
                  evidenceBacked,
                  validationRecommendations: validationRecs,
                  constraintAnalysis,
                  checklistReview,
                  sessionDiagnosis,
                  strategicAlignment,
                  solutionsAnalysis,
                  nextSteps,
                }}
              />
              <Link href={`/session/${id}/validation`}>
                <Button variant="outline" size="sm">
                  Validation Portal
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* Title Section */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Discovery Analysis</h1>
          <p className="text-lg text-gray-600 mt-1">{session?.title}</p>
          <p className="text-sm text-gray-400 mt-1">
            Generated on {new Date(analysis.created_at).toLocaleDateString('en-GB', {
              day: '2-digit', month: '2-digit', year: 'numeric'
            })}
          </p>
        </div>

        {/* Session Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>📊</span> Session Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Evidence Score</p>
                <p className={`text-2xl font-bold ${getScoreColor(evidenceScore)}`}>{evidenceScore}%</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Evidence Cards</p>
                <p className="text-2xl font-bold text-green-600">{evidenceBacked.length}</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Assumption Cards</p>
                <p className="text-2xl font-bold text-yellow-600">{assumptions.length}</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Total Cards</p>
                <p className="text-2xl font-bold text-gray-700">{totalCards}</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Session Nature</p>
                {getSessionNatureBadge(sessionNature)}
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Objective Alignment</p>
                <p className={`text-2xl font-bold ${getScoreColor(analysis.objective_score || 0)}`}>
                  {analysis.objective_score || 0}%
                </p>
              </div>
            </div>

            {/* Summary Quote */}
            {analysis.summary && (
              <blockquote className="border-l-4 border-blue-500 pl-4 py-2 bg-blue-50 rounded-r-lg italic text-gray-700">
                {analysis.summary}
              </blockquote>
            )}
          </CardContent>
        </Card>

        {/* Focus Areas */}
        {sortedFocusAreas.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>🎯</span> Focus Areas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {sortedFocusAreas.map(([area, count], index) => (
                  <div key={area} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-gray-400">{index + 1}.</span>
                      <span className="font-medium">{area}</span>
                    </div>
                    <Badge variant="outline">{count} cards</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Assumption Mapping */}
        <Card>
          <CardHeader>
            <CardTitle>Assumption Mapping</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Evidence-Backed */}
            <div>
              <h3 className="font-medium text-green-700 mb-2">
                🟢 Evidence-Backed ({evidenceBacked.length})
              </h3>
              {evidenceBacked.length > 0 ? (
                <ul className="space-y-2">
                  {evidenceBacked.map((item, i) => (
                    <li key={i} className="bg-green-50 p-3 rounded-md">
                      <p className="font-medium">{item.content}</p>
                      <p className="text-sm text-gray-600">
                        <span className="text-gray-400">{item.section}</span>
                        {item.evidence_summary && ` — ${item.evidence_summary}`}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 text-sm">No evidence-backed items</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Assumed Problems (Need Validation) */}
        {assumptions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>⚠️</span> Assumed Problems (Need Validation)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {assumptions.map((item, index) => (
                <div key={index} className="border border-yellow-200 bg-yellow-50 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-gray-900">{index + 1}. {item.content}</h4>
                    {getPriorityBadge(item.confidence)}
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                    <span><strong>Section:</strong> {item.section}</span>
                    {item.confidence !== undefined && (
                      <span><strong>Confidence:</strong> {Math.round(item.confidence * 100)}%</span>
                    )}
                  </div>
                  {item.validation_strategy && (
                    <p className="text-sm text-gray-600 mt-2">
                      <strong>Validation Strategy:</strong> {item.validation_strategy}
                    </p>
                  )}
                  {item.risk_if_wrong && (
                    <p className="text-sm text-red-600 mt-1">
                      <strong>Risk if wrong:</strong> {item.risk_if_wrong}
                    </p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Validated Problems */}
        {evidenceBacked.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>✅</span> Validated Problems
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {evidenceBacked.map((item, index) => (
                <div key={index} className="border border-green-200 bg-green-50 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-gray-900">{index + 1}. {item.content}</h4>
                    <Badge className="bg-green-100 text-green-800">
                      {item.confidence_tier || 'Validated'}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                    <span><strong>Section:</strong> {item.section}</span>
                    {item.confidence !== undefined && (
                      <span><strong>Confidence:</strong> {Math.round(item.confidence * 100)}%</span>
                    )}
                    {item.sources_count !== undefined && (
                      <span><strong>Sources:</strong> {item.sources_count}</span>
                    )}
                    {item.user_impact && (
                      <span><strong>Impact:</strong> {item.user_impact}</span>
                    )}
                  </div>
                  {item.evidence_summary && (
                    <p className="text-sm text-gray-600 mt-2">
                      <strong>Evidence:</strong> {item.evidence_summary}
                    </p>
                  )}
                  {item.key_quotes && item.key_quotes.length > 0 && (
                    <div className="mt-2 text-sm">
                      <strong>Key Quotes:</strong>
                      <ul className="list-disc list-inside ml-2 text-gray-600">
                        {item.key_quotes.map((quote, qi) => (
                          <li key={qi} className="italic">&quot;{quote}&quot;</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Proposed Solutions */}
        {solutionsAnalysis.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>💡</span> Proposed Solutions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {solutionsAnalysis.map((sol, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-gray-900">{index + 1}. {sol.solution}</h4>
                    {getRecommendationBadge(sol.recommendation)}
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    <strong>Solves:</strong> {sol.problem_solved}
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    {sol.budget_fit && (
                      <div className="bg-gray-50 p-2 rounded">
                        <span className="text-gray-500">Budget:</span> {sol.budget_fit}
                      </div>
                    )}
                    {sol.timeline_fit && (
                      <div className="bg-gray-50 p-2 rounded">
                        <span className="text-gray-500">Timeline:</span> {sol.timeline_fit}
                      </div>
                    )}
                    {sol.tech_feasibility && (
                      <div className="bg-gray-50 p-2 rounded">
                        <span className="text-gray-500">Tech:</span> {sol.tech_feasibility}
                      </div>
                    )}
                  </div>
                  {sol.reasoning && (
                    <p className="text-sm text-gray-500 mt-3 italic">{sol.reasoning}</p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Recommended Next Steps */}
        {nextSteps && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>🚀</span> Recommended Next Steps
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* High Priority - Build Now */}
              {nextSteps.build_now && nextSteps.build_now.length > 0 && (
                <div>
                  <h3 className="font-semibold text-red-700 mb-3 flex items-center gap-2">
                    <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                    High Priority
                  </h3>
                  {nextSteps.build_now.map((item, index) => (
                    <div key={index} className="border-l-4 border-red-500 pl-4 py-2 mb-3 bg-red-50 rounded-r">
                      <p className="font-medium">{item.action}</p>
                      <p className="text-sm text-gray-600">Why: {item.reason}</p>
                      {item.which_solutions && item.which_solutions.length > 0 && (
                        <p className="text-sm text-gray-500">Solutions: {item.which_solutions.join(', ')}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Medium Priority - Validate First */}
              {nextSteps.validate_first && nextSteps.validate_first.length > 0 && (
                <div>
                  <h3 className="font-semibold text-yellow-700 mb-3 flex items-center gap-2">
                    <span className="w-3 h-3 bg-yellow-500 rounded-full"></span>
                    Medium Priority
                  </h3>
                  {nextSteps.validate_first.map((item, index) => (
                    <div key={index} className="border-l-4 border-yellow-500 pl-4 py-2 mb-3 bg-yellow-50 rounded-r">
                      <p className="font-medium">{item.action}</p>
                      <p className="text-sm text-gray-600">Method: {item.method}</p>
                      {item.sample_size && (
                        <p className="text-sm text-gray-500">Sample Size: {item.sample_size}</p>
                      )}
                      {item.timeline && (
                        <p className="text-sm text-gray-500">Effort: {item.timeline}</p>
                      )}
                      {item.questions && item.questions.length > 0 && (
                        <div className="text-sm text-gray-500 mt-1">
                          Questions:
                          <ul className="list-disc list-inside ml-2">
                            {item.questions.map((q, qi) => (
                              <li key={qi}>{q}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Low Priority - Defer */}
              {nextSteps.defer && nextSteps.defer.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-600 mb-3 flex items-center gap-2">
                    <span className="w-3 h-3 bg-gray-400 rounded-full"></span>
                    Low Priority (Defer)
                  </h3>
                  {nextSteps.defer.map((item, index) => (
                    <div key={index} className="border-l-4 border-gray-400 pl-4 py-2 mb-3 bg-gray-50 rounded-r">
                      <p className="font-medium">{item.item}</p>
                      <p className="text-sm text-gray-600">Reason: {item.reason}</p>
                      {item.revisit_when && (
                        <p className="text-sm text-gray-500">Revisit when: {item.revisit_when}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Validation Recommendations */}
        {validationRecs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>🔬</span> Validation Playbook
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3">Item</th>
                      <th className="text-left py-2 px-3">Confidence</th>
                      <th className="text-left py-2 px-3">Method</th>
                      <th className="text-left py-2 px-3">Sample Size</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validationRecs.map((rec, index) => (
                      <tr key={index} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-3">{rec.item}</td>
                        <td className="py-2 px-3">
                          <Badge variant="outline" className={
                            rec.confidence === 'low' ? 'border-red-300 text-red-700' :
                            rec.confidence === 'medium' ? 'border-yellow-300 text-yellow-700' :
                            'border-green-300 text-green-700'
                          }>
                            {rec.confidence}
                          </Badge>
                        </td>
                        <td className="py-2 px-3">{rec.method}</td>
                        <td className="py-2 px-3">{rec.sample_size || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Constraint & Checklist Review */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Constraint Analysis */}
          {constraintAnalysis.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Constraint Alignment</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {constraintAnalysis.map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm">{item.constraint}</span>
                      <Badge variant="outline" className={
                        item.status === 'aligned' ? 'border-green-300 text-green-700' :
                        item.status === 'warning' ? 'border-yellow-300 text-yellow-700' :
                        'border-red-300 text-red-700'
                      }>
                        {item.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Checklist Review */}
          {checklistReview.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Checklist Review</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {checklistReview.map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm">{item.item}</span>
                      <Badge variant="outline" className={
                        item.status === 'met' ? 'border-green-300 text-green-700' :
                        item.status === 'partially' ? 'border-yellow-300 text-yellow-700' :
                        'border-red-300 text-red-700'
                      }>
                        {item.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>📝</span> Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 leading-relaxed">
              {analysis.summary || 'No summary available.'}
            </p>
            {sessionDiagnosis && (
              <div className="mt-4 grid md:grid-cols-2 gap-4">
                {sessionDiagnosis.key_strengths && sessionDiagnosis.key_strengths.length > 0 && (
                  <div>
                    <h4 className="font-medium text-green-700 mb-2">Key Strengths</h4>
                    <ul className="space-y-1">
                      {sessionDiagnosis.key_strengths.map((s, i) => (
                        <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                          <span className="text-green-500">✓</span> {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {sessionDiagnosis.key_gaps && sessionDiagnosis.key_gaps.length > 0 && (
                  <div>
                    <h4 className="font-medium text-red-700 mb-2">Key Gaps</h4>
                    <ul className="space-y-1">
                      {sessionDiagnosis.key_gaps.map((g, i) => (
                        <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                          <span className="text-red-500">!</span> {g}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer Actions */}
        <div className="flex justify-center gap-4 pt-4 pb-8">
          <Link href={`/session/${id}`}>
            <Button variant="outline">Back to Session</Button>
          </Link>
          <Link href={`/session/${id}/validation`}>
            <Button variant="outline" className="border-purple-300 text-purple-700 hover:bg-purple-50">
              Open Validation Portal
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button>Go to Dashboard</Button>
          </Link>
        </div>
      </main>
    </div>
  )
}
