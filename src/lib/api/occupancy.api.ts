import apiClient from './client'
import type { OccupancyRecord } from '@/types'

export const occupancyApi = {
  getUnitHistory: async (unitId: string): Promise<OccupancyRecord[]> => {
    const { data } = await apiClient.get<OccupancyRecord[]>(`/api/v1/occupancy/unit/${unitId}/history`)
    return data
  },
}
