import { apiClient } from './client'
import type {
  TenantWithSubscriptionResponse,
  TenantDetailResponse,
  TenantSubscriptionResponse,
  SubscriptionPlanResponse,
  BranchResponse,
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

  getTenantBranches: (tenantId: string) =>
    apiClient.get<BranchResponse[]>(`/api/v1/superadmin/tenants/${tenantId}/branches`),

  setTenantAiAccess: (tenantId: string, enabled: boolean) =>
    apiClient.put(`/api/v1/superadmin/tenants/${tenantId}/ai`, { enabled }),

  // Plans
  listPlans: () =>
    apiClient.get<SubscriptionPlanResponse[]>('/api/v1/superadmin/plans'),

  createPlan: (data: CreateSubscriptionPlanRequest) =>
    apiClient.post<SubscriptionPlanResponse>('/api/v1/superadmin/plans', data),

  updatePlanFeatures: (planId: string, features: string[]) =>
    apiClient.put<SubscriptionPlanResponse>(`/api/v1/superadmin/plans/${planId}/features`, { features }),
}
