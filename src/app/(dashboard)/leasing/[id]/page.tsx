'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Building2, Calendar, DollarSign, User } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { leasesApi } from '@/lib/api/leases.api'
import { tenantsApi } from '@/lib/api/tenants.api'
import { propertiesApi } from '@/lib/api/properties.api'
import { useAuthStore, useSettingsStore, useBreadcrumbStore } from '@/store'
import { useEventLogger } from '@/hooks/useEventLogger'
import { formatCurrency } from '@/lib/formatCurrency'
import { toast } from 'sonner'
import type { Lease, Tenant, Property } from '@/types'
import { format, differenceInMonths } from 'date-fns'

function maskId(value?: string | null) {
  if (!value) return '—'
  const clean = value.replace(/\D/g, '')
  if (clean.length >= 4) return `***-**-${clean.slice(-4)}`
  return `***${value.slice(-4)}`
}

function leaseDuration(start: string, end: string) {
  const months = differenceInMonths(new Date(end), new Date(start))
  if (months >= 12) {
    const years = Math.round(months / 12)
    return `${years} year${years !== 1 ? 's' : ''}`
  }
  return `${months} month${months !== 1 ? 's' : ''}`
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  )
}

export default function LeaseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const logEvent = useEventLogger()
  const { user } = useAuthStore()

  const [lease, setLease] = useState<Lease | null>(null)
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [property, setProperty] = useState<Property | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showTerminate, setShowTerminate] = useState(false)
  const [terminateReason, setTerminateReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    logEvent('PAGE_VIEW', 'lease_detail', { leaseId: id })
    leasesApi
      .getById(id)
      .then(async (l) => {
        setLease(l)
        const [t, p] = await Promise.all([
          tenantsApi.getById(l.tenantId),
          propertiesApi.getById(l.propertyId),
        ])
        setTenant(t)
        setProperty(p)
        setLabel(id, `${t.firstName} ${t.lastName}`)
      })
      .catch(() => toast.error('Failed to load lease'))
      .finally(() => setIsLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function handleActivate() {
    if (!lease) return
    setIsSubmitting(true)
    try {
      const updated = await leasesApi.activate(lease.id)
      setLease(updated)
      logEvent('USER_ACTION', 'activate_lease', { leaseId: lease.id })
      toast.success('Lease activated')
    } catch {
      toast.error('Failed to activate lease')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleTerminate() {
    if (!lease) return
    setIsSubmitting(true)
    try {
      const updated = await leasesApi.terminate(lease.id, terminateReason)
      setLease(updated)
      setShowTerminate(false)
      setTerminateReason('')
      logEvent('USER_ACTION', 'terminate_lease', { leaseId: lease.id })
      toast.success('Lease terminated')
    } catch {
      toast.error('Failed to terminate lease')
    } finally {
      setIsSubmitting(false)
    }
  }

  const currency = useSettingsStore((s) => s.settings?.currency ?? 'USD')
  const canManage = user?.role === 'ADMIN' || user?.role === 'PROPERTY_MANAGER'
  const setLabel = useBreadcrumbStore((s) => s.setLabel)

  if (isLoading) {
    return (
      <div>
        <div className="h-8 w-48 bg-muted animate-pulse rounded mb-6" />
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-64 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (!lease) {
    return (
      <div className="text-center py-24 text-muted-foreground">
        <p>Lease not found.</p>
        <Button variant="link" onClick={() => router.push('/leasing')}>
          Back to leases
        </Button>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Lease Details"
        description={`ID: ${lease.id}`}
        action={
          canManage ? (
            <div className="flex gap-2">
              {lease.status === 'DRAFT' && (
                <Button onClick={handleActivate} disabled={isSubmitting}>
                  {isSubmitting ? 'Activating…' : 'Activate'}
                </Button>
              )}
              {lease.status === 'ACTIVE' && (
                <Button
                  variant="destructive"
                  onClick={() => setShowTerminate(true)}
                  disabled={isSubmitting}
                >
                  Terminate
                </Button>
              )}
            </div>
          ) : undefined
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        {/* Tenant info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4 text-muted-foreground" />
              Tenant
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tenant ? (
              <>
                <DetailRow
                  label="Name"
                  value={`${tenant.firstName} ${tenant.lastName}`}
                />
                <Separator />
                <DetailRow label="ID Number" value={maskId(tenant.nationalIdNo)} />
                <Separator />
                <DetailRow label="Email" value={tenant.email} />
                <Separator />
                <DetailRow label="Phone" value={tenant.phoneNumber} />
                <Separator />
                <DetailRow
                  label="Status"
                  value={<StatusBadge status={tenant.status} />}
                />
              </>
            ) : (
              <p className="text-sm text-muted-foreground py-3">
                Tenant ID: {lease.tenantId}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Lease info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              Lease
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DetailRow label="Status" value={<StatusBadge status={lease.status} />} />
            <Separator />
            <DetailRow
              label="Start date"
              value={format(new Date(lease.startDate), 'MMMM d, yyyy')}
            />
            <Separator />
            <DetailRow
              label="End date"
              value={format(new Date(lease.endDate), 'MMMM d, yyyy')}
            />
            <Separator />
            <DetailRow
              label="Duration"
              value={leaseDuration(lease.startDate, lease.endDate)}
            />
            <Separator />
            <DetailRow
              label="Created"
              value={format(new Date(lease.createdAt), 'MMM d, yyyy')}
            />
            {lease.terminationReason && (
              <>
                <Separator />
                <DetailRow label="Termination reason" value={lease.terminationReason} />
              </>
            )}
          </CardContent>
        </Card>

        {/* Financials */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              Financials
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DetailRow
              label="Monthly rent"
              value={formatCurrency(lease.monthlyRent, currency)}
            />
            <Separator />
            <DetailRow
              label="Security deposit"
              value={formatCurrency(lease.securityDeposit, currency)}
            />
          </CardContent>
        </Card>

        {/* Property info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              Property
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DetailRow
              label="Property"
              value={
                property ? (
                  <button
                    className="text-primary hover:underline font-medium text-sm"
                    onClick={() => router.push(`/properties/${lease.propertyId}`)}
                  >
                    {property.name}
                  </button>
                ) : (
                  lease.propertyId
                )
              }
            />
            <Separator />
            <DetailRow
              label="Unit"
              value={
                property ? (
                  <button
                    className="text-primary hover:underline font-medium text-sm"
                    onClick={() => router.push(`/properties/${lease.propertyId}/units/${lease.unitId}`)}
                  >
                    Unit {property.units?.find((u) => u.id === lease.unitId)?.unitNumber ?? lease.unitId}
                  </button>
                ) : (
                  lease.unitId
                )
              }
            />
          </CardContent>
        </Card>
      </div>

      {/* Terminate Dialog */}
      <Dialog
        open={showTerminate}
        onOpenChange={(open) => {
          setShowTerminate(open)
          if (!open) setTerminateReason('')
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Terminate Lease</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Please provide a reason for termination.
            </p>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Input
                value={terminateReason}
                onChange={(e) => setTerminateReason(e.target.value)}
                placeholder="e.g. Tenant request"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTerminate(false)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={isSubmitting} onClick={handleTerminate}>
              {isSubmitting ? 'Terminating…' : 'Terminate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
