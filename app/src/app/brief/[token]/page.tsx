import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default async function PublicBriefPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = await createClient()

  const { data: brief } = await supabase
    .from('discovery_briefs')
    .select('*')
    .eq('share_token', token)
    .eq('is_public', true)
    .single()

  if (!brief) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Brief Not Found</h2>
            <p className="text-gray-500">This brief may have been removed or the link has expired.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-lg font-bold text-gray-900">Discovery Brief</h1>
            <Badge variant="outline" className="text-xs">Shared</Badge>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{brief.title}</CardTitle>
            <div className="flex items-center gap-4 text-sm text-gray-500 mt-2">
              <span>{new Date(brief.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
              <span>{brief.evidence_count} evidence items</span>
              <span>{brief.decision_count} decisions</span>
            </div>
            {brief.key_themes && (brief.key_themes as string[]).length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {(brief.key_themes as string[]).map((theme: string, i: number) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {theme}
                  </Badge>
                ))}
              </div>
            )}
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none whitespace-pre-wrap text-gray-700">
              {brief.content}
            </div>
          </CardContent>
        </Card>

        <div className="text-center mt-8 text-xs text-gray-400">
          Generated with Product Discovery OS
        </div>
      </main>
    </div>
  )
}
