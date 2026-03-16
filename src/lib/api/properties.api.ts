import apiClient from './client'
import type { Property, PropertyType, PropertyUnit, UnavailabilityRecord } from '@/types'

export interface CreatePropertyCommand {
  ownerId: string
  name: string
  street: string
  city: string
  state: string
  zipCode: string
  country: string
  type: PropertyType
}

export interface MarkUnavailableCommand {
  reason: string
  startDate: string
  endDate?: string
}

export const propertiesApi = {
  getAll: async (): Promise<Property[]> => {
    const { data } = await apiClient.get<Property[]>('/api/v1/properties')
    return data
  },
  getById: async (id: string): Promise<Property> => {
    const { data } = await apiClient.get<Property>(`/api/v1/properties/${id}`)
    return data
  },
  create: async (command: CreatePropertyCommand): Promise<Property> => {
    const { data } = await apiClient.post<Property>('/api/v1/properties', command)
    return data
  },
  markUnitUnavailable: async (unitId: string, command: MarkUnavailableCommand): Promise<PropertyUnit> => {
    const { data } = await apiClient.patch<PropertyUnit>(`/api/v1/units/${unitId}/unavailable`, command)
    return data
  },
  markUnitAvailable: async (unitId: string): Promise<PropertyUnit> => {
    const { data } = await apiClient.patch<PropertyUnit>(`/api/v1/units/${unitId}/available`)
    return data
  },
  getUnitUnavailabilityHistory: async (unitId: string): Promise<UnavailabilityRecord[]> => {
    const { data } = await apiClient.get<UnavailabilityRecord[]>(`/api/v1/units/${unitId}/unavailability`)
    return data
  },
}
