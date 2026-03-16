import { Card, CardContent } from '@/components/ui/card'
import { ChevronRight, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

interface StatCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  href?: string
  colorClass?: string
  iconColorClass?: string
}

export function StatCard({
  label,
  value,
  icon: Icon,
  href,
  colorClass = 'bg-zinc-50 dark:bg-zinc-800/60',
  iconColorClass = 'text-zinc-600 dark:text-zinc-400',
}: StatCardProps) {
  const content = (
    <Card className={cn('border shadow-none', colorClass)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Icon className={cn('h-4 w-4', iconColorClass)} />
              {label}
            </p>
            <p className="mt-1 text-3xl font-bold tracking-tight">{value}</p>
          </div>
          {href && <ChevronRight className="h-4 w-4 text-muted-foreground mt-1" />}
        </div>
      </CardContent>
    </Card>
  )

  if (href) {
    return (
      <Link href={href} className="block hover:opacity-90 transition-opacity">
        {content}
      </Link>
    )
  }
  return content
}