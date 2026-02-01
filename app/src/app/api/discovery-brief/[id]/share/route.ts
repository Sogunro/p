import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { randomBytes } from 'crypto'

// POST: Generate a share token and make brief public
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if brief already has a share token
    const { data: existing } = await supabase
      .from('discovery_briefs')
      .select('share_token, is_public')
      .eq('id', id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Brief not found' }, { status: 404 })
    }

    if (existing.share_token && existing.is_public) {
      return NextResponse.json({
        share_token: existing.share_token,
        share_url: `/brief/${existing.share_token}`,
      })
    }

    // Generate a unique share token
    const shareToken = randomBytes(16).toString('hex')

    const { data: brief, error } = await supabase
      .from('discovery_briefs')
      .update({
        share_token: shareToken,
        is_public: true,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Share brief error:', error)
      return NextResponse.json({ error: 'Failed to share brief' }, { status: 500 })
    }

    return NextResponse.json({
      share_token: brief.share_token,
      share_url: `/brief/${brief.share_token}`,
    })
  } catch (error) {
    console.error('Share brief error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE: Revoke sharing
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase
      .from('discovery_briefs')
      .update({
        share_token: null,
        is_public: false,
      })
      .eq('id', id)

    if (error) {
      console.error('Revoke share error:', error)
      return NextResponse.json({ error: 'Failed to revoke sharing' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Revoke share error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
