import { apiClient } from './client'
import type { OrderResponse, SalesSummaryResponse } from '@/types/api'
import { localDaysToUtcRange } from '@/lib/dates'

const PAGE_SIZE = 500
const MAX_PAGES = 40

// truncated: the range holds more orders than one report fetches, so the figures cover only part of it.
export interface CompletedOrders {
  orders: OrderResponse[]
  truncated: boolean
}

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
  listAllCompletedOrders: (branchId: string, dateFrom: string, dateTo: string): Promise<CompletedOrders> => {
    const { from, to } = localDaysToUtcRange(dateFrom, dateTo)
    return salesApi.listAllCompletedOrdersBetween(branchId, from, to)
  },

  // Every completed order sold between two UTC instants (to defaults to now), across pages. A sale synced late
  // from an offline till counts at the time it was made.
  listAllCompletedOrdersBetween: async (branchId: string, from: string, to?: string): Promise<CompletedOrders> => {
    const all: OrderResponse[] = []
    for (let page = 1; page <= MAX_PAGES; page++) {
      const { data } = await apiClient.get<OrderResponse[]>(`/api/v1/branches/${branchId}/orders`, {
        params: { status: 'Completed', from, to, page, pageSize: PAGE_SIZE },
      })
      const rows: OrderResponse[] = Array.isArray(data) ? data : ((data as { items?: OrderResponse[] })?.items ?? [])
      all.push(...rows)
      if (rows.length < PAGE_SIZE) return { orders: all, truncated: false }
    }
    return { orders: all, truncated: true }
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
