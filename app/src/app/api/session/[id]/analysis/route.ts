import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user has access to this session
    const { data: session, error: sessionError } = await supabase
      .from('discovery_sessions')
      .select('id, title, workspace_id')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Get the latest analysis for this session
    const { data: analysis, error: analysisError } = await supabase
      .from('session_analyses')
      .select(`
        id,
        session_id,
        created_at,
        objective_score,
        summary,
        raw_response,
        session_diagnosis,
        evidence_assessment,
        strategic_alignment,
        solutions_analysis,
        pattern_detection,
        priority_ranking,
        next_steps,
        hypotheses,
        conflicts
      `)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (analysisError) {
      if (analysisError.code === 'PGRST116') {
        // No analysis found
        return NextResponse.json({ analysis: null }, { status: 200 })
      }
      console.error('Error fetching analysis:', analysisError)
      return NextResponse.json({ error: 'Failed to fetch analysis' }, { status: 500 })
    }

    // Parse raw_response
    let parsedResponse: Record<string, unknown> = {}
    if (analysis.raw_response) {
      try {
        parsedResponse = typeof analysis.raw_response === 'string'
          ? JSON.parse(analysis.raw_response)
          : analysis.raw_response
      } catch {
        console.error('Failed to parse raw_response')
      }
    }

    // Check if this is a v2 (spec) analysis
    if (parsedResponse.spec_version === 2) {
      // V2 format: return the spec analysis directly
      return NextResponse.json({
        success: true,
        analysis: {
          ...parsedResponse,
          id: analysis.id,
          session_id: analysis.session_id,
          created_at: analysis.created_at,
          summary: analysis.summary ?? '',
          sessionTitle: session.title,
        },
      })
    }

    // V1 format: build response with fallbacks to raw_response (backward compatible)
    const responseData = {
      spec_version: 1,
      id: analysis.id,
      session_id: analysis.session_id,
      created_at: analysis.created_at,
      objective_score: analysis.objective_score ?? parsedResponse.objectiveScore ?? 0,
      summary: analysis.summary ?? parsedResponse.summary ?? '',
      session_diagnosis: analysis.session_diagnosis ?? parsedResponse.sessionDiagnosis ?? null,
      strategic_alignment: analysis.strategic_alignment ?? parsedResponse.strategicAlignment ?? null,
      solutions_analysis: analysis.solutions_analysis ?? parsedResponse.solutionsAnalysis ?? [],
      next_steps: analysis.next_steps ?? parsedResponse.nextSteps ?? null,
      evidence_backed: parsedResponse.evidenceBacked ?? [],
      assumptions: parsedResponse.assumptions ?? [],
      validation_recommendations: parsedResponse.validationRecommendations ?? [],
      constraint_analysis: analysis.conflicts ?? parsedResponse.constraintAnalysis ?? [],
      checklist_review: parsedResponse.checklistReview ?? [],
      evidence_assessment: analysis.evidence_assessment ?? parsedResponse.evidenceAssessment ?? null,
      pattern_detection: analysis.pattern_detection ?? parsedResponse.patternDetection ?? null,
      priority_ranking: analysis.priority_ranking ?? parsedResponse.priorityRanking ?? null,
      hypotheses: analysis.hypotheses ?? parsedResponse.hypotheses ?? [],
      sessionTitle: session.title
    }

    return NextResponse.json({
      success: true,
      analysis: responseData
    })

  } catch (error) {
    console.error('Error in GET /api/session/[id]/analysis:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE endpoint to clear analysis results
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user has access to this session
    const { data: session, error: sessionError } = await supabase
      .from('discovery_sessions')
      .select('id')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Delete all analyses for this session
    const { error: deleteError } = await supabase
      .from('session_analyses')
      .delete()
      .eq('session_id', sessionId)

    if (deleteError) {
      console.error('Error deleting analysis:', deleteError)
      return NextResponse.json({ error: 'Failed to delete analysis' }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error in DELETE /api/session/[id]/analysis:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
