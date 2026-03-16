import apiClient from './client'
import type { User, UserRole } from '@/types'

export interface CreateUserCommand {
  username: string
  email: string
  password: string
  role: UserRole
}

export interface UpdateUserCommand {
  email?: string
  role?: UserRole
  active?: boolean
}

export interface ChangePasswordCommand {
  currentPassword: string
  newPassword: string
}

export const usersApi = {
  getAll: async (): Promise<User[]> => {
    const { data } = await apiClient.get<User[]>('/api/v1/users')
    return data
  },
  getById: async (id: string): Promise<User> => {
    const { data } = await apiClient.get<User>(`/api/v1/users/${id}`)
    return data
  },
  create: async (command: CreateUserCommand): Promise<User> => {
    const { data } = await apiClient.post<User>('/api/v1/users', command)
    return data
  },
  update: async (id: string, command: UpdateUserCommand): Promise<User> => {
    const { data } = await apiClient.put<User>(`/api/v1/users/${id}`, command)
    return data
  },
  deactivate: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/v1/users/${id}`)
  },
  changePassword: async (id: string, command: ChangePasswordCommand): Promise<void> => {
    await apiClient.patch(`/api/v1/users/${id}/password`, command)
  },
}
