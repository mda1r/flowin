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

// Blank optional fields are sent as undefined so the server stores null instead of ''.
function withoutBlanks<T extends object>(data: T): T {
  return Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, typeof v === 'string' && v.trim() === '' ? undefined : v]),
  ) as T
}

export const branchesApi = {
  list: (tenantId: string) =>
    apiClient.get<BranchResponse[]>(`/api/v1/tenants/${tenantId}/branches`),

  get: (tenantId: string, branchId: string) =>
    apiClient.get<BranchResponse>(`/api/v1/tenants/${tenantId}/branches/${branchId}`),

  create: (tenantId: string, data: CreateBranchPayload) =>
    apiClient.post<BranchResponse>(`/api/v1/tenants/${tenantId}/branches`, withoutBlanks(data)),

  update: (tenantId: string, branchId: string, data: Omit<CreateBranchPayload, 'isMainBranch'>) =>
    apiClient.put<BranchResponse>(`/api/v1/tenants/${tenantId}/branches/${branchId}`, withoutBlanks(data)),

  deactivate: (tenantId: string, branchId: string) =>
    apiClient.delete(`/api/v1/tenants/${tenantId}/branches/${branchId}`),

  activate: (tenantId: string, branchId: string) =>
    apiClient.post(`/api/v1/tenants/${tenantId}/branches/${branchId}/activate`),

  setMain: (tenantId: string, branchId: string) =>
    apiClient.post(`/api/v1/tenants/${tenantId}/branches/${branchId}/set-main`),
}
