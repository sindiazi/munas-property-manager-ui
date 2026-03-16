import apiClient from './client'
import type { MaintenanceRecord, MaintenanceStatus, MaintenancePriority } from '@/types'

export interface CreateMaintenanceTicketCommand {
  propertyId: string
  unitId: string
  priority: MaintenancePriority
  problemDescription: string
}

export interface UpdateMaintenanceStatusCommand {
  status: MaintenanceStatus
  resolutionNotes?: string
}

export const maintenanceApi = {
  getAll: async (): Promise<MaintenanceRecord[]> => {
    const { data } = await apiClient.get<MaintenanceRecord[]>('/api/v1/maintenance')
    return data
  },
  getById: async (id: string): Promise<MaintenanceRecord> => {
    const { data } = await apiClient.get<MaintenanceRecord>(`/api/v1/maintenance/${id}`)
    return data
  },
  create: async (command: CreateMaintenanceTicketCommand): Promise<MaintenanceRecord> => {
    const { data } = await apiClient.post<MaintenanceRecord>('/api/v1/maintenance', command)
    return data
  },
  updateStatus: async (id: string, command: UpdateMaintenanceStatusCommand): Promise<MaintenanceRecord> => {
    const { data } = await apiClient.patch<MaintenanceRecord>(`/api/v1/maintenance/${id}/status`, command)
    return data
  },
  getByTenant: async (tenantId: string): Promise<MaintenanceRecord[]> => {
    const { data } = await apiClient.get<MaintenanceRecord[]>(`/api/v1/maintenance/tenant/${tenantId}`)
    return data
  },
  getByUnit: async (unitId: string): Promise<MaintenanceRecord[]> => {
    const { data } = await apiClient.get<MaintenanceRecord[]>(`/api/v1/maintenance/unit/${unitId}`)
    return data
  },
}
