import { apiClient } from './client'
import type { OrderResponse, OrderStatus, PaymentMethod, RefundMethod, ReturnOrderResponse, ReturnReason } from '@/types/api'

export type CheckoutDiscountType = 'None' | 'Percentage' | 'Fixed'

export interface CheckoutPayload {
  clientReference: string
  currency: string
  taxRate: number
  customerId?: string
  lines: {
    variantId: string
    productName: string
    variantName: string
    unitPrice: number
    costPrice: number
    quantity: number
    discountType?: CheckoutDiscountType
    discountValue?: number
    notes?: string
  }[]
  loyaltyPoints: number
  paymentMethod: PaymentMethod
  amountTendered: number
  cashAmount?: number
  cardAmount?: number
  offlineCreatedAt?: string
  // Cart discount; a Fixed value is net riyals like the line prices.
  discountType?: CheckoutDiscountType
  discountValue?: number
  // Manager PIN for a cashier discount past the branch cap. Never stored with an offline sale.
  approvalPin?: string
  // Sends the paid sale to the kitchen screen; no table number means takeaway or no table.
  // callName is the name the barista calls out at pickup (40 characters at most).
  kitchen?: { tableNumber: number | null; takeaway: boolean; callName?: string }
}

// The branch till rules: how far a cashier may discount alone, and whether a manager PIN can approve more.
export interface PosBranchSettings {
  maxCashierDiscountPercent: number
  hasApprovalPin: boolean
}

export const posSettingsApi = {
  get: (branchId: string) => apiClient.get<PosBranchSettings>(`/api/v1/branches/${branchId}/pos-settings`),

  // Owner or Manager only. approvalPin replaces the PIN when given; clearApprovalPin removes it.
  save: (branchId: string, data: { maxCashierDiscountPercent: number; approvalPin?: string; clearApprovalPin?: boolean }) =>
    apiClient.put<PosBranchSettings>(`/api/v1/branches/${branchId}/pos-settings`, data),
}

// Mirrors ListReturnsQuery.MaxLimit on the server.
export const RETURNS_MAX_LIMIT = 2000

export const ordersApi = {
  // Whole sale in one request; resending the same clientReference returns the same order.
  // A short timeout so a weak connection falls back to offline selling quickly instead of holding the queue.
  checkout: (branchId: string, payload: CheckoutPayload) =>
    apiClient.post<OrderResponse>(`/api/v1/branches/${branchId}/orders/checkout`, payload, { timeout: 10_000 }),

  listOrders: (
    branchId: string,
    // number finds one invoice by its number across all dates (from/to are ignored then).
    params?: { status?: OrderStatus; page?: number; pageSize?: number; from?: string; to?: string; number?: number },
  ) =>
    apiClient.get<OrderResponse[]>(`/api/v1/branches/${branchId}/orders`, {
      params: { pageSize: 20, ...params },
    }),

  getOrder: (branchId: string, orderId: string) =>
    apiClient.get<OrderResponse>(`/api/v1/branches/${branchId}/orders/${orderId}`),

  createOrder: (
    branchId: string,
    data: { tenantId: string; currency: string; customerId?: string; taxRate?: number },
  ) =>
    apiClient.post<OrderResponse>(`/api/v1/branches/${branchId}/orders`, data),

  addLine: (
    branchId: string,
    orderId: string,
    data: {
      variantId: string
      productName: string
      variantName: string
      unitPrice: number
      costPrice: number
      quantity: number
    },
  ) =>
    apiClient.post<OrderResponse>(
      `/api/v1/branches/${branchId}/orders/${orderId}/lines`,
      data,
    ),

  removeLine: (branchId: string, orderId: string, lineId: string) =>
    apiClient.delete(
      `/api/v1/branches/${branchId}/orders/${orderId}/lines/${lineId}`,
    ),

  redeemLoyalty: (branchId: string, orderId: string, points: number) =>
    apiClient.post<OrderResponse>(`/api/v1/branches/${branchId}/orders/${orderId}/loyalty`, { points }),

  complete: (
    branchId: string,
    orderId: string,
    data: { paymentMethod: PaymentMethod; amountTendered?: number; cashAmount?: number; cardAmount?: number },
  ) =>
    apiClient.post<OrderResponse>(
      `/api/v1/branches/${branchId}/orders/${orderId}/complete`,
      data,
    ),

  cancel: (branchId: string, orderId: string, data?: { reason?: string }) =>
    apiClient.post<OrderResponse>(
      `/api/v1/branches/${branchId}/orders/${orderId}/cancel`,
      data ?? {},
    ),

  returnOrder: (
    branchId: string,
    orderId: string,
    data: {
      refundMethod: RefundMethod
      lines: { lineId: string; quantity: number; reason: ReturnReason }[]
      restockItems?: boolean
      note?: string
      // Resending the same reference returns the same return instead of refunding twice.
      clientReference?: string
    },
  ) =>
    apiClient.post<ReturnOrderResponse>(
      `/api/v1/branches/${branchId}/orders/${orderId}/return`,
      data,
    ),

  // Newest first; the server caps the list (default 1000, at most RETURNS_MAX_LIMIT) so pass from/to.
  listReturns: (branchId: string, params?: { from?: string; to?: string; limit?: number }) =>
    apiClient.get<ReturnOrderResponse[]>(`/api/v1/branches/${branchId}/returns`, { params }),
}
