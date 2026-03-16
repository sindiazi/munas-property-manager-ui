'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Users, FileText, CreditCard } from 'lucide-react'
import { StatCard } from '@/components/shared/StatCard'
import { PageHeader } from '@/components/shared/PageHeader'
import { CardLoadingState } from '@/components/shared/LoadingState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { propertiesApi } from '@/lib/api/properties.api'
import { tenantsApi } from '@/lib/api/tenants.api'
import { leasesApi } from '@/lib/api/leases.api'
import { paymentsApi } from '@/lib/api/payments.api'
import { useEventLogger } from '@/hooks/useEventLogger'
import { useSettingsStore } from '@/store'
import { formatCurrency } from '@/lib/formatCurrency'
import type { Property, Tenant, Lease, Payment } from '@/types'
import { format, isValid } from 'date-fns'

function safeFormat(dateStr: string | undefined | null, fmt: string) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return isValid(d) ? format(d, fmt) : '—'
}

export default function DashboardPage() {
  const router = useRouter()
  const logEvent = useEventLogger()
  const currency = useSettingsStore((s) => s.settings?.currency ?? 'USD')
  const [properties, setProperties] = useState<Property[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [leases, setLeases] = useState<Lease[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    logEvent('PAGE_VIEW', 'dashboard')
    async function loadData() {
      try {
        const [props, tens, ls, pays] = await Promise.allSettled([
          propertiesApi.getAll(),
          tenantsApi.getAll(),
          leasesApi.getAll(),
          paymentsApi.getAll(),
        ])
        if (props.status === 'fulfilled') setProperties(props.value)
        if (tens.status === 'fulfilled') setTenants(tens.value)
        if (ls.status === 'fulfilled') setLeases(ls.value)
        if (pays.status === 'fulfilled') setPayments(pays.value)
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const activeLeases = leases.filter((l) => l.status === 'ACTIVE').length
  const overduePayments = payments.filter((p) => p.status === 'OVERDUE').length

  const propertyMap = Object.fromEntries(properties.map((p) => [p.id, p]))
  const tenantMap = Object.fromEntries(tenants.map((t) => [t.id, t]))
  const leaseMap = Object.fromEntries(leases.map((l) => [l.id, l]))

  const recentLeases = [...leases]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6)

  const recentPayments = [...payments]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6)

  return (
    <div>
      <PageHeader title="Dashboard" description="Overview of your property portfolio" />

      {isLoading ? (
        <div className="mb-8">
          <CardLoadingState />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Properties"
            value={properties.length}
            icon={Building2}
            href="/properties"
            colorClass="bg-green-50 border-green-100"
            iconColorClass="text-green-600"
          />
          <StatCard
            label="Tenants"
            value={tenants.length}
            icon={Users}
            href="/tenants"
            colorClass="bg-orange-50 border-orange-100"
            iconColorClass="text-orange-600"
          />
          <StatCard
            label="Active Leases"
            value={activeLeases}
            icon={FileText}
            href="/leasing"
            colorClass="bg-blue-50 border-blue-100"
            iconColorClass="text-blue-600"
          />
          <StatCard
            label="Overdue Payments"
            value={overduePayments}
            icon={CreditCard}
            href="/payments"
            colorClass="bg-pink-50 border-pink-100"
            iconColorClass="text-pink-600"
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Recent Leases</CardTitle>
          </CardHeader>
          <CardContent>
            {recentLeases.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No leases found</p>
            ) : (
              <div className="space-y-1">
                {recentLeases.map((lease) => {
                  const property = propertyMap[lease.propertyId]
                  const unit = property?.units?.find((u) => u.id === lease.unitId)
                  const tenant = tenantMap[lease.tenantId]
                  return (
                    <div
                      key={lease.id}
                      className="flex items-center justify-between py-2.5 border-b last:border-0 cursor-pointer hover:bg-muted/40 -mx-2 px-2 rounded transition-colors"
                      onClick={() => router.push(`/leasing/${lease.id}`)}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {tenant ? `${tenant.firstName} ${tenant.lastName}` : '—'}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {property?.name ?? lease.propertyId.slice(0, 8)}
                          {unit ? ` · Unit ${unit.unitNumber}` : ''}
                          {' · '}
                          {safeFormat(lease.startDate, 'MMM d, yyyy')}
                          {' – '}
                          {safeFormat(lease.endDate, 'MMM d, yyyy')}
                        </p>
                      </div>
                      <StatusBadge status={lease.status} />
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Recent Payments</CardTitle>
          </CardHeader>
          <CardContent>
            {recentPayments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No payments found</p>
            ) : (
              <div className="space-y-1">
                {recentPayments.map((payment) => {
                  const tenant = tenantMap[payment.tenantId]
                  const lease = leaseMap[payment.leaseId]
                  const property = lease ? propertyMap[lease.propertyId] : undefined
                  const unit = property?.units?.find((u) => u.id === lease?.unitId)
                  return (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between py-2.5 border-b last:border-0"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {tenant ? `${tenant.firstName} ${tenant.lastName}` : '—'}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {property?.name ?? '—'}
                          {unit ? ` · Unit ${unit.unitNumber}` : ''}
                          {' · '}
                          {formatCurrency(payment.amountDue, currency)}
                          {' · Due '}
                          {safeFormat(payment.dueDate, 'MMM d, yyyy')}
                        </p>
                      </div>
                      <StatusBadge status={payment.status} />
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
