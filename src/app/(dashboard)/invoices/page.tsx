'use client'
import { useEffect, useState, useMemo } from 'react'
import { CreditCard, ArrowUpDown, X, CircleDollarSign, SlidersHorizontal, Smartphone, ChevronDown, ChevronRight } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { TableLoadingState } from '@/components/shared/LoadingState'
import { Pagination, usePagination } from '@/components/shared/Pagination'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
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
import { invoicesApi } from '@/lib/api/invoices.api'
import type { CreateInvoiceCommand, RecordCashPaymentCommand } from '@/lib/api/invoices.api'
import { MpesaInvoiceDialog } from '@/components/billing/MpesaInvoiceDialog'
import { leasesApi } from '@/lib/api/leases.api'
import { tenantsApi } from '@/lib/api/tenants.api'
import { propertiesApi } from '@/lib/api/properties.api'
import { useAuthStore, useSettingsStore } from '@/store'
import { useEventLogger } from '@/hooks/useEventLogger'
import { formatCurrency } from '@/lib/formatCurrency'
import { toast } from 'sonner'
import type { Invoice, InvoiceType, PaymentTransaction, Lease, Tenant, Property } from '@/types'
import { format, isValid } from 'date-fns'

const INVOICE_TYPES: InvoiceType[] = [
  'RENT', 'SECURITY_DEPOSIT', 'LATE_FEE', 'MAINTENANCE_FEE', 'OTHER',
]

const INVOICE_STATUSES = ['PENDING', 'PAID', 'OVERDUE', 'PARTIALLY_PAID', 'CANCELLED'] as const

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

const makeEmptyCreateForm = (currency: string): CreateInvoiceCommand => ({
  leaseId: '',
  tenantId: '',
  amount: 0,
  currencyCode: currency,
  dueDate: '',
  type: 'RENT',
})

const METHOD_BADGE: Record<string, { label: string; className: string }> = {
  CASH:  { label: 'Cash',   className: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
  MPESA: { label: 'M-Pesa', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
  CARD:  { label: 'Card',   className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300' },
}

export default function InvoicesPage() {
  const logEvent = useEventLogger()
  const { user } = useAuthStore()
  const currency = useSettingsStore((s) => s.settings?.currency ?? 'USD')

  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [leaseMap, setLeaseMap] = useState<Map<string, Lease>>(new Map())
  const [tenantMap, setTenantMap] = useState<Map<string, Tenant>>(new Map())
  const [propertyMap, setPropertyMap] = useState<Map<string, Property>>(new Map())
  const [isLoading, setIsLoading] = useState(true)

  const [filterStatus, setFilterStatus] = useState<string>('ALL')
  const [filterProperty, setFilterProperty] = useState<string>('ALL')
  const [sortBy, setSortBy] = useState<SortKey>('dueDate_asc')

  const [showCreate, setShowCreate] = useState(false)
  const [cashInvoiceId, setCashInvoiceId] = useState<string | null>(null)
  const [mpesaInvoice, setMpesaInvoice] = useState<Invoice | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [createForm, setCreateForm] = useState<CreateInvoiceCommand>(() => makeEmptyCreateForm(currency))
  const [cashForm, setCashForm] = useState<RecordCashPaymentCommand>({
    amountPaid: 0,
    paymentDate: '',
  })

  // Expanded row state + cached transactions
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null)
  const [transactionCache, setTransactionCache] = useState<Map<string, PaymentTransaction[]>>(new Map())
  const [loadingTransactions, setLoadingTransactions] = useState(false)

  useEffect(() => {
    logEvent('PAGE_VIEW', 'invoices')
    Promise.all([
      invoicesApi.getAll(),
      leasesApi.getAll(),
      tenantsApi.getAll(),
      propertiesApi.getAll(),
    ])
      .then(([invoicesData, leasesData, tenantsData, propertiesData]) => {
        setInvoices(invoicesData)
        setLeaseMap(new Map(leasesData.map((l) => [l.id, l])))
        setTenantMap(new Map(tenantsData.map((t) => [t.id, t])))
        setPropertyMap(new Map(propertiesData.map((p) => [p.id, p])))
      })
      .catch(() => toast.error('Failed to load invoices'))
      .finally(() => setIsLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const properties = useMemo(() => [...propertyMap.values()], [propertyMap])

  const filteredAndSorted = useMemo(() => {
    let result = [...invoices]

    if (filterStatus !== 'ALL') {
      result = result.filter((inv) => inv.status === filterStatus)
    }

    if (filterProperty !== 'ALL') {
      result = result.filter((inv) => {
        const lease = leaseMap.get(inv.leaseId)
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
  }, [invoices, filterStatus, filterProperty, sortBy, leaseMap])

  const isFiltered = filterStatus !== 'ALL' || filterProperty !== 'ALL' || sortBy !== 'dueDate_asc'

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const created = await invoicesApi.create(createForm)
      setInvoices((prev) => [created, ...prev])
      setShowCreate(false)
      setCreateForm(makeEmptyCreateForm(currency))
      logEvent('USER_ACTION', 'create_invoice', { invoiceId: created.invoiceId })
      toast.success('Invoice created')
    } catch {
      toast.error('Failed to create invoice')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleCashPayment(e: React.FormEvent) {
    e.preventDefault()
    if (!cashInvoiceId) return
    setIsSubmitting(true)
    try {
      const updated = await invoicesApi.recordCashPayment(cashInvoiceId, cashForm)
      setInvoices((prev) => prev.map((inv) => (inv.invoiceId === cashInvoiceId ? updated : inv)))
      // Invalidate transaction cache for this invoice
      setTransactionCache((prev) => { const next = new Map(prev); next.delete(cashInvoiceId); return next })
      setCashInvoiceId(null)
      logEvent('USER_ACTION', 'record_cash_payment', { invoiceId: cashInvoiceId })
      toast.success('Cash payment recorded')
    } catch {
      toast.error('Failed to record payment')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleExpandToggle(invoiceId: string) {
    if (expandedInvoiceId === invoiceId) {
      setExpandedInvoiceId(null)
      return
    }
    setExpandedInvoiceId(invoiceId)
    if (!transactionCache.has(invoiceId)) {
      setLoadingTransactions(true)
      try {
        const txns = await invoicesApi.getPayments(invoiceId)
        setTransactionCache((prev) => new Map(prev).set(invoiceId, txns))
      } catch {
        toast.error('Failed to load payment history')
      } finally {
        setLoadingTransactions(false)
      }
    }
  }

  const pagination = usePagination()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { pagination.reset() }, [filterStatus, filterProperty, sortBy])
  const canManage = user?.role === 'ADMIN' || user?.role === 'PROPERTY_MANAGER'
  const colCount = canManage ? 8 : 7

  const totalOutstanding = invoices
    .filter((inv) => inv.status !== 'PAID' && inv.status !== 'CANCELLED')
    .reduce((sum, inv) => sum + (inv.outstandingBalance ?? inv.amountDue), 0)

  return (
    <div>
      <PageHeader
        title="Invoices"
        description={`${invoices.filter((inv) => inv.status === 'OVERDUE').length} overdue · ${formatCurrency(totalOutstanding, currency)} outstanding`}
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <SlidersHorizontal className="h-4 w-4 text-muted-foreground shrink-0" />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            {INVOICE_STATUSES.map((s) => (
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
                <TableHead className="w-8" />
                <TableHead className="w-32">Status</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Amount / Type</TableHead>
                <TableHead>Property / Unit</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Paid Date</TableHead>
                {canManage && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableLoadingState rows={5} cols={colCount} />
              ) : filteredAndSorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={colCount} className="text-center py-12 text-muted-foreground">
                    <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p>No invoices found</p>
                  </TableCell>
                </TableRow>
              ) : (
                pagination.paginate(filteredAndSorted).map((invoice) => {
                  const lease    = leaseMap.get(invoice.leaseId)
                  const tenant   = tenantMap.get(invoice.tenantId)
                  const property = lease ? propertyMap.get(lease.propertyId) : undefined
                  const unit     = property?.units?.find((u) => u.id === lease?.unitId)
                  const isExpanded = expandedInvoiceId === invoice.invoiceId
                  const transactions = transactionCache.get(invoice.invoiceId)

                  return (
                    <>
                      <TableRow key={invoice.invoiceId} className="cursor-pointer hover:bg-muted/40" onClick={() => handleExpandToggle(invoice.invoiceId)}>
                        <TableCell className="pr-0">
                          {isExpanded
                            ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={invoice.status} />
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
                            <span className="text-muted-foreground text-xs">{invoice.tenantId}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium">
                              {formatCurrency(invoice.amountDue, currency)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {invoice.type.replace(/_/g, ' ')}
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
                          {safeFormat(invoice.dueDate, 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {safeFormat(invoice.paidDate, 'MMM d, yyyy')}
                        </TableCell>
                        {canManage && (
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1">
                              {invoice.status !== 'PAID' && invoice.status !== 'CANCELLED' && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setCashInvoiceId(invoice.invoiceId)
                                          setCashForm({
                                            amountPaid: invoice.amountDue,
                                            paymentDate: new Date().toISOString(),
                                          })
                                        }}
                                      >
                                        <CircleDollarSign className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Pay by cash</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                              {invoice.status !== 'PAID' && invoice.status !== 'CANCELLED' && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setMpesaInvoice(invoice)}
                                      >
                                        <Smartphone className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Pay with M-Pesa</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                              {invoice.status !== 'PAID' && invoice.status !== 'CANCELLED' && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span>
                                        <Button size="sm" variant="outline" disabled>
                                          <CreditCard className="h-4 w-4" />
                                        </Button>
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>Card payment (coming soon)</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>

                      {/* Expanded transaction history */}
                      {isExpanded && (
                        <TableRow key={`${invoice.invoiceId}-txns`} className="bg-muted/20 hover:bg-muted/20">
                          <TableCell colSpan={colCount} className="py-0">
                            <div className="px-4 py-3">
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                                Payment History
                              </p>
                              {loadingTransactions && !transactions ? (
                                <p className="text-xs text-muted-foreground py-2">Loading…</p>
                              ) : !transactions || transactions.length === 0 ? (
                                <p className="text-xs text-muted-foreground py-2">No payment transactions recorded.</p>
                              ) : (
                                <div className="space-y-1">
                                  {transactions.map((tx) => {
                                    const methodInfo = METHOD_BADGE[tx.method] ?? { label: tx.method, className: '' }
                                    return (
                                      <div key={tx.id} className="flex items-center gap-3 text-xs py-1.5 border-b last:border-0">
                                        <span className="text-muted-foreground w-24 shrink-0">
                                          {safeFormat(tx.paymentDate, 'MMM d, yyyy')}
                                        </span>
                                        <Badge className={`text-xs px-1.5 py-0 ${methodInfo.className}`}>
                                          {methodInfo.label}
                                        </Badge>
                                        <span className="font-medium">
                                          {formatCurrency(tx.amount, currency)}
                                        </span>
                                        <span className="text-muted-foreground font-mono">
                                          {tx.reference ?? '—'}
                                        </span>
                                        <Badge variant={tx.status === 'COMPLETED' ? 'default' : 'destructive'} className="text-xs px-1.5 py-0">
                                          {tx.status}
                                        </Badge>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
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

      {/* Create Invoice Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Invoice</DialogTitle>
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
                    setCreateForm((f) => ({ ...f, type: v as InvoiceType }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INVOICE_TYPES.map((t) => (
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

      {/* M-Pesa Invoice Dialog */}
      {mpesaInvoice && (
        <MpesaInvoiceDialog
          open={mpesaInvoice !== null}
          onOpenChange={(open) => { if (!open) setMpesaInvoice(null) }}
          invoice={mpesaInvoice}
          tenantPhone={tenantMap.get(mpesaInvoice.tenantId)?.phoneNumber ?? ''}
          onSuccess={(updated) => {
            setInvoices((prev) => prev.map((inv) => inv.invoiceId === updated.invoiceId ? updated : inv))
            setTransactionCache((prev) => { const next = new Map(prev); next.delete(mpesaInvoice.invoiceId); return next })
            setMpesaInvoice(null)
          }}
        />
      )}

      {/* Pay by Cash Dialog */}
      <Dialog open={!!cashInvoiceId} onOpenChange={() => setCashInvoiceId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Pay by Cash</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCashPayment} className="space-y-4">
            <div className="space-y-2">
              <Label>Amount Paid</Label>
              <Input
                type="number"
                min={0}
                value={cashForm.amountPaid}
                onChange={(e) =>
                  setCashForm((f) => ({ ...f, amountPaid: Number(e.target.value) }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Date &amp; Time</Label>
              <Input
                value={format(new Date(cashForm.paymentDate || new Date()), 'MMM d, yyyy HH:mm:ss')}
                readOnly
                className="bg-muted text-muted-foreground"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCashInvoiceId(null)}>
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
