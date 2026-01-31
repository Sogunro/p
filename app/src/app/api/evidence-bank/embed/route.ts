import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const EMBEDDING_SERVICE_URL = process.env.EMBEDDING_SERVICE_URL || ''
const EMBEDDING_API_KEY = process.env.EMBEDDING_API_KEY || ''

// POST /api/evidence-bank/embed — Generate and store embedding for evidence item(s)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Resolve workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    if (!EMBEDDING_SERVICE_URL) {
      return NextResponse.json({ error: 'Embedding service not configured. Set EMBEDDING_SERVICE_URL.' }, { status: 503 })
    }

    const body = await request.json()
    const { evidenceId, embedAll } = body

    if (embedAll) {
      // Embed all evidence items without embeddings
      const { data: items, error } = await supabase
        .from('evidence_bank')
        .select('id, title, content')
        .eq('workspace_id', membership.workspace_id)
        .is('embedding', null)

      if (error || !items || items.length === 0) {
        return NextResponse.json({
          message: 'No items need embedding',
          updated: 0,
        })
      }

      // Build texts for batch embedding
      const texts = items.map(item => {
        const parts = [item.title]
        if (item.content) parts.push(item.content)
        return parts.join('. ')
      })

      // Call embedding service batch endpoint
      const embeddingResponse = await fetch(`${EMBEDDING_SERVICE_URL}/embed-batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(EMBEDDING_API_KEY ? { 'Authorization': `Bearer ${EMBEDDING_API_KEY}` } : {}),
        },
        body: JSON.stringify({ texts }),
      })

      if (!embeddingResponse.ok) {
        const errorText = await embeddingResponse.text()
        return NextResponse.json({ error: `Embedding service error: ${errorText}` }, { status: 502 })
      }

      const { embeddings } = await embeddingResponse.json()

      // Update each item with its embedding
      let updated = 0
      for (let i = 0; i < items.length; i++) {
        const { error: updateError } = await supabase
          .from('evidence_bank')
          .update({ embedding: JSON.stringify(embeddings[i]) })
          .eq('id', items[i].id)

        if (!updateError) updated++
      }

      return NextResponse.json({
        message: `Embedded ${updated}/${items.length} items`,
        updated,
        total: items.length,
      })
    }

    if (evidenceId) {
      // Embed a single evidence item
      const { data: item, error } = await supabase
        .from('evidence_bank')
        .select('id, title, content')
        .eq('id', evidenceId)
        .eq('workspace_id', membership.workspace_id)
        .single()

      if (error || !item) {
        return NextResponse.json({ error: 'Evidence item not found' }, { status: 404 })
      }

      const text = [item.title, item.content].filter(Boolean).join('. ')

      // Call embedding service
      const embeddingResponse = await fetch(`${EMBEDDING_SERVICE_URL}/embed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(EMBEDDING_API_KEY ? { 'Authorization': `Bearer ${EMBEDDING_API_KEY}` } : {}),
        },
        body: JSON.stringify({ text }),
      })

      if (!embeddingResponse.ok) {
        const errorText = await embeddingResponse.text()
        return NextResponse.json({ error: `Embedding service error: ${errorText}` }, { status: 502 })
      }

      const { embedding } = await embeddingResponse.json()

      // Store embedding
      const { error: updateError } = await supabase
        .from('evidence_bank')
        .update({ embedding: JSON.stringify(embedding) })
        .eq('id', item.id)

      if (updateError) {
        return NextResponse.json({ error: 'Failed to store embedding' }, { status: 500 })
      }

      return NextResponse.json({
        message: 'Embedding generated and stored',
        evidenceId: item.id,
      })
    }

    return NextResponse.json({ error: 'Provide evidenceId or set embedAll: true' }, { status: 400 })
  } catch (error) {
    console.error('Embed error:', error)
    return NextResponse.json({ error: 'Failed to generate embedding' }, { status: 500 })
  }
}
