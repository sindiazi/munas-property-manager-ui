'use client'
import { useEffect } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useAuthStore, useSettingsStore } from '@/store'

export function Providers({ children }: { children: React.ReactNode }) {
  const initialize = useAuthStore((s) => s.initialize)
  const fetchSettings = useSettingsStore((s) => s.fetchSettings)
  const theme = useSettingsStore((s) => s.settings?.theme)

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  // Run once on mount — auth first, then settings only if authenticated
  useEffect(() => {
    initialize()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      fetchSettings()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated])

  // Keep <html class="dark"> in sync with the stored theme preference
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'DARK')
  }, [theme])

  return (
    <TooltipProvider>
      {children}
      <Toaster richColors position="top-right" />
    </TooltipProvider>
  )
}
