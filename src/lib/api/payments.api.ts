import apiClient from './client'
import type { Payment, PaymentType } from '@/types'

export interface CreatePaymentCommand {
  leaseId: string
  tenantId: string
  amount: number
  currencyCode: string
  dueDate: string
  type: PaymentType
}

export interface ProcessPaymentCommand {
  id?: string
  amountPaid: number
  currencyCode: string
  paymentDate: string
}

export const paymentsApi = {
  getAll: async (): Promise<Payment[]> => {
    const { data } = await apiClient.get<Payment[]>('/api/v1/payments')
    return data
  },
  getById: async (id: string): Promise<Payment> => {
    const { data } = await apiClient.get<Payment>(`/api/v1/payments/${id}`)
    return data
  },
  getByLease: async (leaseId: string): Promise<Payment[]> => {
    const { data } = await apiClient.get<Payment[]>(`/api/v1/payments/lease/${leaseId}`)
    return data
  },
  getByTenant: async (tenantId: string): Promise<Payment[]> => {
    const { data } = await apiClient.get<Payment[]>(`/api/v1/payments/tenant/${tenantId}`)
    return data
  },
  create: async (command: CreatePaymentCommand): Promise<Payment> => {
    const { data } = await apiClient.post<Payment>('/api/v1/payments', command)
    return data
  },
  receive: async (id: string, command: ProcessPaymentCommand): Promise<Payment> => {
    const { data } = await apiClient.patch<Payment>(`/api/v1/payments/${id}/receive`, { ...command, id })
    return data
  },
}
