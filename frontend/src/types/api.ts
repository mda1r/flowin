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
  // The pages this user may open; null/absent means every page their role allows.
  allowedPages?: string[] | null
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
  // Optional English name for English-language screens; receipts and tickets keep the Arabic name.
  nameEn?: string | null
  name: string
  description?: string
  isActive: boolean
}

export interface ProductVariantResponse {
  id: string
  nameEn?: string | null
  sku: string
  name: string
  costPrice: number
  salePrice: number
  currency: string
  barcode?: string
  isActive: boolean
  expiryDate?: string
}

export type UnitType = 'Piece' | 'Kilogram' | 'Gram' | 'Liter' | 'Milliliter' | 'Meter' | 'Box'

export interface ProductResponse {
  id: string
  nameEn?: string | null
  name: string
  description?: string
  categoryId?: string
  type: string
  taxClass: string
  isActive: boolean
  trackInventory: boolean
  unitType: UnitType
  imageUrl?: string
  createdAt: string
  variants: ProductVariantResponse[]
  // Filled by the list, by-id and barcode reads (active groups in the product's order, active options only); null after a write.
  modifierGroups?: ProductModifierGroupResponse[] | null
}

// ── Modifiers (add-ons) ──────────────────────────────────────────────────────

// priceDelta is net of VAT, like order line prices; screens add VAT before showing it.
export interface ModifierOptionResponse {
  id: string
  nameEn?: string | null
  name: string
  priceDelta: number
  isActive: boolean
  sortOrder: number
}

export interface ModifierGroupResponse {
  id: string
  nameEn?: string | null
  name: string
  isRequired: boolean
  minSelect: number
  maxSelect: number
  sortOrder: number
  isActive: boolean
  options: ModifierOptionResponse[]
  productIds: string[]
}

export interface ProductModifierGroupResponse {
  id: string
  nameEn?: string | null
  name: string
  isRequired: boolean
  minSelect: number
  maxSelect: number
  options: ModifierOptionResponse[]
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
  // Digital wallets and anything that is neither cash nor card, so the three add up to totalSales.
  totalDigitalSales: number
  // Cash handed back on returns during the shift; it comes out of expectedCash.
  totalCashRefunds: number
  // Set when a manager closed the shift for the cashier.
  closedByName: string | null
  // Everything handed back on returns during the shift (cash, card and store credit).
  totalRefunds?: number
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
  notifyDaysBeforeExpiry: number
  isArchived?: boolean
}

export type MovementType = 'Receive' | 'Sale' | 'Return' | 'TransferIn' | 'TransferOut' | 'Adjustment' | 'WriteOff'

export interface StockMovementResponse {
  id: string
  type: MovementType
  quantity: number
  quantityBefore: number
  quantityAfter: number
  reference?: string | null
  notes?: string | null
  occurredAt: string
  userId?: string | null
  invoiceNumber?: number | null
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
  costPrice: number
  lineTotal: number
  // What the customer asked for on this item ("no sugar"), shown on the invoice and the kitchen ticket.
  notes?: string | null
  // What one unit gives back on a return, VAT included, after every discount on the sale.
  refundUnitPrice?: number
  // The add-ons sold with the item (oat milk, an extra shot); priceDelta is net and already inside unitPrice.
  // Null on a line without add-ons and on older sales.
  modifiers?: { id: string; name: string; priceDelta: number }[] | null
}

export interface OrderResponse {
  id: string
  // The store's sequential invoice number; null for older or not-yet-synced sales.
  number?: number | null
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
  splitCash?: number
  splitCard?: number
  notes?: string
  createdAt: string
  completedAt?: string
  // Set when the till rang the sale up offline; completedAt is then that time, not the sync time.
  offlineCreatedAt?: string | null
  lines: OrderLineResponse[]
  // Points spent on this sale and their pre-tax value; already part of discountAmount.
  loyaltyPointsRedeemed?: number
  loyaltyDiscountAmount?: number
  source?: 'Pos' | 'Gaming' | 'Restaurant'
  // The owner's discount code that gave the order discount (upper case); null when the sale used none.
  discountCode?: string | null
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
  // Pre-tax, like order lines; the refund adds VAT on top.
  unitPrice: number
  lineTotal: number
  reason: ReturnReason
  // Unit cost of the original sale line (0 when unknown).
  costPrice?: number
}

export interface ReturnOrderResponse {
  id: string
  originalOrderId: string
  tenantId: string
  branchId: string
  currency: string
  // VAT included.
  refundAmount: number
  // The refund split into its pre-tax part and the VAT given back.
  netAmount?: number
  taxAmount?: number
  refundMethod: RefundMethod
  createdAt: string
  lines: ReturnOrderLineResponse[]
  createdByUserId?: string | null
  createdByName?: string | null
  shiftId?: string | null
  note?: string | null
}

// ── Sales ────────────────────────────────────────────────────────────────────

// One day of GET sales/summary/range. totalRevenue includes VAT; refunds reduce it and totalTax.
export interface SalesSummaryResponse {
  branchId: string
  summaryDate: string
  currency: string
  totalOrders: number
  totalRevenue: number
  totalDiscounts: number
  totalTax: number
  averageOrderValue: number
}

// ── Purchasing ────────────────────────────────────────────────────────────────

export type PurchaseOrderStatus = 'Draft' | 'Sent' | 'PartiallyReceived' | 'Received' | 'Cancelled'

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
  stockMaterialId?: string
  description: string
  unitCost: number
  orderedQuantity: number
  receivedQuantity: number
  lineTotal: number
  isFullyReceived: boolean
}

export interface PurchaseOrderResponse {
  id: string
  tenantId: string
  branchId: string
  supplierId: string
  status: PurchaseOrderStatus
  totalAmount: number
  expectedDeliveryDate?: string
  notes?: string
  createdAt: string
  receivedAt?: string
  lines: PurchaseOrderLineResponse[]
  supplierName?: string | null
}

// ── CRM ──────────────────────────────────────────────────────────────────────

// The store's loyalty programme: points per riyal paid, redeemPoints points are worth redeemValue riyals,
// and a customer can start redeeming from minRedeemPoints.
export interface LoyaltySettings {
  enabled: boolean
  pointsPerCurrencyUnit: number
  redeemPoints: number
  redeemValue: number
  minRedeemPoints: number
}

export interface CustomerResponse {
  id: string
  tenantId: string
  name: string
  email?: string
  phone?: string
  address?: string
  // YYYY-MM-DD; not on the edit form yet, so an update sends back what is stored.
  dateOfBirth?: string | null
  notes?: string | null
  loyaltyPoints: number
  isActive: boolean
  createdAt: string
  // Agreed to receive offers on WhatsApp.
  marketingOptIn: boolean
}

// ── Finance ──────────────────────────────────────────────────────────────────

export type ExpenseStatus = 'Pending' | 'Approved' | 'Voided'
// Must match NexusPOS.Finance.Domain.Enums.ExpenseCategory (sent as strings).
export type ExpenseCategory =
  | 'Rent'
  | 'Utilities'
  | 'Wages'
  | 'Supplies'
  | 'Equipment'
  | 'Marketing'
  | 'Maintenance'
  | 'GovernmentFees'
  | 'Subscriptions'
  | 'DeliveryCommissions'
  | 'BankFees'
  | 'Insurance'
  | 'Transport'
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
  approvedBy?: string | null
  voidReason?: string | null
  notes?: string
  createdAt: string
}

export interface ExpenseSummaryResponse {
  dateFrom: string
  dateTo: string
  approved: { status: ExpenseStatus; count: number; total: number }
  pending: { status: ExpenseStatus; count: number; total: number }
  voided: { status: ExpenseStatus; count: number; total: number }
  byCategory: { category: ExpenseCategory; count: number; total: number }[]
  groups: { category: ExpenseCategory; status: ExpenseStatus; count: number; total: number }[]
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
  // A ticket for a sale already paid at the cafe till: the kitchen makes it, nobody settles it here.
  kitchenOnly?: boolean
  sourceOrderId?: string | null
  ticketNumber?: number | null
  cancelReason?: string
  cancelledAt?: string
  // The name the barista calls out at pickup (cafe tickets only).
  callName?: string | null
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
  // Null: the code never expires.
  expiryDate: string | null
  isActive: boolean
  createdAt: string
  // The short name the till and receipt show ("موظفين", "VIP").
  label?: string | null
}

export interface ValidateDiscountCodeResponse {
  code: string
  type: DiscountCodeType
  value: number
  discountAmount: number
  isValid: boolean
  errorMessage?: string
  label?: string | null
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

// Trial = starts in the future; Cancelled = replaced by a newer subscription before it began
export type SubscriptionStatus = 'Trial' | 'Active' | 'Expired' | 'Suspended' | 'Cancelled'

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
  // End of the subscription chain: what a renewal extends (a pre-paid period after the live one).
  renewableSubscription?: TenantSubscriptionResponse
}

export interface TenantDetailResponse extends TenantWithSubscriptionResponse {
  subscriptionHistory: TenantSubscriptionResponse[]
  aiEnabled: boolean
  suspensionReason?: string
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
  allowedPages?: string[] | null
}

export interface CreateUserRequest {
  email: string
  firstName: string
  lastName: string
  password: string
  role: string
}

export interface UpdateUserRequest {
  firstName: string
  lastName: string
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
  packageName?: string
  packagePrice?: number
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
  paymentMethod?: 'Cash' | 'Card'
  paidAt?: string
  packageName?: string
  packagePrice?: number
  overtimeMinutes?: number
  /** The sequential number of the sale POS recorded; set once the session is paid. */
  invoiceNumber?: number | null
}

export interface GamingPackageResponse {
  id: string
  name: string
  durationMinutes: number
  price: number
  stationType?: StationType
}


// ── Activity Logs ────────────────────────────────────────────────────────────

export interface ActivityLogResponse {
  id: string
  timestamp: string
  userId: string
  userName: string
  userEmail?: string | null
  category: string
  action: string
  details?: string | null
  branchId?: string | null
}
