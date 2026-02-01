import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST: Push a decision to Linear as an issue
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    const body = await request.json()
    const { decision_id } = body

    if (!decision_id) {
      return NextResponse.json({ error: 'decision_id is required' }, { status: 400 })
    }

    // Fetch Linear integration config
    const { data: integration } = await supabase
      .from('external_integrations')
      .select('*')
      .eq('workspace_id', membership.workspace_id)
      .eq('integration_type', 'linear')
      .eq('is_active', true)
      .single()

    if (!integration || !integration.api_key_encrypted) {
      return NextResponse.json({ error: 'Linear integration not configured or inactive' }, { status: 400 })
    }

    // Fetch decision
    const { data: decision } = await supabase
      .from('decisions')
      .select('*')
      .eq('id', decision_id)
      .single()

    if (!decision) {
      return NextResponse.json({ error: 'Decision not found' }, { status: 404 })
    }

    // Create pending push record
    const { data: push } = await supabase
      .from('external_pushes')
      .insert({
        workspace_id: membership.workspace_id,
        decision_id,
        integration_type: 'linear',
        push_status: 'pending',
        pushed_by: user.id,
      })
      .select()
      .single()

    // Format decision as Linear issue
    const description = [
      `**Status:** ${decision.status?.toUpperCase()}`,
      `**Evidence Strength:** ${decision.evidence_strength || 0}%`,
      `**Evidence Count:** ${decision.evidence_count || 0}`,
      decision.hypothesis ? `\n**Hypothesis:** ${decision.hypothesis}` : '',
      decision.description ? `\n**Description:** ${decision.description}` : '',
      `\n---\n*Pushed from Product Discovery OS*`,
    ].filter(Boolean).join('\n')

    // Create issue via Linear GraphQL API
    const mutation = `
      mutation IssueCreate($input: IssueCreateInput!) {
        issueCreate(input: $input) {
          success
          issue {
            id
            identifier
            url
          }
        }
      }
    `

    const variables: Record<string, unknown> = {
      input: {
        title: decision.title,
        description,
        ...(integration.team_id ? { teamId: integration.team_id } : {}),
      },
    }

    const linearRes = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': integration.api_key_encrypted,
      },
      body: JSON.stringify({ query: mutation, variables }),
    })

    const linearData = await linearRes.json()

    if (linearData.data?.issueCreate?.success) {
      const issue = linearData.data.issueCreate.issue

      // Update push record
      if (push) {
        await supabase
          .from('external_pushes')
          .update({
            external_id: issue.identifier,
            external_url: issue.url,
            push_status: 'success',
          })
          .eq('id', push.id)
      }

      // Update decision with external ref
      await supabase
        .from('decisions')
        .update({
          external_ref: issue.identifier,
          external_url: issue.url,
        })
        .eq('id', decision_id)

      return NextResponse.json({
        success: true,
        external_id: issue.identifier,
        external_url: issue.url,
      })
    } else {
      const errorMsg = linearData.errors?.[0]?.message || 'Unknown Linear API error'

      if (push) {
        await supabase
          .from('external_pushes')
          .update({
            push_status: 'failed',
            error_message: errorMsg,
          })
          .eq('id', push.id)
      }

      return NextResponse.json({ error: `Linear API error: ${errorMsg}` }, { status: 502 })
    }
  } catch (error) {
    console.error('Linear push error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
