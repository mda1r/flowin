import { apiClient } from './client'
import type { CategoryResponse, ProductResponse } from '@/types/api'

export const catalogApi = {
  // Categories
  listCategories: (tenantId: string, params?: { page?: number; pageSize?: number }) =>
    apiClient.get<CategoryResponse[]>(`/api/v1/tenants/${tenantId}/categories`, {
      params: { page: 1, pageSize: 50, ...params },
    }),

  createCategory: (tenantId: string, data: { name: string; description?: string }) =>
    apiClient.post<CategoryResponse>(`/api/v1/tenants/${tenantId}/categories`, data),

  // Products
  listProducts: (tenantId: string, params?: {
    categoryId?: string
    search?: string
    page?: number
    pageSize?: number
  }) =>
    apiClient.get<ProductResponse[]>(`/api/v1/tenants/${tenantId}/products`, {
      params: { pageSize: 100, ...params },
    }),

  getProduct: (tenantId: string, productId: string) =>
    apiClient.get<ProductResponse>(`/api/v1/tenants/${tenantId}/products/${productId}`),

  createProduct: (tenantId: string, data: {
    name: string
    description?: string
    categoryId?: string
    type?: string
    taxClass?: string
    trackInventory?: boolean
    sku: string
    variantName: string
    costPrice: number
    salePrice: number
    currency: string
    barcode?: string
  }) => apiClient.post<ProductResponse>(`/api/v1/tenants/${tenantId}/products`, data),

  updateProduct: (tenantId: string, productId: string, data: {
    name: string
    description?: string
    categoryId?: string
    taxClass?: string
    trackInventory?: boolean
    imageUrl?: string
  }) => apiClient.put<ProductResponse>(`/api/v1/tenants/${tenantId}/products/${productId}`, data),

  updateVariant: (tenantId: string, productId: string, variantId: string, data: {
    name: string
    costPrice: number
    salePrice: number
    currency: string
    barcode?: string
  }) =>
    apiClient.patch(`/api/v1/tenants/${tenantId}/products/${productId}/variants/${variantId}`, data),

  deactivateProduct: (tenantId: string, productId: string) =>
    apiClient.delete(`/api/v1/tenants/${tenantId}/products/${productId}`),
}
