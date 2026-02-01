'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SidebarLayout } from '@/components/sidebar-layout'
import type { DiscoveryBrief } from '@/types/database'

export default function DiscoveryBriefPage() {
  const [briefs, setBriefs] = useState<DiscoveryBrief[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [shareLoading, setShareLoading] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    fetchBriefs()
  }, [])

  async function fetchBriefs() {
    try {
      const res = await fetch('/api/discovery-brief')
      if (res.ok) {
        const data = await res.json()
        setBriefs(data.briefs || [])
      }
    } catch (error) {
      console.error('Failed to fetch briefs:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerate() {
    setGenerating(true)
    try {
      const res = await fetch('/api/discovery-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (res.ok) {
        const data = await res.json()
        setBriefs(prev => [data.brief, ...prev])
      }
    } catch (error) {
      console.error('Failed to generate brief:', error)
    } finally {
      setGenerating(false)
    }
  }

  async function handleShare(briefId: string) {
    setShareLoading(briefId)
    try {
      const res = await fetch(`/api/discovery-brief/${briefId}/share`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        const fullUrl = `${window.location.origin}${data.share_url}`
        await navigator.clipboard.writeText(fullUrl)
        setCopiedId(briefId)
        setTimeout(() => setCopiedId(null), 2000)
        // Update brief in list
        setBriefs(prev => prev.map(b =>
          b.id === briefId ? { ...b, share_token: data.share_token, is_public: true } : b
        ))
      }
    } catch (error) {
      console.error('Failed to share brief:', error)
    } finally {
      setShareLoading(null)
    }
  }

  async function handleRevokeShare(briefId: string) {
    try {
      const res = await fetch(`/api/discovery-brief/${briefId}/share`, { method: 'DELETE' })
      if (res.ok) {
        setBriefs(prev => prev.map(b =>
          b.id === briefId ? { ...b, share_token: null, is_public: false } : b
        ))
      }
    } catch (error) {
      console.error('Failed to revoke share:', error)
    }
  }

  async function handleDelete(briefId: string) {
    if (!confirm('Delete this brief? This cannot be undone.')) return
    try {
      const res = await fetch(`/api/discovery-brief/${briefId}`, { method: 'DELETE' })
      if (res.ok) {
        setBriefs(prev => prev.filter(b => b.id !== briefId))
      }
    } catch (error) {
      console.error('Failed to delete brief:', error)
    }
  }

  if (loading) {
    return (
      <SidebarLayout>
        <div className="flex items-center justify-center py-20">
          <p className="text-gray-500">Loading briefs...</p>
        </div>
      </SidebarLayout>
    )
  }

  return (
    <SidebarLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold text-gray-900">Discovery Briefs</h1>
        <Button onClick={handleGenerate} disabled={generating}>
          {generating ? 'Generating...' : '+ Generate Brief'}
        </Button>
      </div>

      <div>
        {briefs.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No briefs yet</h3>
              <p className="text-gray-500 mb-4">
                Generate a discovery brief to synthesize your workspace intelligence.
              </p>
              <Button onClick={handleGenerate} disabled={generating}>
                {generating ? 'Generating...' : 'Generate Your First Brief'}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {briefs.map((brief) => (
              <Card key={brief.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg pr-4 line-clamp-2">{brief.title}</CardTitle>
                    {brief.is_public && (
                      <Badge variant="outline" className="text-xs shrink-0">Shared</Badge>
                    )}
                  </div>
                  <CardDescription>
                    {new Date(brief.created_at).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                    <span>{brief.evidence_count} evidence</span>
                    <span>{brief.decision_count} decisions</span>
                  </div>

                  {brief.key_themes && (brief.key_themes as string[]).length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {(brief.key_themes as string[]).slice(0, 3).map((theme: string, i: number) => (
                        <Badge key={i} variant="secondary" className="text-[10px]">
                          {theme}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <p className="text-sm text-gray-600 line-clamp-3 mb-4">
                    {brief.content.slice(0, 200)}...
                  </p>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleShare(brief.id)}
                      disabled={shareLoading === brief.id}
                    >
                      {copiedId === brief.id
                        ? 'Link Copied!'
                        : shareLoading === brief.id
                          ? 'Sharing...'
                          : brief.is_public
                            ? 'Copy Link'
                            : 'Share'}
                    </Button>
                    {brief.is_public && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevokeShare(brief.id)}
                        className="text-gray-400 hover:text-red-500"
                      >
                        Revoke
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(brief.id)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </SidebarLayout>
  )
}
