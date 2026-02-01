import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET: Fetch Linear integration config
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
      .select('id, integration_type, base_url, team_id, is_active, config, created_at')
      .eq('workspace_id', membership.workspace_id)
      .eq('integration_type', 'linear')
      .single()

    return NextResponse.json({ integration: integration || null })
  } catch (error) {
    console.error('Fetch Linear config error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: Create or update Linear integration
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
    const { api_key, team_id, is_active } = body

    // Upsert the integration
    const { data: integration, error } = await supabase
      .from('external_integrations')
      .upsert({
        workspace_id: membership.workspace_id,
        integration_type: 'linear',
        api_key_encrypted: api_key || null,
        team_id: team_id || null,
        is_active: is_active ?? false,
      }, {
        onConflict: 'workspace_id,integration_type',
      })
      .select('id, integration_type, team_id, is_active, config, created_at')
      .single()

    if (error) {
      console.error('Upsert Linear config error:', error)
      return NextResponse.json({ error: 'Failed to save config' }, { status: 500 })
    }

    return NextResponse.json({ integration })
  } catch (error) {
    console.error('Save Linear config error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE: Remove Linear integration
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
      .eq('integration_type', 'linear')

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete Linear config error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
