import { apiClient } from './client'
import type {
  TenantWithSubscriptionResponse,
  TenantDetailResponse,
  TenantSubscriptionResponse,
  SubscriptionPlanResponse,
  CreateSubscriptionRequest,
  CreateSubscriptionPlanRequest,
  CreateTenantRequest,
} from '@/types/api'

export const superAdminApi = {
  // Tenants
  listTenants: () =>
    apiClient.get<TenantWithSubscriptionResponse[]>('/api/v1/superadmin/tenants'),

  createTenant: (data: CreateTenantRequest) =>
    apiClient.post<TenantWithSubscriptionResponse>('/api/v1/superadmin/tenants', data),

  getTenant: (id: string) =>
    apiClient.get<TenantDetailResponse>(`/api/v1/superadmin/tenants/${id}`),

  createSubscription: (tenantId: string, data: CreateSubscriptionRequest) =>
    apiClient.post<TenantSubscriptionResponse>(
      `/api/v1/superadmin/tenants/${tenantId}/subscriptions`,
      data,
    ),

  suspendTenant: (tenantId: string, reason: string) =>
    apiClient.post(`/api/v1/superadmin/tenants/${tenantId}/suspend`, { reason }),

  activateTenant: (tenantId: string) =>
    apiClient.post(`/api/v1/superadmin/tenants/${tenantId}/activate`),

  deleteTenant: (tenantId: string) =>
    apiClient.delete(`/api/v1/superadmin/tenants/${tenantId}`),

  // Plans
  listPlans: () =>
    apiClient.get<SubscriptionPlanResponse[]>('/api/v1/superadmin/plans'),

  createPlan: (data: CreateSubscriptionPlanRequest) =>
    apiClient.post<SubscriptionPlanResponse>('/api/v1/superadmin/plans', data),
}
