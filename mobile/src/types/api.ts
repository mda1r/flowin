// All response shapes below mirror the backend DTOs as serialized by the API:
// System.Text.Json with JsonNamingPolicy.CamelCase, enums as strings, nulls omitted.

export interface PagedResult<T> {
  items: T[]
  page: number
  pageSize: number
  totalCount: number
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export type BusinessType = 'Retail' | 'Supermarket' | 'Restaurant' | 'Hotel' | 'Gaming' | 'Cafe'

export interface UserProfile {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  tenantId?: string
  branchId?: string
  businessType?: BusinessType
}

// ── Catalog ───────────────────────────────────────────────────────────────────

export interface CategoryResponse {
  id: string
  name: string
  description?: string
  isActive?: boolean
}

export type ProductType = 'Standard' | 'Composite' | 'Service' | 'Subscription'
export type TaxClass = 'Standard' | 'Reduced' | 'ZeroRated' | 'Exempt'

export interface ProductVariantResponse {
  id: string
  sku: string
  name: string
  costPrice: number
  salePrice: number
  currency: string
  barcode?: string
  isActive: boolean
  expiryDate?: string
}

export interface ProductResponse {
  id: string
  name: string
  description?: string
  categoryId?: string
  type: ProductType | string
  taxClass: TaxClass | string
  isActive: boolean
  trackInventory: boolean
  imageUrl?: string
  createdAt: string
  variants: ProductVariantResponse[]
}

// ── Shifts ────────────────────────────────────────────────────────────────────

export type ShiftStatus = 'Open' | 'Closed'

export interface ShiftResponse {
  id: string
  branchId: string
  userId: string
  cashierName: string
  status: ShiftStatus
  openingCash: number
  closingCash: number | null
  totalSales: number
  totalCashSales: number
  totalCardSales: number
  totalTax: number
  totalOrders: number
  expectedCash: number | null
  cashVariance: number | null
  closingCardCount: number | null
  cardVariance: number | null
  notes: string | null
  openedAt: string
  closedAt: string | null
}

// ── Inventory ─────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/branches/{branchId}/stock
 * Carries no product or variant names — join with the catalog on `variantId` client-side.
 * `id` is the stock item id used by the adjust/receive/delete endpoints.
 */
export interface StockItemResponse {
  id: string
  variantId: string
  branchId: string
  quantity: number
  reorderPoint: number
  reorderQuantity: number
  isLowStock: boolean
  updatedAt: string
  expiryDate?: string
  notifyDaysBeforeExpiry?: number
}

/** Alias kept for existing imports; the stock endpoint returns StockItemResponse rows. */
export type StockLevelResponse = StockItemResponse

export interface StockAlertItemResponse {
  stockItemId: string
  variantId: string
  branchId: string
  quantity: number
  reorderPoint: number
  expiryDate?: string
  daysUntilExpiry?: number
  alertType: 'Expired' | 'ExpiringSoon' | 'LowStock'
}

export interface InventoryAlertsResponse {
  expired: StockAlertItemResponse[]
  expiringSoon: StockAlertItemResponse[]
  lowStock: StockAlertItemResponse[]
  totalAlerts: number
}

// ── Orders / POS ──────────────────────────────────────────────────────────────

export type OrderStatus = 'Open' | 'Completed' | 'Cancelled'
export type PaymentMethod = 'Cash' | 'Card' | 'Split'

export interface OrderLineResponse {
  id: string
  variantId: string
  productName: string
  variantName: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

export interface OrderResponse {
  id: string
  tenantId: string
  branchId: string
  status: OrderStatus
  subtotalAmount: number
  discountAmount: number
  taxAmount: number
  totalAmount: number
  taxRate: number
  paymentMethod?: PaymentMethod
  amountTendered?: number
  changeDue?: number
  splitCash?: number
  splitCard?: number
  notes?: string
  createdAt: string
  completedAt?: string
  lines: OrderLineResponse[]
}

// ── CRM ───────────────────────────────────────────────────────────────────────

/** /api/v1/tenants/{tenantId}/customers */
export interface CustomerResponse {
  id: string
  tenantId: string
  name: string
  email?: string
  phone?: string
  address?: string
  dateOfBirth?: string
  loyaltyPoints: number
  notes?: string
  isActive: boolean
  createdAt: string
}

// ── Sales / Reports ───────────────────────────────────────────────────────────

export interface SaleRecordResponse {
  id: string
  subtotalAmount: number
  taxAmount: number
  totalAmount: number
  paymentMethod: string
  completedAt: string
}

/**
 * GET /api/v1/branches/{branchId}/sales/summary?date=YYYY-MM-DD      → SalesSummaryResponse
 * GET /api/v1/branches/{branchId}/sales/summary/range?dateFrom&dateTo → SalesSummaryResponse[]
 */
export interface SalesSummaryResponse {
  branchId: string
  /** YYYY-MM-DD */
  summaryDate: string
  currency: string
  totalOrders: number
  totalRevenue: number
  totalDiscounts: number
  totalTax: number
  averageOrderValue: number
}
