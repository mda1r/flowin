import { apiClient } from './client'
import type { OrderResponse, SalesSummaryResponse } from '@/types/api'
import { localDaysToUtcRange } from '@/lib/dates'

const PAGE_SIZE = 500

export const salesApi = {
  // dateFrom/dateTo are local YYYY-MM-DD days.
  listCompletedOrders: (
    branchId: string,
    params?: { dateFrom?: string; dateTo?: string; page?: number; pageSize?: number },
  ) => {
    const { dateFrom, dateTo, ...rest } = params ?? {}
    const range = dateFrom && dateTo ? localDaysToUtcRange(dateFrom, dateTo) : undefined
    return apiClient.get<OrderResponse[]>(`/api/v1/branches/${branchId}/orders`, {
      params: { status: 'Completed', pageSize: PAGE_SIZE, ...range, ...rest },
    })
  },

  // Every completed order in the local-day range, across pages.
  listAllCompletedOrders: (branchId: string, dateFrom: string, dateTo: string) => {
    const { from, to } = localDaysToUtcRange(dateFrom, dateTo)
    return salesApi.listAllCompletedOrdersBetween(branchId, from, to)
  },

  // Every completed order created between two UTC instants (to defaults to now), across pages.
  listAllCompletedOrdersBetween: async (branchId: string, from: string, to?: string) => {
    const all: OrderResponse[] = []
    for (let page = 1; page <= 40; page++) {
      const { data } = await apiClient.get<OrderResponse[]>(`/api/v1/branches/${branchId}/orders`, {
        params: { status: 'Completed', from, to, page, pageSize: PAGE_SIZE },
      })
      const rows: OrderResponse[] = Array.isArray(data) ? data : ((data as { items?: OrderResponse[] })?.items ?? [])
      all.push(...rows)
      if (rows.length < PAGE_SIZE) break
    }
    return all
  },

  getSummary: (branchId: string, dateFrom: string, dateTo: string) =>
    apiClient.get<SalesSummaryResponse[]>(`/api/v1/branches/${branchId}/sales/summary/range`, {
      params: { dateFrom, dateTo },
    }),

  getTotalRevenue: (orders: OrderResponse[]) =>
    orders.reduce((sum, o) => sum + o.totalAmount, 0),

  getTotalTax: (orders: OrderResponse[]) =>
    orders.reduce((sum, o) => sum + o.taxAmount, 0),
}
