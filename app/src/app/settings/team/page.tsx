'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { WorkspaceInvite, WorkspaceRole } from '@/types/database'

interface Member {
  id: string
  user_id: string
  role: WorkspaceRole
  joined_at: string
  profiles: {
    full_name: string | null
    email: string
  }
}

interface Workspace {
  id: string
  name: string
}

export default function TeamSettingsPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [invites, setInvites] = useState<WorkspaceInvite[]>([])
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [currentUserRole, setCurrentUserRole] = useState<WorkspaceRole>('member')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  // New invite form
  const [newInviteRole, setNewInviteRole] = useState<'admin' | 'member'>('member')
  const [newInviteMaxUses, setNewInviteMaxUses] = useState<string>('')
  const [newInviteExpiry, setNewInviteExpiry] = useState<string>('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [membersRes, invitesRes] = await Promise.all([
        fetch('/api/workspace/members'),
        fetch('/api/workspace/invites'),
      ])

      if (membersRes.ok) {
        const data = await membersRes.json()
        console.log('Members API response:', data)
        setMembers(data.members || [])
        setWorkspace(data.workspace)
        setCurrentUserId(data.currentUserId)
        setCurrentUserRole(data.currentUserRole || 'member')
      } else {
        const errorData = await membersRes.json()
        console.error('Members API error:', membersRes.status, errorData)
        // Show error to user
        alert(`Error: ${errorData.error || 'Failed to load team data'} (Status: ${membersRes.status})`)
      }

      if (invitesRes.ok) {
        const data = await invitesRes.json()
        console.log('Invites API response:', data)
        setInvites(data.invites || [])
      } else {
        // Invites API might fail if table doesn't exist yet
        console.log('Invites API not available (run Phase 3 migration)')
      }
    } catch (error) {
      console.error('Failed to fetch team data:', error)
    } finally {
      setLoading(false)
    }
  }

  const createInvite = async () => {
    setCreating(true)
    try {
      const body: Record<string, unknown> = { role: newInviteRole }

      if (newInviteMaxUses) {
        body.max_uses = parseInt(newInviteMaxUses)
      }

      if (newInviteExpiry) {
        body.expires_at = new Date(newInviteExpiry).toISOString()
      }

      const response = await fetch('/api/workspace/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (response.ok) {
        const data = await response.json()
        setInvites([data.invite, ...invites])
        // Reset form
        setNewInviteRole('member')
        setNewInviteMaxUses('')
        setNewInviteExpiry('')
      }
    } catch (error) {
      console.error('Failed to create invite:', error)
    } finally {
      setCreating(false)
    }
  }

  const deactivateInvite = async (inviteId: string) => {
    try {
      const response = await fetch(`/api/workspace/invites?id=${inviteId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setInvites(invites.filter(inv => inv.id !== inviteId))
      }
    } catch (error) {
      console.error('Failed to deactivate invite:', error)
    }
  }

  const removeMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) return

    try {
      const response = await fetch(`/api/workspace/members?id=${memberId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setMembers(members.filter(m => m.id !== memberId))
      }
    } catch (error) {
      console.error('Failed to remove member:', error)
    }
  }

  const updateMemberRole = async (memberId: string, newRole: 'admin' | 'member') => {
    try {
      const response = await fetch('/api/workspace/members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, role: newRole }),
      })

      if (response.ok) {
        setMembers(members.map(m =>
          m.id === memberId ? { ...m, role: newRole } : m
        ))
      }
    } catch (error) {
      console.error('Failed to update member role:', error)
    }
  }

  const copyInviteLink = (code: string) => {
    const link = `${window.location.origin}/join/${code}`
    navigator.clipboard.writeText(link)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const canManageMembers = currentUserRole === 'owner' || currentUserRole === 'admin'
  const canCreateInvites = currentUserRole === 'owner' || currentUserRole === 'admin'
  const canChangeRoles = currentUserRole === 'owner'

  const getRoleBadgeColor = (role: WorkspaceRole) => {
    switch (role) {
      case 'owner': return 'bg-purple-100 text-purple-800'
      case 'admin': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading team settings...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
                ← Back
              </Link>
              <h1 className="text-xl font-bold">Team Settings</h1>
            </div>
            {workspace && (
              <Badge variant="outline" className="text-sm">
                {workspace.name}
              </Badge>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Invite Links */}
        <Card>
          <CardHeader>
            <CardTitle>Invite Team Members</CardTitle>
            <CardDescription>
              {canCreateInvites
                ? 'Create invite links to share with your team. Anyone with the link can join your workspace.'
                : 'Only owners and admins can create invite links.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {canCreateInvites ? (
              <>
                {/* Create new invite form */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                  <h4 className="font-medium">Create New Invite Link</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="invite-role">Role</Label>
                      <select
                        id="invite-role"
                        className="w-full border rounded-md px-3 py-2 text-sm"
                        value={newInviteRole}
                        onChange={(e) => setNewInviteRole(e.target.value as 'admin' | 'member')}
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="invite-uses">Max Uses (optional)</Label>
                      <Input
                        id="invite-uses"
                        type="number"
                        min="1"
                        placeholder="Unlimited"
                        value={newInviteMaxUses}
                        onChange={(e) => setNewInviteMaxUses(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="invite-expiry">Expires (optional)</Label>
                      <Input
                        id="invite-expiry"
                        type="date"
                        value={newInviteExpiry}
                        onChange={(e) => setNewInviteExpiry(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button onClick={createInvite} disabled={creating}>
                    {creating ? 'Creating...' : 'Create Invite Link'}
                  </Button>
                </div>

                {/* Active invites */}
                {invites.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm text-gray-600">Active Invite Links</h4>
                    {invites.map((invite) => (
                      <div
                        key={invite.id}
                        className="flex items-center justify-between p-3 bg-white border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                            {invite.invite_code}
                          </code>
                          <Badge className={getRoleBadgeColor(invite.role as WorkspaceRole)}>
                            {invite.role}
                          </Badge>
                          <span className="text-sm text-gray-500">
                            {invite.use_count} / {invite.max_uses || '∞'} uses
                          </span>
                          {invite.expires_at && (
                            <span className="text-sm text-gray-500">
                              Expires: {new Date(invite.expires_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyInviteLink(invite.invite_code)}
                          >
                            {copiedCode === invite.invite_code ? 'Copied!' : 'Copy Link'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => deactivateInvite(invite.id)}
                          >
                            Deactivate
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {invites.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No active invite links. Create one above to invite team members.
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">
                Contact your workspace owner or admin to get an invite link.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Team Members */}
        <Card>
          <CardHeader>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>
              {members.length} member{members.length !== 1 ? 's' : ''} in this workspace
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {members.map((member) => {
                const isCurrentUser = member.user_id === currentUserId
                const canRemove = canManageMembers && !isCurrentUser && member.role !== 'owner'
                const canEditRole = canChangeRoles && !isCurrentUser && member.role !== 'owner'

                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center text-white font-medium">
                        {(member.profiles?.full_name || member.profiles?.email || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {member.profiles?.full_name || member.profiles?.email}
                          </span>
                          {isCurrentUser && (
                            <span className="text-xs text-gray-500">(you)</span>
                          )}
                        </div>
                        <span className="text-sm text-gray-500">{member.profiles?.email}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {canEditRole ? (
                        <select
                          className="border rounded-md px-2 py-1 text-sm"
                          value={member.role}
                          onChange={(e) => updateMemberRole(member.id, e.target.value as 'admin' | 'member')}
                        >
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                        </select>
                      ) : (
                        <Badge className={getRoleBadgeColor(member.role)}>
                          {member.role}
                        </Badge>
                      )}
                      {canRemove && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => removeMember(member.id)}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Role Permissions */}
        <Card>
          <CardHeader>
            <CardTitle>Role Permissions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <Badge className={getRoleBadgeColor('owner')}>Owner</Badge>
                <p className="text-gray-600">
                  Full access. Can manage all members, change roles, create/delete invites, and delete the workspace.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <Badge className={getRoleBadgeColor('admin')}>Admin</Badge>
                <p className="text-gray-600">
                  Can invite new members, remove members (except admins/owner), and manage workspace settings.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <Badge className={getRoleBadgeColor('member')}>Member</Badge>
                <p className="text-gray-600">
                  Can create and manage sessions, add evidence, and view all workspace content.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
