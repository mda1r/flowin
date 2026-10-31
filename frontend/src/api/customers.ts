import { apiClient } from './client'
import type { CustomerResponse, LoyaltySettings } from '@/types/api'

export type LoyaltyTransactionKind = 'Earn' | 'Redeem' | 'Adjust' | 'Reverse'

// One change to a customer's points: delta is signed (+ added, - taken away).
export interface LoyaltyTransaction {
  id: string
  delta: number
  kind: LoyaltyTransactionKind
  orderId?: string | null
  userId?: string | null
  reason?: string | null
  createdAt: string
}

export const CUSTOMERS_PAGE_SIZE = 20

export const customersApi = {
  list: (
    tenantId: string,
    params?: { search?: string; page?: number; pageSize?: number },
  ) =>
    apiClient.get<CustomerResponse[]>(`/api/v1/tenants/${tenantId}/customers`, {
      params: { page: 1, pageSize: CUSTOMERS_PAGE_SIZE, ...params },
    }),

  // How many customers match the same search as list, for paging and the dashboard total.
  count: (tenantId: string, params?: { search?: string }) =>
    apiClient
      .get<{ totalCount: number }>(`/api/v1/tenants/${tenantId}/customers/count`, { params })
      .then((r) => r.data.totalCount),

  get: (tenantId: string, customerId: string) =>
    apiClient.get<CustomerResponse>(
      `/api/v1/tenants/${tenantId}/customers/${customerId}`,
    ),

  // dateOfBirth is YYYY-MM-DD.
  create: (
    tenantId: string,
    data: { name: string; email?: string; phone?: string; address?: string; dateOfBirth?: string; marketingOptIn?: boolean },
  ) =>
    apiClient.post<CustomerResponse>(
      `/api/v1/tenants/${tenantId}/customers`,
      data,
    ),

  update: (
    tenantId: string,
    customerId: string,
    data: {
      name: string
      email?: string
      phone?: string
      address?: string
      dateOfBirth?: string | null
      notes?: string | null
      marketingOptIn?: boolean
    },
  ) =>
    apiClient.put<CustomerResponse>(
      `/api/v1/tenants/${tenantId}/customers/${customerId}`,
      data,
    ),

  addLoyaltyPoints: (
    tenantId: string,
    customerId: string,
    data: { points: number; reason: string },
  ) =>
    apiClient.post<CustomerResponse>(
      `/api/v1/tenants/${tenantId}/customers/${customerId}/loyalty/add`,
      data,
    ),

  redeemLoyaltyPoints: (
    tenantId: string,
    customerId: string,
    data: { points: number; reason: string },
  ) =>
    apiClient.post<CustomerResponse>(
      `/api/v1/tenants/${tenantId}/customers/${customerId}/loyalty/redeem`,
      data,
    ),

  loyaltyHistory: (tenantId: string, customerId: string, limit = 50) =>
    apiClient
      .get<LoyaltyTransaction[]>(`/api/v1/tenants/${tenantId}/customers/${customerId}/loyalty/history`, {
        params: { limit },
      })
      .then((r) => r.data),

  getLoyaltySettings: (tenantId: string) =>
    apiClient.get<LoyaltySettings>(`/api/v1/tenants/${tenantId}/loyalty-settings`),

  updateLoyaltySettings: (tenantId: string, data: LoyaltySettings) =>
    apiClient.put<LoyaltySettings>(`/api/v1/tenants/${tenantId}/loyalty-settings`, data),
}
