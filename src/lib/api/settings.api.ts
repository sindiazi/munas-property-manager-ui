import apiClient from './client'
import type { UserSettings, Theme } from '@/types'

export interface UpdateSettingsCommand {
  currency?: string
  theme?: Theme
  timezone?: string
}

export const settingsApi = {
  get: async (): Promise<UserSettings> => {
    const { data } = await apiClient.get<UserSettings>('/api/v1/settings')
    return data
  },
  update: async (command: UpdateSettingsCommand): Promise<UserSettings> => {
    const { data } = await apiClient.put<UserSettings>('/api/v1/settings', command)
    return data
  },
}
