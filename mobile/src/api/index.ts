import { apiClient } from './client'
import type {
  CategoryResponse,
  CustomerResponse,
  InventoryAlertsResponse,
  OrderResponse,
  PaymentMethod,
  ProductResponse,
  ProductType,
  ProductVariantResponse,
  SalesSummaryResponse,
  ShiftResponse,
  StockLevelResponse,
  TaxClass,
  UserProfile,
} from '@/types/api'

// ── Catalog ───────────────────────────────────────────────────────────────────

export interface CreateProductPayload {
  name: string
  description?: string
  categoryId?: string
  type?: ProductType
  taxClass?: TaxClass
  trackInventory?: boolean
  sku: string
  variantName: string
  costPrice: number
  salePrice: number
  currency?: string
  barcode?: string
  expiryDate?: string
}

export interface UpdateProductPayload {
  name: string
  description?: string
  categoryId?: string
  /** Required by the backend; pass the product's current value. */
  taxClass: TaxClass | string
  /** Required by the backend; pass the product's current value. */
  trackInventory: boolean
  imageUrl?: string
}

export interface UpdateVariantPayload {
  name: string
  costPrice: number
  salePrice: number
  currency: string
  barcode?: string
}

export const catalogApi = {
  listCategories: (params?: { page?: number; pageSize?: number }) =>
    apiClient.get<CategoryResponse[]>('/api/v1/categories', {
      params: { page: 1, pageSize: 50, ...params },
    }),

  createCategory: (data: { name: string; description?: string }) =>
    apiClient.post<CategoryResponse>('/api/v1/categories', data),

  /** Backend filters by `categoryId` / `search`; paging params are accepted but ignored. */
  listProducts: (params?: { categoryId?: string; search?: string; page?: number; pageSize?: number }) =>
    apiClient.get<ProductResponse[]>('/api/v1/products', {
      params: { pageSize: 200, ...params },
    }),

  getProduct: (id: string) => apiClient.get<ProductResponse>(`/api/v1/products/${id}`),

  getProductByBarcode: (barcode: string) =>
    apiClient.get<ProductResponse[]>('/api/v1/products', { params: { search: barcode, pageSize: 5 } }),

  /** POST /api/v1/products — flat payload creating the product together with its first variant. */
  createProduct: (data: CreateProductPayload) =>
    apiClient.post<ProductResponse>('/api/v1/products', {
      type: 'Standard',
      taxClass: 'Standard',
      trackInventory: true,
      currency: 'SAR',
      ...data,
    }),

  updateProduct: (id: string, data: UpdateProductPayload) =>
    apiClient.put<ProductResponse>(`/api/v1/products/${id}`, data),

  /** PATCH /api/v1/products/{id}/variants/{variantId} */
  updateVariant: (productId: string, variantId: string, data: UpdateVariantPayload) =>
    apiClient.patch<ProductVariantResponse>(`/api/v1/products/${productId}/variants/${variantId}`, data),

  /** DELETE deactivates the product and its variants (soft delete). */
  deactivateProduct: (id: string) => apiClient.delete(`/api/v1/products/${id}`),
}

// ── Orders / POS ──────────────────────────────────────────────────────────────

export const ordersApi = {
  createOrder: (
    branchId: string,
    data: { tenantId: string; currency: string; customerId?: string; taxRate?: number },
  ) => apiClient.post<OrderResponse>(`/api/v1/branches/${branchId}/orders`, data),

  addLine: (
    branchId: string,
    orderId: string,
    data: { variantId: string; productName: string; variantName: string; unitPrice: number; quantity: number },
  ) => apiClient.post<OrderResponse>(`/api/v1/branches/${branchId}/orders/${orderId}/lines`, data),

  removeLine: (branchId: string, orderId: string, lineId: string) =>
    apiClient.delete(`/api/v1/branches/${branchId}/orders/${orderId}/lines/${lineId}`),

  complete: (
    branchId: string,
    orderId: string,
    data: { paymentMethod: PaymentMethod; amountTendered?: number; cashAmount?: number; cardAmount?: number },
  ) => apiClient.post<OrderResponse>(`/api/v1/branches/${branchId}/orders/${orderId}/complete`, data),

  cancel: (branchId: string, orderId: string) =>
    apiClient.post(`/api/v1/branches/${branchId}/orders/${orderId}/cancel`, {}),

  listOrders: (branchId: string, params?: { status?: string; page?: number; pageSize?: number }) =>
    apiClient.get<OrderResponse[]>(`/api/v1/branches/${branchId}/orders`, {
      params: { pageSize: 20, ...params },
    }),

  /** Fetch completed orders in a UTC datetime range for reports. */
  getCompleted: (branchId: string, from: string, to: string, pageSize = 200) =>
    apiClient.get<OrderResponse[]>(`/api/v1/branches/${branchId}/orders`, {
      params: { status: 'Completed', from, to, page: 1, pageSize },
    }),
}

// ── Shifts ────────────────────────────────────────────────────────────────────

export const shiftsApi = {
  /** Responds 204 (empty body) when the user has no open shift. */
  getActive: (branchId: string) =>
    apiClient.get<ShiftResponse | null>(`/api/v1/branches/${branchId}/shifts/current`),

  open: (branchId: string, data: { openingCash: number; notes?: string }) =>
    apiClient.post<ShiftResponse>(`/api/v1/branches/${branchId}/shifts`, data),

  close: (branchId: string, shiftId: string, data: { closingCash: number; closingCardCount?: number; notes?: string }) =>
    apiClient.post<ShiftResponse>(`/api/v1/branches/${branchId}/shifts/${shiftId}/close`, data),

  /** Newest first; the backend only supports page/pageSize (no date filter). */
  list: (branchId: string, params?: { page?: number; pageSize?: number }) =>
    apiClient.get<ShiftResponse[]>(`/api/v1/branches/${branchId}/shifts`, {
      params: { page: 1, pageSize: 20, ...params },
    }),
}

// ── Inventory ─────────────────────────────────────────────────────────────────

export interface AdjustStockPayload {
  /** Absolute quantity after the adjustment. */
  newQuantity: number
  notes?: string
  reference?: string
  reorderPoint?: number
  reorderQuantity?: number
  expiryDate?: string | null
  notifyDaysBeforeExpiry?: number
}

export const inventoryApi = {
  /** GET /api/v1/branches/{branchId}/stock — stock rows only (no product names). */
  listLevels: (branchId: string, params?: { lowStockOnly?: boolean }) =>
    apiClient.get<StockLevelResponse[]>(`/api/v1/branches/${branchId}/stock`, { params }),

  getItem: (branchId: string, stockItemId: string) =>
    apiClient.get<StockLevelResponse>(`/api/v1/branches/${branchId}/stock/${stockItemId}`),

  /** Creates the stock record for a variant at this branch (required before adjust/receive). */
  initialize: (branchId: string, data: { variantId: string; reorderPoint?: number; reorderQuantity?: number }) =>
    apiClient.post<StockLevelResponse>(`/api/v1/branches/${branchId}/stock/initialize`, {
      reorderPoint: 0,
      reorderQuantity: 0,
      ...data,
    }),

  /** POST /api/v1/branches/{branchId}/stock/{stockItemId}/adjust — sets an absolute quantity. */
  adjust: (branchId: string, stockItemId: string, data: AdjustStockPayload) =>
    apiClient.post<StockLevelResponse>(`/api/v1/branches/${branchId}/stock/${stockItemId}/adjust`, data),

  receive: (
    branchId: string,
    stockItemId: string,
    data: { quantity: number; reference?: string; notes?: string; expiryDate?: string },
  ) => apiClient.post<StockLevelResponse>(`/api/v1/branches/${branchId}/stock/${stockItemId}/receive`, data),

  alerts: (branchId: string, daysAhead = 7) =>
    apiClient.get<InventoryAlertsResponse>(`/api/v1/branches/${branchId}/inventory/alerts`, {
      params: { daysAhead },
    }),

  remove: (branchId: string, stockItemId: string) =>
    apiClient.delete(`/api/v1/branches/${branchId}/stock/${stockItemId}`),
}

// ── Customers ─────────────────────────────────────────────────────────────────

export interface CustomerPayload {
  name: string
  email?: string
  phone?: string
  address?: string
  /** YYYY-MM-DD */
  dateOfBirth?: string
  notes?: string
}

export const customersApi = {
  list: (tenantId: string, params?: { search?: string; page?: number; pageSize?: number }) =>
    apiClient.get<CustomerResponse[]>(`/api/v1/tenants/${tenantId}/customers`, {
      params: { page: 1, pageSize: 50, ...params },
    }),

  get: (tenantId: string, id: string) =>
    apiClient.get<CustomerResponse>(`/api/v1/tenants/${tenantId}/customers/${id}`),

  create: (tenantId: string, data: CustomerPayload) =>
    apiClient.post<CustomerResponse>(`/api/v1/tenants/${tenantId}/customers`, data),

  update: (tenantId: string, id: string, data: CustomerPayload) =>
    apiClient.put<CustomerResponse>(`/api/v1/tenants/${tenantId}/customers/${id}`, data),

  /**
   * NOTE: CustomersController currently exposes no DELETE action (GET/POST/PUT + loyalty only),
   * so this will 405 until the backend adds one. Kept for API-surface parity.
   */
  delete: (tenantId: string, id: string) =>
    apiClient.delete(`/api/v1/tenants/${tenantId}/customers/${id}`),

  addLoyaltyPoints: (tenantId: string, id: string, points: number) =>
    apiClient.post<CustomerResponse>(`/api/v1/tenants/${tenantId}/customers/${id}/loyalty/add`, { points }),

  redeemLoyaltyPoints: (tenantId: string, id: string, points: number) =>
    apiClient.post<CustomerResponse>(`/api/v1/tenants/${tenantId}/customers/${id}/loyalty/redeem`, { points }),
}

// ── Users ─────────────────────────────────────────────────────────────────────

export const usersApi = {
  list: () => apiClient.get<UserProfile[]>('/api/v1/users'),
  create: (data: { email: string; firstName: string; lastName: string; password: string; role: string }) =>
    apiClient.post<UserProfile>('/api/v1/users', data),
}

// ── Reports ───────────────────────────────────────────────────────────────────

export interface SaleRecordResponse {
  id: string
  orderId: string
  branchId: string
  currency: string
  subtotalAmount: number
  discountAmount: number
  taxAmount: number
  totalAmount: number
  paymentMethod: PaymentMethod
  completedAt: string
}

export const reportsApi = {
  /** Single-day summary. `date` is YYYY-MM-DD; defaults to today (UTC) on the server. */
  getDaily: (branchId: string, date?: string) =>
    apiClient.get<SalesSummaryResponse>(`/api/v1/branches/${branchId}/sales/summary`, {
      params: date ? { date } : {},
    }),

  /** One summary per day in [dateFrom, dateTo] (YYYY-MM-DD, inclusive). */
  getRange: (branchId: string, dateFrom: string, dateTo: string) =>
    apiClient.get<SalesSummaryResponse[]>(`/api/v1/branches/${branchId}/sales/summary/range`, {
      params: { dateFrom, dateTo },
    }),

  /** Direct sale records — same data source the web uses. dateFrom/dateTo are ISO datetime strings. */
  getRecords: (branchId: string, dateFrom: string, dateTo: string, page = 1, pageSize = 200) =>
    apiClient.get<SaleRecordResponse[]>(`/api/v1/branches/${branchId}/sales/records`, {
      params: { dateFrom, dateTo, page, pageSize },
    }),
}
