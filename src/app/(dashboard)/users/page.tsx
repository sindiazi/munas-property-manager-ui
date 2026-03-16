'use client'
import { useEffect, useState } from 'react'
import { Plus, UserCog, Shield } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { TableLoadingState } from '@/components/shared/LoadingState'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { usersApi } from '@/lib/api/users.api'
import type { CreateUserCommand, UpdateUserCommand } from '@/lib/api/users.api'
import { useAuthStore } from '@/store'
import { useEventLogger } from '@/hooks/useEventLogger'
import { toast } from 'sonner'
import type { User, UserRole } from '@/types'
import { format } from 'date-fns'

const ROLES: UserRole[] = ['ADMIN', 'PROPERTY_MANAGER', 'READ_ONLY']

const roleBadgeStyles: Record<UserRole, string> = {
  ADMIN: 'bg-purple-100 text-purple-700 border-transparent',
  PROPERTY_MANAGER: 'bg-blue-100 text-blue-700 border-transparent',
  READ_ONLY: 'bg-zinc-100 text-zinc-600 border-transparent',
}

const emptyCreateForm: CreateUserCommand = {
  username: '',
  email: '',
  password: '',
  role: 'READ_ONLY',
}

export default function UsersPage() {
  const logEvent = useEventLogger()
  const { user: currentUser } = useAuthStore()
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [createForm, setCreateForm] = useState<CreateUserCommand>(emptyCreateForm)
  const [editForm, setEditForm] = useState<UpdateUserCommand>({})

  useEffect(() => {
    logEvent('PAGE_VIEW', 'users')
    if (currentUser?.role === 'ADMIN') {
      usersApi
        .getAll()
        .then(setUsers)
        .catch(() => toast.error('Failed to load users'))
        .finally(() => setIsLoading(false))
    } else {
      setIsLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const created = await usersApi.create(createForm)
      setUsers((prev) => [created, ...prev])
      setShowCreate(false)
      setCreateForm(emptyCreateForm)
      logEvent('USER_ACTION', 'create_user', { userId: created.id, role: created.role })
      toast.success('User created')
    } catch {
      toast.error('Failed to create user')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!editUser) return
    setIsSubmitting(true)
    try {
      const updated = await usersApi.update(editUser.id, editForm)
      setUsers((prev) => prev.map((u) => (u.id === editUser.id ? updated : u)))
      setEditUser(null)
      logEvent('USER_ACTION', 'update_user', { userId: editUser.id })
      toast.success('User updated')
    } catch {
      toast.error('Failed to update user')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDeactivate(u: User) {
    try {
      await usersApi.deactivate(u.id)
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, active: false } : x)))
      logEvent('USER_ACTION', 'deactivate_user', { userId: u.id })
      toast.success('User deactivated')
    } catch {
      toast.error('Failed to deactivate user')
    }
  }

  if (currentUser?.role !== 'ADMIN') {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <Shield className="h-12 w-12 mb-4 opacity-20" />
        <p className="text-lg font-medium text-foreground">Access Restricted</p>
        <p className="text-sm mt-1">Only administrators can manage users.</p>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Users"
        description={`${users.length} users · ${users.filter((u) => u.active).length} active`}
        action={
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-2" /> Add User
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableLoadingState rows={5} cols={6} />
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    <UserCog className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p>No users found</p>
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="text-xs">
                            {u.username.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-sm">{u.username}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{u.email}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-xs font-medium ${roleBadgeStyles[u.role]}`}
                      >
                        {u.role.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        status={String(u.active)}
                        label={u.active ? 'Active' : 'Inactive'}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(u.createdAt), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditUser(u)
                            setEditForm({ email: u.email, role: u.role, active: u.active })
                          }}
                        >
                          Edit
                        </Button>
                        {u.active && u.id !== currentUser?.id && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 hover:text-red-700 hover:border-red-200"
                            onClick={() => handleDeactivate(u)}
                          >
                            Deactivate
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>Username</Label>
              <Input
                value={createForm.username}
                onChange={(e) => setCreateForm((f) => ({ ...f, username: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={createForm.password}
                onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                required
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={createForm.role}
                onValueChange={(v) => setCreateForm((f) => ({ ...f, role: v as UserRole }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r.replace(/_/g, ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={editForm.email ?? ''}
                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={editForm.role ?? ''}
                onValueChange={(v) => setEditForm((f) => ({ ...f, role: v as UserRole }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r.replace(/_/g, ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditUser(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
