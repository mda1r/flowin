import { apiClient } from './client'
import type { InventoryAlertsResponse, StockItemResponse } from '@/types/api'

export const inventoryApi = {
  listItems: (
    branchId: string,
    params?: { search?: string; lowStock?: boolean; page?: number; pageSize?: number },
  ) =>
    apiClient.get<StockItemResponse[]>(`/api/v1/branches/${branchId}/stock`, {
      params: { pageSize: 100, ...params },
    }),

  getItem: (branchId: string, itemId: string) =>
    apiClient.get<StockItemResponse>(`/api/v1/branches/${branchId}/stock/${itemId}`),

  adjustStock: (
    branchId: string,
    itemId: string,
    data: { newQuantity: number; reference?: string; notes?: string },
  ) =>
    apiClient.post<StockItemResponse>(
      `/api/v1/branches/${branchId}/stock/${itemId}/adjust`,
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
}
