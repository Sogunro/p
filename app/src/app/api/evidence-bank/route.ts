import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET: List all evidence in user's workspace
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    // Fetch all evidence in the workspace
    // Try with profiles join first, fall back to raw query if join fails
    // (handles case where column is named user_id instead of created_by)
    let evidence = null
    const { data: evidenceWithJoin, error: joinError } = await supabase
      .from('evidence_bank')
      .select('*, profiles:created_by(full_name)')
      .eq('workspace_id', membership.workspace_id)
      .order('created_at', { ascending: false })

    if (joinError) {
      console.error('Evidence fetch with join failed, trying without join:', joinError.message)
      const { data: evidenceRaw, error: rawError } = await supabase
        .from('evidence_bank')
        .select('*')
        .eq('workspace_id', membership.workspace_id)
        .order('created_at', { ascending: false })

      if (rawError) {
        console.error('Error fetching evidence (raw):', rawError)
        return NextResponse.json({ error: 'Failed to fetch evidence', details: rawError.message }, { status: 500 })
      }
      evidence = evidenceRaw
    } else {
      evidence = evidenceWithJoin
    }

    return NextResponse.json({ evidence, workspaceId: membership.workspace_id })
  } catch (error) {
    console.error('Evidence bank error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: Add new evidence to bank
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { title, type, url, content, strength, tags, source_system, fetch_status } = body

    if (!title || !type) {
      return NextResponse.json({ error: 'Title and type are required' }, { status: 400 })
    }

    // Get user's workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    // Insert new evidence
    const { data: evidence, error } = await supabase
      .from('evidence_bank')
      .insert({
        workspace_id: membership.workspace_id,
        title,
        type,
        url: type === 'url' ? url : null,
        content: type === 'text' ? content : null,
        strength: strength || 'medium',
        source_system: source_system || 'manual',
        tags: tags || [],
        created_by: user.id,
        // Mark as unfetched by default for URL type evidence
        fetch_status: fetch_status || (type === 'url' ? 'unfetched' : null),
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating evidence:', error)
      return NextResponse.json({ error: 'Failed to create evidence' }, { status: 500 })
    }

    return NextResponse.json({ evidence })
  } catch (error) {
    console.error('Evidence bank error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH: Update evidence in bank
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, title, type, url, content, strength, source_system, tags } = body

    if (!id) {
      return NextResponse.json({ error: 'Evidence ID required' }, { status: 400 })
    }

    // Get user's workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    // Build update object with only provided fields
    const updates: Record<string, unknown> = {}
    if (title !== undefined) updates.title = title
    if (type !== undefined) updates.type = type
    if (url !== undefined) updates.url = url
    if (content !== undefined) updates.content = content
    if (strength !== undefined) updates.strength = strength
    if (source_system !== undefined) updates.source_system = source_system
    if (tags !== undefined) updates.tags = tags

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const { data: evidence, error } = await supabase
      .from('evidence_bank')
      .update(updates)
      .eq('id', id)
      .eq('workspace_id', membership.workspace_id)
      .select()
      .single()

    if (error) {
      console.error('Error updating evidence:', error)
      return NextResponse.json({ error: 'Failed to update evidence' }, { status: 500 })
    }

    return NextResponse.json({ evidence })
  } catch (error) {
    console.error('Evidence bank PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE: Remove evidence from bank
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const evidenceId = searchParams.get('id')

    if (!evidenceId) {
      return NextResponse.json({ error: 'Evidence ID required' }, { status: 400 })
    }

    // Get user's workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    // Delete evidence (RLS will verify workspace access)
    const { error } = await supabase
      .from('evidence_bank')
      .delete()
      .eq('id', evidenceId)
      .eq('workspace_id', membership.workspace_id)

    if (error) {
      console.error('Error deleting evidence:', error)
      return NextResponse.json({ error: 'Failed to delete evidence' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Evidence bank error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
