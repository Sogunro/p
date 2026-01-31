import type {
  WeightConfig,
  RecencyConfig,
  RecencyRange,
  EvidenceStrengthResult,
  EvidenceStrengthFactors,
  QualityGateResult,
  CoverageIndicators,
  SourceSystemExpanded,
  WeightTemplate,
  EvidenceBank,
} from '@/types/database'

// ============================================
// Default Configurations
// ============================================

export const DEFAULT_WEIGHT_CONFIG: WeightConfig = {
  interview: 1.0,
  support: 0.8,
  sales: 0.7,
  analytics: 0.7,
  slack: 0.4,
  social: 0.3,
  internal: 0.1,
  manual: 0.5,
  notion: 0.5,
  mixpanel: 0.7,
  airtable: 0.5,
  intercom: 0.8,
  gong: 0.7,
}

export const DEFAULT_RECENCY_CONFIG: RecencyConfig = {
  ranges: [
    { max_days: 7, factor: 1.0 },
    { max_days: 30, factor: 0.8 },
    { max_days: 90, factor: 0.5 },
    { max_days: 999999, factor: 0.2 },
  ],
}

// ============================================
// Weighting Templates
// ============================================

export const WEIGHT_TEMPLATES: Record<WeightTemplate, WeightConfig> = {
  default: DEFAULT_WEIGHT_CONFIG,
  b2b_enterprise: {
    interview: 1.0,
    support: 0.9,
    sales: 0.9,
    analytics: 0.6,
    slack: 0.3,
    social: 0.2,
    internal: 0.1,
    manual: 0.5,
    notion: 0.5,
    mixpanel: 0.6,
    airtable: 0.5,
    intercom: 0.9,
    gong: 0.9,
  },
  plg_growth: {
    interview: 0.8,
    support: 0.7,
    sales: 0.5,
    analytics: 1.0,
    slack: 0.6,
    social: 0.5,
    internal: 0.1,
    manual: 0.5,
    notion: 0.5,
    mixpanel: 1.0,
    airtable: 0.5,
    intercom: 0.7,
    gong: 0.5,
  },
  support_led: {
    interview: 0.9,
    support: 1.0,
    sales: 0.6,
    analytics: 0.7,
    slack: 0.5,
    social: 0.4,
    internal: 0.1,
    manual: 0.5,
    notion: 0.5,
    mixpanel: 0.7,
    airtable: 0.5,
    intercom: 1.0,
    gong: 0.6,
  },
  research_heavy: {
    interview: 1.0,
    support: 0.7,
    sales: 0.6,
    analytics: 0.8,
    slack: 0.3,
    social: 0.3,
    internal: 0.2,
    manual: 0.7,
    notion: 0.7,
    mixpanel: 0.8,
    airtable: 0.6,
    intercom: 0.7,
    gong: 0.8,
  },
}

// Template display metadata
export const WEIGHT_TEMPLATE_INFO: Record<WeightTemplate, { label: string; description: string }> = {
  default: {
    label: 'Default',
    description: 'Balanced weights across all source types',
  },
  b2b_enterprise: {
    label: 'B2B Enterprise',
    description: 'Prioritizes sales calls, support tickets, and customer interviews',
  },
  plg_growth: {
    label: 'PLG Growth',
    description: 'Prioritizes analytics, product usage data, and community signals',
  },
  support_led: {
    label: 'Support-Led',
    description: 'Prioritizes support channels (Intercom, tickets) and customer feedback',
  },
  research_heavy: {
    label: 'Research-Heavy',
    description: 'Prioritizes user research interviews and qualitative data',
  },
}

// ============================================
// Strength Bands
// ============================================

export type StrengthBand = 'weak' | 'moderate' | 'strong'

export function getStrengthBand(score: number): StrengthBand {
  if (score >= 70) return 'strong'
  if (score >= 40) return 'moderate'
  return 'weak'
}

export function getStrengthBandColor(band: StrengthBand): string {
  switch (band) {
    case 'strong': return '#22c55e'  // green-500
    case 'moderate': return '#eab308' // yellow-500
    case 'weak': return '#ef4444'     // red-500
  }
}

export function getStrengthBandLabel(band: StrengthBand): string {
  switch (band) {
    case 'strong': return 'Strong Evidence'
    case 'moderate': return 'Moderate Evidence'
    case 'weak': return 'Weak Evidence'
  }
}

// ============================================
// Core Calculation Functions
// ============================================

/**
 * Calculate recency factor based on evidence age.
 * Uses the workspace recency config ranges, or defaults.
 */
export function calculateRecencyFactor(
  evidenceDate: string | Date,
  recencyConfig: RecencyConfig = DEFAULT_RECENCY_CONFIG
): number {
  const now = new Date()
  const date = typeof evidenceDate === 'string' ? new Date(evidenceDate) : evidenceDate
  const daysDiff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

  // Sort ranges by max_days ascending
  const sortedRanges = [...recencyConfig.ranges].sort((a, b) => a.max_days - b.max_days)

  for (const range of sortedRanges) {
    if (daysDiff <= range.max_days) {
      return range.factor
    }
  }

  // Fallback for very old evidence
  return 0.1
}

/**
 * Get the source weight for a given source system type.
 */
export function getSourceWeight(
  sourceSystem: SourceSystemExpanded,
  weightConfig: WeightConfig = DEFAULT_WEIGHT_CONFIG
): number {
  return weightConfig[sourceSystem] ?? 0.5
}

/**
 * Calculate segment match factor.
 * Returns 1.0 if evidence segment matches a target segment, 0.5 otherwise.
 */
export function calculateSegmentMatch(
  evidenceSegment: string | null,
  targetSegments: string[]
): number {
  if (!evidenceSegment || targetSegments.length === 0) return 1.0
  const normalizedEvidence = evidenceSegment.toLowerCase().trim()
  const matches = targetSegments.some(
    s => s.toLowerCase().trim() === normalizedEvidence
  )
  return matches ? 1.0 : 0.5
}

/**
 * Calculate corroboration bonus.
 * If 3+ independent sources corroborate, apply 1.3x multiplier.
 */
export function calculateCorroborationBonus(
  uniqueSourceCount: number
): number {
  if (uniqueSourceCount >= 3) return 1.3
  return 1.0
}

/**
 * Direct voice sources are first-person customer data (interview, support, gong).
 */
const DIRECT_VOICE_SOURCES: SourceSystemExpanded[] = ['interview', 'support', 'gong', 'intercom']

export function isDirectVoiceSource(sourceSystem: SourceSystemExpanded): boolean {
  return DIRECT_VOICE_SOURCES.includes(sourceSystem)
}

// ============================================
// Quality Gates
// ============================================

/**
 * Source Diversity Cap: No single source type contributes >70% of total score.
 */
function checkSourceDiversity(
  evidenceItems: Pick<EvidenceBank, 'source_system'>[]
): QualityGateResult['source_diversity'] {
  const total = evidenceItems.length
  if (total === 0) {
    return { passed: true, unique_sources: 0, total: 0, cap_applied: false }
  }

  const sourceCounts: Record<string, number> = {}
  for (const item of evidenceItems) {
    sourceCounts[item.source_system] = (sourceCounts[item.source_system] || 0) + 1
  }

  const uniqueSources = Object.keys(sourceCounts).length
  const maxSourceCount = Math.max(...Object.values(sourceCounts))
  const maxPercentage = maxSourceCount / total

  return {
    passed: maxPercentage <= 0.7,
    unique_sources: uniqueSources,
    total,
    cap_applied: maxPercentage > 0.7,
  }
}

/**
 * Direct Voice Requirement: At least one piece of direct customer evidence.
 */
function checkDirectVoice(
  evidenceItems: Pick<EvidenceBank, 'source_system'>[]
): QualityGateResult['direct_voice'] {
  const hasDirect = evidenceItems.some(item =>
    isDirectVoiceSource(item.source_system as SourceSystemExpanded)
  )
  return { passed: hasDirect, has_direct: hasDirect }
}

/**
 * Independence Check: At least 2 independent sources.
 */
function checkIndependence(
  evidenceItems: Pick<EvidenceBank, 'source_system'>[]
): QualityGateResult['independence'] {
  const uniqueSystems = new Set(evidenceItems.map(item => item.source_system))
  return {
    passed: uniqueSystems.size >= 2,
    independent_count: uniqueSystems.size,
  }
}

/**
 * Recency Floor: At least 50% of evidence is from the last 90 days.
 */
function checkRecencyFloor(
  evidenceItems: Pick<EvidenceBank, 'created_at'>[]
): QualityGateResult['recency_floor'] {
  if (evidenceItems.length === 0) {
    return { passed: true, recent_percentage: 0 }
  }

  const now = new Date()
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
  const recentCount = evidenceItems.filter(item => new Date(item.created_at) >= ninetyDaysAgo).length
  const percentage = recentCount / evidenceItems.length

  return {
    passed: percentage >= 0.5,
    recent_percentage: Math.round(percentage * 100),
  }
}

/**
 * Run all quality gates on a set of evidence items.
 */
export function evaluateQualityGates(
  evidenceItems: Pick<EvidenceBank, 'source_system' | 'created_at'>[]
): QualityGateResult {
  return {
    source_diversity: checkSourceDiversity(evidenceItems),
    direct_voice: checkDirectVoice(evidenceItems),
    independence: checkIndependence(evidenceItems),
    recency_floor: checkRecencyFloor(evidenceItems),
  }
}

// ============================================
// Coverage Indicators
// ============================================

/**
 * Calculate coverage indicators for a set of evidence items.
 */
export function calculateCoverage(
  evidenceItems: Pick<EvidenceBank, 'source_system' | 'segment' | 'created_at' | 'source_timestamp'>[]
): CoverageIndicators {
  const now = new Date()
  const uniqueSources = [...new Set(evidenceItems.map(e => e.source_system))]
  const segments = [...new Set(evidenceItems.map(e => e.segment).filter(Boolean) as string[])]

  // Recency distribution
  const distribution = { recent: 0, moderate: 0, old: 0, stale: 0 }
  for (const item of evidenceItems) {
    const dateStr = item.source_timestamp || item.created_at
    const days = Math.floor((now.getTime() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
    if (days <= 7) distribution.recent++
    else if (days <= 30) distribution.moderate++
    else if (days <= 90) distribution.old++
    else distribution.stale++
  }

  const hasDirectVoice = evidenceItems.some(e =>
    isDirectVoiceSource(e.source_system as SourceSystemExpanded)
  )

  // Identify gaps
  const gaps: string[] = []
  if (uniqueSources.length < 2) gaps.push('Only 1 source type — add diversity')
  if (!hasDirectVoice) gaps.push('No direct customer voice (interview, support, gong)')
  if (segments.length === 0) gaps.push('No segment data — consider tagging evidence')
  if (distribution.stale > evidenceItems.length * 0.5) gaps.push('Over 50% of evidence is stale (>90 days)')
  if (evidenceItems.length < 3) gaps.push('Fewer than 3 evidence items — corroboration bonus unavailable')

  return {
    source_count: evidenceItems.length,
    unique_sources: uniqueSources,
    segment_coverage: segments,
    recency_distribution: distribution,
    has_direct_voice: hasDirectVoice,
    gaps,
  }
}

// ============================================
// Main Computation
// ============================================

/**
 * Compute evidence strength for a single evidence item,
 * given its context (related evidence for corroboration/quality gates).
 *
 * Formula: base_weight × recency × segment_match × corroboration_bonus
 * Result is scaled to 0-100.
 */
export function computeEvidenceStrength(
  evidence: Pick<EvidenceBank, 'source_system' | 'created_at' | 'segment' | 'source_timestamp'>,
  relatedEvidence: Pick<EvidenceBank, 'source_system' | 'created_at' | 'segment' | 'source_timestamp'>[],
  config: {
    weightConfig?: WeightConfig
    recencyConfig?: RecencyConfig
    targetSegments?: string[]
  } = {}
): EvidenceStrengthResult {
  const {
    weightConfig = DEFAULT_WEIGHT_CONFIG,
    recencyConfig = DEFAULT_RECENCY_CONFIG,
    targetSegments = [],
  } = config

  // 1. Base weight from source type
  const sourceWeight = getSourceWeight(
    evidence.source_system as SourceSystemExpanded,
    weightConfig
  )

  // 2. Recency factor from evidence date
  const dateForRecency = evidence.source_timestamp || evidence.created_at
  const recencyFactor = calculateRecencyFactor(dateForRecency, recencyConfig)

  // 3. Segment match
  const segmentMatch = calculateSegmentMatch(evidence.segment, targetSegments)

  // 4. Corroboration bonus from all related evidence (including this one)
  const allEvidence = [evidence, ...relatedEvidence]
  const uniqueSources = new Set(allEvidence.map(e => e.source_system))
  const corroborationBonus = calculateCorroborationBonus(uniqueSources.size)

  // 5. Raw score: all factors multiplied, then scaled to 0-100
  //    Max possible raw = 1.0 × 1.0 × 1.0 × 1.3 = 1.3
  //    Scale: (raw / 1.3) × 100
  const rawScore = sourceWeight * recencyFactor * segmentMatch * corroborationBonus
  const computedStrength = Math.min(100, Math.round((rawScore / 1.3) * 100 * 100) / 100)

  // 6. Quality gates (informational, applied to coverage not individual score)
  const qualityGates = evaluateQualityGates(allEvidence)

  const factors: EvidenceStrengthFactors = {
    base_weight: sourceWeight,
    recency: recencyFactor,
    segment_match: segmentMatch,
    corroboration: corroborationBonus,
    quality_gates: qualityGates,
  }

  return {
    computed_strength: computedStrength,
    band: getStrengthBand(computedStrength),
    source_weight: sourceWeight,
    recency_factor: recencyFactor,
    segment_match: segmentMatch,
    corroboration_bonus: corroborationBonus,
    factors,
  }
}

/**
 * Compute aggregate strength for a set of evidence items (e.g., all evidence linked to a sticky note).
 * Returns the average computed strength across all items.
 */
export function computeAggregateStrength(
  evidenceItems: Pick<EvidenceBank, 'source_system' | 'created_at' | 'segment' | 'source_timestamp'>[],
  config: {
    weightConfig?: WeightConfig
    recencyConfig?: RecencyConfig
    targetSegments?: string[]
  } = {}
): { average_strength: number; band: StrengthBand; item_count: number; coverage: CoverageIndicators } {
  if (evidenceItems.length === 0) {
    return {
      average_strength: 0,
      band: 'weak',
      item_count: 0,
      coverage: calculateCoverage([]),
    }
  }

  const results = evidenceItems.map(item =>
    computeEvidenceStrength(
      item,
      evidenceItems.filter(e => e !== item),
      config
    )
  )

  const totalStrength = results.reduce((sum, r) => sum + r.computed_strength, 0)
  const averageStrength = Math.round((totalStrength / results.length) * 100) / 100

  return {
    average_strength: averageStrength,
    band: getStrengthBand(averageStrength),
    item_count: evidenceItems.length,
    coverage: calculateCoverage(evidenceItems),
  }
}

/**
 * Generate a human-readable breakdown explaining why an evidence item has its strength score.
 */
export function generateStrengthBreakdown(result: EvidenceStrengthResult): string[] {
  const lines: string[] = []

  lines.push(`Score: ${result.computed_strength}/100 (${getStrengthBandLabel(result.band)})`)
  lines.push(`Source weight: ${result.source_weight} (based on source type)`)
  lines.push(`Recency: ${result.recency_factor} (time decay factor)`)

  if (result.segment_match < 1.0) {
    lines.push(`Segment: ${result.segment_match} (no target segment match)`)
  } else {
    lines.push(`Segment: ${result.segment_match} (matched or no filter)`)
  }

  if (result.corroboration_bonus > 1.0) {
    lines.push(`Corroboration: ${result.corroboration_bonus}x bonus (3+ independent sources)`)
  } else {
    lines.push(`Corroboration: no bonus (fewer than 3 independent sources)`)
  }

  const gates = result.factors.quality_gates
  if (!gates.source_diversity.passed) {
    lines.push(`⚠ Source diversity: one source type exceeds 70% — add variety`)
  }
  if (!gates.direct_voice.passed) {
    lines.push(`⚠ No direct customer voice — consider adding interviews or support data`)
  }
  if (!gates.independence.passed) {
    lines.push(`⚠ Only ${gates.independence.independent_count} source type — add independent sources`)
  }
  if (!gates.recency_floor.passed) {
    lines.push(`⚠ Only ${gates.recency_floor.recent_percentage}% recent evidence — gather fresh data`)
  }

  return lines
}
