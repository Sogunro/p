'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface InviteDetails {
  workspace_name: string
  role: string
  expires_at: string | null
}

export default function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)
  const router = useRouter()
  const [invite, setInvite] = useState<InviteDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    validateInvite()
  }, [code])

  const validateInvite = async () => {
    try {
      const response = await fetch(`/api/workspace/join?code=${code}`)
      const data = await response.json()

      if (response.ok) {
        setInvite(data)
      } else {
        setError(data.error || 'Invalid or expired invite link')
      }
    } catch (err) {
      setError('Failed to validate invite link')
    } finally {
      setLoading(false)
    }
  }

  const handleJoin = async () => {
    setJoining(true)
    setError(null)

    try {
      const response = await fetch('/api/workspace/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess(true)
        // Redirect to dashboard after short delay
        setTimeout(() => {
          router.push('/dashboard')
        }, 2000)
      } else {
        if (response.status === 401) {
          // Not logged in, redirect to login with return URL
          router.push(`/login?redirect=/join/${code}`)
        } else {
          setError(data.error || 'Failed to join workspace')
        }
      }
    } catch (err) {
      setError('Failed to join workspace')
    } finally {
      setJoining(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Validating invite...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        {success ? (
          <>
            <CardHeader className="text-center">
              <div className="text-5xl mb-4">🎉</div>
              <CardTitle className="text-green-600">Welcome to the team!</CardTitle>
              <CardDescription>
                You&apos;ve successfully joined {invite?.workspace_name}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-sm text-gray-500 mb-4">Redirecting to dashboard...</p>
              <Link href="/dashboard">
                <Button variant="outline">Go to Dashboard</Button>
              </Link>
            </CardContent>
          </>
        ) : error ? (
          <>
            <CardHeader className="text-center">
              <div className="text-5xl mb-4">😕</div>
              <CardTitle className="text-red-600">Invalid Invite</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-sm text-gray-500">
                This invite link may have expired, reached its usage limit, or been deactivated.
              </p>
              <div className="flex gap-2 justify-center">
                <Link href="/login">
                  <Button variant="outline">Login</Button>
                </Link>
                <Link href="/signup">
                  <Button>Sign Up</Button>
                </Link>
              </div>
            </CardContent>
          </>
        ) : invite ? (
          <>
            <CardHeader className="text-center">
              <div className="text-5xl mb-4">👋</div>
              <CardTitle>You&apos;re invited!</CardTitle>
              <CardDescription>
                Join <strong>{invite.workspace_name}</strong> workspace
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-500 mb-2">You&apos;ll join as</p>
                <Badge className={invite.role === 'admin' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}>
                  {invite.role}
                </Badge>
              </div>

              {invite.expires_at && (
                <p className="text-xs text-center text-gray-500">
                  This invite expires on {new Date(invite.expires_at).toLocaleDateString()}
                </p>
              )}

              <Button
                className="w-full"
                size="lg"
                onClick={handleJoin}
                disabled={joining}
              >
                {joining ? 'Joining...' : 'Accept Invite'}
              </Button>

              <p className="text-xs text-center text-gray-500">
                Don&apos;t have an account?{' '}
                <Link href={`/signup?redirect=/join/${code}`} className="text-blue-600 hover:underline">
                  Sign up first
                </Link>
              </p>
            </CardContent>
          </>
        ) : null}
      </Card>
    </div>
  )
}
