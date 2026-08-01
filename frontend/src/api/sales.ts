import { apiClient } from './client'
import type { OrderResponse, SalesSummaryResponse } from '@/types/api'

export const salesApi = {
  listCompletedOrders: (
    branchId: string,
    params?: { dateFrom?: string; dateTo?: string; page?: number; pageSize?: number },
  ) =>
    apiClient.get<OrderResponse[]>(`/api/v1/branches/${branchId}/orders`, {
      params: { status: 'Completed', pageSize: 200, ...params },
    }),

  getSummary: (branchId: string, dateFrom: string, dateTo: string) =>
    apiClient.get<SalesSummaryResponse>(`/api/v1/branches/${branchId}/sales/summary/range`, {
      params: { dateFrom, dateTo },
    }),

  getTotalRevenue: (orders: OrderResponse[]) =>
    orders.reduce((sum, o) => sum + o.totalAmount, 0),

  getTotalTax: (orders: OrderResponse[]) =>
    orders.reduce((sum, o) => sum + o.taxAmount, 0),
}
