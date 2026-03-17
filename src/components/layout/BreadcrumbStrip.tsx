'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { useBreadcrumbStore } from '@/store'

type Crumb = { label: string; href?: string }

function resolveCrumbs(pathname: string, labels: Record<string, string>): Crumb[] | null {
  const label = (id: string) => labels[id] || `${id.slice(0, 6)}…`

  // /properties/:id/units/:unitId
  const unitMatch = pathname.match(/^\/properties\/([^/]+)\/units\/([^/]+)/)
  if (unitMatch) {
    return [
      { label: 'Properties', href: '/properties' },
      { label: label(unitMatch[1]), href: `/properties/${unitMatch[1]}` },
      { label: label(unitMatch[2]) },
    ]
  }

  // /properties/:id
  const propMatch = pathname.match(/^\/properties\/([^/]+)/)
  if (propMatch) {
    return [
      { label: 'Properties', href: '/properties' },
      { label: label(propMatch[1]) },
    ]
  }

  // /tenants/:id
  const tenantMatch = pathname.match(/^\/tenants\/([^/]+)/)
  if (tenantMatch) {
    return [
      { label: 'Tenants', href: '/tenants' },
      { label: label(tenantMatch[1]) },
    ]
  }

  // /leasing/:id
  const leaseMatch = pathname.match(/^\/leasing\/([^/]+)/)
  if (leaseMatch) {
    return [
      { label: 'Leasing', href: '/leasing' },
      { label: label(leaseMatch[1]) },
    ]
  }

  // /maintenance/new (must come before the :id pattern)
  if (pathname === '/maintenance/new') {
    return [
      { label: 'Maintenance', href: '/maintenance' },
      { label: 'New Maintenance Request' },
    ]
  }

  // /maintenance/:id
  const maintMatch = pathname.match(/^\/maintenance\/([^/]+)/)
  if (maintMatch) {
    return [
      { label: 'Maintenance', href: '/maintenance' },
      { label: label(maintMatch[1]) },
    ]
  }

  return null
}

export function BreadcrumbStrip() {
  const pathname = usePathname()
  const labels = useBreadcrumbStore((s) => s.labels)
  const crumbs = resolveCrumbs(pathname, labels)

  if (!crumbs) return null

  return (
    <div className="sticky top-14 z-10 flex items-center gap-1.5 border-b bg-background px-4 py-2 text-xs text-muted-foreground">
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1
        return (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="h-3 w-3 shrink-0" />}
            {crumb.href && !isLast ? (
              <Link
                href={crumb.href}
                className="hover:text-foreground transition-colors"
              >
                {crumb.label}
              </Link>
            ) : (
              <span className={isLast ? 'text-foreground font-medium' : undefined}>
                {crumb.label}
              </span>
            )}
          </span>
        )
      })}
    </div>
  )
}
