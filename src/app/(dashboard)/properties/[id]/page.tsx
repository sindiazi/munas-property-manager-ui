'use client'
import { useEffect, useState, useMemo, type ComponentType } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { BedDouble, Bath, Maximize2, MoreHorizontal, CalendarX, CalendarCheck, FileText, UserPlus, ChevronLeft, ChevronRight, Home, UtensilsCrossed, LayoutTemplate, SlidersHorizontal, X } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { propertiesApi } from '@/lib/api/properties.api'
import { occupancyApi } from '@/lib/api/occupancy.api'
import { useAuthStore, useSettingsStore, useBreadcrumbStore } from '@/store'
import { useEventLogger } from '@/hooks/useEventLogger'
import { formatCurrency } from '@/lib/formatCurrency'
import { toast } from 'sonner'
import type { Property, PropertyUnit, UnavailabilityRecord } from '@/types'
import { format } from 'date-fns'

const LEASE_PERIODS = ['6 months', '1 year', '2 years']

// Session-scoped filter cache keyed by property ID.
// Populated on every filter change; read on mount to restore state.
// Cleared on page refresh (module re-initialises).
interface FilterState {
  filterStatus: string
  filterBedrooms: string
  filterBathrooms: string
  sortBy: string
}
const filterCache = new Map<string, FilterState>()

function generateId() {
  return Math.random().toString(36).slice(2, 10)
}

interface UnavailableDialogState {
  unitId: string
  unitNumber: string
}

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const logEvent = useEventLogger()
  const { user } = useAuthStore()

  const setLabel = useBreadcrumbStore((s) => s.setLabel)

  const [property, setProperty] = useState<Property | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Mark unavailable dialog
  const [unavailableTarget, setUnavailableTarget] = useState<UnavailableDialogState | null>(null)
  const [unavailableForm, setUnavailableForm] = useState({
    reason: '',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: '',
  })

  // Mark available confirm dialog
  const [availableTarget, setAvailableTarget] = useState<UnavailableDialogState | null>(null)

  useEffect(() => {
    logEvent('PAGE_VIEW', 'property_detail', { propertyId: id })
    propertiesApi
      .getById(id)
      .then((p) => { setProperty(p); setLabel(id, p.name) })
      .catch(() => toast.error('Failed to load property'))
      .finally(() => setIsLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  function updateUnit(unitId: string, changes: Partial<PropertyUnit>) {
    setProperty((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        units: prev.units.map((u) => u.id === unitId ? { ...u, ...changes } : u),
      }
    })
  }

  async function handleMarkUnavailable() {
    if (!unavailableTarget) return
    const { unitId } = unavailableTarget

    const record: UnavailabilityRecord = {
      id: generateId(),
      reason: unavailableForm.reason,
      startDate: unavailableForm.startDate,
      endDate: unavailableForm.endDate || undefined,
      createdAt: new Date().toISOString(),
    }

    // Snapshot for rollback
    const unit = property?.units.find((u) => u.id === unitId)
    const snapshot = unit ? { status: unit.status, currentUnavailability: unit.currentUnavailability, unavailabilityHistory: unit.unavailabilityHistory } : null

    // Optimistic update
    updateUnit(unitId, {
      status: 'UNAVAILABLE',
      currentUnavailability: record,
      unavailabilityHistory: [record, ...(unit?.unavailabilityHistory ?? [])],
    })
    setUnavailableTarget(null)
    setUnavailableForm({ reason: '', startDate: format(new Date(), 'yyyy-MM-dd'), endDate: '' })
    setIsSubmitting(true)

    try {
      const updated = await propertiesApi.markUnitUnavailable(unitId, {
        reason: record.reason,
        startDate: record.startDate,
        endDate: record.endDate,
      })
      // Reconcile with server response
      updateUnit(unitId, {
        status: updated.status,
        currentUnavailability: updated.currentUnavailability,
        unavailabilityHistory: updated.unavailabilityHistory,
      })
      toast.success('Unit marked as unavailable')
      logEvent('USER_ACTION', 'mark_unit_unavailable', { unitId, reason: record.reason })
    } catch {
      // Rollback optimistic update
      if (snapshot) updateUnit(unitId, snapshot)
      toast.error('Failed to update unit — please try again')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleMarkAvailable() {
    if (!availableTarget) return
    const { unitId } = availableTarget

    // Snapshot for rollback
    const unit = property?.units.find((u) => u.id === unitId)
    const snapshot = unit ? { status: unit.status, currentUnavailability: unit.currentUnavailability } : null

    // Optimistic update
    updateUnit(unitId, { status: 'AVAILABLE', currentUnavailability: null })
    setAvailableTarget(null)
    setIsSubmitting(true)

    try {
      const updated = await propertiesApi.markUnitAvailable(unitId)
      updateUnit(unitId, {
        status: updated.status,
        currentUnavailability: updated.currentUnavailability,
        unavailabilityHistory: updated.unavailabilityHistory,
      })
      toast.success('Unit marked as available')
      logEvent('USER_ACTION', 'mark_unit_available', { unitId })
    } catch {
      // Rollback optimistic update
      if (snapshot) updateUnit(unitId, snapshot)
      toast.error('Failed to update unit — please try again')
    } finally {
      setIsSubmitting(false)
    }
  }

  const currency = useSettingsStore((s) => s.settings?.currency ?? 'USD')
  const canManage = user?.role === 'ADMIN' || user?.role === 'PROPERTY_MANAGER'

  // Filters & sort — restored from session cache if available, otherwise default to AVAILABLE
  const cached = filterCache.get(id)
  const [filterStatus, setFilterStatus] = useState<string>(cached?.filterStatus ?? 'AVAILABLE')
  const [filterBedrooms, setFilterBedrooms] = useState<string>(cached?.filterBedrooms ?? 'all')
  const [filterBathrooms, setFilterBathrooms] = useState<string>(cached?.filterBathrooms ?? 'all')
  const [sortBy, setSortBy] = useState<string>(cached?.sortBy ?? 'default')

  // Persist filter state to session cache whenever it changes
  useEffect(() => {
    filterCache.set(id, { filterStatus, filterBedrooms, filterBathrooms, sortBy })
  }, [id, filterStatus, filterBedrooms, filterBathrooms, sortBy])

  const bedroomOptions = useMemo(
    () => [...new Set((property?.units ?? []).map((u) => u.bedrooms))].sort((a, b) => a - b),
    [property],
  )
  const bathroomOptions = useMemo(
    () => [...new Set((property?.units ?? []).map((u) => u.bathrooms))].sort((a, b) => a - b),
    [property],
  )
  const filteredUnits = useMemo(() => {
    const units = property?.units ?? []
    let result = [...units]
    if (filterStatus !== 'all') result = result.filter((u) => u.status === filterStatus)
    if (filterBedrooms !== 'all') result = result.filter((u) => u.bedrooms === Number(filterBedrooms))
    if (filterBathrooms !== 'all') result = result.filter((u) => u.bathrooms === Number(filterBathrooms))
    if (sortBy === 'price_asc') result.sort((a, b) => a.monthlyRentAmount - b.monthlyRentAmount)
    else if (sortBy === 'price_desc') result.sort((a, b) => b.monthlyRentAmount - a.monthlyRentAmount)
    else if (sortBy === 'size_asc') result.sort((a, b) => (a.squareFootage ?? 0) - (b.squareFootage ?? 0))
    else if (sortBy === 'size_desc') result.sort((a, b) => (b.squareFootage ?? 0) - (a.squareFootage ?? 0))
    return result
  }, [property, filterStatus, filterBedrooms, filterBathrooms, sortBy])
  const isFiltered = filterStatus !== 'AVAILABLE' || filterBedrooms !== 'all' || filterBathrooms !== 'all' || sortBy !== 'default'

  function resetFilters() {
    setFilterStatus('AVAILABLE')
    setFilterBedrooms('all')
    setFilterBathrooms('all')
    setSortBy('default')
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-40 bg-muted animate-pulse rounded" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-56 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (!property) {
    return (
      <div className="text-center py-24 text-muted-foreground">
        <p>Property not found.</p>
        <Button variant="link" onClick={() => router.push('/properties')}>
          Back to properties
        </Button>
      </div>
    )
  }

  const available = property.units?.filter((u) => u.status === 'AVAILABLE').length ?? 0
  const occupied = property.units?.filter((u) => u.status === 'OCCUPIED').length ?? 0
  const unavailable = property.units?.filter((u) => u.status === 'UNAVAILABLE').length ?? 0
  const total = property.units?.length ?? 0

  return (
    <div>
      <PageHeader
        title={property.name}
        description={`${property.street}, ${property.city}, ${property.state} ${property.zipCode}`}
      />

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total units',  value: total,       accent: '',                  cardClass: 'bg-zinc-50 border-zinc-100 dark:bg-card dark:border-border' },
          { label: 'Available',    value: available,   accent: 'text-green-600',    cardClass: 'bg-green-50 border-green-100 dark:bg-card dark:border-border' },
          { label: 'Occupied',     value: occupied,    accent: 'text-blue-600',     cardClass: 'bg-blue-50 border-blue-100 dark:bg-card dark:border-border' },
          { label: 'Unavailable',  value: unavailable, accent: 'text-amber-600',    cardClass: 'bg-amber-50 border-amber-100 dark:bg-card dark:border-border' },
        ].map(({ label, value, accent, cardClass }) => (
          <Card key={label} className={cardClass}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">{label}</p>
              <p className={`text-2xl font-semibold ${accent}`}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter / sort bar */}
      {total > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground shrink-0" />

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue placeholder="Availability" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="AVAILABLE">Available</SelectItem>
              <SelectItem value="OCCUPIED">Occupied</SelectItem>
              <SelectItem value="UNAVAILABLE">Unavailable</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterBedrooms} onValueChange={setFilterBedrooms}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue placeholder="Bedrooms" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All bedrooms</SelectItem>
              {bedroomOptions.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} {n === 1 ? 'bedroom' : 'bedrooms'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterBathrooms} onValueChange={setFilterBathrooms}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue placeholder="Bathrooms" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All bathrooms</SelectItem>
              {bathroomOptions.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} {n === 1 ? 'bathroom' : 'bathrooms'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default order</SelectItem>
              <SelectItem value="price_asc">Price: low → high</SelectItem>
              <SelectItem value="price_desc">Price: high → low</SelectItem>
              <SelectItem value="size_asc">Size: small → large</SelectItem>
              <SelectItem value="size_desc">Size: large → small</SelectItem>
            </SelectContent>
          </Select>

          {isFiltered && (
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground" onClick={resetFilters}>
              <X className="h-3.5 w-3.5" />
              Reset
            </Button>
          )}

          {isFiltered && (
            <span className="ml-auto text-xs text-muted-foreground">
              {filteredUnits.length} of {total} units
            </span>
          )}
        </div>
      )}

      {/* Units grid */}
      {total === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <p>No units have been added to this property yet.</p>
          </CardContent>
        </Card>
      ) : filteredUnits.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <p>No units match your current filters.</p>
            <Button variant="link" onClick={resetFilters}>Clear filters</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredUnits.map((unit) => (
            <UnitCard
              key={unit.id}
              unit={unit}
              propertyId={id}
              fallbackCurrency={currency}
              canManage={canManage}
              onMarkUnavailable={() =>
                setUnavailableTarget({ unitId: unit.id, unitNumber: unit.unitNumber })
              }
              onMarkAvailable={() =>
                setAvailableTarget({ unitId: unit.id, unitNumber: unit.unitNumber })
              }
            />
          ))}
        </div>
      )}

      {/* Mark Unavailable Dialog */}
      <Dialog
        open={!!unavailableTarget}
        onOpenChange={(open) => {
          if (!open) {
            setUnavailableTarget(null)
            setUnavailableForm({ reason: '', startDate: format(new Date(), 'yyyy-MM-dd'), endDate: '' })
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Mark Unit {unavailableTarget?.unitNumber} as Unavailable
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Reason</Label>
              <Input
                value={unavailableForm.reason}
                onChange={(e) => setUnavailableForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="e.g. Plumbing repair, Renovation"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={unavailableForm.startDate}
                  onChange={(e) => setUnavailableForm((f) => ({ ...f, startDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>
                  End Date
                  <span className="ml-1 text-xs text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  type="date"
                  value={unavailableForm.endDate}
                  onChange={(e) => setUnavailableForm((f) => ({ ...f, endDate: e.target.value }))}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Leave end date empty if the duration is not yet known.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnavailableTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isSubmitting || !unavailableForm.reason.trim()}
              onClick={handleMarkUnavailable}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark Available Confirm Dialog */}
      <Dialog open={!!availableTarget} onOpenChange={(open) => !open && setAvailableTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Mark Unit {availableTarget?.unitNumber} as Available
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will clear the current unavailability and make the unit available for leasing again.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAvailableTarget(null)}>
              Cancel
            </Button>
            <Button disabled={isSubmitting} onClick={handleMarkAvailable}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Unit Image Carousel ───────────────────────────────────────────────────────

type SlideDefinition = {
  label: string
  icon: ComponentType<{ className?: string }>
  bg: string
  iconColor: string
}

function buildSlides(unit: PropertyUnit): SlideDefinition[] {
  const bedrooms: SlideDefinition[] = Array.from({ length: unit.bedrooms }, (_, i) => ({
    label: unit.bedrooms > 1 ? `Bedroom ${i + 1}` : 'Bedroom',
    icon: BedDouble,
    bg: 'from-indigo-50 to-indigo-100 dark:from-indigo-900/30 dark:to-indigo-800/30',
    iconColor: 'text-indigo-400 dark:text-indigo-500',
  }))

  return [
    {
      label: 'Living Room',
      icon: Home,
      bg: 'from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30',
      iconColor: 'text-blue-400 dark:text-blue-500',
    },
    ...bedrooms,
    {
      label: 'Kitchen',
      icon: UtensilsCrossed,
      bg: 'from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/30',
      iconColor: 'text-amber-400 dark:text-amber-500',
    },
    {
      label: 'Bathroom',
      icon: Bath,
      bg: 'from-teal-50 to-teal-100 dark:from-teal-900/30 dark:to-teal-800/30',
      iconColor: 'text-teal-400 dark:text-teal-500',
    },
    {
      label: 'Floor Plan',
      icon: LayoutTemplate,
      bg: 'from-slate-100 to-slate-200 dark:from-slate-800/50 dark:to-slate-700/50',
      iconColor: 'text-slate-400 dark:text-slate-500',
    },
  ]
}

function UnitImageCarousel({ unit }: { unit: PropertyUnit }) {
  const [current, setCurrent] = useState(0)
  const slides = useMemo(() => buildSlides(unit), [unit])
  const prev = () => setCurrent((c) => (c - 1 + slides.length) % slides.length)
  const next = () => setCurrent((c) => (c + 1) % slides.length)
  const slide = slides[current]
  const Icon = slide.icon

  return (
    <div className="relative w-full h-44 overflow-hidden select-none">
      {/* Slide background */}
      <div className={`absolute inset-0 bg-gradient-to-br ${slide.bg} flex flex-col items-center justify-center gap-2 transition-colors duration-300`}>
        <Icon className={`h-12 w-12 ${slide.iconColor} opacity-60`} />
        <span className="text-xs font-medium text-muted-foreground tracking-wide uppercase">{slide.label}</span>
      </div>

      {/* Prev / Next */}
      <button
        onClick={prev}
        className="absolute left-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-background/70 hover:bg-background/90 flex items-center justify-center shadow-sm transition-colors"
        aria-label="Previous image"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        onClick={next}
        className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-background/70 hover:bg-background/90 flex items-center justify-center shadow-sm transition-colors"
        aria-label="Next image"
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      {/* Dot indicators */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={`rounded-full transition-all duration-200 ${i === current ? 'w-3 h-1.5 bg-foreground/60' : 'w-1.5 h-1.5 bg-foreground/25 hover:bg-foreground/40'}`}
          />
        ))}
      </div>
    </div>
  )
}

// ── Unit Card ────────────────────────────────────────────────────────────────

interface UnitCardProps {
  unit: PropertyUnit
  propertyId: string
  fallbackCurrency: string
  canManage: boolean
  onMarkUnavailable: () => void
  onMarkAvailable: () => void
}

function UnitCard({ unit, propertyId, fallbackCurrency, canManage, onMarkUnavailable, onMarkAvailable }: UnitCardProps) {
  const router = useRouter()
  const [showHistory, setShowHistory] = useState(false)
  const [isLoadingLease, setIsLoadingLease] = useState(false)
  const history = unit.unavailabilityHistory ?? []
  const currency = fallbackCurrency

  async function handleViewCurrentLease() {
    setIsLoadingLease(true)
    try {
      const occupancy = await occupancyApi.getUnitHistory(unit.id)
      if (!occupancy.length) {
        toast.error('No lease history found for this unit')
        return
      }
      const latest = occupancy[occupancy.length - 1]
      router.push(`/leasing/${latest.leaseId}`)
    } catch {
      toast.error('Could not load lease details')
    } finally {
      setIsLoadingLease(false)
    }
  }

  return (
    <Card className="flex flex-col overflow-hidden">
      <UnitImageCarousel unit={unit} />
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Unit {unit.unitNumber}</CardTitle>
          <div className="flex items-center gap-2">
            <StatusBadge status={unit.status} />
            {canManage && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Unit actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-max">
                  <DropdownMenuItem
                    onClick={() => router.push(`/properties/${propertyId}/units/${unit.id}`)}
                  >
                    <FileText className="h-4 w-4" />
                    Unit Details
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={unit.status !== 'OCCUPIED' || isLoadingLease}
                    onClick={handleViewCurrentLease}
                  >
                    <FileText className="h-4 w-4" />
                    {isLoadingLease ? 'Loading…' : 'Current Lease'}
                  </DropdownMenuItem>

                  {/* Availability actions */}
                  {unit.status === 'AVAILABLE' && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() =>
                          router.push(`/leasing?action=create&propertyId=${propertyId}&unitId=${unit.id}`)
                        }
                      >
                        <UserPlus className="h-4 w-4" />
                        Assign Tenant
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={onMarkUnavailable}>
                        <CalendarX className="h-4 w-4" />
                        Mark Unavailable
                      </DropdownMenuItem>
                    </>
                  )}
                  {unit.status === 'UNAVAILABLE' && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={onMarkAvailable}>
                        <CalendarCheck className="h-4 w-4" />
                        Mark Available
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 flex-1">
        {/* Specs */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <BedDouble className="h-3.5 w-3.5" />
            {unit.bedrooms} bd
          </span>
          <span className="flex items-center gap-1">
            <Bath className="h-3.5 w-3.5" />
            {unit.bathrooms} ba
          </span>
          {unit.squareFootage && (
            <span className="flex items-center gap-1">
              <Maximize2 className="h-3.5 w-3.5" />
              {unit.squareFootage.toLocaleString()} sqft
            </span>
          )}
        </div>

        <Separator />

        {/* Rent & lease options */}
        <div className="space-y-2">
          <p className="text-xl font-semibold">
            {formatCurrency(unit.monthlyRentAmount, currency)}
            <span className="text-sm font-normal text-muted-foreground">/mo</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {LEASE_PERIODS.map((period) => (
              <span
                key={period}
                className="inline-flex items-center rounded-md border border-border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground"
              >
                {period}
              </span>
            ))}
          </div>
        </div>

        {/* Current unavailability */}
        {unit.status === 'UNAVAILABLE' && unit.currentUnavailability && (
          <>
            <Separator />
            <div className="rounded-md bg-amber-50 border border-amber-100 p-3 space-y-1 dark:bg-amber-900/20 dark:border-amber-900/40">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Currently unavailable</p>
              <p className="text-xs text-amber-700 dark:text-amber-400">{unit.currentUnavailability.reason}</p>
              <p className="text-xs text-amber-600 dark:text-amber-500">
                From {format(new Date(unit.currentUnavailability.startDate), 'MMM d, yyyy')}
                {unit.currentUnavailability.endDate
                  ? ` · Until ${format(new Date(unit.currentUnavailability.endDate), 'MMM d, yyyy')}`
                  : ' · Open-ended'}
              </p>
            </div>
          </>
        )}

        {/* Unavailability history */}
        {history.length > 0 && (
          <>
            <Separator />
            <div>
              <button
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowHistory((v) => !v)}
              >
                {showHistory ? 'Hide' : 'Show'} history ({history.length})
              </button>
              {showHistory && (
                <div className="mt-2 space-y-2">
                  {history.map((record) => (
                    <div
                      key={record.id}
                      className="rounded-md border border-border p-2.5 space-y-0.5"
                    >
                      <p className="text-xs font-medium">{record.reason}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(record.startDate), 'MMM d, yyyy')}
                        {record.endDate
                          ? ` – ${format(new Date(record.endDate), 'MMM d, yyyy')}`
                          : ' – Open-ended'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
