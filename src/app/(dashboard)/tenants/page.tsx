'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Users, Mail, Phone, Search } from 'lucide-react'
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
import { tenantsApi } from '@/lib/api/tenants.api'
import type { RegisterTenantCommand } from '@/lib/api/tenants.api'
import { useAuthStore } from '@/store'
import { useEventLogger } from '@/hooks/useEventLogger'
import { toast } from 'sonner'
import type { Tenant } from '@/types'
import { format } from 'date-fns'

const emptyForm: RegisterTenantCommand = {
  firstName: '',
  lastName: '',
  email: '',
  phoneNumber: '',
  creditScore: undefined,
}

export default function TenantsPage() {
  const router = useRouter()
  const logEvent = useEventLogger()
  const { user } = useAuthStore()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState<RegisterTenantCommand>(emptyForm)

  useEffect(() => {
    logEvent('PAGE_VIEW', 'tenants')
    tenantsApi
      .getAll()
      .then(setTenants)
      .catch(() => toast.error('Failed to load tenants'))
      .finally(() => setIsLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const created = await tenantsApi.register(form)
      setTenants((prev) => [created, ...prev])
      setShowDialog(false)
      setForm(emptyForm)
      logEvent('USER_ACTION', 'register_tenant', { tenantId: created.id })
      toast.success('Tenant registered')
    } catch {
      toast.error('Failed to register tenant')
    } finally {
      setIsSubmitting(false)
    }
  }

  const canCreate = user?.role === 'ADMIN' || user?.role === 'PROPERTY_MANAGER'

  const filteredTenants = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return tenants
    return tenants.filter((t) =>
      `${t.firstName} ${t.lastName}`.toLowerCase().includes(query)
    )
  }, [tenants, search])

  return (
    <div>
      <PageHeader
        title="Tenants"
        description={`${tenants.length} registered tenants`}
        action={
          canCreate ? (
            <Button onClick={() => setShowDialog(true)}>
              <Plus className="h-4 w-4 mr-2" /> Register Tenant
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name…"
            className="pl-8 h-9"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Status</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Contact Info</TableHead>
                <TableHead>Registered</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableLoadingState rows={5} cols={4} />
              ) : filteredTenants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p>{search ? 'No tenants match your search' : 'No tenants registered yet'}</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredTenants.map((tenant) => (
                  <TableRow
                    key={tenant.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/tenants/${tenant.id}`)}
                  >
                    <TableCell>
                      <StatusBadge status={tenant.status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">
                          {tenant.firstName} {tenant.lastName}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono tracking-wider">
                          {tenant.nationalIdNo ?? '—'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 shrink-0" />
                          {tenant.email}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          {tenant.phoneNumber}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(tenant.registeredAt), 'MMM d, yyyy')}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Register Tenant</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={form.firstName}
                  onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={form.lastName}
                  onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <Input
                id="phoneNumber"
                value={form.phoneNumber}
                onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="creditScore">Credit Score (optional)</Label>
              <Input
                id="creditScore"
                type="number"
                min={300}
                max={850}
                value={form.creditScore ?? ''}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    creditScore: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Registering...' : 'Register'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
