'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { maintenanceApi } from '@/lib/api/maintenance.api'
import { maintenanceCategoriesApi } from '@/lib/api/maintenanceCategories.api'
import { propertiesApi } from '@/lib/api/properties.api'
import { tenantsApi } from '@/lib/api/tenants.api'
import { occupancyApi } from '@/lib/api/occupancy.api'
import { useAuthStore } from '@/store'
import { useEventLogger } from '@/hooks/useEventLogger'
import { toast } from 'sonner'
import type { Property, PropertyUnit, Tenant, MaintenancePriority, MaintenanceCategory } from '@/types'
import { cn } from '@/lib/utils'

// ── Priority toggle config ────────────────────────────────────────────────────

const PRIORITY_CONFIG: { value: MaintenancePriority; label: string; selectedClass: string }[] = [
  {
    value: 'LOW',
    label: 'Low',
    selectedClass: 'border-zinc-400 bg-zinc-100 text-zinc-700 dark:border-zinc-500 dark:bg-zinc-800 dark:text-zinc-300',
  },
  {
    value: 'MEDIUM',
    label: 'Medium',
    selectedClass: 'border-yellow-400 bg-yellow-50 text-yellow-700 dark:border-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  {
    value: 'HIGH',
    label: 'High',
    selectedClass: 'border-orange-400 bg-orange-50 text-orange-700 dark:border-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
  },
  {
    value: 'EMERGENCY',
    label: 'Emergency',
    selectedClass: 'border-red-400 bg-red-50 text-red-700 dark:border-red-600 dark:bg-red-900/30 dark:text-red-400',
  },
]

// ── Form state ────────────────────────────────────────────────────────────────

interface FormState {
  propertyId: string
  unitId: string
  tenantId: string
  priority: MaintenancePriority | ''
  problemDescription: string
}

const emptyForm: FormState = { propertyId: '', unitId: '', tenantId: '', priority: '', problemDescription: '' }

const DEFAULT_PLACEHOLDER = 'Describe the maintenance issue in detail…'

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NewMaintenanceTicketPage() {
  const router = useRouter()
  const logEvent = useEventLogger()
  const { user } = useAuthStore()
  const canManage = user?.role === 'ADMIN' || user?.role === 'PROPERTY_MANAGER'

  const [properties, setProperties] = useState<Property[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [categories, setCategories] = useState<MaintenanceCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)
  const [selectedUnit, setSelectedUnit] = useState<PropertyUnit | null>(null)
  const [inferredTenantDisplay, setInferredTenantDisplay] = useState('')
  const [isTenantLoading, setIsTenantLoading] = useState(false)

  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [selectedIssueId, setSelectedIssueId] = useState('')
  const [descriptionPlaceholder, setDescriptionPlaceholder] = useState(DEFAULT_PLACEHOLDER)

  const [form, setForm] = useState<FormState>(emptyForm)

  useEffect(() => {
    logEvent('PAGE_VIEW', 'maintenance_new')
    Promise.all([
      propertiesApi.getAll(),
      tenantsApi.getAll(),
      maintenanceCategoriesApi.getAll(),
    ])
      .then(([props, tens, cats]) => {
        setProperties(props)
        setTenants(tens)
        setCategories(cats)
      })
      .catch(() => toast.error('Failed to load data'))
      .finally(() => setIsLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handlePropertyChange(propertyId: string) {
    const prop = properties.find((p) => p.id === propertyId) ?? null
    setSelectedProperty(prop)
    setSelectedUnit(null)
    setInferredTenantDisplay('')
    setForm((f) => ({ ...f, propertyId, unitId: '', tenantId: '' }))
  }

  async function handleUnitChange(unitId: string) {
    const unit = selectedProperty?.units.find((u) => u.id === unitId) ?? null
    setSelectedUnit(unit)
    setForm((f) => ({ ...f, unitId, tenantId: '' }))
    setInferredTenantDisplay('')

    if (!unit) return

    if (unit.status !== 'OCCUPIED') {
      setInferredTenantDisplay('Vacant unit — system admin will be assigned')
      return
    }

    setIsTenantLoading(true)
    try {
      const history = await occupancyApi.getUnitHistory(unitId)
      const active = history.find((r) => r.status === 'ACTIVE')
      if (active) {
        const tenant = tenants.find((t) => t.id === active.tenantId)
        setForm((f) => ({ ...f, tenantId: active.tenantId }))
        setInferredTenantDisplay(
          tenant
            ? `${tenant.firstName} ${tenant.lastName}`
            : `Tenant ${active.tenantId.slice(0, 8)}…`,
        )
      } else {
        setInferredTenantDisplay('No active tenant found')
      }
    } catch {
      setInferredTenantDisplay('Could not determine tenant')
    } finally {
      setIsTenantLoading(false)
    }
  }

  function handleCategoryChange(categoryId: string) {
    setSelectedCategoryId(categoryId)
    setSelectedIssueId('')
    setDescriptionPlaceholder(DEFAULT_PLACEHOLDER)
    setForm((f) => ({ ...f, priority: '' }))
  }

  function handleIssueChange(issueId: string) {
    const category = categories.find((c) => c.id === selectedCategoryId)
    const issue = category?.issues.find((i) => i.id === issueId)
    if (!issue) return

    setSelectedIssueId(issueId)
    setDescriptionPlaceholder(issue.description)
    setForm((f) => ({ ...f, priority: issue.priority }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.priority) {
      toast.error('Please select a priority level')
      return
    }
    setIsSubmitting(true)
    try {
      const ticket = await maintenanceApi.create({
        propertyId: form.propertyId,
        unitId: form.unitId,
        tenantId: form.tenantId,
        priority: form.priority,
        problemDescription: form.problemDescription,
      })
      logEvent('USER_ACTION', 'create_maintenance_ticket', { ticketId: ticket.id })
      toast.success('Maintenance ticket submitted')
      router.push('/maintenance')
    } catch {
      toast.error('Failed to submit ticket')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Access guard ─────────────────────────────────────────────────────────────

  if (!canManage) {
    return (
      <div>
        <PageHeader title="New Maintenance Ticket" description="" />
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <p>You do not have permission to create maintenance tickets.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId)
  const isFormValid = form.propertyId && form.unitId && form.tenantId && form.priority && form.problemDescription.trim()

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div>
      <PageHeader
        title="New Maintenance Ticket"
        description="Submit a maintenance request for a property unit"
      />

      <div className="max-w-xl">
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Property */}
              <div className="space-y-2">
                <Label>Property <span className="text-destructive">*</span></Label>
                <Select
                  value={form.propertyId}
                  onValueChange={handlePropertyChange}
                  disabled={isLoading}
                  required
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={isLoading ? 'Loading…' : 'Select a property'} />
                  </SelectTrigger>
                  <SelectContent>
                    {properties.map((prop) => (
                      <SelectItem key={prop.id} value={prop.id}>
                        <span className="flex items-center justify-between gap-3">
                          <span>{prop.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {prop.units.length} unit{prop.units.length !== 1 ? 's' : ''}
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Unit */}
              <div className="space-y-2">
                <Label>Unit <span className="text-destructive">*</span></Label>
                <Select
                  value={form.unitId}
                  onValueChange={handleUnitChange}
                  disabled={!selectedProperty}
                  required
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={
                        !selectedProperty
                          ? 'Select a property first'
                          : selectedProperty.units.length === 0
                          ? 'No units found'
                          : 'Select a unit'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {(selectedProperty?.units ?? []).map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>
                        <span className="flex items-center justify-between gap-3">
                          <span>Unit {unit.unitNumber}</span>
                          <span className="text-xs text-muted-foreground capitalize">
                            {unit.bedrooms}bd / {unit.bathrooms}ba
                            {' · '}
                            {unit.status.toLowerCase().replace('_', ' ')}
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Inferred tenant */}
              {(selectedUnit || isTenantLoading) && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Tenant (inferred)</Label>
                  <Input
                    readOnly
                    tabIndex={-1}
                    value={isTenantLoading ? 'Loading…' : inferredTenantDisplay}
                    className="bg-muted/50 cursor-default"
                  />
                </div>
              )}

              {/* Category */}
              <div className="space-y-2">
                <Label>Category <span className="text-destructive">*</span></Label>
                <Select value={selectedCategoryId} onValueChange={handleCategoryChange} disabled={isLoading} required>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={isLoading ? 'Loading…' : 'Select a category'} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Issue type — cascades from category */}
              <div className="space-y-2">
                <Label>Issue Type <span className="text-destructive">*</span></Label>
                <Select
                  value={selectedIssueId}
                  onValueChange={handleIssueChange}
                  disabled={!selectedCategoryId}
                  required
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={
                        !selectedCategoryId ? 'Select a category first' : 'Select an issue type'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {(selectedCategory?.issues ?? []).map((issue) => (
                      <SelectItem key={issue.id} value={issue.id}>{issue.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Priority — auto-filled by issue selection, still manually overridable */}
              <div className="space-y-2">
                <Label>
                  Priority <span className="text-destructive">*</span>
                  {selectedIssueId && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      (suggested by issue type)
                    </span>
                  )}
                </Label>
                <div className="flex gap-2">
                  {PRIORITY_CONFIG.map(({ value, label, selectedClass }) => (
                    <Button
                      key={value}
                      type="button"
                      variant="outline"
                      size="sm"
                      className={cn('flex-1', form.priority === value && selectedClass)}
                      onClick={() => setForm((f) => ({ ...f, priority: value }))}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Problem description */}
              <div className="space-y-2">
                <Label htmlFor="description">
                  Problem Description <span className="text-destructive">*</span>
                </Label>
                <textarea
                  id="description"
                  value={form.problemDescription}
                  onChange={(e) => setForm((f) => ({ ...f, problemDescription: e.target.value }))}
                  placeholder={descriptionPlaceholder}
                  rows={4}
                  required
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/maintenance')}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting || !isFormValid}>
                  {isSubmitting ? 'Submitting…' : 'Submit Ticket'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
