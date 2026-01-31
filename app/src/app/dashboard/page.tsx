import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LogoutButton } from '@/components/logout-button'
import { DeleteSessionButton } from '@/components/delete-session-button'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: sessions } = await supabase
    .from('sessions')
    .select(`
      *,
      templates (name)
    `)
    .order('updated_at', { ascending: false })

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800'
      case 'active':
        return 'bg-blue-100 text-blue-800'
      case 'completed':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-bold text-gray-900">Product Discovery</h1>
            <div className="flex items-center gap-4">
              <Link href="/evidence-bank">
                <Button variant="ghost" size="sm">
                  Evidence Bank
                </Button>
              </Link>
              <Link href="/insights">
                <Button variant="ghost" size="sm">
                  Insights
                </Button>
              </Link>
              <Link href="/settings/team">
                <Button variant="ghost" size="sm">
                  Team
                </Button>
              </Link>
              <Link href="/settings/evidence-weights">
                <Button variant="ghost" size="sm">
                  Weights
                </Button>
              </Link>
              <Link href="/settings/constraints">
                <Button variant="ghost" size="sm">
                  Settings
                </Button>
              </Link>
              <span className="text-sm text-gray-600">
                {profile?.full_name || user.email}
              </span>
              <LogoutButton />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-semibold text-gray-900">Your Discovery Sessions</h2>
          <Link href="/session/new">
            <Button>+ New Session</Button>
          </Link>
        </div>

        {sessions && sessions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sessions.map((session) => (
              <div key={session.id} className="relative group">
                <Link href={`/session/${session.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-lg pr-8">{session.title}</CardTitle>
                        <Badge className={getStatusColor(session.status)}>
                          {session.status}
                        </Badge>
                      </div>
                      <CardDescription>
                        {session.templates?.name || 'Blank Canvas'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-500">
                        Updated {formatDate(session.updated_at)}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <DeleteSessionButton
                    sessionId={session.id}
                    sessionTitle={session.title}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Card className="text-center py-12">
            <CardContent>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No sessions yet</h3>
              <p className="text-gray-500 mb-4">
                Start your first discovery session to explore problems and solutions.
              </p>
              <Link href="/session/new">
                <Button>Create Your First Session</Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
