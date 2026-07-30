import { apiClient } from './client'
import type { StockCountSessionResponse } from '@/types/api'

export const stockCountApi = {
  listSessions: (branchId: string) =>
    apiClient.get<StockCountSessionResponse[]>(`/api/v1/branches/${branchId}/stock-counts`),

  getSession: (branchId: string, sessionId: string) =>
    apiClient.get<StockCountSessionResponse>(`/api/v1/branches/${branchId}/stock-counts/${sessionId}`),

  createSession: (
    branchId: string,
    data: {
      type: string
      periodStart: string
      periodEnd: string
      notes?: string
      items: { stockItemId: string; variantId: string; systemQuantity: number; unitCost: number }[]
    },
  ) =>
    apiClient.post<StockCountSessionResponse>(`/api/v1/branches/${branchId}/stock-counts`, data),

  saveItems: (
    branchId: string,
    sessionId: string,
    items: { stockItemId: string; countedQuantity: number }[],
  ) =>
    apiClient.put<StockCountSessionResponse>(
      `/api/v1/branches/${branchId}/stock-counts/${sessionId}/items`,
      { items },
    ),

  completeSession: (branchId: string, sessionId: string, autoAdjust: boolean) =>
    apiClient.post<StockCountSessionResponse>(
      `/api/v1/branches/${branchId}/stock-counts/${sessionId}/complete`,
      { autoAdjust },
    ),
}
