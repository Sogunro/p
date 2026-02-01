'use client'

import { useState, useEffect } from 'react'
import { SidebarLayout } from '@/components/sidebar-layout'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import type { Constraint } from '@/types/database'

export default function ConstraintsSettingsPage() {
  const supabase = createClient()
  const [constraints, setConstraints] = useState<Constraint[]>([])
  const [loading, setLoading] = useState(true)
  const [editingConstraint, setEditingConstraint] = useState<Constraint | null>(null)
  const [isAddingNew, setIsAddingNew] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newType, setNewType] = useState('custom')
  const [editValue, setEditValue] = useState('')

  useEffect(() => {
    loadConstraints()
  }, [])

  const loadConstraints = async () => {
    const { data } = await supabase
      .from('constraints')
      .select('*')
      .order('is_system', { ascending: false })
      .order('type')

    if (data) setConstraints(data)
    setLoading(false)
  }

  const handleSaveConstraint = async () => {
    if (!editingConstraint) return

    await supabase
      .from('constraints')
      .update({ value: editValue })
      .eq('id', editingConstraint.id)

    setConstraints((prev) =>
      prev.map((c) =>
        c.id === editingConstraint.id ? { ...c, value: editValue } : c
      )
    )

    setEditingConstraint(null)
    setEditValue('')
  }

  const handleAddConstraint = async () => {
    if (!newLabel.trim()) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('constraints')
      .insert({
        user_id: user.id,
        type: newType,
        label: newLabel.trim(),
        is_system: false,
      })
      .select()
      .single()

    if (!error && data) {
      setConstraints((prev) => [...prev, data])
      setNewLabel('')
      setIsAddingNew(false)
    }
  }

  const handleDeleteConstraint = async (id: string) => {
    await supabase
      .from('constraints')
      .delete()
      .eq('id', id)

    setConstraints((prev) => prev.filter((c) => c.id !== id))
  }

  if (loading) {
    return (
      <SidebarLayout>
        <div className="flex items-center justify-center py-20">
          <p>Loading...</p>
        </div>
      </SidebarLayout>
    )
  }

  return (
    <SidebarLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold text-gray-900">Constraints</h1>
        <Button onClick={() => setIsAddingNew(true)}>+ Add Constraint</Button>
      </div>

        <div className="space-y-4">
          {constraints.map((constraint) => (
            <Card key={constraint.id}>
              <CardContent className="py-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-medium">{constraint.label}</h3>
                    {constraint.value ? (
                      <p className="text-gray-600 mt-1">{constraint.value}</p>
                    ) : (
                      <p className="text-gray-400 mt-1 italic">Not set</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingConstraint(constraint)
                        setEditValue(constraint.value || '')
                      }}
                    >
                      Edit
                    </Button>
                    {!constraint.is_system && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700"
                        onClick={() => handleDeleteConstraint(constraint.id)}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {constraints.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-gray-500">
                No constraints yet. Add some to keep your discovery sessions grounded.
              </CardContent>
            </Card>
          )}
        </div>

      {/* Edit Constraint Dialog */}
      <Dialog open={!!editingConstraint} onOpenChange={() => setEditingConstraint(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {editingConstraint?.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Value</Label>
              <Textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder="Enter the constraint value..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingConstraint(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveConstraint}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Constraint Dialog */}
      <Dialog open={isAddingNew} onOpenChange={setIsAddingNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Constraint</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Label</Label>
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g., Market Size, Team Capacity"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddingNew(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddConstraint} disabled={!newLabel.trim()}>
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarLayout>
  )
}
