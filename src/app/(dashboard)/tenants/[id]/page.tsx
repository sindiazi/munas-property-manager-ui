'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, User, Mail, Phone, CreditCard, ShieldCheck, ShieldOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { StatusBadge } from '@/components/shared/StatusBadge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { tenantsApi } from '@/lib/api/tenants.api'
import type { UpdateTenantCommand } from '@/lib/api/tenants.api'
import { useAuthStore } from '@/store'
import { useEventLogger } from '@/hooks/useEventLogger'
import { toast } from 'sonner'
import { format, isValid } from 'date-fns'
import type { Tenant } from '@/types'

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-right">{value ?? '—'}</span>
    </div>
  )
}

function maskId(value?: string | null) {
  if (!value) return '—'
  const clean = value.replace(/\D/g, '')
  if (clean.length >= 4) return `***-**-${clean.slice(-4)}`
  return `***${value.slice(-4)}`
}

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const logEvent = useEventLogger()
  const { user } = useAuthStore()

  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [showEdit, setShowEdit] = useState(false)
  const [editForm, setEditForm] = useState<UpdateTenantCommand>({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    creditScore: undefined,
  })

  const [showStatusConfirm, setShowStatusConfirm] = useState<'activate' | 'deactivate' | null>(null)

  useEffect(() => {
    logEvent('PAGE_VIEW', 'tenant_detail', { tenantId: id })
    tenantsApi
      .getById(id)
      .then((t) => {
        setTenant(t)
        setEditForm({
          firstName: t.firstName,
          lastName: t.lastName,
          email: t.email,
          phoneNumber: t.phoneNumber,
          creditScore: t.creditScore,
        })
      })
      .catch(() => toast.error('Failed to load tenant'))
      .finally(() => setIsLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!tenant) return
    setIsSubmitting(true)
    try {
      const updated = await tenantsApi.update(id, editForm)
      setTenant(updated)
      setShowEdit(false)
      logEvent('USER_ACTION', 'update_tenant', { tenantId: id })
      toast.success('Tenant updated')
    } catch {
      toast.error('Failed to update tenant')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleStatusChange() {
    if (!showStatusConfirm || !tenant) return
    setIsSubmitting(true)
    try {
      const updated = showStatusConfirm === 'activate'
        ? await tenantsApi.activate(id)
        : await tenantsApi.deactivate(id)
      setTenant(updated)
      setShowStatusConfirm(null)
      logEvent('USER_ACTION', `${showStatusConfirm}_tenant`, { tenantId: id })
      toast.success(`Tenant ${showStatusConfirm === 'activate' ? 'activated' : 'deactivated'}`)
    } catch {
      toast.error('Failed to update tenant status')
    } finally {
      setIsSubmitting(false)
    }
  }

  const canManage = user?.role === 'ADMIN' || user?.role === 'PROPERTY_MANAGER'

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-40 bg-muted animate-pulse rounded" />
        <div className="h-64 bg-muted animate-pulse rounded-lg" />
      </div>
    )
  }

  if (!tenant) {
    return (
      <div className="text-center py-24 text-muted-foreground">
        <p>Tenant not found.</p>
        <Button variant="link" onClick={() => router.push('/tenants')}>Back to tenants</Button>
      </div>
    )
  }

  const registeredDate = tenant.registeredAt && isValid(new Date(tenant.registeredAt))
    ? format(new Date(tenant.registeredAt), 'MMMM d, yyyy')
    : '—'

  const isActive = tenant.status === 'ACTIVE'

  return (
    <div className="space-y-6">
      {/* Back */}
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-muted-foreground"
        onClick={() => router.push('/tenants')}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to tenants
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">
            {tenant.firstName} {tenant.lastName}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <StatusBadge status={tenant.status} />
            <span className="text-sm text-muted-foreground">Registered {registeredDate}</span>
          </div>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}>
              Edit
            </Button>
            {isActive ? (
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => setShowStatusConfirm('deactivate')}
              >
                <ShieldOff className="h-4 w-4 mr-1.5" />
                Deactivate
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="text-green-700 border-green-200 hover:bg-green-50"
                onClick={() => setShowStatusConfirm('activate')}
              >
                <ShieldCheck className="h-4 w-4 mr-1.5" />
                Activate
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Details card */}
      <Card className="max-w-lg">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4 text-muted-foreground" />
            Contact Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DetailRow label="First name" value={tenant.firstName} />
          <Separator />
          <DetailRow label="Last name" value={tenant.lastName} />
          <Separator />
          <DetailRow
            label="Email"
            value={
              <a href={`mailto:${tenant.email}`} className="flex items-center gap-1 text-primary hover:underline">
                <Mail className="h-3.5 w-3.5" />
                {tenant.email}
              </a>
            }
          />
          <Separator />
          <DetailRow
            label="Phone"
            value={
              <a href={`tel:${tenant.phoneNumber}`} className="flex items-center gap-1 text-primary hover:underline">
                <Phone className="h-3.5 w-3.5" />
                {tenant.phoneNumber}
              </a>
            }
          />
          <Separator />
          <DetailRow
            label="National ID"
            value={
              <span className="font-mono tracking-wider">
                {maskId(tenant.nationalIdNo)}
              </span>
            }
          />
          <Separator />
          <DetailRow
            label="Credit score"
            value={
              tenant.creditScore != null ? (
                <span className="flex items-center gap-1">
                  <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                  {tenant.creditScore}
                </span>
              ) : '—'
            }
          />
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Tenant</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input
                  value={editForm.firstName}
                  onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input
                  value={editForm.lastName}
                  onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input
                value={editForm.phoneNumber}
                onChange={(e) => setEditForm((f) => ({ ...f, phoneNumber: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Credit Score <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                type="number"
                min={300}
                max={850}
                value={editForm.creditScore ?? ''}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    creditScore: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowEdit(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving…' : 'Save changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Activate / Deactivate Confirm Dialog */}
      <Dialog
        open={!!showStatusConfirm}
        onOpenChange={(open) => !open && setShowStatusConfirm(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {showStatusConfirm === 'activate' ? 'Activate' : 'Deactivate'} Tenant
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {showStatusConfirm === 'activate'
              ? `${tenant.firstName} will be able to be assigned to leases again.`
              : `${tenant.firstName} will be marked as inactive and cannot be assigned to new leases.`}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStatusConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant={showStatusConfirm === 'deactivate' ? 'destructive' : 'default'}
              disabled={isSubmitting}
              onClick={handleStatusChange}
            >
              {isSubmitting ? 'Updating…' : showStatusConfirm === 'activate' ? 'Activate' : 'Deactivate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
