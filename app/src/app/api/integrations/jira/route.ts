import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET: Fetch Jira integration config
export async function GET() {
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

    const { data: integration } = await supabase
      .from('external_integrations')
      .select('id, integration_type, base_url, project_key, is_active, config, created_at')
      .eq('workspace_id', membership.workspace_id)
      .eq('integration_type', 'jira')
      .single()

    return NextResponse.json({ integration: integration || null })
  } catch (error) {
    console.error('Fetch Jira config error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: Create or update Jira integration
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
    const { api_key, base_url, project_key, email, is_active } = body

    const { data: integration, error } = await supabase
      .from('external_integrations')
      .upsert({
        workspace_id: membership.workspace_id,
        integration_type: 'jira',
        api_key_encrypted: api_key || null,
        base_url: base_url || null,
        project_key: project_key || null,
        is_active: is_active ?? false,
        config: { email: email || null },
      }, {
        onConflict: 'workspace_id,integration_type',
      })
      .select('id, integration_type, base_url, project_key, is_active, config, created_at')
      .single()

    if (error) {
      console.error('Upsert Jira config error:', error)
      return NextResponse.json({ error: 'Failed to save config' }, { status: 500 })
    }

    return NextResponse.json({ integration })
  } catch (error) {
    console.error('Save Jira config error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE: Remove Jira integration
export async function DELETE() {
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

    await supabase
      .from('external_integrations')
      .delete()
      .eq('workspace_id', membership.workspace_id)
      .eq('integration_type', 'jira')

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete Jira config error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
