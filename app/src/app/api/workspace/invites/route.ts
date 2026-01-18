import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Generate random invite code
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let result = ''
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// GET: List invites for user's workspace
export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user's workspace
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
  }

  // Get invites
  const { data: invites, error } = await supabase
    .from('workspace_invites')
    .select('*, created_by_profile:profiles!workspace_invites_created_by_fkey(full_name, email)')
    .eq('workspace_id', membership.workspace_id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ invites, userRole: membership.role })
}

// POST: Create new invite
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { role = 'member', maxUses = null } = body

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
    return NextResponse.json({ error: 'Only owners and admins can create invites' }, { status: 403 })
  }

  // Generate unique invite code
  let inviteCode = generateInviteCode()
  let attempts = 0
  while (attempts < 5) {
    const { data: existing } = await supabase
      .from('workspace_invites')
      .select('id')
      .eq('invite_code', inviteCode)
      .single()

    if (!existing) break
    inviteCode = generateInviteCode()
    attempts++
  }

  // Create invite
  const { data: invite, error } = await supabase
    .from('workspace_invites')
    .insert({
      workspace_id: membership.workspace_id,
      invite_code: inviteCode,
      created_by: user.id,
      role: role === 'admin' ? 'admin' : 'member',
      max_uses: maxUses,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ invite })
}

// DELETE: Deactivate invite
export async function DELETE(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const inviteId = searchParams.get('id')

  if (!inviteId) {
    return NextResponse.json({ error: 'Invite ID required' }, { status: 400 })
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
    return NextResponse.json({ error: 'Only owners and admins can delete invites' }, { status: 403 })
  }

  // Deactivate invite
  const { error } = await supabase
    .from('workspace_invites')
    .update({ is_active: false })
    .eq('id', inviteId)
    .eq('workspace_id', membership.workspace_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
