'use client'
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { AppEvent, EventType } from '@/types'

const MAX_EVENTS = 500

interface EventState {
  events: AppEvent[]
}

interface EventActions {
  logEvent: (type: EventType, name: string, payload?: Record<string, unknown>, userId?: string) => void
  clearEvents: () => void
}

export const useEventStore = create<EventState & EventActions>()(
  devtools(
    (set, get) => ({
      events: [],

      logEvent: (type, name, payload, userId) => {
        const event: AppEvent = {
          id: crypto.randomUUID(),
          type,
          name,
          payload,
          userId,
          timestamp: new Date().toISOString(),
        }
        console.log(`[PM_EVENT] ${type} - ${name}`, payload ?? '')
        const current = get().events
        const updated = [event, ...current].slice(0, MAX_EVENTS)
        set({ events: updated }, false, `event/${type}/${name}`)
      },

      clearEvents: () => set({ events: [] }, false, 'event/clear'),
    }),
    { name: 'event-store' }
  )
)
