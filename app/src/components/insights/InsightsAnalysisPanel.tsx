'use client'

import {
  DailyInsightsAnalysis,
  InsightTheme,
  InsightPattern,
  InsightPriority,
  CrossSourceConnection,
  ActionItem,
} from '@/types/database'

interface InsightsAnalysisPanelProps {
  analysis: DailyInsightsAnalysis
  onClose?: () => void
}

const sourceIcons: Record<string, string> = {
  slack: '💬',
  notion: '📝',
  mixpanel: '📊',
  airtable: '📋',
}

export default function InsightsAnalysisPanel({ analysis, onClose }: InsightsAnalysisPanelProps) {
  const themes = (analysis.themes || []) as unknown as InsightTheme[]
  const patterns = (analysis.patterns || []) as unknown as InsightPattern[]
  const priorities = (analysis.priorities || []) as unknown as InsightPriority[]
  const crossSourceConnections = (analysis.cross_source_connections || []) as unknown as CrossSourceConnection[]
  const actionItems = (analysis.action_items || []) as unknown as ActionItem[]

  const formattedDate = new Date(analysis.analysis_date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Daily Insights Analysis</h2>
            <p className="text-blue-100 text-sm mt-1">{formattedDate}</p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mt-4">
          <div className="bg-white/10 rounded-lg px-3 py-2 text-center">
            <div className="text-2xl font-bold">{analysis.insight_count}</div>
            <div className="text-xs text-blue-100">Insights</div>
          </div>
          <div className="bg-white/10 rounded-lg px-3 py-2 text-center">
            <div className="text-2xl font-bold">{themes.length}</div>
            <div className="text-xs text-blue-100">Themes</div>
          </div>
          <div className="bg-white/10 rounded-lg px-3 py-2 text-center">
            <div className="text-2xl font-bold">
              {priorities.filter((p) => p.priority_score >= 7).length}
            </div>
            <div className="text-xs text-blue-100">High Priority</div>
          </div>
          <div className="bg-white/10 rounded-lg px-3 py-2 text-center">
            <div className="text-2xl font-bold">{actionItems.length}</div>
            <div className="text-xs text-blue-100">Actions</div>
          </div>
        </div>

        {/* Sources */}
        <div className="flex items-center gap-2 mt-4">
          <span className="text-sm text-blue-100">Sources:</span>
          {analysis.sources_included.map((source) => (
            <span
              key={source}
              className="px-2 py-1 bg-white/10 rounded text-sm flex items-center gap-1"
            >
              {sourceIcons[source] || '📌'} {source}
            </span>
          ))}
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Summary */}
        {analysis.summary && (
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                📋
              </span>
              Summary
            </h3>
            <p className="text-gray-700 bg-blue-50 rounded-lg p-4">{analysis.summary}</p>
          </section>
        )}

        {/* Themes */}
        {themes.length > 0 && (
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600">
                🏷️
              </span>
              Themes
            </h3>
            <div className="space-y-3">
              {themes.map((theme, idx) => (
                <div key={idx} className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900">{theme.theme}</h4>
                    <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-sm">
                      {theme.count} mentions
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-gray-500">Sources:</span>
                    {theme.sources.map((source) => (
                      <span key={source} className="text-sm">
                        {sourceIcons[source] || source}
                      </span>
                    ))}
                  </div>
                  {theme.examples.length > 0 && (
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Examples:</span>
                      <ul className="list-disc list-inside mt-1">
                        {theme.examples.slice(0, 3).map((example, i) => (
                          <li key={i} className="text-gray-600">
                            {example}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Patterns */}
        {patterns.length > 0 && (
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center text-orange-600">
                📈
              </span>
              Patterns & Trends
            </h3>
            <div className="space-y-3">
              {patterns.map((pattern, idx) => (
                <div key={idx} className="bg-gray-50 rounded-lg p-4 flex items-start gap-3">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium flex-shrink-0 ${
                      pattern.trend === 'increasing'
                        ? 'bg-red-100 text-red-800'
                        : pattern.trend === 'new'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-200 text-gray-800'
                    }`}
                  >
                    {pattern.trend === 'increasing' && '↑ '}
                    {pattern.trend === 'new' && '✨ '}
                    {pattern.trend}
                  </span>
                  <div>
                    <p className="text-gray-900">{pattern.pattern}</p>
                    {pattern.related_themes.length > 0 && (
                      <div className="flex items-center gap-1 mt-2">
                        <span className="text-xs text-gray-500">Related themes:</span>
                        {pattern.related_themes.map((theme, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs"
                          >
                            {theme}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Priority Insights */}
        {priorities.length > 0 && (
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center text-red-600">
                🎯
              </span>
              Priority Insights
            </h3>
            <div className="space-y-3">
              {priorities
                .sort((a, b) => b.priority_score - a.priority_score)
                .map((priority, idx) => (
                  <div key={idx} className="bg-gray-50 rounded-lg p-4 flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0 ${
                        priority.priority_score >= 8
                          ? 'bg-red-500'
                          : priority.priority_score >= 6
                          ? 'bg-orange-500'
                          : priority.priority_score >= 4
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
                      }`}
                    >
                      {priority.priority_score}
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">{priority.title}</h4>
                      <p className="text-sm text-gray-600 mt-1">{priority.reason}</p>
                    </div>
                  </div>
                ))}
            </div>
          </section>
        )}

        {/* Cross-Source Connections */}
        {crossSourceConnections.length > 0 && (
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center text-green-600">
                🔗
              </span>
              Cross-Source Connections
            </h3>
            <div className="space-y-3">
              {crossSourceConnections.map((connection, idx) => (
                <div key={idx} className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    {connection.sources.map((source, i) => (
                      <span key={i} className="flex items-center">
                        {i > 0 && <span className="mx-1 text-gray-400">↔</span>}
                        <span className="px-2 py-1 bg-white rounded text-sm flex items-center gap-1 border">
                          {sourceIcons[source]} {source}
                        </span>
                      </span>
                    ))}
                  </div>
                  <p className="text-gray-700">{connection.connection}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Action Items */}
        {actionItems.length > 0 && (
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600">
                ✅
              </span>
              Recommended Actions
            </h3>
            <div className="space-y-3">
              {actionItems.map((action, idx) => (
                <div
                  key={idx}
                  className={`rounded-lg p-4 flex items-start gap-3 ${
                    action.urgency === 'high'
                      ? 'bg-red-50 border-l-4 border-red-500'
                      : action.urgency === 'medium'
                      ? 'bg-yellow-50 border-l-4 border-yellow-500'
                      : 'bg-green-50 border-l-4 border-green-500'
                  }`}
                >
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium flex-shrink-0 ${
                      action.urgency === 'high'
                        ? 'bg-red-100 text-red-800'
                        : action.urgency === 'medium'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-green-100 text-green-800'
                    }`}
                  >
                    {action.urgency}
                  </span>
                  <p className="text-gray-900">{action.action}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
