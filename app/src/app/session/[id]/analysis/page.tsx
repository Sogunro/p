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
          <Link href="/dashboard">
            <Button>Go to Dashboard</Button>
          </Link>
        </div>
      </main>
    </div>
  )
}
