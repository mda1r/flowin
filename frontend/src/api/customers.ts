import { apiClient } from './client'
import type { CustomerResponse } from '@/types/api'

export const customersApi = {
  list: (
    tenantId: string,
    params?: { search?: string; page?: number; pageSize?: number },
  ) =>
    apiClient.get<CustomerResponse[]>(`/api/v1/tenants/${tenantId}/customers`, {
      params: { page: 1, pageSize: 20, ...params },
    }),

  get: (tenantId: string, customerId: string) =>
    apiClient.get<CustomerResponse>(
      `/api/v1/tenants/${tenantId}/customers/${customerId}`,
    ),

  create: (
    tenantId: string,
    data: { name: string; email?: string; phone?: string; address?: string },
  ) =>
    apiClient.post<CustomerResponse>(
      `/api/v1/tenants/${tenantId}/customers`,
      data,
    ),

  update: (
    tenantId: string,
    customerId: string,
    data: { name: string; email?: string; phone?: string; address?: string },
  ) =>
    apiClient.put<CustomerResponse>(
      `/api/v1/tenants/${tenantId}/customers/${customerId}`,
      data,
    ),

  addLoyaltyPoints: (
    tenantId: string,
    customerId: string,
    data: { points: number },
  ) =>
    apiClient.post<CustomerResponse>(
      `/api/v1/tenants/${tenantId}/customers/${customerId}/loyalty/add`,
      data,
    ),

  redeemLoyaltyPoints: (
    tenantId: string,
    customerId: string,
    data: { points: number },
  ) =>
    apiClient.post<CustomerResponse>(
      `/api/v1/tenants/${tenantId}/customers/${customerId}/loyalty/redeem`,
      data,
    ),
}
