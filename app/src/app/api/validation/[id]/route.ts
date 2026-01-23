import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{ id: string }>
}

// GET - Get a single validation workflow
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: workflow, error } = await supabase
      .from('validation_workflows')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    // Also fetch history
    const { data: history } = await supabase
      .from('validation_workflow_history')
      .select('*')
      .eq('workflow_id', id)
      .order('created_at', { ascending: false })

    return NextResponse.json({ workflow, history: history || [] })
  } catch (error) {
    console.error('Get validation workflow error:', error)
    return NextResponse.json({ error: 'Failed to fetch workflow' }, { status: 500 })
  }
}

// PATCH - Update a validation workflow
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      status,
      priority,
      hypothesisIf,
      hypothesisThen,
      hypothesisBecause,
      validationMethod,
      researchQuestions,
      successCriteria,
      sampleSizeTarget,
      actualSampleSize,
      testResults,
      keyFindings,
      finalConfidence,
      decision,
      decisionRationale,
      nextActions,
      changeNote
    } = body

    // Get current workflow to track changes
    const { data: currentWorkflow, error: fetchError } = await supabase
      .from('validation_workflows')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !currentWorkflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    // Build update object
    const updates: Record<string, unknown> = {}
    const historyEntries: { field_changed: string; old_value: string | null; new_value: string | null }[] = []

    if (status !== undefined && status !== currentWorkflow.status) {
      updates.status = status
      historyEntries.push({
        field_changed: 'status',
        old_value: currentWorkflow.status,
        new_value: status
      })

      // Set timestamps based on status
      if (status === 'in_progress' && !currentWorkflow.started_at) {
        updates.started_at = new Date().toISOString()
      }
      if (['validated', 'invalidated', 'pivoted'].includes(status)) {
        updates.completed_at = new Date().toISOString()
      }
    }

    if (priority !== undefined && priority !== currentWorkflow.priority) {
      updates.priority = priority
      historyEntries.push({
        field_changed: 'priority',
        old_value: currentWorkflow.priority,
        new_value: priority
      })
    }

    if (hypothesisIf !== undefined) updates.hypothesis_if = hypothesisIf
    if (hypothesisThen !== undefined) updates.hypothesis_then = hypothesisThen
    if (hypothesisBecause !== undefined) updates.hypothesis_because = hypothesisBecause
    if (validationMethod !== undefined) updates.validation_method = validationMethod
    if (researchQuestions !== undefined) updates.research_questions = researchQuestions
    if (successCriteria !== undefined) updates.success_criteria = successCriteria
    if (sampleSizeTarget !== undefined) updates.sample_size_target = sampleSizeTarget
    if (actualSampleSize !== undefined) updates.actual_sample_size = actualSampleSize
    if (testResults !== undefined) updates.test_results = testResults
    if (keyFindings !== undefined) updates.key_findings = keyFindings
    if (finalConfidence !== undefined) {
      updates.final_confidence = finalConfidence
      if (currentWorkflow.final_confidence !== finalConfidence) {
        historyEntries.push({
          field_changed: 'final_confidence',
          old_value: currentWorkflow.final_confidence?.toString() || null,
          new_value: finalConfidence?.toString() || null
        })
      }
    }
    if (decision !== undefined) {
      updates.decision = decision
      if (currentWorkflow.decision !== decision) {
        historyEntries.push({
          field_changed: 'decision',
          old_value: currentWorkflow.decision,
          new_value: decision
        })
      }
    }
    if (decisionRationale !== undefined) updates.decision_rationale = decisionRationale
    if (nextActions !== undefined) updates.next_actions = nextActions

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
    }

    // Update the workflow
    const { data: workflow, error: updateError } = await supabase
      .from('validation_workflows')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Failed to update workflow:', updateError)
      return NextResponse.json({ error: 'Failed to update workflow' }, { status: 500 })
    }

    // Record history entries
    if (historyEntries.length > 0) {
      const historyRecords = historyEntries.map(entry => ({
        workflow_id: id,
        changed_by: user.id,
        field_changed: entry.field_changed,
        old_value: entry.old_value,
        new_value: entry.new_value,
        change_note: changeNote || null
      }))

      await supabase.from('validation_workflow_history').insert(historyRecords)
    }

    return NextResponse.json({ workflow })
  } catch (error) {
    console.error('Update validation workflow error:', error)
    return NextResponse.json({ error: 'Failed to update workflow' }, { status: 500 })
  }
}

// DELETE - Delete a validation workflow
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase
      .from('validation_workflows')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Failed to delete workflow:', error)
      return NextResponse.json({ error: 'Failed to delete workflow' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete validation workflow error:', error)
    return NextResponse.json({ error: 'Failed to delete workflow' }, { status: 500 })
  }
}
