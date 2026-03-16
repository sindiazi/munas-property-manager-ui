'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, MoreHorizontal, Filter, ArrowUpDown, Search } from 'lucide-react'
import { addMonths, addYears, format, differenceInMonths, isValid } from 'date-fns'
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
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { leasesApi } from '@/lib/api/leases.api'
import type { CreateLeaseCommand } from '@/lib/api/leases.api'
import { tenantsApi } from '@/lib/api/tenants.api'
import { propertiesApi } from '@/lib/api/properties.api'
import { useAuthStore, useSettingsStore } from '@/store'
import { useEventLogger } from '@/hooks/useEventLogger'
import { formatCurrency } from '@/lib/formatCurrency'
import { toast } from 'sonner'
import type { Lease, Tenant, Property } from '@/types'
import { cn } from '@/lib/utils'

type LeasePeriod = '6mo' | '1yr' | '2yr'
type FilterStatus = 'ALL' | 'DRAFT' | 'ACTIVE' | 'EXPIRED' | 'TERMINATED'
type FilterDuration = 'ALL' | 'short' | '6mo' | '1yr' | '2yr' | 'long'
type SortKey = 'startDate_asc' | 'startDate_desc' | 'endDate_asc' | 'endDate_desc'

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'startDate_asc', label: 'Start Date (Earliest)' },
  { value: 'startDate_desc', label: 'Start Date (Latest)' },
  { value: 'endDate_asc', label: 'End Date (Earliest)' },
  { value: 'endDate_desc', label: 'End Date (Latest)' },
]

const LEASE_PERIODS: { value: LeasePeriod; label: string }[] = [
  { value: '6mo', label: '6 months' },
  { value: '1yr', label: '1 year' },
  { value: '2yr', label: '2 years' },
]

const DURATION_OPTIONS: { value: FilterDuration; label: string }[] = [
  { value: 'ALL', label: 'Any duration' },
  { value: 'short', label: 'Under 6 months' },
  { value: '6mo', label: '6 – 12 months' },
  { value: '1yr', label: '1 – 2 years' },
  { value: '2yr', label: 'Over 2 years' },
]


function maskId(value?: string | null) {
  if (!value) return '—'
  const clean = value.replace(/\D/g, '')
  if (clean.length >= 4) return `***-**-${clean.slice(-4)}`
  return `***${value.slice(-4)}`
}

function leaseDuration(start: string, end: string) {
  const s = new Date(start)
  const e = new Date(end)
  if (!isValid(s) || !isValid(e)) return '—'
  const months = differenceInMonths(e, s)
  if (months >= 12) {
    const years = Math.round(months / 12)
    return `${years} yr${years !== 1 ? 's' : ''}`
  }
  return `${months} mo${months !== 1 ? 's' : ''}`
}

function safeFormat(dateStr: string | undefined | null, fmt: string) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return isValid(d) ? format(d, fmt) : '—'
}

function leaseDurationMonths(start: string, end: string): number {
  const s = new Date(start)
  const e = new Date(end)
  if (!isValid(s) || !isValid(e)) return 0
  return differenceInMonths(e, s)
}

const emptyForm: CreateLeaseCommand = {
  tenantId: '',
  propertyId: '',
  unitId: '',
  startDate: '',
  endDate: '',
  monthlyRent: 0,
  securityDeposit: 0,
}

export default function LeasingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const logEvent = useEventLogger()
  const { user } = useAuthStore()

  const [leases, setLeases] = useState<Lease[]>([])
  const [tenantMap, setTenantMap] = useState<Record<string, Tenant>>({})
  const [properties, setProperties] = useState<Property[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Filters — default: ACTIVE status, all properties, any duration
  const [searchTenant, setSearchTenant] = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('ACTIVE')
  const [filterProperty, setFilterProperty] = useState<string>('ALL')
  const [filterDuration, setFilterDuration] = useState<FilterDuration>('ALL')
  const [sortBy, setSortBy] = useState<SortKey>('startDate_asc')

  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<CreateLeaseCommand>(emptyForm)
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)
  const [leasePeriod, setLeasePeriod] = useState<LeasePeriod | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [terminateId, setTerminateId] = useState<string | null>(null)
  const [terminateReason, setTerminateReason] = useState('')

  useEffect(() => {
    logEvent('PAGE_VIEW', 'leasing')
    Promise.all([leasesApi.getAll(), tenantsApi.getAll(), propertiesApi.getAll()])
      .then(([leasesData, tenantsData, propertiesData]) => {
        setLeases(leasesData)
        setTenantMap(Object.fromEntries(tenantsData.map((t) => [t.id, t])))
        setProperties(propertiesData)

        // Pre-populate from "Assign Tenant" deep link
        const action = searchParams.get('action')
        const prePropertyId = searchParams.get('propertyId')
        const preUnitId = searchParams.get('unitId')
        if (action === 'create' && prePropertyId && preUnitId) {
          const prop = propertiesData.find((p) => p.id === prePropertyId)
          const unit = prop?.units.find((u) => u.id === preUnitId)
          if (prop && unit) {
            const start = new Date()
            const end = addYears(start, 1)
            setSelectedProperty(prop)
            setLeasePeriod('1yr')
            setForm({
              tenantId: '',
              propertyId: prop.id,
              unitId: unit.id,
              startDate: format(start, 'yyyy-MM-dd'),
              endDate: format(end, 'yyyy-MM-dd'),
              monthlyRent: unit.monthlyRentAmount,
              securityDeposit: unit.monthlyRentAmount,
            })
            setShowCreate(true)
            router.replace('/leasing')
          }
        }
      })
      .catch(() => toast.error('Failed to load data'))
      .finally(() => setIsLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Filtered + sorted leases ─────────────────────────────────────────────
  const filteredLeases = useMemo(() => {
    const query = searchTenant.trim().toLowerCase()
    const result = leases.filter((lease) => {
      if (query) {
        const tenant = tenantMap[lease.tenantId]
        const fullName = tenant ? `${tenant.firstName} ${tenant.lastName}`.toLowerCase() : ''
        if (!fullName.includes(query)) return false
      }
      if (filterStatus !== 'ALL' && lease.status !== filterStatus) return false
      if (filterProperty !== 'ALL' && lease.propertyId !== filterProperty) return false
      if (filterDuration !== 'ALL') {
        const months = leaseDurationMonths(lease.startDate, lease.endDate)
        if (filterDuration === 'short' && months >= 6) return false
        if (filterDuration === '6mo' && (months < 6 || months >= 12)) return false
        if (filterDuration === '1yr' && (months < 12 || months >= 24)) return false
        if (filterDuration === '2yr' && months < 24) return false
      }
      return true
    })

    result.sort((a, b) => {
      const field = sortBy.startsWith('startDate') ? 'startDate' : 'endDate'
      const aTime = new Date(a[field]).getTime()
      const bTime = new Date(b[field]).getTime()
      return sortBy.endsWith('asc') ? aTime - bTime : bTime - aTime
    })

    return result
  }, [leases, searchTenant, tenantMap, filterStatus, filterProperty, filterDuration, sortBy])

  const inactiveTenants = Object.values(tenantMap).filter((t) => t.status === 'INACTIVE')

  function resetCreateDialog() {
    setForm(emptyForm)
    setSelectedProperty(null)
    setLeasePeriod(null)
  }

  function handlePropertyChange(propertyId: string) {
    const prop = properties.find((p) => p.id === propertyId) ?? null
    setSelectedProperty(prop)
    setForm((f) => ({ ...f, propertyId, unitId: '', monthlyRent: 0, securityDeposit: 0 }))
  }

  function handleUnitChange(unitId: string) {
    const unit = selectedProperty?.units.find((u) => u.id === unitId)
    setForm((f) => ({
      ...f,
      unitId,
      monthlyRent: unit?.monthlyRentAmount ?? 0,
      securityDeposit: unit?.monthlyRentAmount ?? 0,
    }))
  }

  function handlePeriodToggle(period: LeasePeriod) {
    if (leasePeriod === period) {
      setLeasePeriod(null)
      setForm((f) => ({ ...f, startDate: '', endDate: '' }))
      return
    }
    setLeasePeriod(period)
    const start = new Date()
    const end =
      period === '6mo' ? addMonths(start, 6) :
      period === '1yr' ? addYears(start, 1) :
      addYears(start, 2)
    setForm((f) => ({
      ...f,
      startDate: format(start, 'yyyy-MM-dd'),
      endDate: format(end, 'yyyy-MM-dd'),
    }))
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const created = await leasesApi.create(form)
      setLeases((prev) => [created, ...prev])
      setShowCreate(false)
      resetCreateDialog()
      logEvent('USER_ACTION', 'create_lease', { leaseId: created.id })
      toast.success('Lease created')
    } catch {
      toast.error('Failed to create lease')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleTerminate() {
    if (!terminateId) return
    setIsSubmitting(true)
    try {
      const updated = await leasesApi.terminate(terminateId, terminateReason)
      setLeases((prev) => prev.map((l) => (l.id === terminateId ? updated : l)))
      setTerminateId(null)
      setTerminateReason('')
      logEvent('USER_ACTION', 'terminate_lease', { leaseId: terminateId })
      toast.success('Lease terminated')
    } catch {
      toast.error('Failed to terminate lease')
    } finally {
      setIsSubmitting(false)
    }
  }

  const currency = useSettingsStore((s) => s.settings?.currency ?? 'USD')
  const canManage = user?.role === 'ADMIN' || user?.role === 'PROPERTY_MANAGER'
  const colCount = canManage ? 6 : 5
  const availableUnits = selectedProperty?.units.filter((u) => u.status === 'AVAILABLE') ?? []

  return (
    <div>
      <PageHeader
        title="Leasing"
        description={`${filteredLeases.length} of ${leases.length} lease agreements`}
        action={
          canManage ? (
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-2" /> New Lease
            </Button>
          ) : undefined
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Filter className="h-4 w-4 text-muted-foreground shrink-0" />

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={searchTenant}
            onChange={(e) => setSearchTenant(e.target.value)}
            placeholder="Search by tenant name…"
            className="pl-8 h-9 w-52"
          />
        </div>

        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as FilterStatus)}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="EXPIRED">Expired</SelectItem>
            <SelectItem value="TERMINATED">Terminated</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterProperty} onValueChange={setFilterProperty}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Property" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All properties</SelectItem>
            {properties.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterDuration} onValueChange={(v) => setFilterDuration(v as FilterDuration)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Duration" />
          </SelectTrigger>
          <SelectContent>
            {DURATION_OPTIONS.map(({ value, label }) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
          <SelectTrigger className="w-52">
            <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map(({ value, label }) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(searchTenant !== '' || filterStatus !== 'ACTIVE' || filterProperty !== 'ALL' || filterDuration !== 'ALL' || sortBy !== 'startDate_asc') && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground h-9"
            onClick={() => {
              setSearchTenant('')
              setFilterStatus('ACTIVE')
              setFilterProperty('ALL')
              setFilterDuration('ALL')
              setSortBy('startDate_asc')
            }}
          >
            Reset
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Status</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Leased Unit</TableHead>
                <TableHead>Rent</TableHead>
                <TableHead>Lease Term</TableHead>
                {canManage && <TableHead className="w-12" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableLoadingState rows={5} cols={colCount} />
              ) : filteredLeases.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={colCount}
                    className="text-center py-12 text-muted-foreground"
                  >
                    <p>No leases match the current filters</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredLeases.map((lease) => {
                  const tenant = tenantMap[lease.tenantId]
                  const property = properties.find((p) => p.id === lease.propertyId)
                  const unit = property?.units.find((u) => u.id === lease.unitId)
                  return (
                    <TableRow key={lease.id}>
                      <TableCell>
                        <StatusBadge status={lease.status} />
                      </TableCell>

                      <TableCell>
                        <button
                          className="flex flex-col gap-0.5 text-left hover:opacity-75 transition-opacity"
                          onClick={() => router.push(`/tenants/${lease.tenantId}`)}
                        >
                          <span className="font-medium text-sm">
                            {tenant
                              ? `${tenant.firstName} ${tenant.lastName}`
                              : `${lease.tenantId.slice(0, 8)}…`}
                          </span>
                          <span className="text-xs text-muted-foreground font-mono tracking-wider">
                            {maskId(tenant?.nationalIdNo)}
                          </span>
                        </button>
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
                          <span className="text-xs text-muted-foreground font-mono">
                            {lease.propertyId.slice(0, 8)}…
                          </span>
                        )}
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-sm">
                            {formatCurrency(lease.monthlyRent, currency)}/mo
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatCurrency(lease.securityDeposit, currency)} deposit
                          </span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-sm">
                            {safeFormat(lease.startDate, 'MMM d, yyyy')}
                            {' – '}
                            {safeFormat(lease.endDate, 'MMM d, yyyy')}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {leaseDuration(lease.startDate, lease.endDate)}
                          </span>
                        </div>
                      </TableCell>

                      {canManage && (
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Open menu</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => router.push(`/leasing/${lease.id}`)}
                              >
                                View details
                              </DropdownMenuItem>
                              {lease.status === 'ACTIVE' && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onClick={() => setTerminateId(lease.id)}
                                  >
                                    Terminate
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Lease Dialog */}
      <Dialog
        open={showCreate}
        onOpenChange={(open) => {
          setShowCreate(open)
          if (!open) resetCreateDialog()
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Lease</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">

            {/* Tenant — dropdown of INACTIVE tenants */}
            <div className="space-y-2">
              <Label>Tenant</Label>
              <Select
                value={form.tenantId}
                onValueChange={(id) => setForm((f) => ({ ...f, tenantId: id }))}
                required
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={
                    inactiveTenants.length === 0 ? 'No inactive tenants' : 'Select a tenant'
                  } />
                </SelectTrigger>
                <SelectContent>
                  {inactiveTenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      <span className="flex items-center gap-2">
                        <span>{t.firstName} {t.lastName}</span>
                        <span className="text-xs text-muted-foreground">{t.nationalIdNo}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Property — dropdown */}
            <div className="space-y-2">
              <Label>Property</Label>
              <Select
                value={form.propertyId}
                onValueChange={handlePropertyChange}
                required
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a property" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((prop) => {
                    const available = prop.units.filter((u) => u.status === 'AVAILABLE').length
                    const total = prop.units.length
                    return (
                      <SelectItem key={prop.id} value={prop.id}>
                        <span className="flex items-center justify-between gap-3 w-full">
                          <span>{prop.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {available}/{total} units available
                          </span>
                        </span>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Unit — dropdown, only available units */}
            <div className="space-y-2">
              <Label>Unit</Label>
              <Select
                value={form.unitId}
                onValueChange={handleUnitChange}
                disabled={!selectedProperty}
                required
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      selectedProperty
                        ? availableUnits.length === 0
                          ? 'No units available'
                          : 'Select a unit'
                        : 'Select a property first'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {availableUnits.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>
                      <span className="flex items-center justify-between gap-3 w-full">
                        <span>Unit {unit.unitNumber}</span>
                        <span className="text-xs text-muted-foreground">
                          {unit.bedrooms}bd / {unit.bathrooms}ba
                          {unit.squareFootage ? ` · ${unit.squareFootage.toLocaleString()} sqft` : ''}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Lease period — toggle buttons */}
            <div className="space-y-2">
              <Label>Lease Period</Label>
              <div className="flex gap-2">
                {LEASE_PERIODS.map(({ value, label }) => (
                  <Button
                    key={value}
                    type="button"
                    variant="outline"
                    size="sm"
                    className={cn(
                      'flex-1',
                      leasePeriod === value && 'border-primary bg-primary/5 text-primary'
                    )}
                    onClick={() => handlePeriodToggle(value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Custom dates — only shown when no period is selected */}
            {leasePeriod === null && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                    required
                  />
                </div>
              </div>
            )}

            {/* Financials — read-only, populated from unit */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-muted-foreground">Monthly Rent ($)</Label>
                <Input
                  readOnly
                  tabIndex={-1}
                  value={form.monthlyRent > 0 ? formatCurrency(form.monthlyRent, currency) : ''}
                  placeholder="Auto-filled from unit"
                  className="bg-muted/50 cursor-default"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Security Deposit ($)</Label>
                <Input
                  readOnly
                  tabIndex={-1}
                  value={form.securityDeposit > 0 ? formatCurrency(form.securityDeposit, currency) : ''}
                  placeholder="Auto-filled from unit"
                  className="bg-muted/50 cursor-default"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => { setShowCreate(false); resetCreateDialog() }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Terminate Lease Dialog */}
      <Dialog
        open={!!terminateId}
        onOpenChange={() => {
          setTerminateId(null)
          setTerminateReason('')
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
            <Button variant="outline" onClick={() => setTerminateId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={isSubmitting} onClick={handleTerminate}>
              {isSubmitting ? 'Terminating...' : 'Terminate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
