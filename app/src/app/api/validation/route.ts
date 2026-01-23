import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - List validation workflows for a session
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sessionId = request.nextUrl.searchParams.get('sessionId')
    const status = request.nextUrl.searchParams.get('status')

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }

    let query = supabase
      .from('validation_workflows')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data: workflows, error } = await query

    if (error) {
      console.error('Failed to fetch workflows:', error)
      return NextResponse.json({ error: 'Failed to fetch workflows' }, { status: 500 })
    }

    return NextResponse.json({ workflows })
  } catch (error) {
    console.error('Validation workflows error:', error)
    return NextResponse.json({ error: 'Failed to fetch workflows' }, { status: 500 })
  }
}

// POST - Create a new validation workflow
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      sessionId,
      analysisId,
      itemType,
      itemContent,
      itemSection,
      originalConfidence,
      hypothesisIf,
      hypothesisThen,
      hypothesisBecause,
      validationMethod,
      researchQuestions,
      successCriteria,
      sampleSizeTarget,
      priority
    } = body

    if (!sessionId || !itemType || !itemContent) {
      return NextResponse.json({
        error: 'sessionId, itemType, and itemContent are required'
      }, { status: 400 })
    }

    // Get user's workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single()

    const { data: workflow, error } = await supabase
      .from('validation_workflows')
      .insert({
        session_id: sessionId,
        analysis_id: analysisId || null,
        user_id: user.id,
        workspace_id: membership?.workspace_id || null,
        item_type: itemType,
        item_content: itemContent,
        item_section: itemSection || null,
        original_confidence: originalConfidence || null,
        hypothesis_if: hypothesisIf || null,
        hypothesis_then: hypothesisThen || null,
        hypothesis_because: hypothesisBecause || null,
        validation_method: validationMethod || null,
        research_questions: researchQuestions || [],
        success_criteria: successCriteria || null,
        sample_size_target: sampleSizeTarget || null,
        priority: priority || 'medium',
        status: 'pending'
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to create workflow:', error)
      return NextResponse.json({ error: 'Failed to create workflow' }, { status: 500 })
    }

    return NextResponse.json({ workflow })
  } catch (error) {
    console.error('Create validation workflow error:', error)
    return NextResponse.json({ error: 'Failed to create workflow' }, { status: 500 })
  }
}
