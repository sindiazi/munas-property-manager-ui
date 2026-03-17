import apiClient from './client'
import type { MaintenanceCategory, MaintenancePriority } from '@/types'

export interface CreateMaintenanceCategoryCommand {
  id: string
  name: string
}

export interface UpdateMaintenanceCategoryCommand {
  name: string
}

export interface AddIssueTemplateCommand {
  id: string
  title: string
  description: string
  priority: MaintenancePriority
}

export interface UpdateIssueTemplateCommand {
  title?: string
  description?: string
  priority?: MaintenancePriority
}

export const maintenanceCategoriesApi = {
  getAll: async (): Promise<MaintenanceCategory[]> => {
    const { data } = await apiClient.get<MaintenanceCategory[]>('/api/v1/maintenance/categories')
    return data
  },
  getById: async (categoryId: string): Promise<MaintenanceCategory> => {
    const { data } = await apiClient.get<MaintenanceCategory>(`/api/v1/maintenance/categories/${categoryId}`)
    return data
  },
  create: async (command: CreateMaintenanceCategoryCommand): Promise<MaintenanceCategory> => {
    const { data } = await apiClient.post<MaintenanceCategory>('/api/v1/maintenance/categories', command)
    return data
  },
  update: async (categoryId: string, command: UpdateMaintenanceCategoryCommand): Promise<MaintenanceCategory> => {
    const { data } = await apiClient.put<MaintenanceCategory>(`/api/v1/maintenance/categories/${categoryId}`, command)
    return data
  },
  delete: async (categoryId: string): Promise<void> => {
    await apiClient.delete(`/api/v1/maintenance/categories/${categoryId}`)
  },
  addIssue: async (categoryId: string, command: AddIssueTemplateCommand): Promise<MaintenanceCategory> => {
    const { data } = await apiClient.post<MaintenanceCategory>(`/api/v1/maintenance/categories/${categoryId}/issues`, command)
    return data
  },
  updateIssue: async (categoryId: string, issueId: string, command: UpdateIssueTemplateCommand): Promise<MaintenanceCategory> => {
    const { data } = await apiClient.put<MaintenanceCategory>(`/api/v1/maintenance/categories/${categoryId}/issues/${issueId}`, command)
    return data
  },
  deleteIssue: async (categoryId: string, issueId: string): Promise<void> => {
    await apiClient.delete(`/api/v1/maintenance/categories/${categoryId}/issues/${issueId}`)
  },
}
