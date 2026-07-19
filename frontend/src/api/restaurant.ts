import { apiClient } from './client'
import type {
  MenuItemResponse,
  MenuCategory,
  RestaurantOrderResponse,
  DiscountCodeResponse,
  ValidateDiscountCodeResponse,
  DiscountCodeType,
} from '@/types/api'

export interface OrderItemInput {
  menuItemId: string
  itemName: string
  quantity: number
  unitPrice: number
  notes?: string
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
      tenantId: string
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
  listActiveOrders: (branchId: string) =>
    apiClient.get<RestaurantOrderResponse[]>(
      `/api/v1/branches/${branchId}/restaurant/orders`,
    ),

  listTableOrders: (branchId: string, tableNumber: number) =>
    apiClient.get<RestaurantOrderResponse[]>(
      `/api/v1/branches/${branchId}/restaurant/orders/by-table/${tableNumber}`,
    ),

  createOrder: (
    branchId: string,
    data: {
      tenantId: string
      tableNumber: number
      items: OrderItemInput[]
      notes?: string
      discountCode?: string
    },
  ) =>
    apiClient.post<RestaurantOrderResponse>(
      `/api/v1/branches/${branchId}/restaurant/orders`,
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

  cancelOrder: (branchId: string, orderId: string) =>
    apiClient.post<RestaurantOrderResponse>(
      `/api/v1/branches/${branchId}/restaurant/orders/${orderId}/cancel`,
    ),

  // ── Discount Codes ─────────────────────────────────────────────────────────
  listDiscountCodes: (branchId: string, tenantId: string) =>
    apiClient.get<DiscountCodeResponse[]>(
      `/api/v1/branches/${branchId}/restaurant/discounts`,
      { params: { tenantId } },
    ),

  validateDiscountCode: (
    branchId: string,
    tenantId: string,
    code: string,
    orderAmount: number,
  ) =>
    apiClient.get<ValidateDiscountCodeResponse>(
      `/api/v1/branches/${branchId}/restaurant/discounts/validate`,
      { params: { tenantId, code, orderAmount } },
    ),

  createDiscountCode: (
    branchId: string,
    data: {
      tenantId: string
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
