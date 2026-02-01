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

  // Fetch latest agent alerts (unread)
  const { data: agentAlerts } = await supabase
    .from('agent_alerts')
    .select('id, agent_type, alert_type, title, content, is_read, created_at')
    .eq('is_dismissed', false)
    .order('created_at', { ascending: false })
    .limit(5)

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
              <Link href="/decisions">
                <Button variant="ghost" size="sm">
                  Decisions
                </Button>
              </Link>
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
              <Link href="/discovery-brief">
                <Button variant="ghost" size="sm">
                  Briefs
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
              <Link href="/settings/pm-tools">
                <Button variant="ghost" size="sm">
                  PM Tools
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

        {/* Agent Activity */}
        {agentAlerts && agentAlerts.length > 0 && (
          <div className="mt-10">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Agent Activity</h2>
            <Card>
              <CardContent className="p-4">
                <div className="space-y-3">
                  {agentAlerts.map((alert) => {
                    const agentIcons: Record<string, string> = {
                      strength_calculator: '\uD83D\uDCAA',
                      contradiction_detector: '\u26A1',
                      segment_identifier: '\uD83C\uDFAF',
                      session_analyzer: '\uD83D\uDD2C',
                      brief_generator: '\uD83D\uDCCB',
                      decay_monitor: '\u23F0',
                      competitor_monitor: '\uD83D\uDCCA',
                      evidence_hunter: '\uD83D\uDD0D',
                      analysis_crew: '\uD83E\uDDE0',
                    }
                    const alertColors: Record<string, string> = {
                      info: 'bg-blue-50 border-blue-200',
                      warning: 'bg-yellow-50 border-yellow-200',
                      action_needed: 'bg-red-50 border-red-200',
                    }
                    return (
                      <div
                        key={alert.id}
                        className={`p-3 rounded-lg border ${alertColors[alert.alert_type] || 'bg-gray-50 border-gray-200'} ${
                          !alert.is_read ? 'ring-1 ring-blue-300' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">{agentIcons[alert.agent_type] || '\uD83E\uDD16'}</span>
                          <span className="text-sm font-medium text-gray-900 flex-1 truncate">
                            {alert.title}
                          </span>
                          <span className="text-xs text-gray-400 shrink-0">
                            {formatDate(alert.created_at)}
                          </span>
                          {!alert.is_read && (
                            <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                          )}
                        </div>
                        {alert.content && (
                          <p className="text-xs text-gray-600 line-clamp-2 ml-7">
                            {alert.content.slice(0, 150)}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  )
}
