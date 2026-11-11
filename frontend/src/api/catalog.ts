import { apiClient } from './client'
import type { CategoryResponse, ModifierGroupResponse, ProductResponse, ProductVariantResponse } from '@/types/api'

export const catalogApi = {
  // Categories — tenant determined from auth token, no tenantId in URL
  listCategories: (params?: { page?: number; pageSize?: number }) =>
    apiClient.get<CategoryResponse[]>('/api/v1/categories', {
      params: { page: 1, pageSize: 50, ...params },
    }),

  createCategory: (data: { name: string; nameEn?: string; description?: string }) =>
    apiClient.post<CategoryResponse>('/api/v1/categories', data),

  // An empty English name clears it.
  updateCategory: (id: string, data: { name: string; nameEn: string }) =>
    apiClient.put<CategoryResponse>(`/api/v1/categories/${id}`, data),

  // Products — tenant determined from auth token (no tenantId in URL)
  listProducts: (_tenantId: string, params?: {
    categoryId?: string
    search?: string
    page?: number
    pageSize?: number
    // Server-side cap on the number of products returned (1–500); omitted returns the whole catalogue.
    limit?: number
  }) =>
    apiClient.get<ProductResponse[]>(`/api/v1/products`, {
      params: { pageSize: 100, ...params },
    }),

  // Exact barcode or SKU match on an active variant (scanner lookup); 404 when nothing matches.
  findByBarcode: (code: string) =>
    apiClient.get<ProductResponse>('/api/v1/products/by-barcode', { params: { code } }),

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
    nameEn?: string
    variantNameEn?: string
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
    // Omitted keeps the stored English name; empty clears it.
    nameEn?: string
  }) => apiClient.put<ProductResponse>(`/api/v1/products/${productId}`, data),

  // Omitted sku/barcode keep the stored values; an empty barcode clears it.
  updateVariant: (productId: string, variantId: string, data: {
    name: string
    costPrice: number
    salePrice: number
    currency: string
    barcode?: string
    sku?: string
    nameEn?: string
  }) => apiClient.patch<ProductVariantResponse>(`/api/v1/products/${productId}/variants/${variantId}`, data),

  addVariant: (productId: string, data: {
    sku: string
    name: string
    costPrice: number
    salePrice: number
    currency: string
    barcode?: string
    nameEn?: string
  }) => apiClient.post<ProductVariantResponse>(`/api/v1/products/${productId}/variants`, data),

  setVariantStatus: (productId: string, variantId: string, isActive: boolean) =>
    apiClient.patch<ProductVariantResponse>(`/api/v1/products/${productId}/variants/${variantId}/status`, { isActive }),

  deactivateProduct: (productId: string) =>
    apiClient.delete(`/api/v1/products/${productId}`),

  // A product's photo (already shrunk in the browser); replaces any earlier one.
  setProductImage: (productId: string, image: Blob) => {
    const form = new FormData()
    form.append('file', image, image.type === 'image/webp' ? 'product.webp' : 'product.jpg')
    // The client defaults to JSON; multipart lets the browser add the boundary instead of turning the form into JSON.
    return apiClient.put<ProductResponse>(`/api/v1/products/${productId}/image`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },

  removeProductImage: (productId: string) =>
    apiClient.delete<ProductResponse>(`/api/v1/products/${productId}/image`),

  // Modifier (add-on) groups — tenant from the token. Option prices are net of VAT.
  listModifierGroups: (params?: { includeInactive?: boolean }) =>
    apiClient.get<ModifierGroupResponse[]>('/api/v1/modifier-groups', { params }),

  createModifierGroup: (data: ModifierGroupPayload) =>
    apiClient.post<ModifierGroupResponse>('/api/v1/modifier-groups', data),

  // options replaces the list: send an option's id to keep it (old orders point at it), leave it out to remove it.
  updateModifierGroup: (groupId: string, data: ModifierGroupPayload) =>
    apiClient.put<ModifierGroupResponse>(`/api/v1/modifier-groups/${groupId}`, data),

  deactivateModifierGroup: (groupId: string) =>
    apiClient.delete(`/api/v1/modifier-groups/${groupId}`),

  // Replaces the product's groups, in the order the till asks them; [] detaches all.
  setProductModifierGroups: (productId: string, groupIds: string[]) =>
    apiClient.put(`/api/v1/products/${productId}/modifier-groups`, { groupIds }),
}

export interface ModifierGroupPayload {
  name: string
  nameEn?: string
  isRequired: boolean
  minSelect: number
  maxSelect: number
  sortOrder: number
  options: { id?: string; name: string; nameEn?: string; priceDelta: number; isActive: boolean; sortOrder: number }[]
}
