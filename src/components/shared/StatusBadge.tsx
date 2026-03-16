import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const statusStyles: Record<string, string> = {
  // Lease statuses
  ACTIVE: 'bg-green-100 text-green-700 hover:bg-green-100 border-transparent',
  DRAFT: 'bg-zinc-100 text-zinc-600 hover:bg-zinc-100 border-transparent',
  EXPIRED: 'bg-orange-100 text-orange-700 hover:bg-orange-100 border-transparent',
  TERMINATED: 'bg-red-100 text-red-700 hover:bg-red-100 border-transparent',
  // Payment statuses
  PAID: 'bg-green-100 text-green-700 hover:bg-green-100 border-transparent',
  PENDING: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100 border-transparent',
  OVERDUE: 'bg-red-100 text-red-700 hover:bg-red-100 border-transparent',
  PARTIALLY_PAID: 'bg-blue-100 text-blue-700 hover:bg-blue-100 border-transparent',
  CANCELLED: 'bg-zinc-100 text-zinc-500 hover:bg-zinc-100 border-transparent',
  // Tenant statuses
  INACTIVE: 'bg-zinc-100 text-zinc-500 hover:bg-zinc-100 border-transparent',
  // Unit statuses
  AVAILABLE: 'bg-green-100 text-green-700 hover:bg-green-100 border-transparent',
  OCCUPIED: 'bg-blue-100 text-blue-700 hover:bg-blue-100 border-transparent',
  UNAVAILABLE: 'bg-amber-100 text-amber-700 hover:bg-amber-100 border-transparent',
  // Boolean
  true: 'bg-green-100 text-green-700 hover:bg-green-100 border-transparent',
  false: 'bg-zinc-100 text-zinc-500 hover:bg-zinc-100 border-transparent',
}

interface StatusBadgeProps {
  status: string
  label?: string
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const style = statusStyles[status] ?? 'bg-zinc-100 text-zinc-600 hover:bg-zinc-100 border-transparent'
  return (
    <Badge variant="outline" className={cn('font-medium text-xs', style)}>
      {label ?? status.replace(/_/g, ' ')}
    </Badge>
  )
}
