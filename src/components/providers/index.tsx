'use client'
import { useEffect } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useAuthStore, useSettingsStore } from '@/store'

export function Providers({ children }: { children: React.ReactNode }) {
  const initialize = useAuthStore((s) => s.initialize)
  const fetchSettings = useSettingsStore((s) => s.fetchSettings)

  // Run once on mount — auth first, then settings
  useEffect(() => {
    initialize().then(() => fetchSettings())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <TooltipProvider>
      {children}
      <Toaster richColors position="top-right" />
    </TooltipProvider>
  )
}
