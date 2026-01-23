import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ExportAnalysisButton } from '@/components/export-analysis-button'

interface PageProps {
  params: Promise<{ id: string }>
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

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'aligned':
      case 'met':
        return <Badge className="bg-green-100 text-green-800">✓ {status}</Badge>
      case 'warning':
      case 'partially':
        return <Badge className="bg-yellow-100 text-yellow-800">⚠ {status}</Badge>
      case 'conflict':
      case 'not_met':
        return <Badge className="bg-red-100 text-red-800">✕ {status}</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const assumptions = analysis.assumptions as { content: string; section: string }[] || []
  const evidenceBacked = analysis.evidence_backed as { content: string; section: string; evidence_summary: string }[] || []
  const validationRecs = analysis.validation_recommendations as {
    item: string
    confidence: string
    reason: string
    method: string
    questions: string[]
  }[] || []
  const constraintAnalysis = analysis.constraint_analysis as { constraint: string; status: string; notes: string }[] || []
  const checklistReview = analysis.checklist_review as { item: string; status: string; notes: string }[] || []

  // Type definitions for additional analysis fields
  type SessionDiagnosis = {
    overall_quality?: string
    evidence_maturity?: string
    session_nature?: string
    key_strengths?: string[]
    key_gaps?: string[]
    readiness_to_build?: string
  }
  type StrategicAlignment = {
    vision_alignment_score?: number
    vision_alignment_explanation?: string
    goals_coverage?: Array<{ goal: string; impact: string; problems_addressed: string[] }>
    overall_alignment_score?: number
  }
  type SolutionAnalysis = {
    solution: string
    problem_solved: string
    recommendation: string
    budget_fit?: string
    timeline_fit?: string
    reasoning?: string
  }
  type NextSteps = {
    build_now?: Array<{ action: string; reason: string }>
    validate_first?: Array<{ action: string; method: string; questions?: string[] }>
    defer?: Array<{ item: string; reason: string }>
  }

  // Prefer database columns, fallback to raw_response parsing for backwards compatibility
  let sessionDiagnosis: SessionDiagnosis | null = analysis.session_diagnosis as SessionDiagnosis | null
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

  const getQualityColor = (quality: string) => {
    switch (quality?.toLowerCase()) {
      case 'good': return 'bg-green-100 text-green-800'
      case 'fair': return 'bg-yellow-100 text-yellow-800'
      case 'poor': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getRecommendationColor = (rec: string) => {
    switch (rec?.toUpperCase()) {
      case 'BUILD_NOW': return 'bg-green-100 text-green-800 border-green-300'
      case 'VALIDATE_FIRST': return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'DEFER': return 'bg-orange-100 text-orange-800 border-orange-300'
      case 'BLOCKED': return 'bg-red-100 text-red-800 border-red-300'
      default: return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href={`/session/${id}`} className="text-gray-600 hover:text-gray-900">
              ← Back to Session
            </Link>
            <div className="flex items-center gap-4">
              <span className="font-medium">Analysis Results</span>
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
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{session?.title}</h1>
          <p className="text-gray-500">Analysis completed on {new Date(analysis.created_at).toLocaleString()}</p>
        </div>

        {/* Objective Score */}
        <Card>
          <CardHeader>
            <CardTitle>Objective Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className={`text-5xl font-bold ${getScoreColor(analysis.objective_score || 0)}`}>
                {analysis.objective_score}/100
              </div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${
                      (analysis.objective_score || 0) >= 80
                        ? 'bg-green-500'
                        : (analysis.objective_score || 0) >= 60
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${analysis.objective_score || 0}%` }}
                  />
                </div>
              </div>
            </div>
            <p className="mt-4 text-gray-700">{analysis.summary}</p>
          </CardContent>
        </Card>

        {/* Session Diagnosis */}
        {sessionDiagnosis && (
          <Card>
            <CardHeader>
              <CardTitle>Session Diagnosis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Overall Quality</p>
                  <Badge className={getQualityColor(sessionDiagnosis.overall_quality || '')}>
                    {sessionDiagnosis.overall_quality || 'N/A'}
                  </Badge>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Evidence Maturity</p>
                  <Badge className={getQualityColor(sessionDiagnosis.evidence_maturity || '')}>
                    {sessionDiagnosis.evidence_maturity || 'N/A'}
                  </Badge>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Session Nature</p>
                  <Badge variant="outline">{sessionDiagnosis.session_nature || 'N/A'}</Badge>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Readiness</p>
                  <Badge className={getQualityColor(
                    sessionDiagnosis.readiness_to_build === 'ready' ? 'good' :
                    sessionDiagnosis.readiness_to_build === 'needs_validation' ? 'fair' : 'poor'
                  )}>
                    {sessionDiagnosis.readiness_to_build || 'N/A'}
                  </Badge>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
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
            </CardContent>
          </Card>
        )}

        {/* Strategic Alignment */}
        {strategicAlignment && (
          <Card>
            <CardHeader>
              <CardTitle>Strategic Alignment</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Vision Alignment</p>
                  <div className="flex items-center gap-2">
                    <span className={`text-2xl font-bold ${getScoreColor(strategicAlignment.vision_alignment_score || 0)}`}>
                      {strategicAlignment.vision_alignment_score || 0}%
                    </span>
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500"
                        style={{ width: `${strategicAlignment.vision_alignment_score || 0}%` }}
                      />
                    </div>
                  </div>
                  {strategicAlignment.vision_alignment_explanation && (
                    <p className="text-xs text-gray-500 mt-2">{strategicAlignment.vision_alignment_explanation}</p>
                  )}
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Overall Alignment</p>
                  <div className="flex items-center gap-2">
                    <span className={`text-2xl font-bold ${getScoreColor(strategicAlignment.overall_alignment_score || 0)}`}>
                      {strategicAlignment.overall_alignment_score || 0}%
                    </span>
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500"
                        style={{ width: `${strategicAlignment.overall_alignment_score || 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
              {strategicAlignment.goals_coverage && strategicAlignment.goals_coverage.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Goals Coverage</h4>
                  <div className="space-y-2">
                    {strategicAlignment.goals_coverage.map((goal, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-sm">{goal.goal}</span>
                        <Badge variant="outline" className={
                          goal.impact === 'high' ? 'border-green-300 text-green-700' :
                          goal.impact === 'medium' ? 'border-yellow-300 text-yellow-700' :
                          'border-gray-300 text-gray-600'
                        }>
                          {goal.impact} impact
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Solutions Analysis */}
        {solutionsAnalysis.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Solutions Analysis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {solutionsAnalysis.map((sol, i) => (
                <div key={i} className={`border rounded-lg p-4 ${getRecommendationColor(sol.recommendation)}`}>
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium">{sol.solution}</h4>
                    <Badge className={getRecommendationColor(sol.recommendation)}>
                      {sol.recommendation?.replace('_', ' ')}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    <strong>Solves:</strong> {sol.problem_solved}
                  </p>
                  <div className="flex gap-4 text-xs text-gray-500">
                    {sol.budget_fit && <span>Budget: {sol.budget_fit}</span>}
                    {sol.timeline_fit && <span>Timeline: {sol.timeline_fit}</span>}
                  </div>
                  {sol.reasoning && (
                    <p className="text-sm text-gray-600 mt-2 italic">{sol.reasoning}</p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Next Steps */}
        {nextSteps && (
          <Card>
            <CardHeader>
              <CardTitle>Next Steps</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                {/* Build Now */}
                {nextSteps.build_now && nextSteps.build_now.length > 0 && (
                  <div className="bg-green-50 rounded-lg p-4">
                    <h4 className="font-medium text-green-700 mb-3 flex items-center gap-2">
                      <span className="text-lg">🚀</span> Build Now
                    </h4>
                    <ul className="space-y-2">
                      {nextSteps.build_now.map((item, i) => (
                        <li key={i} className="text-sm">
                          <p className="font-medium text-gray-800">{item.action}</p>
                          <p className="text-gray-600 text-xs">{item.reason}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Validate First */}
                {nextSteps.validate_first && nextSteps.validate_first.length > 0 && (
                  <div className="bg-yellow-50 rounded-lg p-4">
                    <h4 className="font-medium text-yellow-700 mb-3 flex items-center gap-2">
                      <span className="text-lg">🔬</span> Validate First
                    </h4>
                    <ul className="space-y-2">
                      {nextSteps.validate_first.map((item, i) => (
                        <li key={i} className="text-sm">
                          <p className="font-medium text-gray-800">{item.action}</p>
                          <p className="text-gray-600 text-xs">Method: {item.method}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Defer */}
                {nextSteps.defer && nextSteps.defer.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                      <span className="text-lg">⏸️</span> Defer
                    </h4>
                    <ul className="space-y-2">
                      {nextSteps.defer.map((item, i) => (
                        <li key={i} className="text-sm">
                          <p className="font-medium text-gray-800">{item.item}</p>
                          <p className="text-gray-600 text-xs">{item.reason}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
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

            <Separator />

            {/* Assumptions */}
            <div>
              <h3 className="font-medium text-yellow-700 mb-2">
                🟡 Unvalidated Assumptions ({assumptions.length})
              </h3>
              {assumptions.length > 0 ? (
                <ul className="space-y-2">
                  {assumptions.map((item, i) => (
                    <li key={i} className="bg-yellow-50 p-3 rounded-md">
                      <p className="font-medium">{item.content}</p>
                      <p className="text-sm text-gray-400">{item.section}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 text-sm">No unvalidated assumptions</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Validation Recommendations */}
        {validationRecs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Validation Recommendations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {validationRecs.map((rec, i) => (
                <div key={i} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium">{rec.item}</h4>
                    <Badge
                      variant="outline"
                      className={
                        rec.confidence === 'low'
                          ? 'border-red-300 text-red-700'
                          : rec.confidence === 'medium'
                          ? 'border-yellow-300 text-yellow-700'
                          : 'border-green-300 text-green-700'
                      }
                    >
                      {rec.confidence} confidence
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    <strong>Why:</strong> {rec.reason}
                  </p>
                  <p className="text-sm text-gray-600 mb-2">
                    <strong>Method:</strong> {rec.method}
                  </p>
                  {rec.questions && rec.questions.length > 0 && (
                    <div className="text-sm">
                      <strong>Questions to answer:</strong>
                      <ul className="list-disc list-inside ml-2">
                        {rec.questions.map((q, qi) => (
                          <li key={qi}>{q}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Constraint Analysis */}
        {constraintAnalysis.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Constraint Alignment</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {constraintAnalysis.map((item, i) => (
                  <li key={i} className="flex items-start justify-between">
                    <div>
                      <span className="font-medium">{item.constraint}</span>
                      <p className="text-sm text-gray-600">{item.notes}</p>
                    </div>
                    {getStatusBadge(item.status)}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Checklist Review */}
        {checklistReview.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Checklist Review</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {checklistReview.map((item, i) => (
                  <li key={i} className="flex items-start justify-between">
                    <div>
                      <span className="font-medium">{item.item}</span>
                      <p className="text-sm text-gray-600">{item.notes}</p>
                    </div>
                    {getStatusBadge(item.status)}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex justify-center gap-4 pt-4">
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
