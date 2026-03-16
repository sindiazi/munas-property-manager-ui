'use client'
import { useEffect, useState, useMemo } from 'react'
import { Plus, CreditCard, ArrowUpDown, X } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { TableLoadingState } from '@/components/shared/LoadingState'
import { Pagination, usePagination } from '@/components/shared/Pagination'
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
import { paymentsApi } from '@/lib/api/payments.api'
import type { CreatePaymentCommand, ProcessPaymentCommand } from '@/lib/api/payments.api'
import { leasesApi } from '@/lib/api/leases.api'
import { tenantsApi } from '@/lib/api/tenants.api'
import { propertiesApi } from '@/lib/api/properties.api'
import { useAuthStore, useSettingsStore } from '@/store'
import { useEventLogger } from '@/hooks/useEventLogger'
import { formatCurrency } from '@/lib/formatCurrency'
import { toast } from 'sonner'
import type { Payment, PaymentType, Lease, Tenant, Property } from '@/types'
import { format, isValid } from 'date-fns'

const PAYMENT_TYPES: PaymentType[] = [
  'RENT', 'SECURITY_DEPOSIT', 'LATE_FEE', 'MAINTENANCE_FEE', 'OTHER',
]

const PAYMENT_STATUSES = ['PENDING', 'PAID', 'OVERDUE', 'PARTIALLY_PAID', 'CANCELLED'] as const

type SortKey = 'dueDate_asc' | 'dueDate_desc' | 'paidDate_asc' | 'paidDate_desc'

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'dueDate_asc', label: 'Due Date (Earliest)' },
  { value: 'dueDate_desc', label: 'Due Date (Latest)' },
  { value: 'paidDate_asc', label: 'Paid Date (Earliest)' },
  { value: 'paidDate_desc', label: 'Paid Date (Latest)' },
]

function safeFormat(value: string | null | undefined, fmt: string): string {
  if (!value) return '—'
  const d = new Date(value)
  return isValid(d) ? format(d, fmt) : '—'
}

const makeEmptyCreateForm = (currency: string): CreatePaymentCommand => ({
  leaseId: '',
  tenantId: '',
  amount: 0,
  currencyCode: currency,
  dueDate: '',
  type: 'RENT',
})

export default function PaymentsPage() {
  const logEvent = useEventLogger()
  const { user } = useAuthStore()
  const currency = useSettingsStore((s) => s.settings?.currency ?? 'USD')

  const [payments, setPayments] = useState<Payment[]>([])
  const [leaseMap, setLeaseMap] = useState<Map<string, Lease>>(new Map())
  const [tenantMap, setTenantMap] = useState<Map<string, Tenant>>(new Map())
  const [propertyMap, setPropertyMap] = useState<Map<string, Property>>(new Map())
  const [isLoading, setIsLoading] = useState(true)

  const [filterStatus, setFilterStatus] = useState<string>('ALL')
  const [filterProperty, setFilterProperty] = useState<string>('ALL')
  const [sortBy, setSortBy] = useState<SortKey>('dueDate_asc')

  const [showCreate, setShowCreate] = useState(false)
  const [receiveId, setReceiveId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [createForm, setCreateForm] = useState<CreatePaymentCommand>(() => makeEmptyCreateForm(currency))
  const [receiveForm, setReceiveForm] = useState<ProcessPaymentCommand>({
    amountPaid: 0,
    currencyCode: currency,
    paymentDate: '',
  })

  useEffect(() => {
    logEvent('PAGE_VIEW', 'payments')
    Promise.all([
      paymentsApi.getAll(),
      leasesApi.getAll(),
      tenantsApi.getAll(),
      propertiesApi.getAll(),
    ])
      .then(([paymentsData, leasesData, tenantsData, propertiesData]) => {
        setPayments(paymentsData)
        setLeaseMap(new Map(leasesData.map((l) => [l.id, l])))
        setTenantMap(new Map(tenantsData.map((t) => [t.id, t])))
        setPropertyMap(new Map(propertiesData.map((p) => [p.id, p])))
      })
      .catch(() => toast.error('Failed to load payments'))
      .finally(() => setIsLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const properties = useMemo(() => [...propertyMap.values()], [propertyMap])

  const filteredAndSorted = useMemo(() => {
    let result = [...payments]

    if (filterStatus !== 'ALL') {
      result = result.filter((p) => p.status === filterStatus)
    }

    if (filterProperty !== 'ALL') {
      result = result.filter((p) => {
        const lease = leaseMap.get(p.leaseId)
        return lease?.propertyId === filterProperty
      })
    }

    result.sort((a, b) => {
      if (sortBy === 'dueDate_asc') return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      if (sortBy === 'dueDate_desc') return new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime()
      if (sortBy === 'paidDate_asc') {
        if (!a.paidDate && !b.paidDate) return 0
        if (!a.paidDate) return 1
        if (!b.paidDate) return -1
        return new Date(a.paidDate).getTime() - new Date(b.paidDate).getTime()
      }
      if (sortBy === 'paidDate_desc') {
        if (!a.paidDate && !b.paidDate) return 0
        if (!a.paidDate) return 1
        if (!b.paidDate) return -1
        return new Date(b.paidDate).getTime() - new Date(a.paidDate).getTime()
      }
      return 0
    })

    return result
  }, [payments, filterStatus, filterProperty, sortBy, leaseMap])

  const isFiltered = filterStatus !== 'ALL' || filterProperty !== 'ALL' || sortBy !== 'dueDate_asc'

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const created = await paymentsApi.create(createForm)
      setPayments((prev) => [created, ...prev])
      setShowCreate(false)
      setCreateForm(makeEmptyCreateForm(currency))
      logEvent('USER_ACTION', 'create_payment', { paymentId: created.id })
      toast.success('Payment created')
    } catch {
      toast.error('Failed to create payment')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleReceive(e: React.FormEvent) {
    e.preventDefault()
    if (!receiveId) return
    setIsSubmitting(true)
    try {
      const updated = await paymentsApi.receive(receiveId, receiveForm)
      setPayments((prev) => prev.map((p) => (p.id === receiveId ? updated : p)))
      setReceiveId(null)
      logEvent('USER_ACTION', 'receive_payment', { paymentId: receiveId })
      toast.success('Payment recorded')
    } catch {
      toast.error('Failed to record payment')
    } finally {
      setIsSubmitting(false)
    }
  }

  const pagination = usePagination()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { pagination.reset() }, [filterStatus, filterProperty, sortBy])
  const canManage = user?.role === 'ADMIN' || user?.role === 'PROPERTY_MANAGER'
  const colCount = canManage ? 8 : 7

  const totalOutstanding = payments
    .filter((p) => p.status !== 'PAID' && p.status !== 'CANCELLED')
    .reduce((sum, p) => sum + (p.outstandingBalance ?? p.amountDue), 0)

  return (
    <div>
      <PageHeader
        title="Payments"
        description={`${payments.filter((p) => p.status === 'OVERDUE').length} overdue · ${formatCurrency(totalOutstanding, currency)} outstanding`}
        action={
          canManage ? (
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-2" /> New Payment
            </Button>
          ) : undefined
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            {PAYMENT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s.replace(/_/g, ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterProperty} onValueChange={setFilterProperty}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Property" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Properties</SelectItem>
            {properties.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
          <SelectTrigger className="w-52">
            <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isFiltered && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            onClick={() => {
              setFilterStatus('ALL')
              setFilterProperty('ALL')
              setSortBy('dueDate_asc')
            }}
          >
            <X className="h-3.5 w-3.5" /> Reset
          </Button>
        )}
      </div>

      <Card className="pt-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Status</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Amount / Type</TableHead>
                <TableHead>Property / Unit</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Paid Date</TableHead>
                {canManage && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableLoadingState rows={5} cols={colCount} />
              ) : filteredAndSorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={colCount} className="text-center py-12 text-muted-foreground">
                    <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p>No payments found</p>
                  </TableCell>
                </TableRow>
              ) : (
                pagination.paginate(filteredAndSorted).map((payment) => {
                  const lease = leaseMap.get(payment.leaseId)
                  const tenant = tenantMap.get(payment.tenantId)
                  const property = lease ? propertyMap.get(lease.propertyId) : undefined
                  const unit = property?.units?.find((u) => u.id === lease?.unitId)

                  return (
                    <TableRow key={payment.id}>
                      <TableCell>
                        <StatusBadge status={payment.status} />
                      </TableCell>
                      <TableCell>
                        {tenant ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium">
                              {tenant.firstName} {tenant.lastName}
                            </span>
                            <span className="text-xs text-muted-foreground font-mono tracking-wider">
                              {tenant.nationalIdNo ?? '—'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">{payment.tenantId}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium">
                            {formatCurrency(payment.amountDue, currency)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {payment.type.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {property ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-medium">{property.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {unit ? `Unit ${unit.unitNumber}` : '—'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {safeFormat(payment.dueDate, 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {safeFormat(payment.paidDate, 'MMM d, yyyy')}
                      </TableCell>
                      {canManage && (
                        <TableCell>
                          {(payment.status === 'PENDING' || payment.status === 'OVERDUE') && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setReceiveId(payment.id)
                                setReceiveForm({
                                  amountPaid: payment.amountDue,
                                  currencyCode: payment.currencyCode,
                                  paymentDate: new Date().toISOString().split('T')[0],
                                })
                              }}
                            >
                              Record
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
          {filteredAndSorted.length > 10 && (
            <Pagination
              total={filteredAndSorted.length}
              page={pagination.page}
              pageSize={pagination.pageSize}
              onPageChange={pagination.setPage}
              onPageSizeChange={(s) => { pagination.setPageSize(s); pagination.setPage(1) }}
            />
          )}
        </CardContent>
      </Card>

      {/* Create Payment Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Payment</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>Lease ID</Label>
              <Input
                value={createForm.leaseId}
                onChange={(e) => setCreateForm((f) => ({ ...f, leaseId: e.target.value }))}
                placeholder="UUID"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Tenant ID</Label>
              <Input
                value={createForm.tenantId}
                onChange={(e) => setCreateForm((f) => ({ ...f, tenantId: e.target.value }))}
                placeholder="UUID"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input
                  type="number"
                  min={0}
                  value={createForm.amount}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, amount: Number(e.target.value) }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Input
                  value={createForm.currencyCode}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, currencyCode: e.target.value }))
                  }
                  maxLength={3}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={createForm.dueDate}
                  onChange={(e) => setCreateForm((f) => ({ ...f, dueDate: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={createForm.type}
                  onValueChange={(v) =>
                    setCreateForm((f) => ({ ...f, type: v as PaymentType }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t.replace(/_/g, ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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

      {/* Record Receipt Dialog */}
      <Dialog open={!!receiveId} onOpenChange={() => setReceiveId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Record Payment Receipt</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleReceive} className="space-y-4">
            <div className="space-y-2">
              <Label>Amount Paid</Label>
              <Input
                type="number"
                min={0}
                value={receiveForm.amountPaid}
                onChange={(e) =>
                  setReceiveForm((f) => ({ ...f, amountPaid: Number(e.target.value) }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Input
                value={receiveForm.currencyCode}
                onChange={(e) =>
                  setReceiveForm((f) => ({ ...f, currencyCode: e.target.value }))
                }
                maxLength={3}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Date</Label>
              <Input
                type="date"
                value={receiveForm.paymentDate}
                onChange={(e) =>
                  setReceiveForm((f) => ({ ...f, paymentDate: e.target.value }))
                }
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setReceiveId(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Recording...' : 'Record'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
