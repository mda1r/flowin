import { apiClient } from './client'
import type { BranchResponse, BranchType } from '@/types/api'

export interface CreateBranchPayload {
  name: string
  type: BranchType
  isMainBranch?: boolean
  phoneNumber?: string
  email?: string
  street?: string
  city?: string
  state?: string
  country?: string
  postalCode?: string
}

export const branchesApi = {
  list: (tenantId: string) =>
    apiClient.get<BranchResponse[]>(`/api/v1/tenants/${tenantId}/branches`),

  get: (tenantId: string, branchId: string) =>
    apiClient.get<BranchResponse>(`/api/v1/tenants/${tenantId}/branches/${branchId}`),

  create: (tenantId: string, data: CreateBranchPayload) =>
    apiClient.post<BranchResponse>(`/api/v1/tenants/${tenantId}/branches`, data),

  update: (tenantId: string, branchId: string, data: Omit<CreateBranchPayload, 'isMainBranch'>) =>
    apiClient.put<BranchResponse>(`/api/v1/tenants/${tenantId}/branches/${branchId}`, data),

  deactivate: (tenantId: string, branchId: string) =>
    apiClient.delete(`/api/v1/tenants/${tenantId}/branches/${branchId}`),
}
