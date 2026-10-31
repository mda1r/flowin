import { apiClient } from './client'
import type {
  MenuItemResponse,
  MenuCategory,
  RestaurantOrderResponse,
  DiscountCodeResponse,
  ValidateDiscountCodeResponse,
  DiscountCodeType,
} from '@/types/api'

// The server prices each line from the menu; the till only says which dish and how many.
export interface OrderItemInput {
  menuItemId: string
  quantity: number
  notes?: string
}

// A sale the cafe till already charged, copied for the kitchen screen. These lines are catalog items.
export interface KitchenCopyItemInput {
  menuItemId: string
  itemName: string
  quantity: number
  unitPrice: number
  notes?: string
}

export interface OrderPaymentInput {
  paymentMethod: 'Cash' | 'Card'
  amountTendered: number
}

export const restaurantApi = {
  // ── Menu Items ─────────────────────────────────────────────────────────────
  listMenuItems: (
    branchId: string,
    params?: { category?: MenuCategory; isAvailable?: boolean; page?: number; pageSize?: number },
  ) =>
    apiClient.get<MenuItemResponse[]>(
      `/api/v1/branches/${branchId}/menu-items`,
      { params: { page: 1, pageSize: 100, includeUnavailable: true, ...params } },
    ),

  getMenuItem: (branchId: string, menuItemId: string) =>
    apiClient.get<MenuItemResponse>(
      `/api/v1/branches/${branchId}/menu-items/${menuItemId}`,
    ),

  createMenuItem: (
    branchId: string,
    data: {
      name: string
      description?: string
      category: MenuCategory
      price: number
      currency: string
      sortOrder: number
    },
  ) =>
    apiClient.post<MenuItemResponse>(
      `/api/v1/branches/${branchId}/menu-items`,
      data,
    ),

  updateMenuItem: (
    branchId: string,
    menuItemId: string,
    data: {
      name: string
      description?: string
      category: MenuCategory
      price: number
      sortOrder: number
    },
  ) =>
    apiClient.put<MenuItemResponse>(
      `/api/v1/branches/${branchId}/menu-items/${menuItemId}`,
      data,
    ),

  setAvailability: (
    branchId: string,
    menuItemId: string,
    data: { isAvailable: boolean },
  ) =>
    apiClient.patch<MenuItemResponse>(
      `/api/v1/branches/${branchId}/menu-items/${menuItemId}/availability`,
      data,
    ),

  // ── Restaurant Orders ──────────────────────────────────────────────────────
  listPaidOrders: (branchId: string, from: string, to: string) =>
    apiClient.get<RestaurantOrderResponse[]>(`/api/v1/branches/${branchId}/restaurant/orders/paid`, {
      params: { from, to },
    }),

  listActiveOrders: (branchId: string) =>
    apiClient.get<RestaurantOrderResponse[]>(
      `/api/v1/branches/${branchId}/restaurant/orders`,
    ),

  listTableOrders: (branchId: string, tableNumber: number) =>
    apiClient.get<RestaurantOrderResponse[]>(
      `/api/v1/branches/${branchId}/restaurant/orders/by-table/${tableNumber}`,
    ),

  // sendToKitchen and payment make opening, sending and paying one call, so a retry never doubles an order.
  createOrder: (
    branchId: string,
    data: {
      tableNumber: number
      items: OrderItemInput[]
      notes?: string
      discountCode?: string
      sendToKitchen?: boolean
      payment?: OrderPaymentInput
    },
  ) =>
    apiClient.post<RestaurantOrderResponse>(
      `/api/v1/branches/${branchId}/restaurant/orders`,
      data,
    ),

  createKitchenCopy: (
    branchId: string,
    data: { tableNumber: number; items: KitchenCopyItemInput[]; notes?: string },
  ) =>
    apiClient.post<RestaurantOrderResponse>(
      `/api/v1/branches/${branchId}/restaurant/orders/kitchen-copy`,
      data,
    ),

  addItems: (branchId: string, orderId: string, items: OrderItemInput[]) =>
    apiClient.post<RestaurantOrderResponse>(
      `/api/v1/branches/${branchId}/restaurant/orders/${orderId}/items`,
      { items, sendToKitchen: true },
    ),

  removeItem: (branchId: string, orderId: string, itemId: string) =>
    apiClient.delete<RestaurantOrderResponse>(
      `/api/v1/branches/${branchId}/restaurant/orders/${orderId}/items/${itemId}`,
    ),

  payTable: (
    branchId: string,
    data: { tableNumber: number; orderIds: string[] } & OrderPaymentInput,
  ) =>
    apiClient.post<RestaurantOrderResponse[]>(
      `/api/v1/branches/${branchId}/restaurant/orders/pay-table`,
      data,
    ),

  sendToKitchen: (branchId: string, orderId: string) =>
    apiClient.post<RestaurantOrderResponse>(
      `/api/v1/branches/${branchId}/restaurant/orders/${orderId}/send-to-kitchen`,
    ),

  markItemReady: (branchId: string, orderId: string, itemId: string) =>
    apiClient.post<RestaurantOrderResponse>(
      `/api/v1/branches/${branchId}/restaurant/orders/${orderId}/items/${itemId}/mark-ready`,
    ),

  markOrderReady: (branchId: string, orderId: string) =>
    apiClient.post<RestaurantOrderResponse>(
      `/api/v1/branches/${branchId}/restaurant/orders/${orderId}/mark-ready`,
    ),

  returnToKitchen: (branchId: string, orderId: string) =>
    apiClient.post<RestaurantOrderResponse>(
      `/api/v1/branches/${branchId}/restaurant/orders/${orderId}/return-to-kitchen`,
    ),

  serveOrder: (branchId: string, orderId: string) =>
    apiClient.post<RestaurantOrderResponse>(
      `/api/v1/branches/${branchId}/restaurant/orders/${orderId}/serve`,
    ),

  payOrder: (
    branchId: string,
    orderId: string,
    data: { paymentMethod: string; amountTendered: number },
  ) =>
    apiClient.post<RestaurantOrderResponse>(
      `/api/v1/branches/${branchId}/restaurant/orders/${orderId}/pay`,
      data,
    ),

  cancelOrder: (branchId: string, orderId: string, reason: string) =>
    apiClient.post<RestaurantOrderResponse>(
      `/api/v1/branches/${branchId}/restaurant/orders/${orderId}/cancel`,
      { reason },
    ),

  // ── Discount Codes ─────────────────────────────────────────────────────────
  // The tenant comes from the signed-in user, never from the request.
  listDiscountCodes: (branchId: string) =>
    apiClient.get<DiscountCodeResponse[]>(
      `/api/v1/branches/${branchId}/restaurant/discounts`,
    ),

  validateDiscountCode: (
    branchId: string,
    code: string,
    orderAmount: number,
  ) =>
    apiClient.get<ValidateDiscountCodeResponse>(
      `/api/v1/branches/${branchId}/restaurant/discounts/validate`,
      { params: { code, orderAmount } },
    ),

  createDiscountCode: (
    branchId: string,
    data: {
      code: string
      type: DiscountCodeType
      value: number
      minOrderAmount: number
      maxUses: number
      expiryDate: string
    },
  ) =>
    apiClient.post<DiscountCodeResponse>(
      `/api/v1/branches/${branchId}/restaurant/discounts`,
      data,
    ),
}
