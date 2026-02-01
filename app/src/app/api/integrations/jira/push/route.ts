import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST: Push a decision to Jira as a ticket
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

    // Fetch Jira integration config
    const { data: integration } = await supabase
      .from('external_integrations')
      .select('*')
      .eq('workspace_id', membership.workspace_id)
      .eq('integration_type', 'jira')
      .eq('is_active', true)
      .single()

    if (!integration || !integration.api_key_encrypted || !integration.base_url) {
      return NextResponse.json({ error: 'Jira integration not configured or inactive' }, { status: 400 })
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
        integration_type: 'jira',
        push_status: 'pending',
        pushed_by: user.id,
      })
      .select()
      .single()

    // Format decision as Jira ticket description (ADF format)
    const description = {
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Status: ', marks: [{ type: 'strong' }] },
            { type: 'text', text: decision.status?.toUpperCase() || 'UNKNOWN' },
          ],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Evidence Strength: ', marks: [{ type: 'strong' }] },
            { type: 'text', text: `${decision.evidence_strength || 0}%` },
          ],
        },
        ...(decision.hypothesis ? [{
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Hypothesis: ', marks: [{ type: 'strong' }] },
            { type: 'text', text: decision.hypothesis },
          ],
        }] : []),
        ...(decision.description ? [{
          type: 'paragraph',
          content: [
            { type: 'text', text: decision.description },
          ],
        }] : []),
        {
          type: 'rule',
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Pushed from Product Discovery OS', marks: [{ type: 'em' }] },
          ],
        },
      ],
    }

    const email = (integration.config as Record<string, string>)?.email || ''
    const authToken = Buffer.from(`${email}:${integration.api_key_encrypted}`).toString('base64')

    // Create issue via Jira REST API v3
    const jiraRes = await fetch(`${integration.base_url}/rest/api/3/issue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${authToken}`,
      },
      body: JSON.stringify({
        fields: {
          project: { key: integration.project_key },
          summary: decision.title,
          description,
          issuetype: { name: 'Task' },
        },
      }),
    })

    if (jiraRes.ok) {
      const jiraData = await jiraRes.json()
      const externalUrl = `${integration.base_url}/browse/${jiraData.key}`

      // Update push record
      if (push) {
        await supabase
          .from('external_pushes')
          .update({
            external_id: jiraData.key,
            external_url: externalUrl,
            push_status: 'success',
          })
          .eq('id', push.id)
      }

      // Update decision with external ref
      await supabase
        .from('decisions')
        .update({
          external_ref: jiraData.key,
          external_url: externalUrl,
        })
        .eq('id', decision_id)

      return NextResponse.json({
        success: true,
        external_id: jiraData.key,
        external_url: externalUrl,
      })
    } else {
      const errorText = await jiraRes.text()
      const errorMsg = `Jira API error (${jiraRes.status}): ${errorText.slice(0, 200)}`

      if (push) {
        await supabase
          .from('external_pushes')
          .update({
            push_status: 'failed',
            error_message: errorMsg,
          })
          .eq('id', push.id)
      }

      return NextResponse.json({ error: errorMsg }, { status: 502 })
    }
  } catch (error) {
    console.error('Jira push error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
