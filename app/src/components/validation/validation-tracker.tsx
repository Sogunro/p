'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface ValidationWorkflow {
  id: string
  item_type: string
  item_content: string
  item_section: string | null
  original_confidence: number | null
  hypothesis_if: string | null
  hypothesis_then: string | null
  hypothesis_because: string | null
  validation_method: string | null
  research_questions: string[]
  success_criteria: string | null
  sample_size_target: string | null
  status: 'pending' | 'in_progress' | 'validated' | 'invalidated' | 'needs_more_data' | 'pivoted'
  priority: 'high' | 'medium' | 'low'
  actual_sample_size: number | null
  test_results: string | null
  key_findings: string[]
  final_confidence: number | null
  decision: string | null
  decision_rationale: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

interface Props {
  sessionId: string
  analysisId: string | null
  problems: Array<{
    content: string
    section: string
    confidence?: number
    type: 'tier1' | 'tier2' | 'tier3'
  }>
}

export function ValidationTracker({ sessionId, analysisId, problems }: Props) {
  const [workflows, setWorkflows] = useState<ValidationWorkflow[]>([])
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false)
  const [selectedWorkflow, setSelectedWorkflow] = useState<ValidationWorkflow | null>(null)
  const [selectedProblem, setSelectedProblem] = useState<Props['problems'][0] | null>(null)

  // Form state for creating new workflow
  const [newWorkflow, setNewWorkflow] = useState({
    hypothesisIf: '',
    hypothesisThen: '',
    hypothesisBecause: '',
    validationMethod: '',
    researchQuestions: [''],
    successCriteria: '',
    sampleSizeTarget: '',
    priority: 'medium' as const
  })

  // Form state for updating workflow
  const [updateForm, setUpdateForm] = useState({
    status: '' as ValidationWorkflow['status'] | '',
    testResults: '',
    keyFindings: [''],
    finalConfidence: '',
    decision: '',
    decisionRationale: ''
  })

  useEffect(() => {
    fetchWorkflows()
  }, [sessionId])

  const fetchWorkflows = async () => {
    try {
      const res = await fetch(`/api/validation?sessionId=${sessionId}`)
      const data = await res.json()
      if (data.workflows) {
        setWorkflows(data.workflows)
      }
    } catch (error) {
      console.error('Failed to fetch workflows:', error)
    } finally {
      setLoading(false)
    }
  }

  const createWorkflow = async () => {
    if (!selectedProblem) return

    try {
      const res = await fetch('/api/validation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          analysisId,
          itemType: selectedProblem.type === 'tier3' ? 'assumption' : 'problem',
          itemContent: selectedProblem.content,
          itemSection: selectedProblem.section,
          originalConfidence: selectedProblem.confidence,
          ...newWorkflow,
          researchQuestions: newWorkflow.researchQuestions.filter(q => q.trim())
        })
      })

      if (res.ok) {
        await fetchWorkflows()
        setCreateDialogOpen(false)
        setSelectedProblem(null)
        setNewWorkflow({
          hypothesisIf: '',
          hypothesisThen: '',
          hypothesisBecause: '',
          validationMethod: '',
          researchQuestions: [''],
          successCriteria: '',
          sampleSizeTarget: '',
          priority: 'medium'
        })
      }
    } catch (error) {
      console.error('Failed to create workflow:', error)
    }
  }

  const updateWorkflow = async () => {
    if (!selectedWorkflow) return

    try {
      const updates: Record<string, unknown> = {}
      if (updateForm.status) updates.status = updateForm.status
      if (updateForm.testResults) updates.testResults = updateForm.testResults
      if (updateForm.keyFindings.some(f => f.trim())) {
        updates.keyFindings = updateForm.keyFindings.filter(f => f.trim())
      }
      if (updateForm.finalConfidence) updates.finalConfidence = parseFloat(updateForm.finalConfidence)
      if (updateForm.decision) updates.decision = updateForm.decision
      if (updateForm.decisionRationale) updates.decisionRationale = updateForm.decisionRationale

      const res = await fetch(`/api/validation/${selectedWorkflow.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })

      if (res.ok) {
        await fetchWorkflows()
        setUpdateDialogOpen(false)
        setSelectedWorkflow(null)
        setUpdateForm({
          status: '',
          testResults: '',
          keyFindings: [''],
          finalConfidence: '',
          decision: '',
          decisionRationale: ''
        })
      }
    } catch (error) {
      console.error('Failed to update workflow:', error)
    }
  }

  const getStatusBadge = (status: ValidationWorkflow['status']) => {
    const colors = {
      pending: 'bg-gray-100 text-gray-800',
      in_progress: 'bg-blue-100 text-blue-800',
      validated: 'bg-green-100 text-green-800',
      invalidated: 'bg-red-100 text-red-800',
      needs_more_data: 'bg-yellow-100 text-yellow-800',
      pivoted: 'bg-purple-100 text-purple-800'
    }
    return <Badge className={colors[status]}>{status.replace('_', ' ')}</Badge>
  }

  const getPriorityBadge = (priority: ValidationWorkflow['priority']) => {
    const colors = {
      high: 'border-red-300 text-red-700',
      medium: 'border-yellow-300 text-yellow-700',
      low: 'border-gray-300 text-gray-600'
    }
    return <Badge variant="outline" className={colors[priority]}>{priority}</Badge>
  }

  // Check which problems already have workflows
  const problemsWithWorkflows = new Set(workflows.map(w => w.item_content))

  const pendingWorkflows = workflows.filter(w => w.status === 'pending')
  const inProgressWorkflows = workflows.filter(w => w.status === 'in_progress')
  const completedWorkflows = workflows.filter(w =>
    ['validated', 'invalidated', 'pivoted'].includes(w.status)
  )

  if (loading) {
    return <div className="text-center py-8">Loading validation tracker...</div>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Hypothesis Tracker</span>
          <Badge variant="outline">{workflows.length} hypotheses</Badge>
        </CardTitle>
        <CardDescription>
          Track and validate your hypotheses. Create hypotheses from problems/assumptions and record test results.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Quick Actions */}
        <div className="mb-6">
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>+ Create Hypothesis</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Validation Hypothesis</DialogTitle>
                <DialogDescription>
                  Select a problem or assumption to create a testable hypothesis
                </DialogDescription>
              </DialogHeader>

              {!selectedProblem ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  <p className="text-sm text-gray-500 mb-2">Select an item to validate:</p>
                  {problems.map((problem, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedProblem(problem)}
                      disabled={problemsWithWorkflows.has(problem.content)}
                      className={`w-full text-left p-3 border rounded-lg hover:bg-gray-50 transition-colors ${
                        problemsWithWorkflows.has(problem.content) ? 'opacity-50 cursor-not-allowed' : ''
                      } ${
                        problem.type === 'tier1' ? 'border-green-200' :
                        problem.type === 'tier2' ? 'border-yellow-200' : 'border-red-200'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{problem.content}</p>
                          <p className="text-xs text-gray-500 mt-1">{problem.section}</p>
                        </div>
                        {problemsWithWorkflows.has(problem.content) && (
                          <Badge variant="outline" className="ml-2">Has hypothesis</Badge>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium">Selected: {selectedProblem.content}</p>
                    <p className="text-xs text-gray-500">{selectedProblem.section}</p>
                  </div>

                  <div className="grid gap-4">
                    <div>
                      <Label>IF (What you&apos;ll do)</Label>
                      <Input
                        placeholder="We implement feature X..."
                        value={newWorkflow.hypothesisIf}
                        onChange={(e) => setNewWorkflow({ ...newWorkflow, hypothesisIf: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>THEN (Expected outcome)</Label>
                      <Input
                        placeholder="Users will experience Y..."
                        value={newWorkflow.hypothesisThen}
                        onChange={(e) => setNewWorkflow({ ...newWorkflow, hypothesisThen: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>BECAUSE (Evidence/rationale)</Label>
                      <Input
                        placeholder="Our research shows Z..."
                        value={newWorkflow.hypothesisBecause}
                        onChange={(e) => setNewWorkflow({ ...newWorkflow, hypothesisBecause: e.target.value })}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Validation Method</Label>
                        <Select
                          value={newWorkflow.validationMethod}
                          onValueChange={(v) => setNewWorkflow({ ...newWorkflow, validationMethod: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select method" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="survey">Survey</SelectItem>
                            <SelectItem value="interview">User Interview</SelectItem>
                            <SelectItem value="analytics">Analytics Review</SelectItem>
                            <SelectItem value="prototype_test">Prototype Test</SelectItem>
                            <SelectItem value="A_B_test">A/B Test</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Priority</Label>
                        <Select
                          value={newWorkflow.priority}
                          onValueChange={(v) => setNewWorkflow({ ...newWorkflow, priority: v as 'high' | 'medium' | 'low' })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="low">Low</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label>Success Criteria</Label>
                      <Textarea
                        placeholder="What would prove this hypothesis valid?"
                        value={newWorkflow.successCriteria}
                        onChange={(e) => setNewWorkflow({ ...newWorkflow, successCriteria: e.target.value })}
                      />
                    </div>

                    <div>
                      <Label>Target Sample Size</Label>
                      <Input
                        placeholder="e.g., 10 user interviews, 100 survey responses"
                        value={newWorkflow.sampleSizeTarget}
                        onChange={(e) => setNewWorkflow({ ...newWorkflow, sampleSizeTarget: e.target.value })}
                      />
                    </div>

                    <div>
                      <Label>Research Questions</Label>
                      {newWorkflow.researchQuestions.map((q, i) => (
                        <div key={i} className="flex gap-2 mt-2">
                          <Input
                            placeholder={`Question ${i + 1}`}
                            value={q}
                            onChange={(e) => {
                              const updated = [...newWorkflow.researchQuestions]
                              updated[i] = e.target.value
                              setNewWorkflow({ ...newWorkflow, researchQuestions: updated })
                            }}
                          />
                          {i === newWorkflow.researchQuestions.length - 1 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setNewWorkflow({
                                ...newWorkflow,
                                researchQuestions: [...newWorkflow.researchQuestions, '']
                              })}
                            >
                              +
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <DialogFooter>
                {selectedProblem && (
                  <>
                    <Button variant="outline" onClick={() => setSelectedProblem(null)}>
                      Back
                    </Button>
                    <Button onClick={createWorkflow}>Create Hypothesis</Button>
                  </>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Workflow Tabs */}
        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pending">
              Pending ({pendingWorkflows.length})
            </TabsTrigger>
            <TabsTrigger value="in_progress">
              In Progress ({inProgressWorkflows.length})
            </TabsTrigger>
            <TabsTrigger value="completed">
              Completed ({completedWorkflows.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-3 mt-4">
            {pendingWorkflows.length === 0 ? (
              <p className="text-center text-gray-500 py-8">
                No pending hypotheses. Create one from your problems or assumptions.
              </p>
            ) : (
              pendingWorkflows.map((workflow) => (
                <WorkflowCard
                  key={workflow.id}
                  workflow={workflow}
                  onUpdate={() => {
                    setSelectedWorkflow(workflow)
                    setUpdateForm({
                      status: workflow.status,
                      testResults: workflow.test_results || '',
                      keyFindings: workflow.key_findings?.length ? workflow.key_findings : [''],
                      finalConfidence: workflow.final_confidence?.toString() || '',
                      decision: workflow.decision || '',
                      decisionRationale: workflow.decision_rationale || ''
                    })
                    setUpdateDialogOpen(true)
                  }}
                  getStatusBadge={getStatusBadge}
                  getPriorityBadge={getPriorityBadge}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="in_progress" className="space-y-3 mt-4">
            {inProgressWorkflows.length === 0 ? (
              <p className="text-center text-gray-500 py-8">
                No hypotheses in progress. Start validating a pending hypothesis.
              </p>
            ) : (
              inProgressWorkflows.map((workflow) => (
                <WorkflowCard
                  key={workflow.id}
                  workflow={workflow}
                  onUpdate={() => {
                    setSelectedWorkflow(workflow)
                    setUpdateForm({
                      status: workflow.status,
                      testResults: workflow.test_results || '',
                      keyFindings: workflow.key_findings?.length ? workflow.key_findings : [''],
                      finalConfidence: workflow.final_confidence?.toString() || '',
                      decision: workflow.decision || '',
                      decisionRationale: workflow.decision_rationale || ''
                    })
                    setUpdateDialogOpen(true)
                  }}
                  getStatusBadge={getStatusBadge}
                  getPriorityBadge={getPriorityBadge}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-3 mt-4">
            {completedWorkflows.length === 0 ? (
              <p className="text-center text-gray-500 py-8">
                No completed validations yet.
              </p>
            ) : (
              completedWorkflows.map((workflow) => (
                <WorkflowCard
                  key={workflow.id}
                  workflow={workflow}
                  onUpdate={() => {
                    setSelectedWorkflow(workflow)
                    setUpdateForm({
                      status: workflow.status,
                      testResults: workflow.test_results || '',
                      keyFindings: workflow.key_findings?.length ? workflow.key_findings : [''],
                      finalConfidence: workflow.final_confidence?.toString() || '',
                      decision: workflow.decision || '',
                      decisionRationale: workflow.decision_rationale || ''
                    })
                    setUpdateDialogOpen(true)
                  }}
                  getStatusBadge={getStatusBadge}
                  getPriorityBadge={getPriorityBadge}
                  showResults
                />
              ))
            )}
          </TabsContent>
        </Tabs>

        {/* Update Dialog */}
        <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Update Validation Progress</DialogTitle>
              <DialogDescription>
                Record your validation progress and findings
              </DialogDescription>
            </DialogHeader>

            {selectedWorkflow && (
              <div className="space-y-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium">{selectedWorkflow.item_content}</p>
                  {selectedWorkflow.hypothesis_if && (
                    <p className="text-xs text-gray-600 mt-1">
                      <strong>IF</strong> {selectedWorkflow.hypothesis_if} <strong>THEN</strong> {selectedWorkflow.hypothesis_then}
                    </p>
                  )}
                </div>

                <div>
                  <Label>Status</Label>
                  <Select
                    value={updateForm.status}
                    onValueChange={(v) => setUpdateForm({ ...updateForm, status: v as ValidationWorkflow['status'] })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Update status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="validated">Validated ✓</SelectItem>
                      <SelectItem value="invalidated">Invalidated ✗</SelectItem>
                      <SelectItem value="needs_more_data">Needs More Data</SelectItem>
                      <SelectItem value="pivoted">Pivoted</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Test Results</Label>
                  <Textarea
                    placeholder="Describe what you found during validation..."
                    value={updateForm.testResults}
                    onChange={(e) => setUpdateForm({ ...updateForm, testResults: e.target.value })}
                  />
                </div>

                <div>
                  <Label>Key Findings</Label>
                  {updateForm.keyFindings.map((f, i) => (
                    <div key={i} className="flex gap-2 mt-2">
                      <Input
                        placeholder={`Finding ${i + 1}`}
                        value={f}
                        onChange={(e) => {
                          const updated = [...updateForm.keyFindings]
                          updated[i] = e.target.value
                          setUpdateForm({ ...updateForm, keyFindings: updated })
                        }}
                      />
                      {i === updateForm.keyFindings.length - 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setUpdateForm({
                            ...updateForm,
                            keyFindings: [...updateForm.keyFindings, '']
                          })}
                        >
                          +
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Final Confidence (0-1)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="1"
                      step="0.1"
                      placeholder="e.g., 0.8"
                      value={updateForm.finalConfidence}
                      onChange={(e) => setUpdateForm({ ...updateForm, finalConfidence: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Decision</Label>
                    <Select
                      value={updateForm.decision}
                      onValueChange={(v) => setUpdateForm({ ...updateForm, decision: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="What's next?" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="build">Build It</SelectItem>
                        <SelectItem value="pivot">Pivot Approach</SelectItem>
                        <SelectItem value="kill">Kill / Abandon</SelectItem>
                        <SelectItem value="investigate_more">Investigate More</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Decision Rationale</Label>
                  <Textarea
                    placeholder="Why did you make this decision?"
                    value={updateForm.decisionRationale}
                    onChange={(e) => setUpdateForm({ ...updateForm, decisionRationale: e.target.value })}
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setUpdateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={updateWorkflow}>Save Progress</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}

// Workflow Card Component
function WorkflowCard({
  workflow,
  onUpdate,
  getStatusBadge,
  getPriorityBadge,
  showResults = false
}: {
  workflow: ValidationWorkflow
  onUpdate: () => void
  getStatusBadge: (status: ValidationWorkflow['status']) => JSX.Element
  getPriorityBadge: (priority: ValidationWorkflow['priority']) => JSX.Element
  showResults?: boolean
}) {
  return (
    <div className="border rounded-lg p-4 hover:shadow-sm transition-shadow">
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <p className="font-medium">{workflow.item_content}</p>
          {workflow.item_section && (
            <p className="text-xs text-gray-500">{workflow.item_section}</p>
          )}
        </div>
        <div className="flex gap-2">
          {getStatusBadge(workflow.status)}
          {getPriorityBadge(workflow.priority)}
        </div>
      </div>

      {workflow.hypothesis_if && (
        <div className="bg-gray-50 p-2 rounded text-sm mb-2">
          <p><strong>IF</strong> {workflow.hypothesis_if}</p>
          <p><strong>THEN</strong> {workflow.hypothesis_then}</p>
          {workflow.hypothesis_because && (
            <p><strong>BECAUSE</strong> {workflow.hypothesis_because}</p>
          )}
        </div>
      )}

      <div className="flex gap-4 text-xs text-gray-500 mb-2">
        {workflow.validation_method && <span>Method: {workflow.validation_method}</span>}
        {workflow.sample_size_target && <span>Target: {workflow.sample_size_target}</span>}
      </div>

      {showResults && workflow.test_results && (
        <div className="bg-blue-50 p-2 rounded text-sm mb-2">
          <p className="font-medium text-blue-800">Results:</p>
          <p className="text-blue-700">{workflow.test_results}</p>
          {workflow.decision && (
            <p className="mt-1">
              <strong>Decision:</strong> {workflow.decision}
              {workflow.final_confidence && (
                <span className="ml-2">({Math.round(workflow.final_confidence * 100)}% confidence)</span>
              )}
            </p>
          )}
        </div>
      )}

      <Button variant="outline" size="sm" onClick={onUpdate}>
        {workflow.status === 'pending' ? 'Start Validation' : 'Update Progress'}
      </Button>
    </div>
  )
}
