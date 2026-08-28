import { apiClient } from './client'

export interface BrandResponse {
  id: string
  nameAr: string
  nameEn: string
  code: string
  status: string
  notes: string | null
  memberCount: number
  createdAt: string
}

export interface BrandMemberResponse {
  membershipId: string
  tenantId: string
  tenantName: string
  tenantEmail: string
  businessType: string
  isActive: boolean
  branchDisplayName: string | null
  branchCode: string | null
  membershipStatus: string
  linkedAt: string
}

export interface TaxScopeMemberResponse {
  membershipId: string
  tenantId: string
  tenantName: string
  effectiveFrom: string
  effectiveTo: string | null
}

export interface TaxScopeResponse {
  id: string
  name: string
  vatRegistrationNumber: string
  legalEntityName: string
  isActive: boolean
  createdAt: string
  members: TaxScopeMemberResponse[]
}

export interface BrandDetailResponse {
  id: string
  nameAr: string
  nameEn: string
  code: string
  status: string
  notes: string | null
  memberCount: number
  createdAt: string
  members: BrandMemberResponse[]
  taxScopes: TaxScopeResponse[]
}

export interface ListBrandsResult {
  items: BrandResponse[]
  totalCount: number
  page: number
  pageSize: number
}

export interface CreateBrandRequest {
  nameAr: string
  nameEn: string
  code: string
  notes?: string
}

export interface UpdateBrandRequest {
  nameAr: string
  nameEn: string
  notes?: string
  status?: string
}

export interface LinkTenantRequest {
  tenantId: string
  branchDisplayName?: string
  branchCode?: string
}

export interface MoveTenantRequest {
  tenantId: string
  newBranchDisplayName?: string
  newBranchCode?: string
}

export interface CreateTenantUnderBrandRequest {
  name: string
  subdomain: string
  adminEmail: string
  businessType: string
  currency: string
  timeZone: string
  branchDisplayName?: string
  branchCode?: string
}

export interface CreateTaxScopeRequest {
  name: string
  vatRegistrationNumber: string
  legalEntityName: string
}

export interface AddTenantToTaxScopeRequest {
  tenantId: string
  effectiveFrom: string
}

export const brandsApi = {
  list: (params?: { status?: string; search?: string; page?: number; pageSize?: number }) =>
    apiClient.get<ListBrandsResult>('/api/v1/superadmin/brands', { params }).then((r) => r.data),

  create: (data: CreateBrandRequest) =>
    apiClient.post<BrandResponse>('/api/v1/superadmin/brands', data).then((r) => r.data),

  get: (id: string) =>
    apiClient.get<BrandDetailResponse>(`/api/v1/superadmin/brands/${id}`).then((r) => r.data),

  update: (id: string, data: UpdateBrandRequest) =>
    apiClient.put<BrandResponse>(`/api/v1/superadmin/brands/${id}`, data).then((r) => r.data),

  linkTenant: (brandId: string, data: LinkTenantRequest) =>
    apiClient
      .post<BrandMemberResponse>(`/api/v1/superadmin/brands/${brandId}/members`, data)
      .then((r) => r.data),

  unlinkTenant: (membershipId: string) =>
    apiClient.delete(`/api/v1/superadmin/brands/members/${membershipId}`).then((r) => r.data),

  moveTenant: (brandId: string, data: MoveTenantRequest) =>
    apiClient
      .post<BrandMemberResponse>(`/api/v1/superadmin/brands/${brandId}/move-tenant`, data)
      .then((r) => r.data),

  createTenantUnderBrand: (brandId: string, data: CreateTenantUnderBrandRequest) =>
    apiClient
      .post<BrandMemberResponse>(`/api/v1/superadmin/brands/${brandId}/tenants`, data)
      .then((r) => r.data),

  getTaxScopes: (brandId: string) =>
    apiClient
      .get<TaxScopeResponse[]>(`/api/v1/superadmin/brands/${brandId}/tax-scopes`)
      .then((r) => r.data),

  createTaxScope: (brandId: string, data: CreateTaxScopeRequest) =>
    apiClient
      .post<TaxScopeResponse>(`/api/v1/superadmin/brands/${brandId}/tax-scopes`, data)
      .then((r) => r.data),

  addTenantToTaxScope: (scopeId: string, data: AddTenantToTaxScopeRequest) =>
    apiClient
      .post<TaxScopeMemberResponse>(`/api/v1/superadmin/tax-scopes/${scopeId}/members`, data)
      .then((r) => r.data),

  removeTenantFromTaxScope: (membershipId: string) =>
    apiClient
      .delete(`/api/v1/superadmin/tax-scopes/members/${membershipId}`)
      .then((r) => r.data),
}
