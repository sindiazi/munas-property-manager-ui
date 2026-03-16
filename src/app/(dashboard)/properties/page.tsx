'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Building2, MoreHorizontal } from 'lucide-react'
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
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { propertiesApi } from '@/lib/api/properties.api'
import type { CreatePropertyCommand } from '@/lib/api/properties.api'
import { useAuthStore } from '@/store'
import { useEventLogger } from '@/hooks/useEventLogger'
import { toast } from 'sonner'
import type { Property, PropertyType } from '@/types'
import { format } from 'date-fns'

const PROPERTY_TYPES: PropertyType[] = [
  'APARTMENT', 'HOUSE', 'COMMERCIAL', 'CONDO', 'TOWNHOUSE', 'STUDIO',
]

const defaultForm = (ownerId: string): CreatePropertyCommand => ({
  ownerId,
  name: '',
  street: '',
  city: '',
  state: '',
  zipCode: '',
  country: 'US',
  type: 'APARTMENT',
})

export default function PropertiesPage() {
  const router = useRouter()
  const logEvent = useEventLogger()
  const { user } = useAuthStore()
  const [properties, setProperties] = useState<Property[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState<CreatePropertyCommand>(defaultForm(user?.id ?? ''))

  useEffect(() => {
    logEvent('PAGE_VIEW', 'properties')
    propertiesApi
      .getAll()
      .then(setProperties)
      .catch(() => toast.error('Failed to load properties'))
      .finally(() => setIsLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const created = await propertiesApi.create({ ...form, ownerId: user?.id ?? '' })
      setProperties((prev) => [created, ...prev])
      setShowDialog(false)
      setForm(defaultForm(user?.id ?? ''))
      logEvent('USER_ACTION', 'create_property', { propertyId: created.id })
      toast.success('Property created')
    } catch {
      toast.error('Failed to create property')
    } finally {
      setIsSubmitting(false)
    }
  }

  const canManage = user?.role === 'ADMIN' || user?.role === 'PROPERTY_MANAGER'
  const pagination = usePagination()

  return (
    <div>
      <PageHeader
        title="Properties"
        description={`${properties.length} properties in your portfolio`}
        action={
          canManage ? (
            <Button onClick={() => setShowDialog(true)}>
              <Plus className="h-4 w-4 mr-2" /> Add Property
            </Button>
          ) : undefined
        }
      />

      <Card className="pt-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Property</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Units</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableLoadingState rows={5} cols={5} />
              ) : properties.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    <Building2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p>No properties found</p>
                  </TableCell>
                </TableRow>
              ) : (
                pagination.paginate(properties).map((property) => {
                  const available = property.units?.filter((u) => u.status === 'AVAILABLE').length ?? 0
                  const total = property.units?.length ?? 0
                  return (
                    <TableRow key={property.id}>
                      {/* Property name (clickable) + type subscript */}
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <button
                            className="font-medium text-sm text-left hover:underline cursor-pointer"
                            onClick={() => router.push(`/properties/${property.id}`)}
                          >
                            {property.name}
                          </button>
                          <span className="text-xs text-muted-foreground">
                            {property.type.charAt(0) + property.type.slice(1).toLowerCase()}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="text-muted-foreground text-sm">
                        {property.street}, {property.city}, {property.state}
                      </TableCell>

                      {/* Units: available / total */}
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium">{total}</span>
                          <span className="text-xs text-muted-foreground">
                            {available} available
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(property.createdAt), 'MMM d, yyyy')}
                      </TableCell>

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
                              onClick={() => router.push(`/properties/${property.id}`)}
                            >
                              View details
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
          {properties.length > 10 && (
            <Pagination
              total={properties.length}
              page={pagination.page}
              pageSize={pagination.pageSize}
              onPageChange={pagination.setPage}
              onPageSizeChange={(s) => { pagination.setPageSize(s); pagination.setPage(1) }}
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Property</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Property Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm((f) => ({ ...f, type: v as PropertyType }))}
              >
                <SelectTrigger id="type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROPERTY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t.charAt(0) + t.slice(1).toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="street">Street</Label>
              <Input
                id="street"
                value={form.street}
                onChange={(e) => setForm((f) => ({ ...f, street: e.target.value }))}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={form.state}
                  onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="zipCode">ZIP Code</Label>
                <Input
                  id="zipCode"
                  value={form.zipCode}
                  onChange={(e) => setForm((f) => ({ ...f, zipCode: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={form.country}
                  onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
