import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET: List workspace members
export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError) {
      console.error('Auth error:', authError)
      return NextResponse.json({ error: 'Authentication error', details: authError.message }, { status: 401 })
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized - no user found' }, { status: 401 })
    }

    // First, check if the user_id exists in workspace_members at all
    // Use a direct query that should work with any RLS policy
    const { data: membership, error: membershipError } = await supabase
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (membershipError) {
      console.error('Membership query error:', membershipError)
      return NextResponse.json({
        error: 'Database error while finding workspace',
        details: membershipError.message,
        code: membershipError.code,
        userId: user.id
      }, { status: 500 })
    }

    if (!membership) {
      return NextResponse.json({
        error: 'No workspace membership found',
        userId: user.id,
        hint: 'User needs to be added to a workspace'
      }, { status: 404 })
    }

    // Get all members with profile info
    const { data: members, error } = await supabase
      .from('workspace_members')
      .select('id, user_id, role, joined_at, profiles(full_name, email)')
      .eq('workspace_id', membership.workspace_id)
      .order('joined_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get workspace info
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('id, name')
      .eq('id', membership.workspace_id)
      .single()

    return NextResponse.json({
      members,
      workspace,
      currentUserId: user.id,
      currentUserRole: membership.role,
    })
  } catch (err) {
    console.error('Unexpected error in members API:', err)
    return NextResponse.json({
      error: 'Internal server error',
      details: err instanceof Error ? err.message : 'Unknown error'
    }, { status: 500 })
  }
}

// DELETE: Remove member from workspace (owner/admin only)
export async function DELETE(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const memberId = searchParams.get('id')

  if (!memberId) {
    return NextResponse.json({ error: 'Member ID required' }, { status: 400 })
  }

  // Get user's workspace and check permissions
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
  }

  if (membership.role !== 'owner' && membership.role !== 'admin') {
    return NextResponse.json({ error: 'Only owners and admins can remove members' }, { status: 403 })
  }

  // Get target member
  const { data: targetMember } = await supabase
    .from('workspace_members')
    .select('user_id, role')
    .eq('id', memberId)
    .eq('workspace_id', membership.workspace_id)
    .single()

  if (!targetMember) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  }

  // Can't remove owner
  if (targetMember.role === 'owner') {
    return NextResponse.json({ error: 'Cannot remove workspace owner' }, { status: 403 })
  }

  // Admins can't remove other admins
  if (membership.role === 'admin' && targetMember.role === 'admin') {
    return NextResponse.json({ error: 'Admins cannot remove other admins' }, { status: 403 })
  }

  // Remove member
  const { error } = await supabase
    .from('workspace_members')
    .delete()
    .eq('id', memberId)
    .eq('workspace_id', membership.workspace_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// PATCH: Update member role (owner only)
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { memberId, role } = body

  if (!memberId || !role) {
    return NextResponse.json({ error: 'Member ID and role required' }, { status: 400 })
  }

  if (!['admin', 'member'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  // Get user's workspace and check permissions
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
  }

  if (membership.role !== 'owner') {
    return NextResponse.json({ error: 'Only owners can change member roles' }, { status: 403 })
  }

  // Update role
  const { error } = await supabase
    .from('workspace_members')
    .update({ role })
    .eq('id', memberId)
    .eq('workspace_id', membership.workspace_id)
    .neq('role', 'owner') // Can't change owner role

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
