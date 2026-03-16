'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, BedDouble, Bath, Maximize2, Building2, MapPin, Calendar, ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Pagination, usePagination } from '@/components/shared/Pagination'
import { propertiesApi } from '@/lib/api/properties.api'
import { occupancyApi } from '@/lib/api/occupancy.api'
import { maintenanceApi } from '@/lib/api/maintenance.api'
import { tenantsApi } from '@/lib/api/tenants.api'
import { useSettingsStore } from '@/store'
import { formatCurrency } from '@/lib/formatCurrency'
import { toast } from 'sonner'
import { format, isValid } from 'date-fns'
import type { Property, PropertyUnit, OccupancyRecord, MaintenanceRecord, Tenant } from '@/types'

function safeFormat(dateStr: string | undefined | null, fmt: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return isValid(d) ? format(d, fmt) : '—'
}

export default function UnitDetailPage() {
  const { id: propertyId, unitId } = useParams<{ id: string; unitId: string }>()
  const router = useRouter()
  const fallbackCurrency = useSettingsStore((s) => s.settings?.currency ?? 'USD')

  const [property, setProperty] = useState<Property | null>(null)
  const [unit, setUnit] = useState<PropertyUnit | null>(null)
  const [occupancy, setOccupancy] = useState<OccupancyRecord[]>([])
  const [tenantMap, setTenantMap] = useState<Record<string, Tenant>>({})
  const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const occupancyPagination = usePagination()

  useEffect(() => {
    async function load() {
      try {
        const [prop, history, maintenanceRecords] = await Promise.all([
          propertiesApi.getById(propertyId),
          occupancyApi.getUnitHistory(unitId),
          maintenanceApi.getByUnit(unitId).catch(() => [] as MaintenanceRecord[]),
        ])

        const foundUnit = prop.units?.find((u) => u.id === unitId) ?? null
        setProperty(prop)
        setUnit(foundUnit)
        setOccupancy(history)
        setMaintenance(maintenanceRecords)

        // Collect unique tenant IDs from both occupancy and maintenance records
        const tenantIds = new Set([
          ...history.map((r) => r.tenantId),
          ...maintenanceRecords.map((r) => r.tenantId),
        ])
        if (tenantIds.size > 0) {
          const tenantsData = await tenantsApi.getAll()
          setTenantMap(Object.fromEntries(tenantsData.map((t) => [t.id, t])))
        }
      } catch {
        toast.error('Failed to load unit details')
      } finally {
        setIsLoading(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, unitId])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-40 bg-muted animate-pulse rounded" />
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, i) => <div key={i} className="h-40 bg-muted animate-pulse rounded-lg" />)}
        </div>
      </div>
    )
  }

  if (!property || !unit) {
    return (
      <div className="text-center py-24 text-muted-foreground">
        <p>Unit not found.</p>
        <Button variant="link" onClick={() => router.push(`/properties/${propertyId}`)}>
          Back to property
        </Button>
      </div>
    )
  }

  const currency = fallbackCurrency

  return (
    <div className="space-y-6">
      {/* Back navigation */}
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-muted-foreground"
        onClick={() => router.push(`/properties/${propertyId}`)}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {property.name}
      </Button>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Unit {unit.unitNumber}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{property.name}</p>
      </div>

      {/* Property + Unit info */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Property card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Property
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">{property.name}</p>
                <p className="text-sm text-muted-foreground capitalize">{property.type?.toLowerCase().replace('_', ' ')}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-sm text-muted-foreground">
                {property.street}, {property.city}, {property.state} {property.zipCode}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Unit card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Unit Details
              </CardTitle>
              <StatusBadge status={unit.status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <BedDouble className="h-4 w-4" />
                {unit.bedrooms} bed{unit.bedrooms !== 1 ? 's' : ''}
              </span>
              <span className="flex items-center gap-1.5">
                <Bath className="h-4 w-4" />
                {unit.bathrooms} bath{unit.bathrooms !== 1 ? 's' : ''}
              </span>
              {unit.squareFootage && (
                <span className="flex items-center gap-1.5">
                  <Maximize2 className="h-4 w-4" />
                  {unit.squareFootage.toLocaleString()} sqft
                </span>
              )}
            </div>
            <Separator />
            <p className="text-xl font-semibold">
              {formatCurrency(unit.monthlyRentAmount, currency)}
              <span className="text-sm font-normal text-muted-foreground">/mo</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Lease History */}
      <section>
        <h2 className="text-base font-semibold mb-3">Lease History</h2>
        {occupancy.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground text-sm">
              No lease history for this unit.
            </CardContent>
          </Card>
        ) : (
          <Card className="pt-0">
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="border-b text-xs text-muted-foreground uppercase tracking-wide">
                    <th className="px-4 py-3 text-left font-medium">Tenant</th>
                    <th className="px-4 py-3 text-left font-medium">Period</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {occupancyPagination.paginate(occupancy).map((record) => {
                    const tenant = tenantMap[record.tenantId]
                    return (
                      <tr
                        key={record.leaseId}
                        className="border-b last:border-0 hover:bg-muted/40 cursor-pointer transition-colors"
                        onClick={() => router.push(`/leasing/${record.leaseId}`)}
                      >
                        <td className="px-4 py-3 font-medium">
                          {tenant
                            ? `${tenant.firstName} ${tenant.lastName}`
                            : <span className="text-muted-foreground">{record.tenantId.slice(0, 8)}…</span>}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {safeFormat(record.leaseStart, 'MMM d, yyyy')}
                          {' — '}
                          {record.leaseEnd
                            ? safeFormat(record.leaseEnd, 'MMM d, yyyy')
                            : <span className="text-green-600 font-medium">Current</span>}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={record.status} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <ChevronRight className="h-4 w-4 text-muted-foreground inline" />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {occupancy.length > 10 && (
                <Pagination
                  total={occupancy.length}
                  page={occupancyPagination.page}
                  pageSize={occupancyPagination.pageSize}
                  onPageChange={occupancyPagination.setPage}
                  onPageSizeChange={(s) => { occupancyPagination.setPageSize(s); occupancyPagination.setPage(1) }}
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
              No maintenance records for this unit.
            </CardContent>
          </Card>
        ) : (
          <Card className="pt-0">
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr className="border-b text-xs text-muted-foreground uppercase tracking-wide">
                    <th className="px-4 py-3 text-left font-medium">Description</th>
                    <th className="px-4 py-3 text-left font-medium">Tenant</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">Priority</th>
                    <th className="px-4 py-3 text-left font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {maintenance.map((r) => {
                    const tenant = tenantMap[r.tenantId]
                    return (
                      <tr key={r.id} className="border-b last:border-0">
                        <td className="px-4 py-2.5 font-medium">
                          {r.problemDescription}
                          {r.resolutionNotes && (
                            <p className="text-xs text-muted-foreground font-normal mt-0.5 line-clamp-1">
                              {r.resolutionNotes}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {tenant ? `${tenant.firstName} ${tenant.lastName}` : '—'}
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
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  )
}

function MaintenanceStatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    OPEN: 'bg-red-50 text-red-700 border-red-100',
    IN_PROGRESS: 'bg-blue-50 text-blue-700 border-blue-100',
    RESOLVED: 'bg-green-50 text-green-700 border-green-100',
    COMPLETED: 'bg-green-50 text-green-700 border-green-100',
    CLOSED: 'bg-zinc-100 text-zinc-600 border-zinc-200',
  }
  const cls = variants[status?.toUpperCase()] ?? 'bg-zinc-100 text-zinc-600 border-zinc-200'
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status ?? '—'}
    </span>
  )
}

