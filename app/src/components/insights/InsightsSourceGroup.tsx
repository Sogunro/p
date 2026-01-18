'use client'

import { useState } from 'react'
import { InsightsFeed, SourceSystem } from '@/types/database'

interface InsightsSourceGroupProps {
  source: SourceSystem
  items: InsightsFeed[]
  onAddToBank: (id: string) => void
  onDismiss: (id: string) => void
}

const sourceConfig: Record<SourceSystem, { icon: string; label: string; color: string }> = {
  manual: { icon: '✏️', label: 'Manual', color: 'bg-gray-100 text-gray-800' },
  slack: { icon: '💬', label: 'Slack', color: 'bg-purple-100 text-purple-800' },
  notion: { icon: '📝', label: 'Notion', color: 'bg-gray-800 text-white' },
  mixpanel: { icon: '📊', label: 'Mixpanel', color: 'bg-indigo-100 text-indigo-800' },
  airtable: { icon: '📋', label: 'Airtable', color: 'bg-teal-100 text-teal-800' },
}

const strengthColors: Record<string, string> = {
  high: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-red-100 text-red-800',
}

export default function InsightsSourceGroup({
  source,
  items,
  onAddToBank,
  onDismiss,
}: InsightsSourceGroupProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const config = sourceConfig[source]

  if (items.length === 0) {
    return null
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">{config.icon}</span>
          <span className="font-medium text-gray-900">{config.label}</span>
          <span className={`px-2 py-0.5 rounded-full text-sm font-medium ${config.color}`}>
            {items.length}
          </span>
        </div>
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Items */}
      {isExpanded && (
        <div className="divide-y divide-gray-100">
          {items.map((item) => (
            <div key={item.id} className="p-4 hover:bg-gray-50">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${strengthColors[item.strength]}`}>
                      {item.strength}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(item.fetched_at).toLocaleDateString()}
                    </span>
                  </div>
                  <h4 className="font-medium text-gray-900 truncate">{item.title}</h4>
                  {item.content && (
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">{item.content}</p>
                  )}
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline mt-1 inline-block"
                    >
                      View source →
                    </a>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => onAddToBank(item.id)}
                    className="px-3 py-1.5 text-sm font-medium text-green-700 bg-green-100 rounded hover:bg-green-200 transition-colors"
                  >
                    Add to Bank
                  </button>
                  <button
                    onClick={() => onDismiss(item.id)}
                    className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
