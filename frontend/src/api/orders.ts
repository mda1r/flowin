import { apiClient } from './client'
import type { OrderResponse, OrderStatus, PaymentMethod, RefundMethod, ReturnOrderResponse, ReturnReason } from '@/types/api'

export interface CheckoutPayload {
  clientReference: string
  currency: string
  taxRate: number
  customerId?: string
  lines: { variantId: string; productName: string; variantName: string; unitPrice: number; costPrice: number; quantity: number }[]
  loyaltyPoints: number
  paymentMethod: PaymentMethod
  amountTendered: number
  cashAmount?: number
  cardAmount?: number
  offlineCreatedAt?: string
}

export const ordersApi = {
  // Whole sale in one request; resending the same clientReference returns the same order.
  checkout: (branchId: string, payload: CheckoutPayload) =>
    apiClient.post<OrderResponse>(`/api/v1/branches/${branchId}/orders/checkout`, payload),

  listOrders: (
    branchId: string,
    params?: { status?: OrderStatus; page?: number; pageSize?: number; from?: string; to?: string },
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
    },
  ) =>
    apiClient.post<ReturnOrderResponse>(
      `/api/v1/branches/${branchId}/orders/${orderId}/return`,
      data,
    ),

  listReturns: (branchId: string) =>
    apiClient.get<ReturnOrderResponse[]>(`/api/v1/branches/${branchId}/returns`),
}
