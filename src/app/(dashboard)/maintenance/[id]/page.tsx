'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Wrench, MapPin } from 'lucide-react'
import { format, isValid } from 'date-fns'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { maintenanceApi } from '@/lib/api/maintenance.api'
import { propertiesApi } from '@/lib/api/properties.api'
import { tenantsApi } from '@/lib/api/tenants.api'
import { useAuthStore, useBreadcrumbStore } from '@/store'
import { useEventLogger } from '@/hooks/useEventLogger'
import { toast } from 'sonner'
import type { MaintenanceRecord, Property, Tenant } from '@/types'

function safeFormat(value: string | null | undefined, fmt: string): string {
  if (!value) return '—'
  const d = new Date(value)
  return isValid(d) ? format(d, fmt) : '—'
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  )
}

export default function MaintenanceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const logEvent = useEventLogger()
  const { user } = useAuthStore()
  const canManage = user?.role === 'ADMIN' || user?.role === 'PROPERTY_MANAGER'
  const setLabel = useBreadcrumbStore((s) => s.setLabel)

  const [ticket, setTicket] = useState<MaintenanceRecord | null>(null)
  const [property, setProperty] = useState<Property | null>(null)
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [showCloseDialog, setShowCloseDialog] = useState(false)
  const [resolutionNotes, setResolutionNotes] = useState('')
  const [showReopenDialog, setShowReopenDialog] = useState(false)

  useEffect(() => {
    logEvent('PAGE_VIEW', 'maintenance_detail', { ticketId: id })
    maintenanceApi
      .getById(id)
      .then(async (t) => {
        setTicket(t)
        const desc = t.problemDescription
        setLabel(id, desc.length > 40 ? `${desc.slice(0, 40)}…` : desc)
        await Promise.all([
          t.propertyId
            ? propertiesApi.getById(t.propertyId).then(setProperty).catch(() => {})
            : Promise.resolve(),
          t.tenantId
            ? tenantsApi.getById(t.tenantId).then(setTenant).catch(() => {})
            : Promise.resolve(),
        ])
      })
      .catch(() => toast.error('Failed to load ticket'))
      .finally(() => setIsLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function apiErrorMessage(err: any, fallback: string): string {
    return err?.response?.data?.detail ?? err?.message ?? fallback
  }

  async function handleMarkInProgress() {
    if (!ticket) return
    setIsSubmitting(true)
    try {
      const updated = await maintenanceApi.updateStatus(ticket.id, { requestId: ticket.id, newStatus: 'IN_PROGRESS' })
      setTicket(updated)
      logEvent('USER_ACTION', 'mark_ticket_in_progress', { ticketId: ticket.id })
      toast.success('Ticket marked as in progress')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to update ticket'))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleReopen() {
    if (!ticket) return
    setIsSubmitting(true)
    try {
      const updated = await maintenanceApi.updateStatus(ticket.id, { requestId: ticket.id, newStatus: 'OPEN' })
      setTicket(updated)
      setShowReopenDialog(false)
      logEvent('USER_ACTION', 'reopen_maintenance_ticket', { ticketId: ticket.id })
      toast.success('Ticket reopened')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to reopen ticket'))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleCloseTicket() {
    if (!ticket) return
    setIsSubmitting(true)
    try {
      const updated = await maintenanceApi.updateStatus(ticket.id, {
        requestId: ticket.id,
        newStatus: 'COMPLETED',
        resolutionNotes: resolutionNotes.trim(),
      })
      setTicket(updated)
      setShowCloseDialog(false)
      setResolutionNotes('')
      logEvent('USER_ACTION', 'close_maintenance_ticket', { ticketId: ticket.id })
      toast.success('Ticket closed')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to close ticket'))
    } finally {
      setIsSubmitting(false)
    }
  }

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

  if (!ticket) {
    return (
      <div className="text-center py-24 text-muted-foreground">
        <p>Ticket not found.</p>
        <Button variant="link" onClick={() => router.push('/maintenance')}>
          Back to maintenance
        </Button>
      </div>
    )
  }

  const unit = property?.units.find((u) => u.id === ticket.unitId)

  return (
    <div>
      <PageHeader
        title="Maintenance Ticket"
        description={`#${ticket.id.slice(0, 8).toUpperCase()} · Opened ${safeFormat(ticket.requestedAt, 'MMM d, yyyy')}`}
        action={
          canManage ? (
            <div className="flex gap-2">
              {(ticket.status === 'OPEN' || ticket.status === 'ASSIGNED') && (
                <Button variant="outline" onClick={handleMarkInProgress} disabled={isSubmitting}>
                  {isSubmitting ? 'Updating…' : 'Mark In Progress'}
                </Button>
              )}
              {ticket.status === 'IN_PROGRESS' && (
                <Button onClick={() => setShowCloseDialog(true)} disabled={isSubmitting}>
                  Close Ticket
                </Button>
              )}
              {(ticket.status === 'COMPLETED' || ticket.status === 'CANCELLED') && (
                <Button variant="outline" onClick={() => setShowReopenDialog(true)} disabled={isSubmitting}>
                  Reopen Ticket
                </Button>
              )}
            </div>
          ) : undefined
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        {/* Ticket details */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wrench className="h-4 w-4 text-muted-foreground" />
              Ticket Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DetailRow label="Status"   value={<StatusBadge status={ticket.status} />} />
            <Separator />
            <DetailRow label="Priority" value={<StatusBadge status={ticket.priority} />} />
            <Separator />
            <DetailRow label="Opened"   value={safeFormat(ticket.requestedAt, 'MMMM d, yyyy')} />
            {ticket.completedAt && (
              <>
                <Separator />
                <DetailRow label="Closed" value={safeFormat(ticket.completedAt, 'MMMM d, yyyy')} />
              </>
            )}
            <Separator />
            <div className="py-3 space-y-1.5">
              <p className="text-sm text-muted-foreground">Problem Description</p>
              <p className="text-sm font-medium leading-relaxed">{ticket.problemDescription}</p>
            </div>
            {ticket.resolutionNotes && (
              <>
                <Separator />
                <div className="py-3 space-y-1.5">
                  <p className="text-sm text-muted-foreground">Resolution Notes</p>
                  <p className="text-sm font-medium leading-relaxed">{ticket.resolutionNotes}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Location & tenant */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              Location & Tenant
            </CardTitle>
          </CardHeader>
          <CardContent>
            {property ? (
              <>
                <DetailRow
                  label="Property"
                  value={
                    <button
                      className="text-primary hover:underline font-medium text-sm"
                      onClick={() => router.push(`/properties/${property.id}`)}
                    >
                      {property.name}
                    </button>
                  }
                />
                <Separator />
                <DetailRow
                  label="Unit"
                  value={
                    unit ? (
                      <button
                        className="text-primary hover:underline font-medium text-sm"
                        onClick={() =>
                          router.push(`/properties/${property.id}/units/${unit.id}`)
                        }
                      >
                        Unit {unit.unitNumber}
                      </button>
                    ) : (
                      ticket.unitId ? `${ticket.unitId.slice(0, 8)}…` : '—'
                    )
                  }
                />
              </>
            ) : (
              <DetailRow
                label="Property"
                value={ticket.propertyId ? `${ticket.propertyId.slice(0, 8)}…` : '—'}
              />
            )}
            <Separator />
            {tenant ? (
              <>
                <DetailRow
                  label="Tenant"
                  value={
                    <button
                      className="text-primary hover:underline font-medium text-sm"
                      onClick={() => router.push(`/tenants/${tenant.id}`)}
                    >
                      {tenant.firstName} {tenant.lastName}
                    </button>
                  }
                />
                <Separator />
                <DetailRow label="Email" value={tenant.email} />
                <Separator />
                <DetailRow label="Phone" value={tenant.phoneNumber} />
              </>
            ) : (
              <DetailRow label="Tenant" value="System (Maintenance)" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Close ticket dialog */}
      <Dialog
        open={showCloseDialog}
        onOpenChange={(open) => {
          setShowCloseDialog(open)
          if (!open) setResolutionNotes('')
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Close Ticket</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Please describe how the issue was resolved before closing this ticket.
            </p>
            <div className="space-y-2">
              <Label htmlFor="resolution-notes">
                Resolution Notes <span className="text-destructive">*</span>
              </Label>
              <textarea
                id="resolution-notes"
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="Describe how the issue was resolved…"
                rows={4}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCloseDialog(false)}>
              Cancel
            </Button>
            <Button
              disabled={isSubmitting || !resolutionNotes.trim()}
              onClick={handleCloseTicket}
            >
              {isSubmitting ? 'Closing…' : 'Close Ticket'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reopen ticket dialog */}
      <Dialog open={showReopenDialog} onOpenChange={setShowReopenDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reopen Ticket</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will set the ticket back to <span className="font-medium text-foreground">Open</span> so it can be worked on again. Are you sure?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReopenDialog(false)}>
              Cancel
            </Button>
            <Button disabled={isSubmitting} onClick={handleReopen}>
              {isSubmitting ? 'Reopening…' : 'Reopen Ticket'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
