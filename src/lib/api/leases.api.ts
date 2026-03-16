import apiClient from './client'
import type { Lease } from '@/types'

export interface CreateLeaseCommand {
  tenantId: string
  propertyId: string
  unitId: string
  startDate: string
  endDate: string
  monthlyRent: number
  securityDeposit: number
}

export const leasesApi = {
  getAll: async (): Promise<Lease[]> => {
    const { data } = await apiClient.get<Lease[]>('/api/v1/leases')
    return data
  },
  getById: async (id: string): Promise<Lease> => {
    const { data } = await apiClient.get<Lease>(`/api/v1/leases/${id}`)
    return data
  },
  getByTenant: async (tenantId: string): Promise<Lease[]> => {
    const { data } = await apiClient.get<Lease[]>(`/api/v1/leases/tenant/${tenantId}`)
    return data
  },
  getByUnit: async (unitId: string): Promise<Lease> => {
    const { data } = await apiClient.get<Lease>(`/api/v1/leases/unit/${unitId}`)
    return data
  },
  create: async (command: CreateLeaseCommand): Promise<Lease> => {
    const { data } = await apiClient.post<Lease>('/api/v1/leases', command)
    return data
  },
  activate: async (id: string): Promise<Lease> => {
    const { data } = await apiClient.patch<Lease>(`/api/v1/leases/${id}/activate`)
    return data
  },
  terminate: async (id: string, reason: string): Promise<Lease> => {
    const { data } = await apiClient.patch<Lease>(`/api/v1/leases/${id}/terminate`, { id, reason })
    return data
  },
}
