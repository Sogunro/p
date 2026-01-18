'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import type { EvidenceBank, SourceSystem, EvidenceStrength } from '@/types/database'

const SOURCE_ICONS: Record<SourceSystem, string> = {
  manual: '✏️',
  slack: '💬',
  notion: '📝',
  mixpanel: '📊',
  airtable: '📋',
}

const STRENGTH_COLORS: Record<EvidenceStrength, string> = {
  high: 'bg-green-100 text-green-800 border-green-300',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  low: 'bg-red-100 text-red-800 border-red-300',
}

export default function EvidenceBankPage() {
  const router = useRouter()
  const [evidence, setEvidence] = useState<EvidenceBank[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterSource, setFilterSource] = useState<SourceSystem | 'all'>('all')
  const [filterStrength, setFilterStrength] = useState<EvidenceStrength | 'all'>('all')

  // Add form state
  const [addType, setAddType] = useState<'url' | 'text'>('url')
  const [addTitle, setAddTitle] = useState('')
  const [addUrl, setAddUrl] = useState('')
  const [addContent, setAddContent] = useState('')
  const [addStrength, setAddStrength] = useState<EvidenceStrength>('medium')
  const [addLoading, setAddLoading] = useState(false)

  useEffect(() => {
    fetchEvidence()
  }, [])

  const fetchEvidence = async () => {
    try {
      const response = await fetch('/api/evidence-bank')
      if (response.ok) {
        const data = await response.json()
        setEvidence(data.evidence || [])
      }
    } catch (error) {
      console.error('Failed to fetch evidence:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddEvidence = async () => {
    if (!addTitle) return

    setAddLoading(true)
    try {
      const response = await fetch('/api/evidence-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: addTitle,
          type: addType,
          url: addType === 'url' ? addUrl : undefined,
          content: addType === 'text' ? addContent : undefined,
          strength: addStrength,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setEvidence([data.evidence, ...evidence])
        setShowAddDialog(false)
        resetAddForm()
      }
    } catch (error) {
      console.error('Failed to add evidence:', error)
    } finally {
      setAddLoading(false)
    }
  }

  const handleDeleteEvidence = async (id: string) => {
    try {
      const response = await fetch(`/api/evidence-bank?id=${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setEvidence(evidence.filter(e => e.id !== id))
      }
    } catch (error) {
      console.error('Failed to delete evidence:', error)
    }
  }

  const resetAddForm = () => {
    setAddType('url')
    setAddTitle('')
    setAddUrl('')
    setAddContent('')
    setAddStrength('medium')
  }

  const filteredEvidence = evidence.filter(e => {
    const matchesSearch = e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.content?.toLowerCase().includes(searchQuery.toLowerCase()))
    const matchesSource = filterSource === 'all' || e.source_system === filterSource
    const matchesStrength = filterStrength === 'all' || e.strength === filterStrength
    return matchesSearch && matchesSource && matchesStrength
  })

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading evidence bank...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
                ← Back
              </Link>
              <h1 className="text-xl font-bold">Evidence Bank</h1>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/insights">
                <Button variant="outline">View Insights Feed</Button>
              </Link>
              <Button onClick={() => setShowAddDialog(true)}>+ Add Evidence</Button>
            </div>
          </div>
        </div>
      </header>

      {/* Source Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1 overflow-x-auto">
            {[
              { value: 'all', label: 'All', icon: '📚' },
              { value: 'manual', label: 'Manual', icon: '✏️' },
              { value: 'slack', label: 'Slack', icon: '💬' },
              { value: 'notion', label: 'Notion', icon: '📝' },
              { value: 'mixpanel', label: 'Mixpanel', icon: '📊' },
              { value: 'airtable', label: 'Airtable', icon: '📋' },
            ].map((tab) => {
              const count = tab.value === 'all'
                ? evidence.length
                : evidence.filter(e => e.source_system === tab.value).length
              return (
                <button
                  key={tab.value}
                  onClick={() => setFilterSource(tab.value as SourceSystem | 'all')}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
                    filterSource === tab.value
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                  {count > 0 && (
                    <span className={`px-1.5 py-0.5 rounded text-xs ${
                      filterSource === tab.value
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="Search evidence..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select
            className="border rounded-md px-3 py-2 text-sm"
            value={filterStrength}
            onChange={(e) => setFilterStrength(e.target.value as EvidenceStrength | 'all')}
          >
            <option value="all">All Strengths</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4">
              <p className="text-2xl font-bold">{evidence.length}</p>
              <p className="text-sm text-gray-500">Total Evidence</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-2xl font-bold text-green-600">
                {evidence.filter(e => e.strength === 'high').length}
              </p>
              <p className="text-sm text-gray-500">High Strength</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-2xl font-bold text-yellow-600">
                {evidence.filter(e => e.strength === 'medium').length}
              </p>
              <p className="text-sm text-gray-500">Medium Strength</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-2xl font-bold text-red-600">
                {evidence.filter(e => e.strength === 'low').length}
              </p>
              <p className="text-sm text-gray-500">Low Strength</p>
            </CardContent>
          </Card>
        </div>

        {/* Evidence List */}
        {filteredEvidence.length > 0 ? (
          <div className="grid gap-4">
            {filteredEvidence.map((item) => (
              <Card key={item.id} className="hover:shadow-md transition-shadow">
                <CardContent className="py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">{SOURCE_ICONS[item.source_system]}</span>
                        <h3 className="font-medium">{item.title}</h3>
                        <Badge className={STRENGTH_COLORS[item.strength]}>
                          {item.strength}
                        </Badge>
                      </div>
                      {item.content && (
                        <p className="text-sm text-gray-600 mb-2 line-clamp-2">{item.content}</p>
                      )}
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline"
                        >
                          {item.url}
                        </a>
                      )}
                      <p className="text-xs text-gray-400 mt-2">
                        Added {formatDate(item.created_at)} via {item.source_system}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleDeleteEvidence(item.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="text-center py-12">
            <CardContent>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No evidence found</h3>
              <p className="text-gray-500 mb-4">
                {searchQuery || filterSource !== 'all' || filterStrength !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Start building your evidence bank by adding evidence manually or connecting your tools.'}
              </p>
              <Button onClick={() => setShowAddDialog(true)}>+ Add Evidence</Button>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Add Evidence Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Evidence</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                placeholder="Brief description of this evidence"
                value={addTitle}
                onChange={(e) => setAddTitle(e.target.value)}
              />
            </div>

            <Tabs value={addType} onValueChange={(v) => setAddType(v as 'url' | 'text')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="url">URL</TabsTrigger>
                <TabsTrigger value="text">Text</TabsTrigger>
              </TabsList>
              <TabsContent value="url" className="space-y-2">
                <Label>URL</Label>
                <Input
                  placeholder="https://..."
                  value={addUrl}
                  onChange={(e) => setAddUrl(e.target.value)}
                />
              </TabsContent>
              <TabsContent value="text" className="space-y-2">
                <Label>Content</Label>
                <Textarea
                  placeholder="Paste evidence text here..."
                  value={addContent}
                  onChange={(e) => setAddContent(e.target.value)}
                  rows={4}
                />
              </TabsContent>
            </Tabs>

            <div className="space-y-2">
              <Label>Evidence Strength</Label>
              <div className="flex gap-2">
                {(['high', 'medium', 'low'] as const).map((strength) => (
                  <Button
                    key={strength}
                    type="button"
                    variant={addStrength === strength ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setAddStrength(strength)}
                    className={addStrength === strength ? '' : STRENGTH_COLORS[strength]}
                  >
                    {strength.charAt(0).toUpperCase() + strength.slice(1)}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-gray-500">
                High: interviews, research, analytics | Medium: surveys, tickets | Low: anecdotal
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddEvidence} disabled={!addTitle || addLoading}>
              {addLoading ? 'Adding...' : 'Add Evidence'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
