import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const EMBEDDING_SERVICE_URL = process.env.EMBEDDING_SERVICE_URL || ''
const EMBEDDING_API_KEY = process.env.EMBEDDING_API_KEY || ''

// POST /api/evidence-bank/search — Semantic search over evidence bank
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
    const { query, limit = 10, threshold = 0.3 } = body

    if (!query || !query.trim()) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    // Step 1: Get embedding for the query text
    const embeddingResponse = await fetch(`${EMBEDDING_SERVICE_URL}/embed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(EMBEDDING_API_KEY ? { 'Authorization': `Bearer ${EMBEDDING_API_KEY}` } : {}),
      },
      body: JSON.stringify({ text: query }),
    })

    if (!embeddingResponse.ok) {
      const errorText = await embeddingResponse.text()
      return NextResponse.json({ error: `Embedding service error: ${errorText}` }, { status: 502 })
    }

    const { embedding } = await embeddingResponse.json()

    // Step 2: Call Supabase search_evidence function
    const { data: results, error } = await supabase.rpc('search_evidence', {
      query_embedding: JSON.stringify(embedding),
      target_workspace_id: membership.workspace_id,
      match_limit: limit,
      similarity_threshold: threshold,
    })

    if (error) {
      console.error('Vector search error:', error)
      return NextResponse.json({ error: 'Search failed' }, { status: 500 })
    }

    return NextResponse.json({
      results: results || [],
      query,
      count: results?.length || 0,
    })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json({ error: 'Failed to search evidence' }, { status: 500 })
  }
}
