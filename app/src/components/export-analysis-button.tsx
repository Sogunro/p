'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface AnalysisData {
  sessionTitle: string
  createdAt: string
  objectiveScore: number
  summary: string
  assumptions: { content: string; section: string; confidence?: number; validation_strategy?: string }[]
  evidenceBacked: { content: string; section: string; evidence_summary: string; confidence?: number; confidence_tier?: string }[]
  validationRecommendations: {
    item: string
    confidence: string
    reason: string
    method: string
    questions: string[]
    sample_size?: string
  }[]
  constraintAnalysis: { constraint: string; status: string; notes: string }[]
  checklistReview: { item: string; status: string; notes: string }[]
  // New comprehensive fields
  sessionDiagnosis?: {
    overall_quality?: string
    evidence_maturity?: string
    session_nature?: string
    key_strengths?: string[]
    key_gaps?: string[]
    readiness_to_build?: string
  } | null
  strategicAlignment?: {
    vision_alignment_score?: number
    vision_alignment_explanation?: string
    goals_coverage?: { goal: string; impact: string; problems_addressed: string[] }[]
    overall_alignment_score?: number
  } | null
  solutionsAnalysis?: {
    solution: string
    problem_solved: string
    recommendation: string
    budget_fit?: string
    timeline_fit?: string
    tech_feasibility?: string
    reasoning?: string
  }[]
  nextSteps?: {
    build_now?: { action: string; reason: string; which_solutions?: string[] }[]
    validate_first?: { action: string; method: string; sample_size?: string; timeline?: string; questions?: string[] }[]
    defer?: { item: string; reason: string; revisit_when?: string }[]
  } | null
  patternDetection?: {
    shared_evidence?: { evidence_title: string; used_by_problems: string[] }[]
    convergent_patterns?: { pattern: string; source_count: number }[]
    evidence_gaps?: string[]
  } | null
  priorityRanking?: {
    rank: number
    item: string
    type: string
    total_score: number
    why_this_rank?: string
  }[]
}

interface ExportAnalysisButtonProps {
  analysis: AnalysisData
}

export function ExportAnalysisButton({ analysis }: ExportAnalysisButtonProps) {
  const [showDialog, setShowDialog] = useState(false)
  const [copied, setCopied] = useState(false)

  const generateMarkdown = () => {
    const lines: string[] = []
    const totalCards = analysis.evidenceBacked.length + analysis.assumptions.length
    const evidenceScore = totalCards > 0
      ? Math.round((analysis.evidenceBacked.length / totalCards) * 100)
      : 0

    // Determine session nature
    let sessionNature = 'assumption_driven'
    if (evidenceScore >= 70) sessionNature = 'validated'
    else if (evidenceScore >= 30) sessionNature = 'hybrid'

    // Header
    lines.push(`# Discovery Analysis: ${analysis.sessionTitle}`)
    lines.push(``)
    lines.push(`_Generated on ${new Date(analysis.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}_`)
    lines.push(``)

    // Session Overview
    lines.push(`## 📊 Session Overview`)
    lines.push(``)
    lines.push(`- **Evidence Score:** ${evidenceScore}%`)
    lines.push(`- **Evidence-based cards:** ${analysis.evidenceBacked.length}`)
    lines.push(`- **Assumption cards:** ${analysis.assumptions.length}`)
    lines.push(`- **Total cards:** ${totalCards}`)
    lines.push(`- **Session Nature:** ${sessionNature}`)
    lines.push(`- **Objective Alignment:** ${analysis.objectiveScore}%`)
    lines.push(``)
    lines.push(`> ${analysis.summary}`)
    lines.push(``)

    // Session Diagnosis (if available)
    if (analysis.sessionDiagnosis) {
      const diag = analysis.sessionDiagnosis
      lines.push(`### Session Quality`)
      lines.push(``)
      lines.push(`- **Overall Quality:** ${diag.overall_quality || 'N/A'}`)
      lines.push(`- **Evidence Maturity:** ${diag.evidence_maturity || 'N/A'}`)
      lines.push(`- **Readiness to Build:** ${diag.readiness_to_build || 'N/A'}`)

      if (diag.key_strengths && diag.key_strengths.length > 0) {
        lines.push(``)
        lines.push(`**Strengths:**`)
        diag.key_strengths.forEach(s => lines.push(`- ✓ ${s}`))
      }

      if (diag.key_gaps && diag.key_gaps.length > 0) {
        lines.push(``)
        lines.push(`**Gaps:**`)
        diag.key_gaps.forEach(g => lines.push(`- ⚠ ${g}`))
      }
      lines.push(``)
    }

    // Focus Areas (derived from sections)
    const sections = new Set<string>()
    analysis.evidenceBacked.forEach(e => sections.add(e.section))
    analysis.assumptions.forEach(a => sections.add(a.section))

    if (sections.size > 0) {
      lines.push(`## 🎯 Focus Areas`)
      lines.push(``)
      let idx = 1
      sections.forEach(section => {
        if (section) {
          const count = [...analysis.evidenceBacked, ...analysis.assumptions].filter(x => x.section === section).length
          lines.push(`${idx}. **${section}** (${count} cards)`)
          idx++
        }
      })
      lines.push(``)
    }

    // Evidence-Backed Problems (Validated)
    if (analysis.evidenceBacked.length > 0) {
      lines.push(`## ✅ Validated Problems`)
      lines.push(``)
      analysis.evidenceBacked.forEach((item, i) => {
        const confidence = item.confidence ? Math.round(item.confidence * 100) : 70
        lines.push(`### ${i + 1}. ${item.content}`)
        lines.push(``)
        lines.push(`- **Section:** ${item.section}`)
        lines.push(`- **Confidence:** ${confidence}%`)
        lines.push(`- **Tier:** ${item.confidence_tier || 'validated'}`)
        if (item.evidence_summary) {
          lines.push(`- **Evidence:** ${item.evidence_summary}`)
        }
        lines.push(``)
      })
    }

    // Assumed Problems (Need Validation)
    if (analysis.assumptions.length > 0) {
      lines.push(`## ⚠️ Assumed Problems (Need Validation)`)
      lines.push(``)
      analysis.assumptions.forEach((item, i) => {
        const confidence = item.confidence ? Math.round(item.confidence * 100) : 25
        // Determine priority based on confidence
        let priority = 'medium'
        if (confidence < 30) priority = 'high'
        else if (confidence > 50) priority = 'low'

        lines.push(`### ${i + 1}. ${item.content}`)
        lines.push(``)
        lines.push(`- **Priority:** ${priority}`)
        lines.push(`- **Confidence:** ${confidence}%`)
        if (item.validation_strategy) {
          lines.push(`- **Suggested Validation:** ${item.validation_strategy}`)
        }
        lines.push(``)
      })
    }

    // Proposed Solutions
    if (analysis.solutionsAnalysis && analysis.solutionsAnalysis.length > 0) {
      lines.push(`## 💡 Proposed Solutions`)
      lines.push(``)
      analysis.solutionsAnalysis.forEach((sol, i) => {
        lines.push(`${i + 1}. **${sol.solution}**`)
        lines.push(`   - Addresses: ${sol.problem_solved}`)
        lines.push(`   - Recommendation: ${sol.recommendation?.replace('_', ' ')}`)
        if (sol.tech_feasibility) {
          lines.push(`   - Feasibility: ${sol.tech_feasibility}`)
        }
        if (sol.budget_fit) {
          lines.push(`   - Budget: ${sol.budget_fit}`)
        }
        if (sol.reasoning) {
          lines.push(`   - Rationale: ${sol.reasoning}`)
        }
      })
      lines.push(``)
    }

    // Strategic Alignment
    if (analysis.strategicAlignment) {
      const align = analysis.strategicAlignment
      lines.push(`## 🎯 Strategic Alignment`)
      lines.push(``)
      lines.push(`- **Vision Alignment:** ${align.vision_alignment_score || 0}%`)
      lines.push(`- **Overall Alignment:** ${align.overall_alignment_score || 0}%`)
      if (align.vision_alignment_explanation) {
        lines.push(``)
        lines.push(`> ${align.vision_alignment_explanation}`)
      }
      if (align.goals_coverage && align.goals_coverage.length > 0) {
        lines.push(``)
        lines.push(`### Goals Coverage`)
        lines.push(``)
        align.goals_coverage.forEach(g => {
          lines.push(`- **${g.goal}**: ${g.impact} impact`)
        })
      }
      lines.push(``)
    }

    // Recommended Next Steps
    if (analysis.nextSteps) {
      lines.push(`## 🚀 Recommended Next Steps`)
      lines.push(``)

      // High Priority - Build Now
      if (analysis.nextSteps.build_now && analysis.nextSteps.build_now.length > 0) {
        lines.push(`### 🟢 Ready to Build`)
        lines.push(``)
        analysis.nextSteps.build_now.forEach((step, i) => {
          lines.push(`**${i + 1}. ${step.action}**`)
          lines.push(`- Why: ${step.reason}`)
          if (step.which_solutions && step.which_solutions.length > 0) {
            lines.push(`- Solutions: ${step.which_solutions.join(', ')}`)
          }
          lines.push(``)
        })
      }

      // Medium Priority - Validate First
      if (analysis.nextSteps.validate_first && analysis.nextSteps.validate_first.length > 0) {
        lines.push(`### 🟡 Validate First`)
        lines.push(``)
        analysis.nextSteps.validate_first.forEach((step, i) => {
          lines.push(`**${i + 1}. ${step.action}**`)
          lines.push(`- Method: ${step.method}`)
          if (step.sample_size) {
            lines.push(`- Sample Size: ${step.sample_size}`)
          }
          if (step.timeline) {
            lines.push(`- Effort: ${step.timeline}`)
          }
          if (step.questions && step.questions.length > 0) {
            lines.push(`- Questions:`)
            step.questions.forEach(q => lines.push(`  - ${q}`))
          }
          lines.push(``)
        })
      }

      // Low Priority - Defer
      if (analysis.nextSteps.defer && analysis.nextSteps.defer.length > 0) {
        lines.push(`### ⏸️ Defer`)
        lines.push(``)
        analysis.nextSteps.defer.forEach((step, i) => {
          lines.push(`**${i + 1}. ${step.item}**`)
          lines.push(`- Reason: ${step.reason}`)
          if (step.revisit_when) {
            lines.push(`- Revisit when: ${step.revisit_when}`)
          }
          lines.push(``)
        })
      }
    }

    // Validation Recommendations (detailed)
    if (analysis.validationRecommendations.length > 0) {
      lines.push(`## 📋 Validation Playbook`)
      lines.push(``)
      analysis.validationRecommendations.forEach((rec, i) => {
        lines.push(`### ${i + 1}. ${rec.item}`)
        lines.push(``)
        lines.push(`- **Confidence:** ${rec.confidence}`)
        lines.push(`- **Why:** ${rec.reason}`)
        lines.push(`- **Method:** ${rec.method}`)
        if (rec.sample_size) {
          lines.push(`- **Sample Size:** ${rec.sample_size}`)
        }
        if (rec.questions && rec.questions.length > 0) {
          lines.push(`- **Questions to answer:**`)
          rec.questions.forEach((q) => {
            lines.push(`  - ${q}`)
          })
        }
        lines.push(``)
      })
    }

    // Constraint Analysis
    if (analysis.constraintAnalysis.length > 0) {
      lines.push(`## ⚙️ Constraint Alignment`)
      lines.push(``)
      lines.push(`| Constraint | Status | Notes |`)
      lines.push(`|------------|--------|-------|`)
      analysis.constraintAnalysis.forEach((item) => {
        const statusEmoji = item.status === 'aligned' ? '✓' : item.status === 'warning' ? '⚠' : '✕'
        lines.push(`| ${item.constraint} | ${statusEmoji} ${item.status} | ${item.notes} |`)
      })
      lines.push(``)
    }

    // Checklist Review
    if (analysis.checklistReview.length > 0) {
      lines.push(`## ✅ Checklist Review`)
      lines.push(``)
      lines.push(`| Item | Status | Notes |`)
      lines.push(`|------|--------|-------|`)
      analysis.checklistReview.forEach((item) => {
        const statusEmoji = item.status === 'met' ? '✓' : item.status === 'partially' ? '◐' : '✕'
        lines.push(`| ${item.item} | ${statusEmoji} ${item.status} | ${item.notes} |`)
      })
      lines.push(``)
    }

    // Summary
    lines.push(`## 📝 Summary`)
    lines.push(``)

    // Generate a comprehensive summary
    const summaryParts: string[] = []

    if (evidenceScore < 30) {
      summaryParts.push(`The analysis reveals a discovery phase with substantial evidentiary gaps (${evidenceScore}% evidence score).`)
    } else if (evidenceScore < 70) {
      summaryParts.push(`The analysis shows a hybrid discovery phase with moderate evidence backing (${evidenceScore}% evidence score).`)
    } else {
      summaryParts.push(`The analysis demonstrates a well-validated discovery phase (${evidenceScore}% evidence score).`)
    }

    if (analysis.assumptions.length > 0) {
      summaryParts.push(`${analysis.assumptions.length} items remain as assumptions requiring validation before proceeding.`)
    }

    if (analysis.sessionDiagnosis?.readiness_to_build === 'ready') {
      summaryParts.push(`The session is ready for solution development.`)
    } else if (analysis.sessionDiagnosis?.readiness_to_build === 'needs_validation') {
      summaryParts.push(`A 'validate first' strategy is recommended before building.`)
    } else {
      summaryParts.push(`Further discovery work is recommended to strengthen evidence.`)
    }

    lines.push(summaryParts.join(' '))
    lines.push(``)

    lines.push(`---`)
    lines.push(`*Generated by Product Discovery Tool*`)

    return lines.join('\n')
  }

  const generateJSON = () => {
    return JSON.stringify({
      sessionTitle: analysis.sessionTitle,
      exportedAt: new Date().toISOString(),
      analysisDate: analysis.createdAt,
      objectiveScore: analysis.objectiveScore,
      evidenceScore: analysis.evidenceBacked.length + analysis.assumptions.length > 0
        ? Math.round((analysis.evidenceBacked.length / (analysis.evidenceBacked.length + analysis.assumptions.length)) * 100)
        : 0,
      summary: analysis.summary,
      sessionDiagnosis: analysis.sessionDiagnosis,
      strategicAlignment: analysis.strategicAlignment,
      assumptions: analysis.assumptions,
      evidenceBacked: analysis.evidenceBacked,
      solutionsAnalysis: analysis.solutionsAnalysis,
      nextSteps: analysis.nextSteps,
      validationRecommendations: analysis.validationRecommendations,
      constraintAnalysis: analysis.constraintAnalysis,
      checklistReview: analysis.checklistReview,
    }, null, 2)
  }

  const handleCopyMarkdown = async () => {
    await navigator.clipboard.writeText(generateMarkdown())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownloadMarkdown = () => {
    const content = generateMarkdown()
    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${analysis.sessionTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-analysis.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleDownloadJSON = () => {
    const content = generateJSON()
    const blob = new Blob([content], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${analysis.sessionTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-analysis.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <Button variant="outline" onClick={() => setShowDialog(true)}>
        Export
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Export Analysis</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Export your analysis results to share with your team or save for reference.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-20 flex flex-col gap-1"
                onClick={handleCopyMarkdown}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                </svg>
                <span className="text-xs">
                  {copied ? 'Copied!' : 'Copy to Clipboard'}
                </span>
              </Button>

              <Button
                variant="outline"
                className="h-20 flex flex-col gap-1"
                onClick={handleDownloadMarkdown}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" x2="12" y1="15" y2="3" />
                </svg>
                <span className="text-xs">Download .md</span>
              </Button>

              <Button
                variant="outline"
                className="h-20 flex flex-col gap-1 col-span-2"
                onClick={handleDownloadJSON}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span className="text-xs">Download .json (for integrations)</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
