'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import type { Template, Constraint } from '@/types/database'

const DEFAULT_CHECKLIST = [
  'Identified at least one target user segment',
  'Documented observed problems with context',
  'Linked evidence to key assumptions',
  'Considered constraints in proposed solutions',
  'Defined next validation steps',
]

type Step = 1 | 2 | 3 | 4

export default function NewSessionPage() {
  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  // Step 1: Template
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [sessionTitle, setSessionTitle] = useState('')

  // Step 2: Objectives
  const [objectives, setObjectives] = useState<string[]>([''])

  // Step 3: Checklist
  const [checklistItems, setChecklistItems] = useState<{ content: string; enabled: boolean }[]>(
    DEFAULT_CHECKLIST.map(item => ({ content: item, enabled: true }))
  )
  const [newChecklistItem, setNewChecklistItem] = useState('')

  // Step 4: Constraints
  const [constraints, setConstraints] = useState<Constraint[]>([])
  const [selectedConstraints, setSelectedConstraints] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadTemplates()
    loadConstraints()
  }, [])

  const loadTemplates = async () => {
    const { data } = await supabase
      .from('templates')
      .select('*')
      .eq('is_system', true)
      .order('name')

    if (data) setTemplates(data)
  }

  const loadConstraints = async () => {
    const { data } = await supabase
      .from('constraints')
      .select('*')
      .order('type')

    if (data) setConstraints(data)
  }

  const addObjective = () => {
    setObjectives([...objectives, ''])
  }

  const updateObjective = (index: number, value: string) => {
    const updated = [...objectives]
    updated[index] = value
    setObjectives(updated)
  }

  const removeObjective = (index: number) => {
    if (objectives.length > 1) {
      setObjectives(objectives.filter((_, i) => i !== index))
    }
  }

  const addChecklistItem = () => {
    if (newChecklistItem.trim()) {
      setChecklistItems([...checklistItems, { content: newChecklistItem.trim(), enabled: true }])
      setNewChecklistItem('')
    }
  }

  const toggleChecklistItem = (index: number) => {
    const updated = [...checklistItems]
    updated[index].enabled = !updated[index].enabled
    setChecklistItems(updated)
  }

  const toggleConstraint = (id: string) => {
    const updated = new Set(selectedConstraints)
    if (updated.has(id)) {
      updated.delete(id)
    } else {
      updated.add(id)
    }
    setSelectedConstraints(updated)
  }

  const canProceed = () => {
    switch (step) {
      case 1:
        return sessionTitle.trim().length > 0
      case 2:
        return objectives.some(o => o.trim().length > 0)
      case 3:
        return true // Optional
      case 4:
        return true // Optional
      default:
        return false
    }
  }

  const handleCreate = async () => {
    setLoading(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Create session
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .insert({
          user_id: user.id,
          template_id: selectedTemplate,
          title: sessionTitle,
          status: 'active',
        })
        .select()
        .single()

      if (sessionError) throw sessionError

      // Create objectives
      const validObjectives = objectives.filter(o => o.trim().length > 0)
      if (validObjectives.length > 0) {
        const { error: objError } = await supabase
          .from('session_objectives')
          .insert(
            validObjectives.map((content, index) => ({
              session_id: session.id,
              content,
              order_index: index,
            }))
          )
        if (objError) throw objError
      }

      // Create checklist items
      const enabledChecklist = checklistItems.filter(item => item.enabled)
      if (enabledChecklist.length > 0) {
        const { error: checkError } = await supabase
          .from('session_checklist_items')
          .insert(
            enabledChecklist.map((item, index) => ({
              session_id: session.id,
              content: item.content,
              is_default: DEFAULT_CHECKLIST.includes(item.content),
              order_index: index,
            }))
          )
        if (checkError) throw checkError
      }

      // Link constraints
      if (selectedConstraints.size > 0) {
        const { error: constError } = await supabase
          .from('session_constraints')
          .insert(
            Array.from(selectedConstraints).map(constraint_id => ({
              session_id: session.id,
              constraint_id,
            }))
          )
        if (constError) throw constError
      }

      // Create default sections if template selected
      if (selectedTemplate && selectedTemplate !== '00000000-0000-0000-0000-000000000001') {
        const { data: templateSections } = await supabase
          .from('template_sections')
          .select('*')
          .eq('template_id', selectedTemplate)
          .order('order_index')

        if (templateSections && templateSections.length > 0) {
          const { error: sectionsError } = await supabase
            .from('sections')
            .insert(
              templateSections.map((ts, index) => ({
                session_id: session.id,
                name: ts.name,
                order_index: index,
                position_x: index * 350,
                position_y: 50,
              }))
            )
          if (sectionsError) throw sectionsError
        }
      }

      router.push(`/session/${session.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
              ← Back
            </Link>
            <span className="text-sm text-gray-500">Step {step} of 4</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 bg-red-50 text-red-600 p-4 rounded-md">
            {error}
          </div>
        )}

        {/* Step 1: Choose Template */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>New Discovery Session</CardTitle>
              <CardDescription>Choose a template and name your session</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Session Title</Label>
                <Input
                  id="title"
                  placeholder="e.g., User Onboarding Discovery"
                  value={sessionTitle}
                  onChange={(e) => setSessionTitle(e.target.value)}
                />
              </div>

              <div className="space-y-3">
                <Label>Choose a Template</Label>
                <div className="grid grid-cols-2 gap-4">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      onClick={() => setSelectedTemplate(template.id)}
                      className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                        selectedTemplate === template.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <h3 className="font-medium">{template.name}</h3>
                      <p className="text-sm text-gray-500 mt-1">{template.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => setStep(2)} disabled={!canProceed()}>
                  Next
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Define Objectives */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Define Session Objectives</CardTitle>
              <CardDescription>What do you want to achieve in this session?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {objectives.map((objective, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder={`Objective ${index + 1}`}
                    value={objective}
                    onChange={(e) => updateObjective(index, e.target.value)}
                  />
                  {objectives.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeObjective(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))}

              <Button variant="outline" onClick={addObjective} className="w-full">
                + Add Objective
              </Button>

              <p className="text-sm text-orange-600">
                At least one objective is required
              </p>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button onClick={() => setStep(3)} disabled={!canProceed()}>
                  Next
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Set Checklist */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Session Checklist (Optional)</CardTitle>
              <CardDescription>Requirements to check at the end of this session</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {checklistItems.map((item, index) => (
                <div key={index} className="flex items-center gap-3">
                  <Checkbox
                    checked={item.enabled}
                    onCheckedChange={() => toggleChecklistItem(index)}
                  />
                  <span className={item.enabled ? '' : 'text-gray-400 line-through'}>
                    {item.content}
                  </span>
                </div>
              ))}

              <div className="flex gap-2 pt-2">
                <Input
                  placeholder="Add custom checklist item"
                  value={newChecklistItem}
                  onChange={(e) => setNewChecklistItem(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addChecklistItem()}
                />
                <Button variant="outline" onClick={addChecklistItem}>
                  Add
                </Button>
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep(2)}>
                  Back
                </Button>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setStep(4)}>
                    Skip
                  </Button>
                  <Button onClick={() => setStep(4)}>
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Select Constraints */}
        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle>Apply Constraints (Optional)</CardTitle>
              <CardDescription>Keep your ideas grounded in reality</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {constraints.length > 0 ? (
                constraints.map((constraint) => (
                  <div key={constraint.id} className="flex items-start gap-3 p-3 border rounded-lg">
                    <Checkbox
                      checked={selectedConstraints.has(constraint.id)}
                      onCheckedChange={() => toggleConstraint(constraint.id)}
                    />
                    <div>
                      <span className="font-medium">{constraint.label}</span>
                      {constraint.value && (
                        <p className="text-sm text-gray-500 mt-1">{constraint.value}</p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">
                  No constraints defined yet.{' '}
                  <Link href="/settings/constraints" className="text-blue-600 hover:underline">
                    Add constraints
                  </Link>
                </p>
              )}

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep(3)}>
                  Back
                </Button>
                <Button onClick={handleCreate} disabled={loading}>
                  {loading ? 'Creating...' : 'Start Session'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
