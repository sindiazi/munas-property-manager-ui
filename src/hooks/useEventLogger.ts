'use client'
import { useCallback } from 'react'
import { useEventStore, useAuthStore } from '@/store'
import type { EventType } from '@/types'

export function useEventLogger() {
  const logEvent = useEventStore((s) => s.logEvent)
  const user = useAuthStore((s) => s.user)

  return useCallback(
    (type: EventType, name: string, payload?: Record<string, unknown>) => {
      logEvent(type, name, payload, user?.id)
    },
    [logEvent, user?.id]
  )
}
