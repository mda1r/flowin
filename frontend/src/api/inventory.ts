import { apiClient } from './client'
import type {
  InventoryAlertsResponse,
  MovementType,
  PagedResult,
  StockItemResponse,
  StockMovementResponse,
} from '@/types/api'

export const inventoryApi = {
  listItems: (
    branchId: string,
    params?: { search?: string; lowStock?: boolean; includeArchived?: boolean; page?: number; pageSize?: number },
  ) =>
    apiClient.get<StockItemResponse[]>(`/api/v1/branches/${branchId}/stock`, {
      params: { pageSize: 100, ...params },
    }),

  getItem: (branchId: string, itemId: string) =>
    apiClient.get<StockItemResponse>(`/api/v1/branches/${branchId}/stock/${itemId}`),

  adjustStock: (
    branchId: string,
    itemId: string,
    data: { newQuantity: number; reference?: string; notes?: string; expiryDate?: string | null; clearExpiry?: boolean; reorderPoint?: number; reorderQuantity?: number; notifyDaysBeforeExpiry?: number },
  ) =>
    apiClient.post<StockItemResponse>(
      `/api/v1/branches/${branchId}/stock/${itemId}/adjust`,
      data,
    ),

  receiveStock: (
    branchId: string,
    itemId: string,
    data: { quantity: number; reference?: string; notes?: string; expiryDate?: string | null },
  ) =>
    apiClient.post<StockItemResponse>(
      `/api/v1/branches/${branchId}/stock/${itemId}/receive`,
      data,
    ),

  initializeStock: (branchId: string, variantId: string) =>
    apiClient.post<StockItemResponse>(`/api/v1/branches/${branchId}/stock/initialize`, {
      variantId,
      reorderPoint: 0,
      reorderQuantity: 0,
    }),

  getAlerts: (branchId: string, daysAhead = 7) =>
    apiClient.get<InventoryAlertsResponse>(
      `/api/v1/branches/${branchId}/inventory/alerts`,
      { params: { daysAhead } },
    ),

  // The item's stock card, newest first. from/to are calendar days (YYYY-MM-DD) in store time.
  listMovements: (
    branchId: string,
    itemId: string,
    params?: { type?: MovementType; from?: string; to?: string; page?: number; pageSize?: number },
  ) =>
    apiClient.get<PagedResult<StockMovementResponse>>(
      `/api/v1/branches/${branchId}/stock/${itemId}/movements`,
      { params },
    ),

  deleteItem: (branchId: string, itemId: string) =>
    apiClient.delete(`/api/v1/branches/${branchId}/stock/${itemId}`),

  archiveItem: (branchId: string, itemId: string) =>
    apiClient.post<StockItemResponse>(`/api/v1/branches/${branchId}/stock/${itemId}/archive`),

  restoreItem: (branchId: string, itemId: string) =>
    apiClient.post<StockItemResponse>(`/api/v1/branches/${branchId}/stock/${itemId}/restore`),
}
