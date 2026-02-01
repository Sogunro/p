import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DeleteSessionButton } from '@/components/delete-session-button'
import { DashboardClient } from './dashboard-client'

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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )
      case 'active':
        return (
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
        )
      default:
        return (
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
        )
    }
  }

  const formatRelativeDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Updated today'
    if (diffDays === 1) return 'Updated yesterday'
    if (diffDays < 7) return `Updated ${diffDays} days ago`
    if (diffDays < 30) return `Updated ${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`
    return `Updated ${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) > 1 ? 's' : ''} ago`
  }

  const userName = profile?.full_name || user.email || 'User'

  return (
    <DashboardClient userName={userName}>
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-semibold text-gray-900">Your Discovery Sessions</h2>
          <Link href="/session/new">
            <Button className="bg-blue-600 hover:bg-blue-700">+ New Session</Button>
          </Link>
        </div>

        {sessions && sessions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {sessions.map((session) => (
              <div key={session.id} className="relative group">
                <Link href={`/session/${session.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer h-full border-gray-200">
                    <CardHeader className="pb-3">
                      <div className="flex items-start gap-3">
                        {getStatusIcon(session.status)}
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                            <CardTitle className="text-base pr-2 leading-tight">{session.title}</CardTitle>
                            <Badge className={`${getStatusColor(session.status)} shrink-0 capitalize text-xs`}>
                              {session.status}
                            </Badge>
                          </div>
                          <CardDescription className="mt-1">
                            {session.templates?.name || 'Full Discovery Session'}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center gap-1.5 text-xs text-gray-400">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {formatRelativeDate(session.updated_at)}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <DeleteSessionButton
                    sessionId={session.id}
                    sessionTitle={session.title}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Card className="text-center py-12 border-gray-200">
            <CardContent>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No sessions yet</h3>
              <p className="text-gray-500 mb-4">
                Start your first discovery session to explore problems and solutions.
              </p>
              <Link href="/session/new">
                <Button className="bg-blue-600 hover:bg-blue-700">Create Your First Session</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Agent Activity */}
        {agentAlerts && agentAlerts.length > 0 && (
          <div className="mt-10">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Agent Activity</h2>
            <Card className="border-gray-200">
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
                            {new Date(alert.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
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
      </div>
    </DashboardClient>
  )
}
