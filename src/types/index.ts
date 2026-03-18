export type UserRole = 'ADMIN' | 'PROPERTY_MANAGER' | 'READ_ONLY'
export type Theme = 'LIGHT' | 'DARK'
export type LeaseStatus = 'DRAFT' | 'ACTIVE' | 'EXPIRED' | 'TERMINATED'
export type InvoiceStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'PARTIALLY_PAID' | 'CANCELLED'
export type InvoiceType = 'RENT' | 'SECURITY_DEPOSIT' | 'LATE_FEE' | 'MAINTENANCE_FEE' | 'OTHER'
export type PaymentMethod = 'CASH' | 'MPESA' | 'CARD'
export type PaymentTransactionStatus = 'COMPLETED' | 'FAILED'
export type PropertyType = 'APARTMENT' | 'HOUSE' | 'COMMERCIAL' | 'CONDO' | 'TOWNHOUSE' | 'STUDIO'
export type TenantStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING'
export type EventType = 'PAGE_VIEW' | 'USER_ACTION' | 'API_CALL' | 'API_ERROR' | 'AUTH' | 'NAVIGATION'
export type MaintenanceStatus = 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
export type MaintenancePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'EMERGENCY'

export interface User {
  id: string
  username: string
  email: string
  role: UserRole
  active: boolean
  createdAt: string
}

export interface TokenResponse {
  token: string
  expiresAt: string
  user: User
}

export interface UserSettings {
  userId: string
  currency: string
  theme: Theme
  timezone: string
  updatedAt: string
}

export interface UnavailabilityRecord {
  id: string
  reason: string
  startDate: string
  endDate?: string
  createdAt: string
}

export interface PropertyUnit {
  id: string
  unitNumber: string
  bedrooms: number
  bathrooms: number
  squareFootage?: number
  monthlyRentAmount: number
  currencyCode?: string
  status: string
  currentUnavailability?: UnavailabilityRecord | null
  unavailabilityHistory: UnavailabilityRecord[]
}

export interface Property {
  id: string
  ownerId: string
  name: string
  street: string
  city: string
  state: string
  zipCode: string
  country: string
  type: PropertyType
  units: PropertyUnit[]
  createdAt: string
}

export interface Tenant {
  id: string
  firstName: string
  lastName: string
  email: string
  phoneNumber: string
  nationalIdNo?: string
  creditScore?: number
  status: TenantStatus
  registeredAt: string
}

export interface Lease {
  id: string
  tenantId: string
  propertyId: string
  unitId: string
  startDate: string
  endDate: string
  monthlyRent: number
  securityDeposit: number
  status: LeaseStatus
  terminationReason?: string
  createdAt: string
}

export interface Invoice {
  invoiceId: string
  leaseId: string
  tenantId: string
  amountDue: number
  amountPaid?: number
  outstandingBalance?: number
  currencyCode: string
  dueDate: string
  paidDate?: string
  status: InvoiceStatus
  type: InvoiceType
  createdAt: string
}

export interface PaymentTransaction {
  id: string
  invoiceId: string
  tenantId: string
  amount: number
  currencyCode: string
  method: PaymentMethod
  status: PaymentTransactionStatus
  reference: string | null
  paymentDate: string
  createdAt: string
}

export interface OccupancyRecord {
  leaseId: string
  unitId: string
  tenantId: string
  propertyId?: string
  monthlyRent?: number
  leaseStart: string
  leaseEnd?: string
  status: LeaseStatus
}

export interface MaintenanceIssueTemplate {
  id: string
  title: string
  description: string
  priority: MaintenancePriority
}

export interface MaintenanceCategory {
  id: string
  name: string
  issues: MaintenanceIssueTemplate[]
}

export interface MaintenanceRecord {
  id: string
  tenantId: string
  unitId?: string
  propertyId?: string
  problemDescription: string
  resolutionNotes?: string
  status: MaintenanceStatus
  priority: MaintenancePriority
  requestedAt: string
  completedAt?: string
}

export interface InitiateMpesaPaymentCommand {
  invoiceId: string
  amount: number
  phoneNumber: string
}

export interface MpesaInitiationResponse {
  invoiceId: string
  paymentTransactionId: string
  checkoutRequestId: string
  merchantRequestId: string
  customerMessage: string
  invoiceStatus: InvoiceStatus
}

export type MpesaTransactionStatus = 'INITIATED' | 'CONFIRMED' | 'FAILED' | 'CANCELLED'

export interface MpesaStatusResponse {
  invoiceId: string
  checkoutRequestId: string
  transactionStatus: MpesaTransactionStatus
  resultDescription: string
  mpesaReceiptNumber: string | null
  amountPaid: number | null
  invoiceStatus: InvoiceStatus
}

export interface AppEvent {
  id: string
  type: EventType
  name: string
  payload?: Record<string, unknown>
  userId?: string
  timestamp: string
}