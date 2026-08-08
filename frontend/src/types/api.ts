// ── Common ──────────────────────────────────────────────────────────────────

export interface ProblemDetails {
  title: string
  detail: string
  status: number
  type?: string
}

export interface PagedResult<T> {
  items: T[]
  page: number
  pageSize: number
  totalCount: number
}

// ── Auth ────────────────────────────────────────────────────────────────────

export interface LoginRequest {
  email: string
  password: string
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

// ── Tenant / Organization ────────────────────────────────────────────────────

export interface TenantResponse {
  id: string
  name: string
  subdomain: string
  currency: string
  timeZone: string
  taxId?: string
  phoneNumber?: string
  isActive: boolean
}

export type BranchType = 'Retail' | 'Restaurant' | 'Hotel' | 'Gaming' | 'Warehouse' | 'Office'

export interface BranchResponse {
  id: string
  tenantId: string
  name: string
  type: BranchType
  isActive: boolean
  isMainBranch: boolean
  createdAt: string
  phoneNumber?: string
  email?: string
  street?: string
  city?: string
  state?: string
  country?: string
  postalCode?: string
}

// ── Catalog ──────────────────────────────────────────────────────────────────

export interface CategoryResponse {
  id: string
  name: string
  description?: string
  isActive: boolean
}

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
  type: string
  taxClass: string
  isActive: boolean
  trackInventory: boolean
  imageUrl?: string
  createdAt: string
  variants: ProductVariantResponse[]
}

// ── Inventory ────────────────────────────────────────────────────────────────

// ── Shifts ──────────────────────────────────────────────────────────────────

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
}

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

// ── Stock Count ──────────────────────────────────────────────────────────────

export type StockCountType = 'Daily' | 'Monthly' | 'Quarterly' | 'TaxAudit'
export type StockCountStatus = 'InProgress' | 'Completed' | 'Cancelled'

export interface StockCountItemResponse {
  id: string
  stockItemId: string
  variantId: string
  systemQuantity: number
  countedQuantity: number | null
  difference: number
  unitCost: number
  systemValue: number
  countedValue: number
  taxAmount: number
  hasDiscrepancy: boolean
}

export interface StockCountSessionResponse {
  id: string
  branchId: string
  type: StockCountType
  status: StockCountStatus
  periodStart: string
  periodEnd: string
  notes: string | null
  createdAt: string
  completedAt: string | null
  totalItems: number
  countedItems: number
  discrepancyCount: number
  totalSystemValue: number
  totalCountedValue: number
  totalTaxAmount: number
  items: StockCountItemResponse[]
}

// ── POS / Orders ─────────────────────────────────────────────────────────────

export type OrderStatus = 'Open' | 'Completed' | 'Cancelled'
export type PaymentMethod = 'Cash' | 'Card' | 'BankTransfer' | 'Voucher' | 'Split'

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
  customerId?: string
  currency: string
  status: OrderStatus
  subtotalAmount: number
  discountAmount: number
  taxAmount: number
  totalAmount: number
  taxRate: number
  paymentMethod?: PaymentMethod
  amountTendered?: number
  changeDue?: number
  notes?: string
  createdAt: string
  completedAt?: string
  lines: OrderLineResponse[]
}

// ── Returns ──────────────────────────────────────────────────────────────────

export type ReturnReason = 'DefectiveProduct' | 'CustomerRequest' | 'OrderError' | 'Other'
export type RefundMethod = 'Cash' | 'Card' | 'StoreCredit'

export interface ReturnOrderLineResponse {
  id: string
  originalLineId: string
  variantId: string
  productName: string
  variantName: string
  quantity: number
  unitPrice: number
  lineTotal: number
  reason: ReturnReason
}

export interface ReturnOrderResponse {
  id: string
  originalOrderId: string
  tenantId: string
  branchId: string
  currency: string
  refundAmount: number
  refundMethod: RefundMethod
  createdAt: string
  lines: ReturnOrderLineResponse[]
}

// ── Sales ────────────────────────────────────────────────────────────────────

export interface SalesSummaryResponse {
  branchId: string
  dateFrom: string
  dateTo: string
  totalOrders: number
  totalRevenue: number
  averageOrderValue: number
}

// ── Purchasing ────────────────────────────────────────────────────────────────

export type PurchaseOrderStatus = 'Draft' | 'Sent' | 'Received' | 'Cancelled'

export interface SupplierResponse {
  id: string
  tenantId: string
  name: string
  contactEmail?: string
  contactPhone?: string
  address?: string
  isActive: boolean
}

export interface PurchaseOrderLineResponse {
  id: string
  variantId: string
  description: string
  quantityOrdered: number
  quantityReceived: number
  unitCost: number
  totalCost: number
}

export interface PurchaseOrderResponse {
  id: string
  branchId: string
  tenantId: string
  supplierId: string
  status: PurchaseOrderStatus
  lines: PurchaseOrderLineResponse[]
  totalCost: number
  expectedDelivery?: string
  notes?: string
  createdAt: string
  sentAt?: string
  receivedAt?: string
}

// ── CRM ──────────────────────────────────────────────────────────────────────

export interface CustomerResponse {
  id: string
  tenantId: string
  name: string
  email?: string
  phone?: string
  address?: string
  loyaltyPoints: number
  isActive: boolean
  createdAt: string
}

// ── Finance ──────────────────────────────────────────────────────────────────

export type ExpenseStatus = 'Pending' | 'Approved' | 'Voided'
export type ExpenseCategory =
  | 'Rent'
  | 'Utilities'
  | 'Salaries'
  | 'Supplies'
  | 'Maintenance'
  | 'Marketing'
  | 'Other'

export interface ExpenseResponse {
  id: string
  branchId: string
  tenantId: string
  category: ExpenseCategory
  amount: number
  currency: string
  description: string
  expenseDate: string
  status: ExpenseStatus
  notes?: string
  createdAt: string
}

// ── Restaurant ────────────────────────────────────────────────────────────────

export type MenuCategory =
  | 'Starters'
  | 'Mains'
  | 'Sides'
  | 'Beverages'
  | 'Desserts'
  | 'Specials'

export interface MenuItemResponse {
  id: string
  tenantId: string
  branchId: string
  name: string
  description?: string
  category: MenuCategory
  price: number
  currency: string
  isAvailable: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type RestaurantOrderStatus =
  | 'Pending'
  | 'InKitchen'
  | 'Ready'
  | 'Served'
  | 'Paid'
  | 'Cancelled'

export type OrderItemStatus = 'Pending' | 'Preparing' | 'Ready'

export type DiscountCodeType = 'Percentage' | 'Fixed'

export interface RestaurantOrderItemResponse {
  id: string
  menuItemId: string
  itemName: string
  quantity: number
  unitPrice: number
  lineTotal: number
  notes?: string
  status: OrderItemStatus
}

export interface RestaurantOrderResponse {
  id: string
  tenantId: string
  branchId: string
  tableNumber: number
  status: RestaurantOrderStatus
  notes?: string
  appliedDiscountCode?: string
  discountAmount: number
  subTotal: number
  taxAmount: number
  total: number
  paymentMethod?: string
  amountTendered?: number
  createdAt: string
  servedAt?: string
  paidAt?: string
  items: RestaurantOrderItemResponse[]
}

export interface DiscountCodeResponse {
  id: string
  tenantId: string
  code: string
  type: DiscountCodeType
  value: number
  minOrderAmount: number
  maxUses: number
  usedCount: number
  expiryDate: string
  isActive: boolean
  createdAt: string
}

export interface ValidateDiscountCodeResponse {
  code: string
  type: DiscountCodeType
  value: number
  discountAmount: number
  isValid: boolean
  errorMessage?: string
}

// ── Hotel ────────────────────────────────────────────────────────────────────

export type RoomType = 'Standard' | 'Deluxe' | 'Suite' | 'Presidential'
export type RoomStatus = 'Available' | 'Occupied' | 'Reserved' | 'Maintenance'
export type CleaningStatus = 'Clean' | 'NeedsClean' | 'InProgress'
export type ReservationStatus = 'Active' | 'CheckedOut' | 'Cancelled'

export interface ReservationResponse {
  id: string
  roomId: string
  tenantId: string
  branchId: string
  guestName: string
  guestNationalId: string
  guestPhone: string
  checkIn: string
  checkOut: string
  nights: number
  ratePerNight: number
  totalAmount: number
  status: ReservationStatus
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface RoomResponse {
  id: string
  tenantId: string
  branchId: string
  roomNumber: string
  roomType: RoomType
  floor: number
  capacity: number
  nightlyRate: number
  currency: string
  status: RoomStatus
  cleaningStatus: CleaningStatus
  description?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  checkOutAlert: boolean
  activeReservation?: ReservationResponse
}

// ── Hotel – Rental Contracts ──────────────────────────────────────────────────

export type ContractStatus = 'Draft' | 'Active' | 'Executed' | 'Cancelled'

export interface ContractClauseDto {
  order: number
  title: string
  body: string
}

export interface RentalContractResponse {
  id: string
  branchId: string
  reservationId: string | null
  tenantName: string
  tenantNationalId: string
  tenantPhone: string
  roomNumber: string
  startDate: string
  endDate: string
  monthlyRent: number
  currency: string
  landlordName: string
  status: ContractStatus
  notes: string | null
  createdAt: string
  signedAt: string | null
  clauses: ContractClauseDto[]
}

// ── SuperAdmin ────────────────────────────────────────────────────────────────

export type SubscriptionStatus = 'Trial' | 'Active' | 'Expired' | 'Suspended'

export interface SubscriptionPlanResponse {
  id: string
  name: string
  businessType?: string
  price: number
  maxBranches: number
  maxUsers: number
  features: string[]
  isActive: boolean
  createdAt: string
}

export interface TenantSubscriptionResponse {
  id: string
  tenantId: string
  planId: string
  planName: string
  planPrice: number
  startDate: string
  expiryDate: string
  status: SubscriptionStatus
  maxBranches: number
  maxUsers: number
  notes?: string
  createdAt: string
  daysRemaining: number
}

export interface TenantWithSubscriptionResponse {
  id: string
  name: string
  subdomain: string
  adminEmail: string
  currency: string
  timeZone: string
  isActive: boolean
  createdAt: string
  suspendedAt?: string
  activeSubscription?: TenantSubscriptionResponse
  businessType: BusinessType
  defaultPassword?: string
}

export interface TenantDetailResponse extends TenantWithSubscriptionResponse {
  subscriptionHistory: TenantSubscriptionResponse[]
}

export interface CreateSubscriptionRequest {
  planId: string
  startDate: string
  expiryDate: string
  notes?: string
}

export interface CreateTenantRequest {
  name: string
  subdomain: string
  adminEmail: string
  businessType: BusinessType
  currency: string
  timeZone: string
}

// ── User Management ──────────────────────────────────────────────────────────

export interface UserSummaryResponse {
  id: string
  email: string
  firstName: string
  lastName: string
  fullName: string
  roles: string[]
  isActive: boolean
  createdAt: string
  lastLoginAt?: string
}

export interface CreateUserRequest {
  email: string
  firstName: string
  lastName: string
  password: string
  role: string
}

export interface CreateSubscriptionPlanRequest {
  name: string
  businessType?: string
  price: number
  maxBranches: number
  maxUsers: number
  features: string[]
}

// ── Gaming ────────────────────────────────────────────────────────────────────

export type StationType = 'Console' | 'PC' | 'VR' | 'Arcade' | 'Board'
export type StationStatus = 'Available' | 'InUse' | 'Maintenance'
export type GameSessionStatus = 'Active' | 'Completed' | 'Cancelled'

export interface GameSessionSummary {
  sessionId: string
  playerName: string
  startTime: string
  durationMinutes: number
  ratePerHour: number
}

export interface GameStationResponse {
  id: string
  tenantId: string
  branchId: string
  name: string
  type: StationType
  status: StationStatus
  hourlyRate: number
  currency: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  activeSession?: GameSessionSummary
}

export interface GameSessionResponse {
  id: string
  stationId: string
  tenantId: string
  branchId: string
  playerName: string
  startTime: string
  durationMinutes: number
  ratePerHour: number
  status: GameSessionStatus
}

export interface GameSessionBillResponse {
  sessionId: string
  stationId: string
  stationName: string
  stationType: string
  playerName: string
  startTime: string
  endTime: string
  plannedDurationMinutes: number
  actualDurationMinutes: number
  ratePerHour: number
  totalAmount: number
  currency: string
}
