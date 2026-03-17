import apiClient from './client'
import type { MaintenanceRecord, MaintenanceStatus, MaintenancePriority } from '@/types'

export interface CreateMaintenanceTicketCommand {
  propertyId: string
  unitId: string
  tenantId: string
  priority: MaintenancePriority
  problemDescription: string
}

export interface UpdateMaintenanceStatusCommand {
  requestId: string
  newStatus: MaintenanceStatus
  resolutionNotes?: string
}

export const maintenanceApi = {
  getById: async (id: string): Promise<MaintenanceRecord> => {
    const { data } = await apiClient.get<MaintenanceRecord>(`/api/v1/maintenance/${id}`)
    return data
  },
  getByProperty: async (propertyId: string): Promise<MaintenanceRecord[]> => {
    const { data } = await apiClient.get<MaintenanceRecord[]>(`/api/v1/maintenance/property/${propertyId}`)
    return data
  },
  getByTenant: async (tenantId: string): Promise<MaintenanceRecord[]> => {
    const { data } = await apiClient.get<MaintenanceRecord[]>(`/api/v1/maintenance/tenant/${tenantId}`)
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
}
