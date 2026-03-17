'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardPlus, SlidersHorizontal, Search, X, ArrowUpDown } from 'lucide-react'
import { format, isValid } from 'date-fns'
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { maintenanceApi } from '@/lib/api/maintenance.api'
import { propertiesApi } from '@/lib/api/properties.api'
import { tenantsApi } from '@/lib/api/tenants.api'
import { useAuthStore } from '@/store'
import { useEventLogger } from '@/hooks/useEventLogger'
import { toast } from 'sonner'
import type { MaintenanceRecord, Property, PropertyUnit, Tenant } from '@/types'

type FilterStatus = 'ALL' | 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
type SortKey = 'requestedAt_desc' | 'requestedAt_asc' | 'completedAt_desc' | 'completedAt_asc'

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'requestedAt_desc', label: 'Date Opened (Newest)' },
  { value: 'requestedAt_asc',  label: 'Date Opened (Oldest)' },
  { value: 'completedAt_desc', label: 'Date Closed (Newest)' },
  { value: 'completedAt_asc',  label: 'Date Closed (Oldest)' },
]

function safeFormat(value: string | null | undefined, fmt: string): string {
  if (!value) return '—'
  const d = new Date(value)
  return isValid(d) ? format(d, fmt) : '—'
}

export default function MaintenancePage() {
  const router = useRouter()
  const logEvent = useEventLogger()
  const { user } = useAuthStore()
  const canManage = user?.role === 'ADMIN' || user?.role === 'PROPERTY_MANAGER'

  const [tickets, setTickets] = useState<MaintenanceRecord[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [tenantMap, setTenantMap] = useState<Map<string, Tenant>>(new Map())
  const [isLoading, setIsLoading] = useState(true)

  const [filterStatus, setFilterStatus] = useState<FilterStatus>('ALL')
  const [searchTenant, setSearchTenant] = useState('')
  const [searchUnit, setSearchUnit] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('requestedAt_desc')

  const pagination = usePagination()

  useEffect(() => {
    logEvent('PAGE_VIEW', 'maintenance')
    if (!canManage) {
      setIsLoading(false)
      return
    }
    Promise.all([propertiesApi.getAll(), tenantsApi.getAll()])
      .then(async ([propsData, tenantsData]) => {
        setProperties(propsData)
        setTenantMap(new Map(tenantsData.map((t) => [t.id, t])))
        const arrays = await Promise.all(
          propsData.map((p) => maintenanceApi.getByProperty(p.id).catch(() => [] as MaintenanceRecord[]))
        )
        setTickets(arrays.flat())
      })
      .catch(() => toast.error('Failed to load maintenance data'))
      .finally(() => setIsLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const unitMap = useMemo(() => {
    const m = new Map<string, { unit: PropertyUnit; propertyName: string; propertyId: string }>()
    for (const prop of properties) {
      for (const unit of prop.units) {
        m.set(unit.id, { unit, propertyName: prop.name, propertyId: prop.id })
      }
    }
    return m
  }, [properties])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { pagination.reset() }, [filterStatus, searchTenant, searchUnit, sortBy])

  const filteredTickets = useMemo(() => {
    const tq = searchTenant.trim().toLowerCase()
    const uq = searchUnit.trim().toLowerCase()
    let result = [...tickets]

    if (filterStatus !== 'ALL') result = result.filter((t) => t.status === filterStatus)

    if (tq) {
      result = result.filter((t) => {
        const tenant = tenantMap.get(t.tenantId)
        return tenant
          ? `${tenant.firstName} ${tenant.lastName}`.toLowerCase().includes(tq)
          : false
      })
    }

    if (uq) {
      result = result.filter((t) => {
        if (!t.unitId) return false
        return unitMap.get(t.unitId)?.unit.unitNumber.toLowerCase().includes(uq) ?? false
      })
    }

    result.sort((a, b) => {
      if (sortBy === 'requestedAt_asc')  return new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime()
      if (sortBy === 'requestedAt_desc') return new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
      if (sortBy === 'completedAt_asc') {
        const at = a.completedAt ? new Date(a.completedAt).getTime() : Infinity
        const bt = b.completedAt ? new Date(b.completedAt).getTime() : Infinity
        return at - bt
      }
      if (sortBy === 'completedAt_desc') {
        const at = a.completedAt ? new Date(a.completedAt).getTime() : -Infinity
        const bt = b.completedAt ? new Date(b.completedAt).getTime() : -Infinity
        return bt - at
      }
      return 0
    })

    return result
  }, [tickets, filterStatus, searchTenant, searchUnit, sortBy, tenantMap, unitMap])

  const isFiltered = filterStatus !== 'ALL' || searchTenant !== '' || searchUnit !== '' || sortBy !== 'requestedAt_desc'

  function resetFilters() {
    setFilterStatus('ALL')
    setSearchTenant('')
    setSearchUnit('')
    setSortBy('requestedAt_desc')
  }

  const total      = tickets.length
  const open       = tickets.filter((t) => t.status === 'OPEN' || t.status === 'ASSIGNED').length
  const inProgress = tickets.filter((t) => t.status === 'IN_PROGRESS').length
  const closed     = tickets.filter((t) => t.status === 'COMPLETED' || t.status === 'CANCELLED').length
  const colCount   = 7

  if (!canManage) {
    return (
      <div>
        <PageHeader title="Maintenance" description="Maintenance ticket management" />
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <p className="font-medium text-foreground">Access Restricted</p>
            <p className="text-sm mt-1">You do not have permission to view this page.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Maintenance"
        description={`${filteredTickets.length} of ${total} ticket${total !== 1 ? 's' : ''}`}
        action={
          <Button onClick={() => router.push('/maintenance/new')}>
            <ClipboardPlus className="h-4 w-4 mr-2" /> New Ticket
          </Button>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total',       value: total,      accent: '',               cardClass: 'bg-zinc-50 border-zinc-100 dark:bg-card dark:border-border' },
          { label: 'Open',        value: open,       accent: 'text-sky-600',   cardClass: 'bg-sky-50 border-sky-100 dark:bg-card dark:border-border' },
          { label: 'In Progress', value: inProgress, accent: 'text-amber-600', cardClass: 'bg-amber-50 border-amber-100 dark:bg-card dark:border-border' },
          { label: 'Closed',      value: closed,     accent: 'text-zinc-500',  cardClass: 'bg-zinc-50 border-zinc-100 dark:bg-card dark:border-border' },
        ].map(({ label, value, accent, cardClass }) => (
          <Card key={label} className={cardClass}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">{label}</p>
              <p className={`text-2xl font-semibold ${accent}`}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <SlidersHorizontal className="h-4 w-4 text-muted-foreground shrink-0" />

        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as FilterStatus)}>
          <SelectTrigger className="h-9 w-36 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="OPEN">Open</SelectItem>
            <SelectItem value="ASSIGNED">Assigned</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={searchTenant}
            onChange={(e) => setSearchTenant(e.target.value)}
            placeholder="Search tenant…"
            className="pl-8 h-9 w-44 text-sm"
          />
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={searchUnit}
            onChange={(e) => setSearchUnit(e.target.value)}
            placeholder="Search unit…"
            className="pl-8 h-9 w-36 text-sm"
          />
        </div>

        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
          <SelectTrigger className="h-9 w-52 text-sm">
            <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isFiltered && (
          <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-xs text-muted-foreground" onClick={resetFilters}>
            <X className="h-3.5 w-3.5" />
            Reset
          </Button>
        )}

        {isFiltered && (
          <span className="ml-auto text-xs text-muted-foreground">
            {filteredTickets.length} of {total} tickets
          </span>
        )}
      </div>

      {/* Table */}
      <Card className="pt-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Priority</TableHead>
                <TableHead>Problem</TableHead>
                <TableHead>Property / Unit</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead>Date Opened</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableLoadingState rows={5} cols={colCount} />
              ) : filteredTickets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={colCount} className="text-center py-12 text-muted-foreground">
                    {isFiltered ? 'No tickets match the current filters.' : 'No maintenance tickets found.'}
                  </TableCell>
                </TableRow>
              ) : (
                pagination.paginate(filteredTickets).map((ticket) => {
                  const tenant   = tenantMap.get(ticket.tenantId)
                  const unitEntry = ticket.unitId ? unitMap.get(ticket.unitId) : null
                  return (
                    <TableRow
                      key={ticket.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/maintenance/${ticket.id}`)}
                    >
                      <TableCell>
                        <StatusBadge status={ticket.priority} />
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <span className="text-sm line-clamp-2">{ticket.problemDescription}</span>
                      </TableCell>
                      <TableCell>
                        {unitEntry ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-medium">{unitEntry.propertyName}</span>
                            <span className="text-xs text-muted-foreground">Unit {unitEntry.unit.unitNumber}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {tenant ? (
                          <span className="text-sm">{tenant.firstName} {tenant.lastName}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">System</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={ticket.status} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {safeFormat(ticket.requestedAt, 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => router.push(`/maintenance/${ticket.id}`)}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
          {filteredTickets.length > 10 && (
            <Pagination
              total={filteredTickets.length}
              page={pagination.page}
              pageSize={pagination.pageSize}
              onPageChange={pagination.setPage}
              onPageSizeChange={(s) => { pagination.setPageSize(s); pagination.setPage(1) }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
