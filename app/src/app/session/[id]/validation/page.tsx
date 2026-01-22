import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface PageProps {
  params: Promise<{ id: string }>
}

interface ValidationRecommendation {
  item: string
  confidence: string
  reason: string
  method: string
  questions: string[]
  success_criteria?: string
  sample_size?: string
}

interface ProblemTier1 {
  content: string
  section: string
  confidence: number
  evidence_summary: string
  sources_count: number
}

interface ProblemTier2 {
  content: string
  section: string
  confidence: number
  current_evidence: string
  validation_needed: string
}

interface ProblemTier3 {
  content: string
  section: string
  confidence: number
  validation_strategy: string
  research_questions: string[]
}

interface SessionDiagnosis {
  overall_quality: string
  evidence_maturity: string
  key_strengths: string[]
  key_gaps: string[]
}

export default async function ValidationPortalPage({ params }: PageProps) {
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

  // Parse analysis data - support both old and new formats
  const rawResponse = analysis.raw_response as { content?: { text?: string }[] } | null
  let parsedAnalysis: {
    session_diagnosis?: SessionDiagnosis
    problems_strongly_validated?: ProblemTier1[]
    problems_with_preliminary_evidence?: ProblemTier2[]
    problems_assumed?: ProblemTier3[]
    validation_recommendations?: ValidationRecommendation[]
  } = {}

  // Try to parse from raw_response if available
  if (rawResponse?.content?.[0]?.text) {
    try {
      parsedAnalysis = JSON.parse(rawResponse.content[0].text)
    } catch {
      // Use fallback from stored fields
    }
  }

  // Fallback to stored fields or use parsed data
  const sessionDiagnosis = parsedAnalysis.session_diagnosis || {
    overall_quality: 'unknown',
    evidence_maturity: 'unknown',
    key_strengths: [],
    key_gaps: []
  }

  const tier1Problems = parsedAnalysis.problems_strongly_validated || []
  const tier2Problems = parsedAnalysis.problems_with_preliminary_evidence || []
  const tier3Problems = parsedAnalysis.problems_assumed ||
    (analysis.assumptions as { content: string; section: string }[] || []).map(a => ({
      content: a.content,
      section: a.section,
      confidence: 0.2,
      validation_strategy: 'User interviews or surveys',
      research_questions: []
    }))

  const validationRecs = parsedAnalysis.validation_recommendations ||
    (analysis.validation_recommendations as ValidationRecommendation[] || [])

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.6) {
      return <Badge className="bg-green-100 text-green-800">{Math.round(confidence * 100)}% confidence</Badge>
    }
    if (confidence >= 0.3) {
      return <Badge className="bg-yellow-100 text-yellow-800">{Math.round(confidence * 100)}% confidence</Badge>
    }
    return <Badge className="bg-red-100 text-red-800">{Math.round(confidence * 100)}% confidence</Badge>
  }

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'excellent': return 'text-green-600'
      case 'good': return 'text-blue-600'
      case 'fair': return 'text-yellow-600'
      case 'poor': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const getMaturityColor = (maturity: string) => {
    switch (maturity) {
      case 'strong': return 'text-green-600'
      case 'medium': return 'text-yellow-600'
      case 'weak': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href={`/session/${id}/analysis`} className="text-gray-600 hover:text-gray-900">
              ← Back to Analysis
            </Link>
            <span className="font-medium text-purple-700">Validation Portal</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{session?.title} - Validation Portal</h1>
          <p className="text-gray-500">Prioritize and plan validation for your discovery findings</p>
        </div>

        {/* Session Diagnosis Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Session Diagnosis</CardTitle>
            <CardDescription>Overall assessment of your discovery session</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500 mb-1">Overall Quality</p>
                <p className={`text-xl font-bold capitalize ${getQualityColor(sessionDiagnosis.overall_quality)}`}>
                  {sessionDiagnosis.overall_quality}
                </p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500 mb-1">Evidence Maturity</p>
                <p className={`text-xl font-bold capitalize ${getMaturityColor(sessionDiagnosis.evidence_maturity)}`}>
                  {sessionDiagnosis.evidence_maturity}
                </p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500 mb-1">Validated Problems</p>
                <p className="text-xl font-bold text-green-600">{tier1Problems.length}</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500 mb-1">Needs Validation</p>
                <p className="text-xl font-bold text-yellow-600">{tier2Problems.length + tier3Problems.length}</p>
              </div>
            </div>

            {(sessionDiagnosis.key_strengths.length > 0 || sessionDiagnosis.key_gaps.length > 0) && (
              <div className="grid md:grid-cols-2 gap-4 mt-4">
                {sessionDiagnosis.key_strengths.length > 0 && (
                  <div className="p-3 bg-green-50 rounded-lg">
                    <p className="text-sm font-medium text-green-800 mb-2">Key Strengths</p>
                    <ul className="text-sm text-green-700 space-y-1">
                      {sessionDiagnosis.key_strengths.map((s, i) => (
                        <li key={i}>✓ {s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {sessionDiagnosis.key_gaps.length > 0 && (
                  <div className="p-3 bg-red-50 rounded-lg">
                    <p className="text-sm font-medium text-red-800 mb-2">Key Gaps</p>
                    <ul className="text-sm text-red-700 space-y-1">
                      {sessionDiagnosis.key_gaps.map((g, i) => (
                        <li key={i}>⚠ {g}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Three-Tier Problem Classification */}
        <Tabs defaultValue="tier1" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="tier1" className="data-[state=active]:bg-green-100">
              🟢 Tier 1: Validated ({tier1Problems.length})
            </TabsTrigger>
            <TabsTrigger value="tier2" className="data-[state=active]:bg-yellow-100">
              🟡 Tier 2: Preliminary ({tier2Problems.length})
            </TabsTrigger>
            <TabsTrigger value="tier3" className="data-[state=active]:bg-red-100">
              🔴 Tier 3: Assumptions ({tier3Problems.length})
            </TabsTrigger>
          </TabsList>

          {/* Tier 1: Strongly Validated */}
          <TabsContent value="tier1">
            <Card>
              <CardHeader>
                <CardTitle className="text-green-700">Strongly Validated Problems</CardTitle>
                <CardDescription>
                  Confidence 60-100%. Multiple independent sources with quantitative data or behavioral evidence.
                  These problems are ready for solution ideation.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {tier1Problems.length > 0 ? (
                  tier1Problems.map((problem, i) => (
                    <div key={i} className="border border-green-200 bg-green-50 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium text-green-900">{problem.content}</h4>
                        {getConfidenceBadge(problem.confidence)}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        <span className="inline-block px-2 py-0.5 bg-white rounded text-xs mr-2">{problem.section}</span>
                        {problem.sources_count} source{problem.sources_count !== 1 ? 's' : ''}
                      </p>
                      <p className="text-sm text-green-800">
                        <strong>Evidence:</strong> {problem.evidence_summary}
                      </p>
                      <div className="mt-3 pt-3 border-t border-green-200">
                        <p className="text-xs text-green-700 font-medium">✓ Ready for solution ideation</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-8">
                    No problems have been strongly validated yet. Add more evidence to your sticky notes or fetch evidence from your sources.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tier 2: Preliminary Evidence */}
          <TabsContent value="tier2">
            <Card>
              <CardHeader>
                <CardTitle className="text-yellow-700">Problems with Preliminary Evidence</CardTitle>
                <CardDescription>
                  Confidence 30-60%. 1-2 sources with some quantification. Needs additional validation before prioritizing.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {tier2Problems.length > 0 ? (
                  tier2Problems.map((problem, i) => (
                    <div key={i} className="border border-yellow-200 bg-yellow-50 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium text-yellow-900">{problem.content}</h4>
                        {getConfidenceBadge(problem.confidence)}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        <span className="inline-block px-2 py-0.5 bg-white rounded text-xs">{problem.section}</span>
                      </p>
                      <p className="text-sm text-yellow-800 mb-2">
                        <strong>Current Evidence:</strong> {problem.current_evidence}
                      </p>
                      <div className="mt-3 pt-3 border-t border-yellow-200 bg-white/50 rounded p-2">
                        <p className="text-sm text-yellow-900 font-medium mb-1">⚡ Validation Needed:</p>
                        <p className="text-sm text-yellow-800">{problem.validation_needed}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-8">
                    No problems with preliminary evidence. Items will appear here as you add some evidence to your assumptions.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tier 3: Assumptions */}
          <TabsContent value="tier3">
            <Card>
              <CardHeader>
                <CardTitle className="text-red-700">Unvalidated Assumptions</CardTitle>
                <CardDescription>
                  Confidence 0-30%. No evidence or single anecdotal source. Validate these before investing significant effort.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {tier3Problems.length > 0 ? (
                  tier3Problems.map((problem, i) => (
                    <div key={i} className="border border-red-200 bg-red-50 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium text-red-900">{problem.content}</h4>
                        {getConfidenceBadge(problem.confidence)}
                      </div>
                      <p className="text-sm text-gray-600 mb-3">
                        <span className="inline-block px-2 py-0.5 bg-white rounded text-xs">{problem.section}</span>
                      </p>
                      <div className="bg-white/50 rounded p-3 space-y-2">
                        <p className="text-sm text-red-900">
                          <strong>Suggested Validation:</strong> {problem.validation_strategy}
                        </p>
                        {problem.research_questions && problem.research_questions.length > 0 && (
                          <div>
                            <p className="text-sm font-medium text-red-800">Research Questions:</p>
                            <ul className="text-sm text-red-700 list-disc list-inside">
                              {problem.research_questions.map((q, qi) => (
                                <li key={qi}>{q}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-8">
                    Great work! All your problems have at least some evidence backing them.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Validation Playbook */}
        {validationRecs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Validation Playbook</CardTitle>
              <CardDescription>
                Detailed validation strategies for items that need further research
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {validationRecs.map((rec, i) => (
                <div key={i} className="border rounded-lg p-4 hover:shadow-sm transition-shadow">
                  <div className="flex justify-between items-start mb-3">
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

                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500 font-medium mb-1">Why Validate?</p>
                      <p className="text-gray-700">{rec.reason}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 font-medium mb-1">Suggested Method</p>
                      <p className="text-gray-700">{rec.method}</p>
                    </div>
                  </div>

                  {rec.questions && rec.questions.length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-sm text-gray-500 font-medium mb-2">Questions to Answer</p>
                      <ul className="text-sm text-gray-700 space-y-1">
                        {rec.questions.map((q, qi) => (
                          <li key={qi} className="flex items-start gap-2">
                            <span className="text-purple-500">?</span>
                            {q}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {(rec.success_criteria || rec.sample_size) && (
                    <div className="mt-3 pt-3 border-t grid md:grid-cols-2 gap-4 text-sm">
                      {rec.success_criteria && (
                        <div>
                          <p className="text-gray-500 font-medium mb-1">Success Criteria</p>
                          <p className="text-gray-700">{rec.success_criteria}</p>
                        </div>
                      )}
                      {rec.sample_size && (
                        <div>
                          <p className="text-gray-500 font-medium mb-1">Recommended Sample Size</p>
                          <p className="text-gray-700">{rec.sample_size}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Evidence Quality Guide */}
        <Card>
          <CardHeader>
            <CardTitle>Evidence Quality Framework</CardTitle>
            <CardDescription>How we assess the strength of your evidence</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-3 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="font-medium">High Quality (70-95%)</span>
                </div>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• 3+ independent sources</li>
                  <li>• Quantitative data available</li>
                  <li>• Behavioral evidence (not just opinions)</li>
                </ul>
              </div>
              <div className="p-3 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <span className="font-medium">Medium Quality (40-60%)</span>
                </div>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• 1-2 sources</li>
                  <li>• Some quantification or specific examples</li>
                  <li>• Consistent feedback pattern</li>
                </ul>
              </div>
              <div className="p-3 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                  <span className="font-medium">Low Quality (20-40%)</span>
                </div>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Single anecdotal source</li>
                  <li>• No quantification</li>
                  <li>• Opinion-based feedback</li>
                </ul>
              </div>
              <div className="p-3 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span className="font-medium">No Evidence (10-30%)</span>
                </div>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Pure assumption</li>
                  <li>• No evidence attached</li>
                  <li>• Validate before investing</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* Actions */}
        <div className="flex justify-center gap-4 pt-4">
          <Link href={`/session/${id}`}>
            <Button variant="outline">Back to Session</Button>
          </Link>
          <Link href={`/session/${id}/analysis`}>
            <Button variant="outline">View Full Analysis</Button>
          </Link>
          <Link href="/dashboard">
            <Button>Go to Dashboard</Button>
          </Link>
        </div>
      </main>
    </div>
  )
}
