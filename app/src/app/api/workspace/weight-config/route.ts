import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { WEIGHT_TEMPLATES, WEIGHT_TEMPLATE_INFO, DEFAULT_WEIGHT_CONFIG, DEFAULT_RECENCY_CONFIG } from '@/lib/evidence-strength'
import type { WeightTemplate } from '@/types/database'

// GET: Get workspace weight configuration
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    const { data: settings, error } = await supabase
      .from('workspace_settings')
      .select('weight_config, weight_template, recency_config, target_segments')
      .eq('workspace_id', membership.workspace_id)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching weight config:', error)
      return NextResponse.json({ error: 'Failed to fetch weight configuration' }, { status: 500 })
    }

    return NextResponse.json({
      weight_config: settings?.weight_config ?? DEFAULT_WEIGHT_CONFIG,
      weight_template: settings?.weight_template ?? 'default',
      recency_config: settings?.recency_config ?? DEFAULT_RECENCY_CONFIG,
      target_segments: settings?.target_segments ?? [],
      templates: WEIGHT_TEMPLATES,
      template_info: WEIGHT_TEMPLATE_INFO,
    })
  } catch (error) {
    console.error('Weight config error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT: Update workspace weight configuration
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
    }

    if (membership.role !== 'owner' && membership.role !== 'admin') {
      return NextResponse.json({ error: 'Only owners and admins can update weight configuration' }, { status: 403 })
    }

    const body = await request.json()
    const { weight_config, weight_template, recency_config, target_segments } = body

    // Validate weight_template if provided
    const validTemplates: WeightTemplate[] = ['default', 'b2b_enterprise', 'plg_growth', 'support_led', 'research_heavy']
    if (weight_template && !validTemplates.includes(weight_template)) {
      return NextResponse.json({ error: 'Invalid weight template' }, { status: 400 })
    }

    // If a template is selected, use its config
    const resolvedConfig = weight_template && weight_template !== 'default'
      ? WEIGHT_TEMPLATES[weight_template as WeightTemplate]
      : (weight_config ?? DEFAULT_WEIGHT_CONFIG)

    const updateData: Record<string, unknown> = {
      workspace_id: membership.workspace_id,
    }

    if (weight_config !== undefined || weight_template !== undefined) {
      updateData.weight_config = resolvedConfig
    }
    if (weight_template !== undefined) {
      updateData.weight_template = weight_template
    }
    if (recency_config !== undefined) {
      updateData.recency_config = recency_config
    }
    if (target_segments !== undefined) {
      updateData.target_segments = target_segments
    }

    const { data: settings, error } = await supabase
      .from('workspace_settings')
      .update(updateData)
      .eq('workspace_id', membership.workspace_id)
      .select('weight_config, weight_template, recency_config, target_segments')
      .single()

    if (error) {
      console.error('Error updating weight config:', error)
      return NextResponse.json({ error: 'Failed to update weight configuration' }, { status: 500 })
    }

    return NextResponse.json({ settings })
  } catch (error) {
    console.error('Weight config update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
