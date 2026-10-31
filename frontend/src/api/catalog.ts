import { apiClient } from './client'
import type { CategoryResponse, ProductResponse, ProductVariantResponse } from '@/types/api'

export const catalogApi = {
  // Categories — tenant determined from auth token, no tenantId in URL
  listCategories: (params?: { page?: number; pageSize?: number }) =>
    apiClient.get<CategoryResponse[]>('/api/v1/categories', {
      params: { page: 1, pageSize: 50, ...params },
    }),

  createCategory: (data: { name: string; description?: string }) =>
    apiClient.post<CategoryResponse>('/api/v1/categories', data),

  // Products — tenant determined from auth token (no tenantId in URL)
  listProducts: (_tenantId: string, params?: {
    categoryId?: string
    search?: string
    page?: number
    pageSize?: number
  }) =>
    apiClient.get<ProductResponse[]>(`/api/v1/products`, {
      params: { pageSize: 100, ...params },
    }),

  getProduct: (_tenantId: string, productId: string) =>
    apiClient.get<ProductResponse>(`/api/v1/products/${productId}`),

  createProduct: (_tenantId: string, data: {
    name: string
    description?: string
    categoryId?: string
    type?: string
    taxClass?: string
    trackInventory?: boolean
    unitType?: string
    sku: string
    variantName: string
    costPrice: number
    salePrice: number
    currency: string
    barcode?: string
  }) => apiClient.post<ProductResponse>(`/api/v1/products`, data),

  updateProduct: (productId: string, data: {
    name: string
    description?: string
    categoryId?: string
    taxClass?: string
    trackInventory?: boolean
    unitType?: string
    imageUrl?: string
  }) => apiClient.put<ProductResponse>(`/api/v1/products/${productId}`, data),

  // Omitted sku/barcode keep the stored values; an empty barcode clears it.
  updateVariant: (productId: string, variantId: string, data: {
    name: string
    costPrice: number
    salePrice: number
    currency: string
    barcode?: string
    sku?: string
  }) => apiClient.patch<ProductVariantResponse>(`/api/v1/products/${productId}/variants/${variantId}`, data),

  addVariant: (productId: string, data: {
    sku: string
    name: string
    costPrice: number
    salePrice: number
    currency: string
    barcode?: string
  }) => apiClient.post<ProductVariantResponse>(`/api/v1/products/${productId}/variants`, data),

  setVariantStatus: (productId: string, variantId: string, isActive: boolean) =>
    apiClient.patch<ProductVariantResponse>(`/api/v1/products/${productId}/variants/${variantId}/status`, { isActive }),

  deactivateProduct: (productId: string) =>
    apiClient.delete(`/api/v1/products/${productId}`),
}
