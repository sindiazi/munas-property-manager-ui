import apiClient from './client'
import type { Invoice, InvoiceType, PaymentTransaction, InitiateMpesaPaymentCommand, MpesaInitiationResponse, MpesaStatusResponse } from '@/types'

export interface CreateInvoiceCommand {
  leaseId: string
  tenantId: string
  amount: number
  currencyCode: string
  dueDate: string
  type: InvoiceType
}

export interface RecordCashPaymentCommand {
  invoiceId?: string
  amountPaid: number
  paymentDate: string
}

export const invoicesApi = {
  getAll: async (): Promise<Invoice[]> => {
    const { data } = await apiClient.get<Invoice[]>('/api/v1/invoices')
    return data
  },
  getById: async (id: string): Promise<Invoice> => {
    const { data } = await apiClient.get<Invoice>(`/api/v1/invoices/${id}`)
    return data
  },
  getByLease: async (leaseId: string): Promise<Invoice[]> => {
    const { data } = await apiClient.get<Invoice[]>(`/api/v1/invoices/lease/${leaseId}`)
    return data
  },
  getByTenant: async (tenantId: string): Promise<Invoice[]> => {
    const { data } = await apiClient.get<Invoice[]>(`/api/v1/invoices/tenant/${tenantId}`)
    return data
  },
  create: async (command: CreateInvoiceCommand): Promise<Invoice> => {
    const { data } = await apiClient.post<Invoice>('/api/v1/invoices', command)
    return data
  },
  recordCashPayment: async (id: string, command: RecordCashPaymentCommand): Promise<Invoice> => {
    const { data } = await apiClient.post<Invoice>(`/api/v1/invoices/${id}/payments/cash`, { ...command, invoiceId: id })
    return data
  },
  initiateMpesa: async (id: string, command: Omit<InitiateMpesaPaymentCommand, 'invoiceId'>): Promise<MpesaInitiationResponse> => {
    const { data } = await apiClient.post<MpesaInitiationResponse>(`/api/v1/invoices/${id}/payments/mpesa`, { ...command, invoiceId: id })
    return data
  },
  getMpesaStatus: async (paymentTransactionId: string): Promise<MpesaStatusResponse> => {
    const { data } = await apiClient.get<MpesaStatusResponse>(`/api/v1/invoices/payments/mpesa/${paymentTransactionId}/status`)
    return data
  },
  getPayments: async (invoiceId: string): Promise<PaymentTransaction[]> => {
    const { data } = await apiClient.get<PaymentTransaction[]>(`/api/v1/invoices/${invoiceId}/payments`)
    return data
  },
}
