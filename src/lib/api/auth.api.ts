import apiClient from './client'
import type { TokenResponse, User } from '@/types'

export const authApi = {
  login: async (username: string, password: string): Promise<TokenResponse> => {
    const { data } = await apiClient.post<TokenResponse>('/api/v1/auth/login', { username, password })
    return data
  },
  getMe: async (): Promise<User> => {
    const { data } = await apiClient.get<User>('/api/v1/auth/me')
    return data
  },
}
