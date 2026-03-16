'use client'
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { settingsApi } from '@/lib/api/settings.api'
import type { UpdateSettingsCommand } from '@/lib/api/settings.api'
import type { UserSettings } from '@/types'

interface SettingsState {
  settings: UserSettings | null
  isLoading: boolean
  error: string | null
}

interface SettingsActions {
  fetchSettings: () => Promise<void>
  updateSettings: (command: UpdateSettingsCommand) => Promise<void>
}

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  devtools(
    (set) => ({
      settings: null,
      isLoading: false,
      error: null,

      fetchSettings: async () => {
        set({ isLoading: true, error: null }, false, 'settings/fetch/pending')
        try {
          const settings = await settingsApi.get()
          set({ settings, isLoading: false }, false, 'settings/fetch/success')
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to load settings'
          set({ isLoading: false, error: message }, false, 'settings/fetch/error')
        }
      },

      updateSettings: async (command) => {
        set({ isLoading: true, error: null }, false, 'settings/update/pending')
        try {
          const settings = await settingsApi.update(command)
          set({ settings, isLoading: false }, false, 'settings/update/success')
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to update settings'
          set({ isLoading: false, error: message }, false, 'settings/update/error')
          throw err
        }
      },
    }),
    { name: 'settings-store' }
  )
)
