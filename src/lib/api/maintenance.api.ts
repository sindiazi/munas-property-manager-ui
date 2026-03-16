import apiClient from './client'
import type { MaintenanceRecord } from '@/types'

export const maintenanceApi = {
  getByTenant: async (tenantId: string): Promise<MaintenanceRecord[]> => {
    const { data } = await apiClient.get<MaintenanceRecord[]>(`/api/v1/maintenance/tenant/${tenantId}`)
    return data
  },
}
