import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const statusStyles: Record<string, string> = {
  // Lease statuses
  ACTIVE:         'bg-green-100 text-green-700 hover:bg-green-100 border-transparent dark:bg-green-900/40 dark:text-green-400 dark:hover:bg-green-900/40',
  DRAFT:          'bg-zinc-100 text-zinc-600 hover:bg-zinc-100 border-transparent dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800',
  EXPIRED:        'bg-orange-100 text-orange-700 hover:bg-orange-100 border-transparent dark:bg-orange-900/40 dark:text-orange-400 dark:hover:bg-orange-900/40',
  TERMINATED:     'bg-red-100 text-red-700 hover:bg-red-100 border-transparent dark:bg-red-900/40 dark:text-red-400 dark:hover:bg-red-900/40',
  // Payment statuses
  PAID:           'bg-green-100 text-green-700 hover:bg-green-100 border-transparent dark:bg-green-900/40 dark:text-green-400 dark:hover:bg-green-900/40',
  PENDING:        'bg-yellow-100 text-yellow-700 hover:bg-yellow-100 border-transparent dark:bg-yellow-900/40 dark:text-yellow-400 dark:hover:bg-yellow-900/40',
  OVERDUE:        'bg-red-100 text-red-700 hover:bg-red-100 border-transparent dark:bg-red-900/40 dark:text-red-400 dark:hover:bg-red-900/40',
  PARTIALLY_PAID: 'bg-blue-100 text-blue-700 hover:bg-blue-100 border-transparent dark:bg-blue-900/40 dark:text-blue-400 dark:hover:bg-blue-900/40',
  CANCELLED:      'bg-zinc-100 text-zinc-500 hover:bg-zinc-100 border-transparent dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800',
  // Tenant statuses
  INACTIVE:       'bg-zinc-100 text-zinc-500 hover:bg-zinc-100 border-transparent dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800',
  // Unit statuses
  AVAILABLE:      'bg-green-100 text-green-700 hover:bg-green-100 border-transparent dark:bg-green-900/40 dark:text-green-400 dark:hover:bg-green-900/40',
  OCCUPIED:       'bg-blue-100 text-blue-700 hover:bg-blue-100 border-transparent dark:bg-blue-900/40 dark:text-blue-400 dark:hover:bg-blue-900/40',
  UNAVAILABLE:    'bg-amber-100 text-amber-700 hover:bg-amber-100 border-transparent dark:bg-amber-900/40 dark:text-amber-400 dark:hover:bg-amber-900/40',
  // Boolean
  true:           'bg-green-100 text-green-700 hover:bg-green-100 border-transparent dark:bg-green-900/40 dark:text-green-400 dark:hover:bg-green-900/40',
  false:          'bg-zinc-100 text-zinc-500 hover:bg-zinc-100 border-transparent dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800',
  // Maintenance statuses
  OPEN:           'bg-sky-100 text-sky-700 hover:bg-sky-100 border-transparent dark:bg-sky-900/40 dark:text-sky-400 dark:hover:bg-sky-900/40',
  IN_PROGRESS:    'bg-amber-100 text-amber-700 hover:bg-amber-100 border-transparent dark:bg-amber-900/40 dark:text-amber-400 dark:hover:bg-amber-900/40',
  CLOSED:         'bg-zinc-100 text-zinc-500 hover:bg-zinc-100 border-transparent dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800',
  // Maintenance priorities
  LOW:            'bg-zinc-100 text-zinc-500 hover:bg-zinc-100 border-transparent dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800',
  MEDIUM:         'bg-yellow-100 text-yellow-700 hover:bg-yellow-100 border-transparent dark:bg-yellow-900/40 dark:text-yellow-400 dark:hover:bg-yellow-900/40',
  HIGH:           'bg-orange-100 text-orange-700 hover:bg-orange-100 border-transparent dark:bg-orange-900/40 dark:text-orange-400 dark:hover:bg-orange-900/40',
  EMERGENCY:      'bg-red-100 text-red-700 hover:bg-red-100 border-transparent dark:bg-red-900/40 dark:text-red-400 dark:hover:bg-red-900/40',
}

interface StatusBadgeProps {
  status: string
  label?: string
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const style = statusStyles[status] ?? 'bg-zinc-100 text-zinc-600 hover:bg-zinc-100 border-transparent dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800'
  return (
    <Badge variant="outline" className={cn('font-medium text-xs', style)}>
      {label ?? status.replace(/_/g, ' ')}
    </Badge>
  )
}