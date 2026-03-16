import apiClient from './client'
import type { Tenant } from '@/types'

export interface RegisterTenantCommand {
  firstName: string
  lastName: string
  email: string
  phoneNumber: string
  creditScore?: number
}

export interface UpdateTenantCommand {
  firstName: string
  lastName: string
  email: string
  phoneNumber: string
  creditScore?: number
}

export const tenantsApi = {
  getAll: async (): Promise<Tenant[]> => {
    const { data } = await apiClient.get<Tenant[]>('/api/v1/tenants')
    return data
  },
  getById: async (id: string): Promise<Tenant> => {
    const { data } = await apiClient.get<Tenant>(`/api/v1/tenants/${id}`)
    return data
  },
  register: async (command: RegisterTenantCommand): Promise<Tenant> => {
    const { data } = await apiClient.post<Tenant>('/api/v1/tenants', command)
    return data
  },
  update: async (id: string, command: UpdateTenantCommand): Promise<Tenant> => {
    const { data } = await apiClient.put<Tenant>(`/api/v1/tenants/${id}`, command)
    return data
  },
  activate: async (id: string): Promise<Tenant> => {
    const { data } = await apiClient.patch<Tenant>(`/api/v1/tenants/${id}/activate`)
    return data
  },
  deactivate: async (id: string): Promise<Tenant> => {
    const { data } = await apiClient.patch<Tenant>(`/api/v1/tenants/${id}/deactivate`)
    return data
  },
}
