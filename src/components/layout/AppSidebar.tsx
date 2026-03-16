'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuthStore } from '@/store'
import {
  Building2, LayoutDashboard, Home, Users, FileText,
  CreditCard, Wrench, Settings, UserCog, LogOut,
} from 'lucide-react'
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup,
  SidebarGroupContent, SidebarHeader, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

const navItems = [
  { label: 'Dashboard',   href: '/dashboard',   icon: LayoutDashboard, managerOnly: false },
  { label: 'Properties',  href: '/properties',  icon: Home,            managerOnly: false },
  { label: 'Tenants',     href: '/tenants',     icon: Users,           managerOnly: false },
  { label: 'Leasing',     href: '/leasing',     icon: FileText,        managerOnly: false },
  { label: 'Payments',    href: '/payments',    icon: CreditCard,      managerOnly: false },
  { label: 'Maintenance', href: '/maintenance', icon: Wrench,          managerOnly: true  },
]

const adminItems = [
  { label: 'Users', href: '/users', icon: UserCog },
]

const bottomItems = [
  { label: 'Settings', href: '/settings', icon: Settings },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuthStore()
  const canManage = user?.role === 'ADMIN' || user?.role === 'PROPERTY_MANAGER'

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 shrink-0">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <span className="font-semibold truncate group-data-[collapsible=icon]:hidden">
            Property Manager
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent className="py-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.filter((item) => !item.managerOnly || canManage).map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.href)}
                    tooltip={item.label}
                  >
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {user?.role === 'ADMIN' && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.href)}
                      tooltip={item.label}
                    >
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              {bottomItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.href)}
                    tooltip={item.label}
                  >
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-7 w-7 shrink-0">
            <AvatarFallback className="text-xs">
              {user?.username?.slice(0, 2).toUpperCase() ?? 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="text-xs font-medium truncate">{user?.username}</p>
            <p className="text-xs text-muted-foreground truncate">
              {user?.role?.replace(/_/g, ' ').toLowerCase()}
            </p>
          </div>
          <button
            onClick={logout}
            className={cn(
              'text-muted-foreground hover:text-foreground transition-colors shrink-0',
              'group-data-[collapsible=icon]:mx-auto'
            )}
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
