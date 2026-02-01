import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET: Fetch a single discovery brief
export async function GET(
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

    const { data: brief, error } = await supabase
      .from('discovery_briefs')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !brief) {
      return NextResponse.json({ error: 'Brief not found' }, { status: 404 })
    }

    return NextResponse.json({ brief })
  } catch (error) {
    console.error('Fetch brief error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH: Update a discovery brief
export async function PATCH(
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

    const body = await request.json()
    const { title, content } = body

    const updates: Record<string, unknown> = {}
    if (title !== undefined) updates.title = title
    if (content !== undefined) updates.content = content

    const { data: brief, error } = await supabase
      .from('discovery_briefs')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Update brief error:', error)
      return NextResponse.json({ error: 'Failed to update brief' }, { status: 500 })
    }

    return NextResponse.json({ brief })
  } catch (error) {
    console.error('Update brief error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE: Delete a discovery brief
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
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Delete brief error:', error)
      return NextResponse.json({ error: 'Failed to delete brief' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete brief error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
