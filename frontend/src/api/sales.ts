import { apiClient } from './client'
import type { OrderResponse } from '@/types/api'

export const salesApi = {
  listCompletedOrders: (
    branchId: string,
    params?: { dateFrom?: string; dateTo?: string; page?: number; pageSize?: number },
  ) =>
    apiClient.get<OrderResponse[]>(`/api/v1/branches/${branchId}/orders`, {
      params: { status: 'Completed', pageSize: 50, ...params },
    }),

  getTotalRevenue: (orders: OrderResponse[]) =>
    orders.reduce((sum, o) => sum + o.totalAmount, 0),
}
