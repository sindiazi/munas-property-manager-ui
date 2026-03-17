'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  User, Mail, Phone, CreditCard, ShieldCheck, ShieldOff,
  Calendar, ChevronRight, Wrench,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Pagination, usePagination } from '@/components/shared/Pagination'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from '@/components/ui/tooltip'
import { tenantsApi } from '@/lib/api/tenants.api'
import type { UpdateTenantCommand } from '@/lib/api/tenants.api'
import { leasesApi } from '@/lib/api/leases.api'
import { maintenanceApi } from '@/lib/api/maintenance.api'
import { propertiesApi } from '@/lib/api/properties.api'
import { useAuthStore, useSettingsStore, useBreadcrumbStore } from '@/store'
import { useEventLogger } from '@/hooks/useEventLogger'
import { formatCurrency } from '@/lib/formatCurrency'
import { toast } from 'sonner'
import { format, isValid } from 'date-fns'
import type { Tenant, Lease, MaintenanceRecord, Property } from '@/types'

function safeFormat(dateStr: string | undefined | null, fmt: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return isValid(d) ? format(d, fmt) : '—'
}

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

function MaintenanceStatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    OPEN: 'bg-sky-50 text-sky-700 border-sky-100',
    ASSIGNED: 'bg-purple-50 text-purple-700 border-purple-100',
    IN_PROGRESS: 'bg-amber-50 text-amber-700 border-amber-100',
    COMPLETED: 'bg-green-50 text-green-700 border-green-100',
    CANCELLED: 'bg-zinc-100 text-zinc-600 border-zinc-200',
  }
  const cls = variants[status?.toUpperCase()] ?? 'bg-zinc-100 text-zinc-600 border-zinc-200'
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status ?? '—'}
    </span>
  )
}

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const logEvent = useEventLogger()
  const { user } = useAuthStore()
  const currency = useSettingsStore((s) => s.settings?.currency ?? 'USD')
  const setLabel = useBreadcrumbStore((s) => s.setLabel)

  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [leases, setLeases] = useState<Lease[]>([])
  const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>([])
  const [propertyMap, setPropertyMap] = useState<Record<string, Property>>({})
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

  const leasePagination = usePagination()
  const maintenancePagination = usePagination()

  useEffect(() => {
    logEvent('PAGE_VIEW', 'tenant_detail', { tenantId: id })
    async function load() {
      try {
        const [t, ls, maint, props] = await Promise.all([
          tenantsApi.getById(id),
          leasesApi.getByTenant(id).catch(() => [] as Lease[]),
          maintenanceApi.getByTenant(id).catch(() => [] as MaintenanceRecord[]),
          propertiesApi.getAll().catch(() => [] as Property[]),
        ])
        setTenant(t)
        setLabel(id, `${t.firstName} ${t.lastName}`)
        setEditForm({
          firstName: t.firstName,
          lastName: t.lastName,
          email: t.email,
          phoneNumber: t.phoneNumber,
          creditScore: t.creditScore,
        })
        setLeases([...ls].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))
        setMaintenance([...maint].sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()))
        setPropertyMap(Object.fromEntries(props.map((p) => [p.id, p])))
      } catch {
        toast.error('Failed to load tenant')
      } finally {
        setIsLoading(false)
      }
    }
    load()
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
  const hasActiveLease = leases.some((l) => l.status === 'ACTIVE')

  const pagedLeases = leasePagination.paginate(leases)
  const pagedMaintenance = maintenancePagination.paginate(maintenance)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
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
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 border-red-200 hover:bg-red-50 disabled:pointer-events-none"
                      disabled={hasActiveLease}
                      onClick={() => setShowStatusConfirm('deactivate')}
                    >
                      <ShieldOff className="h-4 w-4 mr-1.5" />
                      Deactivate
                    </Button>
                  </span>
                </TooltipTrigger>
                {hasActiveLease && (
                  <TooltipContent>
                    Tenant has an active lease and cannot be deactivated
                  </TooltipContent>
                )}
              </Tooltip>
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

      {/* Lease History */}
      <section>
        <h2 className="text-base font-semibold mb-3">Lease History</h2>
        {leases.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground text-sm">
              No lease history for this tenant.
            </CardContent>
          </Card>
        ) : (
          <Card className="pt-0">
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="border-b text-xs text-muted-foreground uppercase tracking-wide">
                    <th className="px-4 py-3 text-left font-medium">Property</th>
                    <th className="px-4 py-3 text-left font-medium">Unit</th>
                    <th className="px-4 py-3 text-left font-medium">Period</th>
                    <th className="px-4 py-3 text-left font-medium">Rent</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {pagedLeases.map((lease) => {
                    const property = propertyMap[lease.propertyId]
                    const unit = property?.units?.find((u) => u.id === lease.unitId)
                    return (
                      <tr
                        key={lease.id}
                        className="border-b last:border-0 hover:bg-muted/40 cursor-pointer transition-colors"
                        onClick={() => router.push(`/leasing/${lease.id}`)}
                      >
                        <td className="px-4 py-3 font-medium">
                          {property?.name ?? <span className="text-muted-foreground">{lease.propertyId.slice(0, 8)}…</span>}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {unit ? `Unit ${unit.unitNumber}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {safeFormat(lease.startDate, 'MMM d, yyyy')}
                          {' — '}
                          {lease.status === 'ACTIVE'
                            ? <span className="text-green-600 font-medium">Current</span>
                            : safeFormat(lease.endDate, 'MMM d, yyyy')}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatCurrency(lease.monthlyRent, currency)}
                          <span className="text-xs">/mo</span>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={lease.status} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <ChevronRight className="h-4 w-4 text-muted-foreground inline" />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {leases.length > 10 && (
                <Pagination
                  total={leases.length}
                  page={leasePagination.page}
                  pageSize={leasePagination.pageSize}
                  onPageChange={leasePagination.setPage}
                  onPageSizeChange={(s) => { leasePagination.setPageSize(s); leasePagination.setPage(1) }}
                />
              )}
            </CardContent>
          </Card>
        )}
      </section>

      {/* Maintenance History */}
      <section>
        <h2 className="text-base font-semibold mb-3">Maintenance History</h2>
        {maintenance.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground text-sm">
              No maintenance records for this tenant.
            </CardContent>
          </Card>
        ) : (
          <Card className="pt-0">
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="border-b text-xs text-muted-foreground uppercase tracking-wide">
                    <th className="px-4 py-3 text-left font-medium">Description</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">Priority</th>
                    <th className="px-4 py-3 text-left font-medium">Date</th>
                    <th className="px-4 py-3 text-right font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {pagedMaintenance.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b last:border-0 hover:bg-muted/40 cursor-pointer transition-colors"
                      onClick={() => router.push(`/maintenance/${r.id}`)}
                    >
                      <td className="px-4 py-2.5 font-medium">
                        {r.problemDescription}
                        {r.resolutionNotes && (
                          <p className="text-xs text-muted-foreground font-normal mt-0.5 line-clamp-1">
                            {r.resolutionNotes}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <MaintenanceStatusBadge status={r.status} />
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground capitalize text-xs">
                        {r.priority?.toLowerCase() ?? '—'}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {safeFormat(r.requestedAt, 'MMM d, yyyy')}
                        </div>
                        {r.completedAt && (
                          <p className="text-xs text-green-600 mt-0.5">
                            Completed {safeFormat(r.completedAt, 'MMM d, yyyy')}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <ChevronRight className="h-4 w-4 text-muted-foreground inline" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {maintenance.length > 10 && (
                <Pagination
                  total={maintenance.length}
                  page={maintenancePagination.page}
                  pageSize={maintenancePagination.pageSize}
                  onPageChange={maintenancePagination.setPage}
                  onPageSizeChange={(s) => { maintenancePagination.setPageSize(s); maintenancePagination.setPage(1) }}
                />
              )}
            </CardContent>
          </Card>
        )}
      </section>

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
