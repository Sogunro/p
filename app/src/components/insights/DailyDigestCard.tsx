'use client'

import { useState } from 'react'
import { DailyInsightsAnalysis, InsightTheme, InsightPattern, ActionItem } from '@/types/database'

interface DailyDigestCardProps {
  date: string
  insightCount: number
  sources: string[]
  analysis: DailyInsightsAnalysis | null
  onAnalyze: (date: string) => void
  isAnalyzing?: boolean
  onViewDetails?: (date: string) => void
}

const sourceIcons: Record<string, string> = {
  slack: '💬',
  notion: '📝',
  mixpanel: '📊',
  airtable: '📋',
}

export default function DailyDigestCard({
  date,
  insightCount,
  sources,
  analysis,
  onAnalyze,
  isAnalyzing = false,
  onViewDetails,
}: DailyDigestCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const themes = (analysis?.themes || []) as unknown as InsightTheme[]
  const patterns = (analysis?.patterns || []) as unknown as InsightPattern[]
  const actionItems = (analysis?.action_items || []) as unknown as ActionItem[]

  const highPriorityCount = ((analysis?.priorities || []) as { priority_score: number }[])
    .filter((p) => p.priority_score >= 7).length

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">{formattedDate}</h3>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-sm text-gray-600">{insightCount} insights</span>
              <div className="flex items-center gap-1">
                {sources.map((source) => (
                  <span key={source} title={source} className="text-sm">
                    {sourceIcons[source] || '📌'}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!analysis ? (
              <button
                onClick={() => onAnalyze(date)}
                disabled={isAnalyzing}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isAnalyzing ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Analyzing...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                      />
                    </svg>
                    Analyze
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="px-4 py-2 bg-green-100 text-green-700 text-sm font-medium rounded-lg hover:bg-green-200 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                {isExpanded ? 'Hide Analysis' : 'View Analysis'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Analysis Summary (when available and expanded) */}
      {analysis && isExpanded && (
        <div className="p-4 space-y-4">
          {/* Summary */}
          {analysis.summary && (
            <div className="bg-blue-50 rounded-lg p-3">
              <h4 className="font-medium text-blue-900 mb-1">Summary</h4>
              <p className="text-sm text-blue-800">{analysis.summary}</p>
            </div>
          )}

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-900">{themes.length}</div>
              <div className="text-xs text-gray-600">Themes</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-orange-600">{highPriorityCount}</div>
              <div className="text-xs text-gray-600">High Priority</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-purple-600">{actionItems.length}</div>
              <div className="text-xs text-gray-600">Actions</div>
            </div>
          </div>

          {/* Themes */}
          {themes.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Themes</h4>
              <div className="flex flex-wrap gap-2">
                {themes.slice(0, 5).map((theme, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm"
                  >
                    {theme.theme} ({theme.count})
                  </span>
                ))}
                {themes.length > 5 && (
                  <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">
                    +{themes.length - 5} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Patterns */}
          {patterns.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Patterns</h4>
              <div className="space-y-2">
                {patterns.slice(0, 3).map((pattern, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        pattern.trend === 'increasing'
                          ? 'bg-red-100 text-red-800'
                          : pattern.trend === 'new'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {pattern.trend}
                    </span>
                    <span className="text-gray-700">{pattern.pattern}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Items */}
          {actionItems.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Action Items</h4>
              <div className="space-y-2">
                {actionItems.slice(0, 3).map((action, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-sm">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${
                        action.urgency === 'high'
                          ? 'bg-red-100 text-red-800'
                          : action.urgency === 'medium'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {action.urgency}
                    </span>
                    <span className="text-gray-700">{action.action}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* View Full Details Button */}
          {onViewDetails && (
            <button
              onClick={() => onViewDetails(date)}
              className="w-full py-2 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
            >
              View Full Analysis →
            </button>
          )}
        </div>
      )}
    </div>
  )
}
