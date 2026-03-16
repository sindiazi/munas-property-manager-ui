'use client'
import { usePathname } from 'next/navigation'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'

const routeLabels: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/properties': 'Properties',
  '/tenants': 'Tenants',
  '/leasing': 'Leasing',
  '/payments': 'Payments',
  '/maintenance': 'Maintenance',
  '/users': 'Users',
  '/settings': 'Settings',
}

export function Header() {
  const pathname = usePathname()
  const label =
    Object.entries(routeLabels).find(([key]) => pathname.startsWith(key))?.[1] ?? 'Dashboard'

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-4" />
      <h1 className="text-sm font-semibold">{label}</h1>
      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="icon">
          <Bell className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}
