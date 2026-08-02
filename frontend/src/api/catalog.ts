import { apiClient } from './client'
import type { CategoryResponse, ProductResponse } from '@/types/api'

export const catalogApi = {
  // Categories — tenant determined from auth token, no tenantId in URL
  listCategories: (params?: { page?: number; pageSize?: number }) =>
    apiClient.get<CategoryResponse[]>('/api/v1/categories', {
      params: { page: 1, pageSize: 50, ...params },
    }),

  createCategory: (data: { name: string; description?: string }) =>
    apiClient.post<CategoryResponse>('/api/v1/categories', data),

  // Products — LIST is tenant-scoped by URL (isolation fix)
  //            WRITE uses /api/v1/products (tenant from auth token)
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

  createProduct: (data: {
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
  }) => apiClient.post<ProductResponse>('/api/v1/products', data),

  updateProduct: (productId: string, data: {
    name: string
    description?: string
    categoryId?: string
    taxClass?: string
    trackInventory?: boolean
    imageUrl?: string
  }) => apiClient.put<ProductResponse>(`/api/v1/products/${productId}`, data),

  updateVariant: (productId: string, variantId: string, data: {
    name: string
    costPrice: number
    salePrice: number
    currency: string
    barcode?: string
  }) => apiClient.patch(`/api/v1/products/${productId}/variants/${variantId}`, data),

  deactivateProduct: (productId: string) =>
    apiClient.delete(`/api/v1/products/${productId}`),
}
