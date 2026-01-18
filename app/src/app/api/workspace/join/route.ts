import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET: Check if invite code is valid
export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.json({ error: 'Invite code required' }, { status: 400 })
  }

  // Find invite
  const { data: invite, error } = await supabase
    .from('workspace_invites')
    .select('*, workspaces(name)')
    .eq('invite_code', code.toUpperCase())
    .eq('is_active', true)
    .single()

  if (error || !invite) {
    return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 404 })
  }

  // Check if expired
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This invite has expired' }, { status: 410 })
  }

  // Check if max uses reached
  if (invite.max_uses && invite.use_count >= invite.max_uses) {
    return NextResponse.json({ error: 'This invite has reached its maximum uses' }, { status: 410 })
  }

  return NextResponse.json({
    valid: true,
    workspaceName: invite.workspaces?.name || 'Unknown Workspace',
    role: invite.role,
  })
}

// POST: Accept invite and join workspace
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'You must be logged in to join a workspace' }, { status: 401 })
  }

  const body = await request.json()
  const { code } = body

  if (!code) {
    return NextResponse.json({ error: 'Invite code required' }, { status: 400 })
  }

  // Find invite
  const { data: invite, error: inviteError } = await supabase
    .from('workspace_invites')
    .select('*')
    .eq('invite_code', code.toUpperCase())
    .eq('is_active', true)
    .single()

  if (inviteError || !invite) {
    return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 404 })
  }

  // Check if expired
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This invite has expired' }, { status: 410 })
  }

  // Check if max uses reached
  if (invite.max_uses && invite.use_count >= invite.max_uses) {
    return NextResponse.json({ error: 'This invite has reached its maximum uses' }, { status: 410 })
  }

  // Check if user is already a member
  const { data: existingMember } = await supabase
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', invite.workspace_id)
    .eq('user_id', user.id)
    .single()

  if (existingMember) {
    return NextResponse.json({ error: 'You are already a member of this workspace' }, { status: 400 })
  }

  // Add user to workspace
  const { error: memberError } = await supabase
    .from('workspace_members')
    .insert({
      workspace_id: invite.workspace_id,
      user_id: user.id,
      role: invite.role,
    })

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 })
  }

  // Increment use count
  await supabase
    .from('workspace_invites')
    .update({ use_count: invite.use_count + 1 })
    .eq('id', invite.id)

  return NextResponse.json({ success: true, workspaceId: invite.workspace_id })
}
