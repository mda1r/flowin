import { apiClient } from './client'
import type {
  StockMaterialCategoryResponse,
  StockMaterialResponse,
  CreateStockMaterialCategoryPayload,
  CreateStockMaterialPayload,
  UpdateStockMaterialPayload,
  AdjustStockMaterialPayload,
  ReceiveStockMaterialPayload,
  StockMaterialMovementResponse,
} from '@/types/stockMaterial'

const base = (tenantId: string) => `/api/v1/tenants/${tenantId}/stock-materials`

export const stockMaterialApi = {
  // Categories
  listCategories: (tenantId: string) =>
    apiClient.get<StockMaterialCategoryResponse[]>(`${base(tenantId)}/categories`),

  createCategory: (tenantId: string, data: CreateStockMaterialCategoryPayload) =>
    apiClient.post<StockMaterialCategoryResponse>(`${base(tenantId)}/categories`, data),

  updateCategory: (tenantId: string, categoryId: string, data: CreateStockMaterialCategoryPayload) =>
    apiClient.put<StockMaterialCategoryResponse>(`${base(tenantId)}/categories/${categoryId}`, data),

  deleteCategory: (tenantId: string, categoryId: string) =>
    apiClient.delete(`${base(tenantId)}/categories/${categoryId}`),

  // Materials
  listMaterials: (
    tenantId: string,
    params?: { categoryId?: string; lowStockOnly?: boolean; search?: string; archived?: boolean },
  ) => apiClient.get<StockMaterialResponse[]>(base(tenantId), { params }),

  getMaterial: (tenantId: string, materialId: string) =>
    apiClient.get<StockMaterialResponse>(`${base(tenantId)}/${materialId}`),

  createMaterial: (tenantId: string, data: CreateStockMaterialPayload) =>
    apiClient.post<StockMaterialResponse>(base(tenantId), data),

  updateMaterial: (tenantId: string, materialId: string, data: UpdateStockMaterialPayload) =>
    apiClient.put<StockMaterialResponse>(`${base(tenantId)}/${materialId}`, data),

  // Materials with movement history are archived (archived: true) rather than removed.
  deleteMaterial: (tenantId: string, materialId: string) =>
    apiClient.delete<{ archived: boolean }>(`${base(tenantId)}/${materialId}`),

  restoreMaterial: (tenantId: string, materialId: string) =>
    apiClient.post<StockMaterialResponse>(`${base(tenantId)}/${materialId}/restore`),

  adjustMaterial: (tenantId: string, materialId: string, data: AdjustStockMaterialPayload) =>
    apiClient.post<StockMaterialResponse>(`${base(tenantId)}/${materialId}/adjust`, data),

  receiveMaterial: (tenantId: string, materialId: string, data: ReceiveStockMaterialPayload) =>
    apiClient.post<StockMaterialResponse>(`${base(tenantId)}/${materialId}/receive`, data),

  purchaseReceiptStatus: (tenantId: string, purchaseOrderId: string) =>
    apiClient.get<{ purchaseOrderId: string; applied: boolean; appliedAt?: string; lineCount: number; productsApplied: boolean }>(
      `${base(tenantId)}/purchase-receipts/${purchaseOrderId}`,
    ),

  listMovements: (tenantId: string, materialId: string) =>
    apiClient.get<StockMaterialMovementResponse[]>(`${base(tenantId)}/${materialId}/movements`),
}
