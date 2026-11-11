import { useState, useRef, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Coffee, ShoppingBag, ChefHat, X, Plus, Minus, Trash2,
  Printer, MessageSquare, CreditCard, Banknote, Bot,
  Gamepad2, Clock, Play, Square, Search, Percent, RotateCcw, Megaphone, TicketPercent, Loader2,
} from 'lucide-react'
import { catalogApi } from '@/api/catalog'
import { ordersApi, posSettingsApi } from '@/api/orders'
import { inventoryApi } from '@/api/inventory'
import { useAuthStore } from '@/stores/authStore'
import { toast } from '@/components/ui/Toast'
import { apiErrorMessage } from '@/lib/apiError'
import { formatCurrency, cn, normalizeArabic } from '@/lib/utils'
import { isPlainVariant, lineDisplayName } from '@/lib/variantName'
import { localName } from '@/lib/localName'
import { generateZatcaQr } from '@/lib/zatca'
import { refreshVatAfter, useVat, vatRate } from '@/lib/vat'
import { documentHasVat } from '@/lib/orderReceipt'
import { useShift, ShiftGate, ShiftBadge, OpenShiftModal, CloseShiftModal } from './ShiftGate'
import { aiCashierApi, type AiCashierCartSnapshot } from '@/api/aiCashier'
import { AiCashierAgent, type AiCartResult } from '@/components/cafe/AiCashierAgent'
import { gamingApi } from '@/api/gaming'
import type { PaymentMethod, CategoryResponse, ProductResponse, ProductModifierGroupResponse, GameStationResponse, GameSessionBillResponse, CustomerResponse } from '@/types/api'
import { useI18n } from '@/i18n'
import { LoyaltyPanel } from '@/components/pos/LoyaltyPanel'
import { CashTender } from '@/components/pos/CashTender'
import { GamingTimeAlerts } from '@/components/pos/GamingTimeAlerts'
import { ShortcutsHelp, ShortcutsHelpButton } from '@/components/pos/ShortcutsHelp'
import { ConfirmModal, Modal, OverlayDialog, useDialogBehavior } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useShortcuts } from '@/lib/useShortcuts'
import { formatClock, requestNotificationPermission, sessionSecondsLeft, WARNING_SECONDS } from '@/lib/gamingAlerts'
import { maxRedeemablePoints, pointsEarned, pointsValue, useLoyaltyRules } from '@/lib/loyalty'
import { ReceiptDocument } from '@/components/pos/ReceiptDocument'
import { invoiceNo } from '@/lib/invoiceNumber'
import { useReceiptSettings, useSellerIdentity } from '@/lib/receipt'
import { WhatsAppShare } from '@/components/pos/WhatsAppShare'
import { SessionPayButtons } from '@/components/pos/SessionPayButtons'
import { printElement } from '@/lib/print'
import { OfflineBanner } from '@/components/pos/OfflineBanner'
import { isTransientError, newClientReference, queueSale, savedOnDeviceMessage, withoutApprovalPin } from '@/lib/offlineSales'
import { isAxiosError } from 'axios'
import type { CheckoutPayload } from '@/api/orders'
import { PackageBillLines, PackagePicker } from '@/components/gaming/Packages'
import { buildReceiptMessage, toAsciiDigits } from '@/lib/whatsapp'
import { CALL_NAME_MAX, callNameFrom } from '@/lib/callName'
import { restaurantApi } from '@/api/restaurant'
import { type AppliedDiscountCode, appliedCodeName, normalizeDiscountCode } from '@/lib/discountCodes'
import {
  type CartModifier, grossDelta, groupSatisfied, initialPicks, lineDetail, modifierKey, modifierSummary,
  pickedModifiers, productGroups, readLastModifiers, rememberLastModifiers,
} from '@/lib/modifiers'
import { intlLocale } from '@/lib/locale'

// ── Types ─────────────────────────────────────────────────────────────────────

interface StartSessionForm {
  stationId: string
  stationName: string
  stationTypeKey: string
  /** The station's own rate; only an owner or manager may start a session at another one. */
  stationRate: number
  hourlyRate: number
  playerName: string
  durationMinutes: number
  packageId?: string
  packageName?: string
  packagePrice?: number
}

interface CafeCartItem {
  // Local id of the cart line: the same drink with different notes or add-ons is a separate line.
  lineKey: string
  variantId: string
  productName: string
  variantName: string
  // VAT included: the size price plus its add-ons.
  unitPrice: number
  costPrice: number
  quantity: number
  notes: string
  // The add-ons picked for it (oat milk, an extra shot), VAT included; empty for a plain drink.
  modifiers: CartModifier[]
}

interface KitchenTicketData {
  items: CafeCartItem[]
  orderType: 'here' | 'takeaway'
  tableNumber: number | null
  // The sale's invoice number, the same one the kitchen screen shows.
  ticketNo: string
  // The name the barista calls out at pickup.
  callName?: string
  offline?: boolean
  createdAt: string
}

interface CustomerReceiptData {
  orderId: string
  number?: number | null
  items: CafeCartItem[]
  grandTotal: number
  tax: number
  subtotal: number
  // Whether the sale was made with VAT; a sale made with VAT off prints a plain invoice.
  vat: boolean
  payMode: PayMode
  splitCash?: number
  splitCard?: number
  cashTendered?: number
  tableNumber: number | null
  orderType: 'here' | 'takeaway'
  completedAt: string
  offline?: boolean
  callName?: string
  customerName?: string
  customerPhone?: string
  discount?: number
  // The owner's discount code that gave the discount, printed next to it.
  discountLabel?: string
  loyaltyDiscount?: number
  pointsRedeemed?: number
  pointsEarned?: number
}

type PayMode = 'Cash' | 'Card' | 'Split'
type DiscountMode = 'Percentage' | 'Fixed'

// Until the branch till rules load, the same cap the retail till assumes.
const DEFAULT_POS_SETTINGS = { maxCashierDiscountPercent: 10, hasApprovalPin: false }

const newLineKey = () => Math.random().toString(36).slice(2, 10)

const round2 = (n: number) => Math.round(n * 100) / 100

// One line per drink, notes and add-ons: equal items fold together, keeping the first line's place.
// Add-ons compare as a set, so oat + shot and shot + oat are the same drink.
function mergeCartLines(lines: CafeCartItem[]): CafeCartItem[] {
  const out: CafeCartItem[] = []
  for (const line of lines) {
    const notes = line.notes.trim()
    const key = modifierKey(line.modifiers)
    const same = out.find((l) => l.variantId === line.variantId && l.notes === notes && modifierKey(l.modifiers) === key)
    if (same) same.quantity += line.quantity
    else out.push({ ...line, notes })
  }
  return out
}

// The menu's prices, VAT included: every size, and every add-on on sale. A line whose price differs from
// its size plus its add-ons takes the menu price; shared by a sale refused for an old price and a cart read
// back after a reload.
interface MenuPrices {
  sizes: Map<string, number>
  addOns: Map<string, number>
}

const catalogPrices = (list: ProductResponse[]): MenuPrices => ({
  sizes: new Map(list.flatMap((p) => p.variants.map((v) => [v.id, v.salePrice] as const))),
  addOns: new Map(list.flatMap((p) => productGroups(p.modifierGroups).flatMap((g) => g.options.map((o) => [o.id, grossDelta(o.priceDelta)] as const)))),
})

// Today's price of one unit of a line, or undefined when its size or one of its add-ons left the menu.
function menuPrice(line: CafeCartItem, prices: MenuPrices): number | undefined {
  const size = prices.sizes.get(line.variantId)
  if (size === undefined) return undefined
  let total = size
  for (const m of line.modifiers) {
    const delta = prices.addOns.get(m.optionId)
    if (delta === undefined) return undefined
    total += delta
  }
  return round2(total)
}

const isStale = (line: CafeCartItem, prices: MenuPrices) => {
  const price = menuPrice(line, prices)
  return price !== undefined && price !== line.unitPrice
}

const repriceLines = (lines: CafeCartItem[], prices: MenuPrices) =>
  lines.map((i) => (isStale(i, prices)
    ? { ...i, unitPrice: menuPrice(i, prices)!, modifiers: i.modifiers.map((m) => ({ ...m, priceDelta: prices.addOns.get(m.optionId)! })) }
    : i))

// A line's add-ons as they are on the menu today, or null when one of them is no longer on sale.
function currentModifiers(product: ProductResponse, modifiers: readonly { optionId: string }[]): CartModifier[] | null {
  const options = new Map(productGroups(product.modifierGroups).flatMap((g) => g.options.map((o) => [o.id, o] as const)))
  const out: CartModifier[] = []
  for (const m of modifiers) {
    const option = options.get(m.optionId)
    if (!option) return null
    out.push({ optionId: option.id, name: option.name, priceDelta: grossDelta(option.priceDelta) })
  }
  return out
}

// One unit of a size with these add-ons, VAT included.
const unitPriceWith = (salePrice: number, modifiers: CartModifier[]) =>
  round2(modifiers.reduce((sum, m) => sum + m.priceDelta, salePrice))

// The add-ons as a group's rule, the way the owner set it: "اختر 1", "اختر 1 إلى 2", "حتى 3".
function groupRule(group: ProductModifierGroupResponse, p: { pickExactly: string; pickRange: string; pickUpTo: string }) {
  const min = group.isRequired ? Math.max(group.minSelect, 1) : group.minSelect
  if (min === group.maxSelect) return p.pickExactly.replace('{n}', String(min))
  if (min === 0) return p.pickUpTo.replace('{n}', String(group.maxSelect))
  return p.pickRange.replace('{min}', String(min)).replace('{max}', String(group.maxSelect))
}

// Search rank of a product, lower first, or null when it does not match. Every side is folded with
// normalizeArabic, so "اسبريسو" finds "إسبريسو". An exact barcode or SKU comes first, then a name that
// starts with the term, a word in the name that does, a name that only contains it, then sizes and SKUs.
function searchRank(product: ProductResponse, term: string): number | null {
  const sizes = product.variants.filter((v) => v.isActive)
  if (sizes.length === 0) return null
  if (exactCodeVariant(product, term)) return 0
  const names = [product.name, product.nameEn].filter((n): n is string => !!n).map((n) => normalizeArabic(n.toLowerCase()))
  if (names.some((n) => n.startsWith(term))) return 1
  if (names.some((n) => n.split(/\s+/).some((w) => w.startsWith(term)))) return 2
  if (names.some((n) => n.includes(term))) return 3
  if (sizes.some((v) =>
    [v.name, v.nameEn, v.sku].some((x) => !!x && normalizeArabic(x.toLowerCase()).includes(term)))) return 4
  return null
}

// The active variant whose barcode or SKU is exactly the (normalised) term, if any.
const exactCodeVariant = (product: ProductResponse, term: string) =>
  product.variants.find((v) =>
    v.isActive && [v.barcode, v.sku].some((code) => !!code && normalizeArabic(code.toLowerCase()) === term.toLowerCase()))

// The size this device sold last for each drink, so the size picker opens on it. Per device, best effort.
const LAST_SIZE_KEY = 'cafe-last-size'

function readLastSize(productId: string): string | null {
  try {
    const map = JSON.parse(localStorage.getItem(LAST_SIZE_KEY) ?? '{}') as Record<string, string>
    return typeof map[productId] === 'string' ? map[productId] : null
  } catch {
    return null
  }
}

function rememberLastSize(productId: string, variantId: string) {
  try {
    const map = JSON.parse(localStorage.getItem(LAST_SIZE_KEY) ?? '{}') as Record<string, string>
    map[productId] = variantId
    localStorage.setItem(LAST_SIZE_KEY, JSON.stringify(map))
  } catch {
    // Storage blocked or full: the picker just opens on the first size next time.
  }
}

// The order on the till, kept per branch for this browser tab so an accidental reload does not lose it.
// sessionStorage, best effort: the manager PIN, payment and customer are never part of it.
interface CartDraft {
  cart: CafeCartItem[]
  orderType: 'here' | 'takeaway'
  tableNumber: number | null
  discountMode: DiscountMode
  discountInput: string
  // Checked again by the server at checkout, so a stale one is refused there, never applied blindly.
  discountCode?: AppliedDiscountCode | null
}

const draftKey = (branchId: string) => `cafe-cart-draft:${branchId}`

function readDraft(branchId: string): Partial<CartDraft> | null {
  try {
    const raw = sessionStorage.getItem(draftKey(branchId))
    const draft = raw ? (JSON.parse(raw) as Partial<CartDraft>) : null
    return draft && Array.isArray(draft.cart) ? draft : null
  } catch {
    return null
  }
}

function writeDraft(branchId: string, draft: CartDraft) {
  try {
    if (draft.cart.length === 0) sessionStorage.removeItem(draftKey(branchId))
    else sessionStorage.setItem(draftKey(branchId), JSON.stringify(draft))
  } catch {
    // Storage blocked or full: the order just is not kept across a reload.
  }
}

function clearDraft(branchId: string | null) {
  try {
    if (branchId) sessionStorage.removeItem(draftKey(branchId))
  } catch {
    // Nothing to clear when storage is blocked.
  }
}

// A typed quantity: Arabic-Indic and Persian digits count too, since a phone's Arabic keypad sends them.
const parseQty = (text: string) => parseInt(toAsciiDigits(text), 10)

const CAFE_ACCENT: React.CSSProperties = {
  '--accent-l': '#0B7A65',
  '--accent-d': '#3FD3B0',
} as React.CSSProperties

const TOTAL_TABLES = 16

// Product tiles: two across on a phone, up to five on a wide screen.
const PRODUCT_GRID = 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'

// Cart line controls: 36px to look at, 44px to hit, since the ::after layer reaches 4px past each edge.
const HIT_AREA = "relative flex items-center justify-center transition-colors after:absolute after:-inset-1 after:content-['']"
const QTY_BUTTON = cn(HIT_AREA, 'h-9 w-9 shrink-0 rounded-lg border border-border bg-surface text-fg hover:bg-surface-2')

// ── Table Picker ──────────────────────────────────────────────────────────────

function TablePicker({
  selected,
  onSelect,
}: {
  selected: number | null
  onSelect: (n: number) => void
}) {
  return (
    <div className="grid grid-cols-4 gap-1.5 p-3">
      {Array.from({ length: TOTAL_TABLES }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          onClick={() => onSelect(n)}
          className={cn(
            'flex h-12 items-center justify-center rounded-xl border-2 text-sm font-bold transition-all',
            selected === n
              ? 'scale-95 border-brand bg-brand-soft text-brand-ink'
              : 'border-border bg-surface text-fg hover:border-brand/40 hover:bg-brand-soft',
          )}
        >
          {n}
        </button>
      ))}
    </div>
  )
}

// ── Kitchen Ticket Modal ───────────────────────────────────────────────────────

function KitchenTicketModal({
  ticket,
  onClose,
}: {
  ticket: KitchenTicketData
  onClose: () => void
}) {
  return (
    <OverlayDialog onClose={onClose} label="تذكرة المطبخ" closeOnBackdrop={false} panelClassName="w-80 rounded-2xl bg-surface shadow-2xl">
        <div id="cafe-kitchen-print" className="p-5">
          {/* Header */}
          <div className="mb-4 border-b border-dashed border-border pb-4 text-center">
            <div className="mb-1 flex items-center justify-center gap-2 text-lg font-black">
              <ChefHat className="h-5 w-5 text-brand-ink" />
              طلب المطبخ
            </div>
            <p className="text-xs text-muted">
              {new Date(ticket.createdAt).toLocaleTimeString(intlLocale(), { hour: '2-digit', minute: '2-digit' })}
            </p>
            {ticket.callName && (
              <p className="mt-2 break-words text-3xl font-black leading-tight text-fg"><bdi>{ticket.callName}</bdi></p>
            )}
            <div className="mt-2 flex items-center justify-center gap-2">
              <span className={cn(
                'rounded-full px-3 py-0.5 text-sm font-bold',
                ticket.orderType === 'here'
                  ? 'bg-brand-soft text-brand-ink'
                  : 'bg-info/10 text-info',
              )}>
                {ticket.orderType === 'here'
                  ? ticket.tableNumber ? `طاولة ${ticket.tableNumber}` : 'بدون طاولة'
                  : '🛍 تيك أواي'}
              </span>
              <span className="text-sm tabular-nums text-muted" dir="ltr">#{ticket.ticketNo}</span>
            </div>
            {ticket.offline && <p className="mt-2 text-xs text-warning">رقم مؤقت · يصل للمطبخ عند المزامنة</p>}
          </div>

          {/* Items */}
          <div className="space-y-3">
            {ticket.items.map((item) => (
              <div key={item.lineKey} className="border-b border-border pb-3 last:border-0 last:pb-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-fg">{lineDisplayName(item.productName, item.variantName)}</p>
                    {item.modifiers.length > 0 && (
                      <p className="mt-0.5 text-sm font-semibold text-fg">{modifierSummary(item.modifiers.map((m) => m.name))}</p>
                    )}
                    {item.notes && (
                      <p className="mt-0.5 text-xs font-medium text-brand-ink">
                        📝 {item.notes}
                      </p>
                    )}
                  </div>
                  <span className="text-2xl font-black tabular-nums text-fg">
                    ×{item.quantity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 border-t border-border p-4">
          <button
            onClick={() => printElement(document.getElementById('cafe-kitchen-print'))}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-fg py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-fg/85"
          >
            <Printer className="h-4 w-4" />
            طباعة
          </button>
          <button
            onClick={onClose}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-semibold text-fg transition-colors hover:bg-surface-2"
          >
            <X className="h-4 w-4" />
            إغلاق
          </button>
        </div>
    </OverlayDialog>
  )
}

// ── Customer Receipt Modal ────────────────────────────────────────────────────

function CustomerReceiptModal({
  receipt,
  onClose,
  onKitchenTicket,
}: {
  receipt: CustomerReceiptData
  onClose: () => void
  onKitchenTicket?: () => void
}) {
  const { sellerName, vatNumber } = useSellerIdentity()
  const receiptSettings = useReceiptSettings()

  // The sale's own rate decides, not today's setting: no VAT rows, number or QR on a sale made with VAT off.
  const qrCode = receipt.vat
    ? generateZatcaQr({
        sellerName: sellerName || 'كافيه',
        vatNumber,
        timestamp: receipt.completedAt,
        totalWithVat: receipt.grandTotal,
        vatAmount: receipt.tax,
      })
    : undefined

  const payLabel =
    receipt.payMode === 'Cash' ? 'نقداً' :
    receipt.payMode === 'Card' ? 'بطاقة' :
    `تقسيم — نقد ${formatCurrency(receipt.splitCash ?? 0)} / بطاقة ${formatCurrency(receipt.splitCard ?? 0)}`

  return (
    <OverlayDialog onClose={onClose} label="فاتورة العميل" closeOnBackdrop={false} panelClassName="w-[22rem] rounded-2xl bg-surface shadow-2xl">
        <div className="max-h-[62vh] overflow-y-auto p-5">
          <ReceiptDocument
            id="cafe-receipt-print"
            settings={receiptSettings}
            sellerName={sellerName}
            vatNumber={vatNumber}
            invoiceNo={invoiceNo({ id: receipt.orderId, number: receipt.number })}
            issuedAt={receipt.completedAt}
            lines={receipt.items.map((item) => ({
              key: item.lineKey,
              name: lineDisplayName(item.productName, item.variantName),
              quantity: item.quantity,
              total: item.unitPrice * item.quantity,
              detail: lineDetail(item.modifiers.map((m) => m.name), item.notes),
            }))}
            subtotal={receipt.subtotal}
            tax={receipt.tax}
            vat={receipt.vat}
            total={receipt.grandTotal}
            discount={receipt.discount}
            discountLabel={receipt.discountLabel}
            loyalty={receipt.loyaltyDiscount ? { amount: receipt.loyaltyDiscount, points: receipt.pointsRedeemed ?? 0 } : undefined}
            paymentLabel={payLabel}
            tendered={
              receipt.payMode === 'Cash' ? receipt.cashTendered
                : receipt.payMode === 'Split' && receipt.cashTendered != null ? round2(receipt.cashTendered + (receipt.splitCard ?? 0))
                  : undefined
            }
            customer={receipt.customerName ? { name: receipt.customerName, pointsEarned: receipt.pointsEarned } : undefined}
            callName={receipt.callName}
            badge={
              receipt.offline
                ? 'رقم مؤقت · تصدر الفاتورة عند المزامنة'
                : receipt.orderType === 'takeaway'
                  ? 'سفري'
                  : receipt.tableNumber
                    ? `طاولة ${receipt.tableNumber}`
                    : undefined
            }
            qr={qrCode}
          />
        </div>

        <div className="border-t border-border px-4 pt-3">
          <p className="mb-1.5 text-xs font-medium text-muted">إرسال الفاتورة على واتساب</p>
          <WhatsAppShare
            defaultPhone={receipt.customerPhone}
            message={buildReceiptMessage({
              storeName: sellerName || 'كافيه',
              invoiceNo: invoiceNo({ id: receipt.orderId, number: receipt.number }),
              date: new Date(receipt.completedAt).toLocaleString(intlLocale(), { dateStyle: 'medium', timeStyle: 'short' }),
              items: receipt.items.map((i) => ({
                name: lineDisplayName(i.productName, i.variantName),
                detail: lineDetail(i.modifiers.map((m) => m.name), i.notes),
                quantity: i.quantity,
                total: i.unitPrice * i.quantity,
              })),
              discount: (receipt.discount ?? 0) + (receipt.loyaltyDiscount ?? 0) || undefined,
              discountLabel: receipt.loyaltyDiscount ? undefined : receipt.discountLabel,
              vat: receipt.vat ? receipt.tax : undefined,
              vatIncluded: true,
              total: receipt.grandTotal,
              payment: payLabel,
            })}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 border-t border-border p-4">
          <button
            onClick={() => printElement(document.getElementById('cafe-receipt-print'))}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-fg py-2.5 text-sm font-semibold text-bg hover:bg-fg/85"
          >
            <Printer className="h-4 w-4" />
            طباعة
          </button>
          {onKitchenTicket && (
            <button
              onClick={onKitchenTicket}
              title="طباعة تذكرة المطبخ"
              className="flex items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2.5 text-sm font-semibold text-fg hover:bg-surface-2"
            >
              <ChefHat className="h-4 w-4 text-brand-strong" />
              المطبخ
            </button>
          )}
          <button
            onClick={onClose}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-semibold text-fg hover:bg-surface-2"
          >
            <X className="h-4 w-4" />
            إغلاق
          </button>
        </div>
    </OverlayDialog>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function CafePosPage() {
  const { branchId, tenantId, user } = useAuthStore()
  const vat = useVat()
  const isGamingLounge = user?.businessType === 'Gaming'
  const isManager = user?.role === 'Owner' || user?.role === 'Manager'
  const { data: posSettingsRes } = useQuery({
    queryKey: ['pos-settings', branchId],
    queryFn: () => posSettingsApi.get(branchId!),
    enabled: !!branchId,
    staleTime: 5 * 60_000,
  })
  const posSettings = posSettingsRes?.data ?? DEFAULT_POS_SETTINGS
  const canManage = isManager
  const [gamingAlertCounts, setGamingAlertCounts] = useState({ expired: 0, warning: 0 })
  const { t, lang } = useI18n()
  const { shift } = useShift()

  // Order type & table
  const [orderType, setOrderType] = useState<'here' | 'takeaway'>('here')
  const [tableNumber, setTableNumber] = useState<number | null>(null)
  const [showTablePicker, setShowTablePicker] = useState(false)
  // Tapping the type already picked keeps the table; switching type starts without one.
  const pickOrderType = (type: 'here' | 'takeaway') => {
    if (type === orderType) return
    setOrderType(type)
    setTableNumber(null)
  }
  // The name the barista calls out. A picked loyalty customer fills it in unless the cashier typed another.
  const [callName, setCallName] = useState('')
  const callNameAutoRef = useRef('')

  // Products
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all')
  const [productSearch, setProductSearch] = useState('')
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [confirmClearCart, setConfirmClearCart] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const lastLineRef = useRef<string | null>(null)
  // A drink with several sizes or with add-ons opens this picker; fromSearch clears the search once it is added.
  // picks holds the chosen option ids per add-on group.
  const [sizePicker, setSizePicker] = useState<{
    product: ProductResponse
    selectedId: string
    picks: Record<string, string[]>
    fromSearch: boolean
  } | null>(null)

  // Cart
  const [cart, setCart] = useState<CafeCartItem[]>([])
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [payMode, setPayMode] = useState<PayMode>('Cash')
  const [cashTendered, setCashTendered] = useState('')
  const [loyaltyCustomer, setLoyaltyCustomer] = useState<CustomerResponse | null>(null)
  const loyaltyRules = useLoyaltyRules()
  const [redeemPoints, setRedeemPoints] = useState(0)
  useEffect(() => {
    const suggested = callNameFrom(loyaltyCustomer?.name)
    setCallName((current) => (current.trim() === '' || current === callNameAutoRef.current ? suggested : current))
    callNameAutoRef.current = suggested
  }, [loyaltyCustomer?.id, loyaltyCustomer?.name])
  const [discountMode, setDiscountMode] = useState<DiscountMode>('Percentage')
  const [discountInput, setDiscountInput] = useState('')
  const [showDiscount, setShowDiscount] = useState(false)
  const [approvalPin, setApprovalPin] = useState('')
  // An owner's discount code, checked with the server when applied. One discount at a time: while a code is on,
  // the manual discount is off, and the server takes the percentage from the code, not from this till.
  const [appliedCode, setAppliedCode] = useState<AppliedDiscountCode | null>(null)
  const [showCodeInput, setShowCodeInput] = useState(false)
  const [codeInput, setCodeInput] = useState('')
  const [codeError, setCodeError] = useState<string | null>(null)
  const [codeChecking, setCodeChecking] = useState(false)
  const queryClient = useQueryClient()

  // AI Cashier
  const [aiCashierActive, setAiCashierActive] = useState(false)

  // Gaming
  const [startSessionForm, setStartSessionForm] = useState<StartSessionForm | null>(null)
  const [gamingBill, setGamingBill] = useState<GameSessionBillResponse | null>(null)
  const closeGamingBill = () => {
    if (gamingBill && !gamingBill.paidAt) toast.warning('الجلسة غير مدفوعة', 'ستظهر كغير محصّلة في الإقفال اليومي')
    setGamingBill(null)
  }
  const [gamingNow, setGamingNow] = useState(() => Date.now())

  // Shift
  const [showOpenShift, setShowOpenShift] = useState(false)
  const [showCloseShift, setShowCloseShift] = useState(false)

  // Split payment. splitCash is the cash handed over, which may be a larger note than the cash part; once the
  // card part is typed it stays put, so the note can be entered and the change shown.
  const [splitCash, setSplitCash] = useState<string>('')
  const [splitCard, setSplitCard] = useState<string>('')
  const [splitCardTyped, setSplitCardTyped] = useState(false)

  // Kitchen ticket & customer receipt. The last sale's ticket is kept so the cashier can reprint it.
  const [lastKitchenTicket, setLastKitchenTicket] = useState<KitchenTicketData | null>(null)
  const [showKitchenTicket, setShowKitchenTicket] = useState(false)
  const [customerReceipt, setCustomerReceipt] = useState<CustomerReceiptData | null>(null)

  // Below md the cart is a bottom sheet over the menu; a quantity tapped on a line becomes a typed field.
  const [cartOpen, setCartOpen] = useState(false)
  // The phone sheet behaves as a dialog: focus on its close button, Tab kept inside, page scroll locked,
  // focus back on the bottom bar when it closes.
  const cartSheetRef = useDialogBehavior<HTMLElement>(cartOpen, () => setCartOpen(false), 'panel')
  const [qtyEdit, setQtyEdit] = useState<{ lineKey: string; text: string } | null>(null)
  // Set once this branch's saved draft has been looked at, so an empty cart never overwrites it first.
  const draftBranchRef = useRef<string | null>(null)

  // Widening past md shows the side cart, so a sheet left open there must not linger as a dialog.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const onChange = () => { if (mq.matches) setCartOpen(false) }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // ── Data ──────────────────────────────────────────────────────────────────

  const { data: categoriesData } = useQuery({
    queryKey: ['categories', tenantId],
    queryFn: () => catalogApi.listCategories(),
  })

  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['cafe-products', tenantId, selectedCategoryId],
    queryFn: () =>
      catalogApi.listProducts(tenantId!, selectedCategoryId !== 'all' ? { categoryId: selectedCategoryId } : {}),
    enabled: !!tenantId,
  })

  const { data: cashierFeature } = useQuery({
    queryKey: ['ai-cashier-available', tenantId],
    queryFn: () => {
      const id = branchId ?? tenantId
      return id ? aiCashierApi.isAvailable(id) : Promise.resolve({ available: false })
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 10,
  })
  const aiCashierAvailable = cashierFeature?.available ?? false

  const { data: allProductsData } = useQuery({
    queryKey: ['products', tenantId],
    queryFn: () => catalogApi.listProducts(tenantId!, { pageSize: 200 }),
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 5,
  })

  const { data: stockData } = useQuery({
    queryKey: ['pos-stock', branchId],
    queryFn: () => inventoryApi.listItems(branchId!, { pageSize: 500 }),
    enabled: !!branchId,
    staleTime: 30_000,
  })

  const { data: stationsData, refetch: refetchStations } = useQuery({
    queryKey: ['gaming-stations-cafe', branchId],
    queryFn: () => gamingApi.listStations(branchId!),
    // Gaming lounges poll on every tab so time-up alerts reach the cashier while selling drinks.
    enabled: !!branchId && (isGamingLounge || selectedCategoryId === '__gaming__'),
    refetchInterval: selectedCategoryId === '__gaming__' ? 15_000 : isGamingLounge ? 30_000 : false,
  })
  const stations: GameStationResponse[] = Array.isArray(stationsData?.data)
    ? (stationsData!.data as GameStationResponse[])
    : []

  const _rawCats = categoriesData?.data
  const categories: CategoryResponse[] = Array.isArray(_rawCats) ? _rawCats : ((_rawCats as any)?.items ?? [])
  const _rawProds = productsData?.data
  const categoryProducts: ProductResponse[] = Array.isArray(_rawProds) ? _rawProds : ((_rawProds as any)?.items ?? [])
  const _rawAll = allProductsData?.data
  const allProducts: ProductResponse[] = Array.isArray(_rawAll) ? _rawAll : ((_rawAll as any)?.items ?? [])
  // A search looks across every category, best match first; otherwise the grid shows the selected category.
  // Either way the grid has one tile per drink that has a size on sale.
  const searchTerm = normalizeArabic(productSearch.toLowerCase())
  const products: ProductResponse[] = searchTerm
    ? allProducts
        .map((p, i) => ({ p, i, rank: searchRank(p, searchTerm) }))
        .filter((x): x is { p: ProductResponse; i: number; rank: number } => x.rank !== null)
        .sort((a, b) => a.rank - b.rank || a.i - b.i)
        .map((x) => x.p)
    : categoryProducts.filter((p) => p.variants.some((v) => v.isActive))

  // Cart lines carry the Arabic names that go on the receipt and the kitchen ticket; on screen each line is
  // named from the catalogue in the UI language, falling back to the stored name for an item no longer listed.
  const catalogByVariant = new Map(allProducts.flatMap((p) => p.variants.map((v) => [v.id, { product: p, variant: v }] as const)))
  const catalogOptions = new Map(allProducts.flatMap((p) => (p.modifierGroups ?? []).flatMap((g) => g.options.map((o) => [o.id, o] as const))))
  const shownProduct = (item: { variantId: string; productName: string }) => {
    const found = catalogByVariant.get(item.variantId)
    return found ? localName(found.product, lang) : item.productName
  }
  const shownSize = (item: { variantId: string; variantName: string }) => {
    const found = catalogByVariant.get(item.variantId)
    return found ? localName(found.variant, lang) : item.variantName
  }
  const shownModifiers = (mods: { optionId: string; name: string }[]) =>
    mods.map((m) => localName(catalogOptions.get(m.optionId) ?? m, lang))

  // Stock map: variantId → quantity on hand
  const stockMap = (() => {
    const raw = stockData?.data
    const items = Array.isArray(raw) ? raw : ((raw as any)?.items ?? [])
    const m: Record<string, number> = {}
    for (const s of items) m[s.variantId] = s.quantity
    return m
  })()

  // Map: variantId → does the product track inventory
  const trackMap = (() => {
    const m: Record<string, boolean> = {}
    for (const p of allProducts) {
      for (const v of p.variants) m[v.id] = p.trackInventory
    }
    return m
  })()

  useEffect(() => {
    if (isGamingLounge) requestNotificationPermission()
  }, [isGamingLounge])

  // Timer: update every second only while gaming tab is open
  useEffect(() => {
    if (selectedCategoryId !== '__gaming__') return
    const id = setInterval(() => setGamingNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [selectedCategoryId])

  // One drink can sit on several lines (different notes); stock counts them all.
  const cartQty = (variantId: string, lines = cart) => lines.reduce((n, i) => (i.variantId === variantId ? n + i.quantity : n), 0)

  // How many more of a size the stock allows on top of the given lines; untracked or unknown stock has no limit.
  const stockRoom = (variantId: string, lines = cart): number => {
    if (!trackMap[variantId]) return Infinity
    const available = stockMap[variantId]
    if (available === undefined) return Infinity
    return available - cartQty(variantId, lines)
  }

  const canAddMore = (variantId: string, addingQty = 1, lines = cart): boolean => addingQty <= stockRoom(variantId, lines)

  // A tracked size with nothing on hand; a tile is sold out only when every one of its sizes is.
  const isSoldOut = (variantId: string) =>
    !!trackMap[variantId] && stockMap[variantId] !== undefined && stockMap[variantId] <= 0

  // ── Cart ops ──────────────────────────────────────────────────────────────

  const addToCart = (
    variantId: string,
    productName: string,
    variantName: string,
    unitPrice: number,
    costPrice: number,
    modifiers: CartModifier[] = [],
  ): boolean => {
    if (!canAddMore(variantId)) {
      toast.error('المخزون غير كافٍ', `المتاح: ${stockMap[variantId] ?? 0} وحدة`)
      return false
    }
    const key = modifierKey(modifiers)
    setCart((prev) => {
      // A tap adds to the line without notes and with the same add-ons; any other line is a different order.
      const existing = prev.find((i) => i.variantId === variantId && !i.notes && modifierKey(i.modifiers) === key)
      if (existing) {
        lastLineRef.current = existing.lineKey
        return prev.map((i) => i.lineKey === existing.lineKey ? { ...i, quantity: i.quantity + 1 } : i)
      }
      const lineKey = newLineKey()
      lastLineRef.current = lineKey
      return [...prev, {
        lineKey, variantId, productName, variantName, unitPrice: unitPriceWith(unitPrice, modifiers), costPrice, quantity: 1, notes: '', modifiers,
      }]
    })
    return true
  }

  // A tile tap: a drink with one size and no add-ons goes straight in; otherwise the picker opens on the
  // last size and add-ons sold here.
  const openProduct = (product: ProductResponse, fromSearch = false) => {
    const sizes = product.variants.filter((v) => v.isActive)
    if (sizes.length === 0) return
    const groups = productGroups(product.modifierGroups)
    if (sizes.length === 1 && groups.length === 0) {
      const [only] = sizes
      if (addToCart(only.id, product.name, only.name, only.salePrice, only.costPrice) && fromSearch) setProductSearch('')
      return
    }
    const last = readLastSize(product.id)
    setSizePicker({
      product,
      selectedId: sizes.some((v) => v.id === last) ? last! : sizes[0].id,
      picks: initialPicks(groups, readLastModifiers(product.id)),
      fromSearch,
    })
  }

  // Without add-ons a size tap adds it; with add-ons it only picks the size, and 'أضف للطلب' adds the drink.
  const pickSize = (variantId: string) => {
    if (!sizePicker) return
    const { product, fromSearch } = sizePicker
    const variant = product.variants.find((v) => v.id === variantId)
    if (!variant) return
    if (productGroups(product.modifierGroups).length > 0) {
      setSizePicker({ ...sizePicker, selectedId: variant.id })
      return
    }
    // Out of stock keeps the picker open so another size can be chosen.
    if (!addToCart(variant.id, product.name, variant.name, variant.salePrice, variant.costPrice)) return
    rememberLastSize(product.id, variant.id)
    if (fromSearch) setProductSearch('')
    setSizePicker(null)
  }

  // A chip tap: a pick-one group swaps its choice; otherwise the option toggles, up to the group's maximum.
  const togglePick = (group: ProductModifierGroupResponse, optionId: string) => {
    setSizePicker((p) => {
      if (!p) return p
      const current = p.picks[group.id] ?? []
      const next = current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : group.maxSelect === 1
          ? [optionId]
          : current.length >= group.maxSelect ? current : [...current, optionId]
      return { ...p, picks: { ...p.picks, [group.id]: next } }
    })
  }

  // Adds the picked size with its add-ons once every group's rule is met; the server checks the same rules.
  const addPicked = () => {
    if (!sizePicker) return
    const { product, selectedId, picks, fromSearch } = sizePicker
    const variant = product.variants.find((v) => v.id === selectedId && v.isActive)
    if (!variant) return
    const groups = productGroups(product.modifierGroups)
    const missing = groups.find((g) => !groupSatisfied(g, picks[g.id]?.length ?? 0))
    if (missing) {
      toast.error(t.pos.addOnMissing.replace('{group}', localName(missing, lang)), groupRule(missing, t.products))
      return
    }
    const modifiers = pickedModifiers(groups, picks)
    if (!addToCart(variant.id, product.name, variant.name, variant.salePrice, variant.costPrice, modifiers)) return
    rememberLastSize(product.id, variant.id)
    rememberLastModifiers(product.id, modifiers.map((m) => m.optionId))
    if (fromSearch) setProductSearch('')
    setSizePicker(null)
  }

  // ── AI cashier cart ops ─────────────────────────────────────────────────────
  // One AI reply can carry several actions in the same tick, so these work on a ref
  // that is updated immediately instead of waiting for the next render.
  const aiCartRef = useRef<CafeCartItem[]>(cart)
  aiCartRef.current = cart
  const commitAiCart = (next: CafeCartItem[]) => {
    aiCartRef.current = next
    setCart(next)
  }

  const aiStockAllows = (variantId: string, trackInventory: boolean, qty: number): boolean => {
    if (!trackInventory) return true
    const available = stockMap[variantId]
    if (available === undefined || qty <= available) return true
    toast.error('المخزون غير كافٍ', `المتاح: ${available} وحدة`)
    return false
  }

  const aiQtyOf = (variantId: string, except?: string) =>
    aiCartRef.current.reduce((n, i) => (i.variantId === variantId && i.lineKey !== except ? n + i.quantity : n), 0)

  // The same drink with the same note joins its line; a different note is its own line, as at the till.
  const addVariantById = (variantId: string, qty: number, notes: string): AiCartResult => {
    const product = allProducts.find((p) => p.variants.some((v) => v.id === variantId))
    const variant = product?.variants.find((v) => v.id === variantId)
    if (!product || !variant) return 'not_found'
    // A required add-on (e.g. milk) is the cashier's pick on the till; a plain line would be refused at payment.
    if (productGroups(product.modifierGroups).some((g) => !groupSatisfied(g, 0))) return 'needs_options'
    const note = (notes ?? '').trim()
    const current = aiCartRef.current
    // The AI adds the plain drink; a line with add-ons is the cashier's and stays as it is.
    const existing = current.find((i) => i.variantId === variantId && i.notes === note && i.modifiers.length === 0)
    if (!aiStockAllows(variantId, product.trackInventory, aiQtyOf(variantId) + qty)) return 'out_of_stock'
    commitAiCart(existing
      ? current.map((i) => i.lineKey === existing.lineKey ? { ...i, quantity: i.quantity + qty } : i)
      : [...current, { lineKey: newLineKey(), variantId, productName: product.name, variantName: variant.name, unitPrice: variant.salePrice, costPrice: variant.costPrice, quantity: qty, notes: note, modifiers: [] }])
    return 'ok'
  }

  // Sets the item's quantity on its plain line (or its first line); other lines with notes stay as they are.
  const setVariantQtyById = (variantId: string, qty: number): AiCartResult => {
    const current = aiCartRef.current
    const lines = current.filter((i) => i.variantId === variantId)
    if (lines.length === 0) return 'not_in_cart'
    if (qty <= 0) {
      commitAiCart(current.filter((i) => i.variantId !== variantId))
      return 'ok'
    }
    const target = lines.find((i) => !i.notes) ?? lines[0]
    if (!aiStockAllows(variantId, trackMap[variantId] ?? false, aiQtyOf(variantId, target.lineKey) + qty)) return 'out_of_stock'
    commitAiCart(current.map((i) => i.lineKey === target.lineKey ? { ...i, quantity: qty } : i))
    return 'ok'
  }

  const removeVariantById = (variantId: string): AiCartResult => setVariantQtyById(variantId, 0)

  const getAiCartSnapshot = (): AiCashierCartSnapshot => {
    const lines = aiCartRef.current.map((i) => ({
      variantId: i.variantId,
      name: [lineDisplayName(i.productName, i.variantName), modifierSummary(i.modifiers.map((m) => m.name))].filter(Boolean).join(' · ')
        + (i.notes ? ` (${i.notes})` : ''),
      quantity: i.quantity,
      lineTotal: Math.round(i.unitPrice * i.quantity * 100) / 100,
    }))
    return { lines, total: Math.round(lines.reduce((s, l) => s + l.lineTotal, 0) * 100) / 100 }
  }

  const updateQty = (lineKey: string, delta: number) => {
    const line = cart.find((i) => i.lineKey === lineKey)
    if (!line) return
    if (delta > 0 && !canAddMore(line.variantId)) {
      toast.error('المخزون غير كافٍ', `المتاح: ${stockMap[line.variantId] ?? 0} وحدة`)
      return
    }
    setCart((prev) =>
      prev
        .map((i) => i.lineKey === lineKey ? { ...i, quantity: i.quantity + delta } : i)
        .filter((i) => i.quantity > 0),
    )
  }

  const removeItem = (lineKey: string) => setCart((prev) => prev.filter((i) => i.lineKey !== lineKey))

  // A typed quantity: 0 removes the line, more than the stock allows stops at what is on hand.
  const commitQty = () => {
    if (!qtyEdit) return
    const { lineKey, text } = qtyEdit
    setQtyEdit(null)
    const line = cart.find((i) => i.lineKey === lineKey)
    const typed = parseQty(text)
    if (!line || !Number.isFinite(typed) || typed < 0) return
    if (typed === 0) { removeItem(lineKey); return }
    let quantity = Math.min(typed, 999)
    if (quantity > line.quantity && !canAddMore(line.variantId, quantity - line.quantity)) {
      toast.error('المخزون غير كافٍ', `المتاح: ${stockMap[line.variantId] ?? 0} وحدة`)
      quantity = line.quantity + Math.max(0, stockRoom(line.variantId))
    }
    lastLineRef.current = lineKey
    setCart((prev) => prev.map((i) => (i.lineKey === lineKey ? { ...i, quantity } : i)))
  }

  // Rings the last sale again for a regular, at today's prices and with its notes and add-ons. Stock applies as
  // for a tap: a size that ran out, or a size or add-on no longer on the menu, is left out and the cashier is told.
  const repeatLastOrder = () => {
    const last = lastKitchenTicket?.items ?? []
    if (last.length === 0) {
      toast.info(t.pos.repeatNothing)
      return
    }
    const onSale = new Map(allProducts.flatMap((p) => p.variants.filter((v) => v.isActive).map((v) => [v.id, { product: p, variant: v }] as const)))
    const next = [...cart]
    let missed = 0
    for (const item of last) {
      const found = onSale.get(item.variantId)
      const modifiers = found ? currentModifiers(found.product, item.modifiers) : null
      if (!found || !modifiers) { missed += item.quantity; continue }
      let quantity = item.quantity
      if (!canAddMore(item.variantId, quantity, next)) quantity = Math.max(0, stockRoom(item.variantId, next))
      missed += item.quantity - quantity
      if (quantity === 0) continue
      const { product, variant } = found
      const lineKey = newLineKey()
      lastLineRef.current = lineKey
      next.push({
        lineKey, variantId: variant.id, productName: product.name, variantName: variant.name,
        unitPrice: unitPriceWith(variant.salePrice, modifiers), costPrice: variant.costPrice, quantity, notes: item.notes, modifiers,
      })
    }
    if (next.length === cart.length) {
      toast.error(t.pos.repeatNoneAdded, t.pos.repeatMissed.replace('{n}', String(missed)))
      return
    }
    const merged = mergeCartLines(next)
    if (!merged.some((i) => i.lineKey === lastLineRef.current)) lastLineRef.current = null
    setCart(merged)
    if (missed > 0) toast.warning(t.pos.repeatPartial, t.pos.repeatMissed.replace('{n}', String(missed)))
    else toast.success(t.pos.repeatAdded)
  }

  const updateNote = (lineKey: string, note: string) => {
    setCart((prev) => prev.map((i) => i.lineKey === lineKey ? { ...i, notes: note } : i))
  }

  // Once a note is written, a line that now matches another one (same drink, note and add-ons) joins it.
  const finishNote = () => {
    setEditingNoteId(null)
    setCart(mergeCartLines)
  }

  // الأسعار شاملة الضريبة — نستخرج الضريبة من الإجمالي
  const cartTotal = cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0)
  // The order discount comes off first, then loyalty points, as on the server. A fixed discount is typed
  // in riyals the customer sees (VAT included); a percentage is the same share before or after VAT.
  // A discount code brings its own kind and value (a fixed code is VAT included, like a typed one).
  const discountKind: DiscountMode = appliedCode ? appliedCode.type : discountMode
  const discountRaw = appliedCode ? appliedCode.value : Math.max(0, parseFloat(discountInput) || 0)
  const discountGross = Math.round(Math.min(
    discountKind === 'Percentage' ? cartTotal * Math.min(discountRaw, 100) / 100 : discountRaw,
    cartTotal,
  ) * 100) / 100
  const discountShare = cartTotal > 0 ? (discountGross / cartTotal) * 100 : 0
  // The branch sets how far a cashier may discount alone; past it a manager types their PIN, if the branch has one.
  // The owner approved a discount code when they made it, so it is never over the cap.
  const discountCap = posSettings.maxCashierDiscountPercent
  const overCap = !appliedCode && !isManager && discountShare > discountCap + 0.01
  const needsPin = overCap && posSettings.hasApprovalPin && navigator.onLine
  const discountOverCap = overCap && !needsPin
  const afterDiscount = Math.round((cartTotal - discountGross) * 100) / 100
  const maxRedeemable = loyaltyCustomer ? maxRedeemablePoints(loyaltyCustomer.loyaltyPoints, afterDiscount, loyaltyRules) : 0
  const appliedPoints = Math.min(redeemPoints, maxRedeemable)
  const loyaltyDiscount = pointsValue(appliedPoints, loyaltyRules)
  // grandTotal is what the customer pays, after the order discount and any loyalty discount.
  const grandTotal = Math.round((afterDiscount - loyaltyDiscount) * 100) / 100
  // The VAT share inside a price at the shop's rate; nothing for a shop without VAT.
  const vatOf = (gross: number) => Math.round((gross * vat.rate / (1 + vat.rate)) * 100) / 100
  const tax = vatOf(grandTotal)
  const subtotal = Math.round((grandTotal - tax) * 100) / 100

  // ── Discount code ─────────────────────────────────────────────────────────
  // The server checks the code for this store and answers with its label and value; a bad code shows the
  // server's reason under the field. The sale's checkout checks it once more.
  const applyDiscountCode = async () => {
    const code = normalizeDiscountCode(codeInput)
    if (!code || !branchId || codeChecking) return
    if (!navigator.onLine) {
      setCodeError(t.pos.codeNeedsInternet)
      return
    }
    setCodeChecking(true)
    setCodeError(null)
    try {
      const { data } = await restaurantApi.validateDiscountCode(branchId, code, Math.round(cartTotal * 100) / 100)
      if (!data.isValid) {
        setCodeError(data.errorMessage || t.pos.codeInvalid)
        return
      }
      setAppliedCode({ code: data.code, label: data.label ?? null, type: data.type, value: data.value })
      setDiscountInput('')
      setShowDiscount(false)
      setApprovalPin('')
      setShowCodeInput(false)
      setCodeInput('')
      toast.success(t.pos.codeApplied)
    } catch (e) {
      setCodeError(apiErrorMessage(e, t.pos.codeCheckFailed))
    } finally {
      setCodeChecking(false)
    }
  }

  const clearDiscountCode = () => {
    setAppliedCode(null)
    setShowCodeInput(false)
    setCodeInput('')
    setCodeError(null)
  }

  // ── Checkout ──────────────────────────────────────────────────────────────

  // A sale refused for a price below the catalog means the menu changed after these items were added:
  // reload it and reprice the cart lines from it, so the next press of pay goes through.
  const repriceCart = async (err: Error) => {
    const fresh = await queryClient.fetchQuery({
      queryKey: ['products', tenantId],
      queryFn: () => catalogApi.listProducts(tenantId!, { pageSize: 200 }),
      staleTime: 0,
    })
    void queryClient.invalidateQueries({ queryKey: ['cafe-products', tenantId] })
    const raw = fresh?.data
    const list: ProductResponse[] = Array.isArray(raw) ? raw : ((raw as any)?.items ?? [])
    const prices = catalogPrices(list)
    if (!cart.some((i) => isStale(i, prices))) {
      toast.error(apiErrorMessage(err), 'احذف الصنف من السلة وأضفه من جديد')
      return
    }
    setCart((prev) => repriceLines(prev, prices))
    toast.warning('تحدّثت الأسعار من قائمة المنتجات', 'راجع الإجمالي ثم ادفع مرة أخرى')
  }

  // ── Cart draft ────────────────────────────────────────────────────────────
  // Saved on every change once this branch's draft has been read back, and dropped with an empty cart.
  useEffect(() => {
    if (!branchId || draftBranchRef.current !== branchId) return
    writeDraft(branchId, { cart, orderType, tableNumber, discountMode, discountInput, discountCode: appliedCode })
  }, [branchId, cart, orderType, tableNumber, discountMode, discountInput, appliedCode])

  // Read back once the menu has loaded: lines whose size or an add-on left the menu are dropped and the rest
  // take today's prices, the same repricing a refused sale gets. A cart already started here is left alone.
  useEffect(() => {
    if (!branchId || !allProductsData || draftBranchRef.current === branchId) return
    draftBranchRef.current = branchId
    const draft = readDraft(branchId)
    if (!draft?.cart?.length || cart.length > 0) return
    const onSale = new Map(allProducts.flatMap((p) => p.variants.filter((v) => v.isActive).map((v) => [v.id, { product: p, variant: v }] as const)))
    const kept: CafeCartItem[] = []
    for (const i of draft.cart) {
      const found = typeof i?.variantId === 'string' ? onSale.get(i.variantId) : undefined
      if (!found || !Number.isInteger(i.quantity) || i.quantity <= 0) continue
      // A draft from before add-ons has none; a stored add-on is kept only while it is still on the menu.
      const stored = Array.isArray(i.modifiers) ? i.modifiers.filter((m) => typeof m?.optionId === 'string') : []
      const modifiers = currentModifiers(found.product, stored)
      if (!modifiers) continue
      kept.push({
        lineKey: typeof i.lineKey === 'string' ? i.lineKey : newLineKey(),
        variantId: found.variant.id,
        productName: found.product.name,
        variantName: found.variant.name,
        unitPrice: Number(i.unitPrice),
        costPrice: found.variant.costPrice,
        quantity: Math.min(i.quantity, 999),
        notes: typeof i.notes === 'string' ? i.notes.slice(0, 200) : '',
        modifiers,
      })
    }
    const dropped = draft.cart.length - kept.length
    if (kept.length === 0) {
      clearDraft(branchId)
      return
    }
    setCart(mergeCartLines(repriceLines(kept, catalogPrices(allProducts))))
    if (draft.orderType === 'here' || draft.orderType === 'takeaway') setOrderType(draft.orderType)
    if (typeof draft.tableNumber === 'number' && draft.tableNumber >= 1 && draft.tableNumber <= TOTAL_TABLES) setTableNumber(draft.tableNumber)
    if (draft.discountMode === 'Percentage' || draft.discountMode === 'Fixed') setDiscountMode(draft.discountMode)
    if (typeof draft.discountInput === 'string') setDiscountInput(draft.discountInput)
    const code = draft.discountCode
    if (code && typeof code.code === 'string' && (code.type === 'Percentage' || code.type === 'Fixed') && Number(code.value) > 0) {
      setAppliedCode({ code: code.code, label: typeof code.label === 'string' ? code.label : null, type: code.type, value: Number(code.value) })
    }
    toast.info(t.pos.draftRestored, dropped > 0 ? t.pos.draftDropped.replace('{n}', String(dropped)) : undefined)
    // Only the menu arriving (or the branch changing) should trigger the read-back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, allProductsData])

  // The button and the AI cashier share one path: a single idempotent /orders/checkout with the offline fallback.
  // The AI cashier settles the exact total by cash or card, so it has no tendered amount or split.
  const checkout = useMutation({
    mutationFn: async ({ mode, viaAi }: { mode: PayMode; viaAi?: boolean }) => {
      if (!branchId || !tenantId) throw new Error('no-branch')
      if (cart.length === 0) throw new Error('empty')
      if (discountOverCap) throw new Error('discount-cap')

      // Prices include VAT; the server receives the pre-VAT price and adds the tax back. The rate is the shop's
      // (0 without VAT, when the listed price is the price); the server refuses any other.
      const taxRate = vatRate()
      const preTaxRate = 1 + taxRate
      const handed = mode === 'Cash' && !viaAi ? parseFloat(cashTendered) || 0 : 0
      const clientReference = newClientReference()
      const payload: CheckoutPayload = {
        clientReference,
        currency: 'SAR',
        taxRate,
        customerId: loyaltyCustomer?.id,
        lines: cart.map((item) => ({
          variantId: item.variantId,
          productName: item.productName,
          variantName: item.variantName,
          unitPrice: Math.round((item.unitPrice / preTaxRate) * 10000) / 10000,
          costPrice: item.costPrice,
          quantity: item.quantity,
          notes: item.notes.trim() || undefined,
          // The server prices and checks these again; an offline sale keeps them in its queued payload as they are.
          ...(item.modifiers.length > 0 && { modifierOptionIds: item.modifiers.map((m) => m.optionId) }),
        })),
        ...(discountGross > 0 && (discountKind === 'Percentage'
          ? { discountType: 'Percentage' as const, discountValue: Math.min(discountRaw, 100) }
          : { discountType: 'Fixed' as const, discountValue: Math.round((discountGross / preTaxRate) * 10000) / 10000 })),
        // The server sets the discount from the code; the values above only matter if the code is deleted before
        // a queued offline sale syncs.
        ...(appliedCode && { discountCode: appliedCode.code }),
        ...(needsPin && { approvalPin: approvalPin.trim() }),
        // The kitchen screen gets the paid sale as a ticket; dine-in without a table goes as "no table".
        kitchen: {
          tableNumber: orderType === 'here' ? tableNumber : null,
          takeaway: orderType === 'takeaway',
          callName: callName.trim().slice(0, CALL_NAME_MAX) || undefined,
        },
        loyaltyPoints: appliedPoints,
        paymentMethod: mode as PaymentMethod,
        // A split records the cash part as what is left after the card, so it adds up to the total; a larger
        // note shows up as change through the amount tendered.
        amountTendered: mode === 'Split' ? Math.max(grandTotal, round2(splitCashNum + splitCardNum)) : Math.max(grandTotal, handed),
        ...(mode === 'Split' && {
          cashAmount: splitCashDue,
          cardAmount: splitCardNum,
        }),
      }

      // Keep selling without a connection: the sale waits on this device and syncs when the network returns,
      // and the kitchen ticket goes with it. The manager PIN stays off the device; the manager reviews the sale.
      const saveOffline = () => {
        queueSale({
          clientReference,
          tenantId,
          branchId,
          payload: { ...withoutApprovalPin(payload), offlineCreatedAt: new Date().toISOString() },
          total: grandTotal,
          itemCount: cart.reduce((s, i) => s + i.quantity, 0),
        })
        return { orderId: clientReference, number: null as number | null, offline: true, vat: taxRate > 0 }
      }

      if (!navigator.onLine) {
        if (appliedPoints > 0) throw new Error('offline-loyalty')
        return saveOffline()
      }
      try {
        const { data } = await ordersApi.checkout(branchId, payload)
        return { orderId: data.id, number: data.number ?? null, offline: false, vat: documentHasVat(data) }
      } catch (err) {
        if (isTransientError(err)) return saveOffline()
        throw err
      }
    },
    onSuccess: ({ orderId, number, offline, vat: saleVat }, { mode, viaAi }) => {
      const completedAt = new Date().toISOString()
      const snapshot = {
        items: [...cart],
        grandTotal,
        tax,
        subtotal,
        vat: saleVat,
        payMode: mode,
        splitCash: mode === 'Split' ? splitCashDue || undefined : undefined,
        splitCard: mode === 'Split' ? splitCardNum || undefined : undefined,
        cashTendered: mode === 'Cash' && !viaAi && parseFloat(cashTendered) > 0
          ? parseFloat(cashTendered)
          : mode === 'Split' && splitChange > 0 ? splitCashNum : undefined,
        tableNumber: orderType === 'here' ? tableNumber : null,
        orderType,
        callName: callName.trim().slice(0, CALL_NAME_MAX) || undefined,
        customerName: loyaltyCustomer?.name,
        customerPhone: loyaltyCustomer?.phone ?? undefined,
        discount: discountGross || undefined,
        discountLabel: appliedCode && discountGross > 0 ? appliedCodeName(appliedCode) : undefined,
        loyaltyDiscount: loyaltyDiscount || undefined,
        pointsRedeemed: appliedPoints || undefined,
        pointsEarned: loyaltyCustomer && loyaltyRules.enabled ? pointsEarned(grandTotal, loyaltyRules) : undefined,
      }

      // The server put the ticket on the kitchen screen; this copy is for printing it here.
      setLastKitchenTicket({
        items: snapshot.items,
        orderType,
        tableNumber: snapshot.tableNumber,
        ticketNo: invoiceNo({ id: orderId, number }),
        callName: snapshot.callName,
        offline,
        createdAt: completedAt,
      })
      setShowKitchenTicket(false)

      setCustomerReceipt({ orderId, number, ...snapshot, completedAt, offline })
      setCart([])
      clearDraft(branchId)
      setCartOpen(false)
      setQtyEdit(null)
      lastLineRef.current = null
      setTableNumber(null)
      setCallName('')
      callNameAutoRef.current = ''
      setSplitCash('')
      setSplitCard('')
      setSplitCardTyped(false)
      setCashTendered('')
      setPayMode('Cash')
      setDiscountInput('')
      setApprovalPin('')
      setShowDiscount(false)
      clearDiscountCode()
      void queryClient.invalidateQueries({ queryKey: ['pos-stock', branchId] })
      if (loyaltyCustomer) {
        void queryClient.invalidateQueries({ queryKey: ['pos-customer-search'] })
        void queryClient.invalidateQueries({ queryKey: ['customers'] })
      }
      setLoyaltyCustomer(null)
      setRedeemPoints(0)
      if (viaAi) setAiCashierActive(false)
      if (offline) {
        toast.warning(...savedOnDeviceMessage())
      } else {
        toast.success(
          viaAi ? 'تم إتمام الطلب عبر كاشير AI' : t.pos.orderProcessed,
          snapshot.pointsEarned ? `أضيفت ${snapshot.pointsEarned.toLocaleString(intlLocale())} نقطة لـ${snapshot.customerName}` : undefined,
        )
      }
    },
    onError: (e: Error) => {
      if (e.message === 'empty') toast.error('السلة فارغة')
      else if (e.message === 'offline-storage') toast.error('لم تُحفظ العملية: ذاكرة الجهاز ممتلئة', 'دوّن العملية يدوياً، فهي غير مسجلة. السلة باقية كما هي')
      else if (e.message === 'offline-loyalty') toast.error('لا يمكن استبدال النقاط دون اتصال', 'ألغِ الاستبدال وأكمل البيع')
      else if (e.message === 'discount-cap') toast.error(`أقصى خصم للكاشير ${discountCap}٪`, 'اطلب من المدير إتمام البيع')
      else if (isAxiosError(e) && (e.response?.data as { errors?: Record<string, unknown> } | undefined)?.errors?.['POS.DiscountCodeChanged']) {
        // The owner edited the code since it was applied: take it off and offer it again, so the total is re-checked.
        const code = appliedCode?.code ?? ''
        clearDiscountCode()
        setCodeInput(code)
        setShowCodeInput(true)
        toast.error(t.pos.paymentFailed, apiErrorMessage(e))
      } else if (isAxiosError(e) && ['POS.PriceBelowCatalog', 'POS.UnknownProduct'].some((code) => (e.response?.data as { errors?: Record<string, unknown> } | undefined)?.errors?.[code])) {
        void repriceCart(e).catch(() => toast.error(t.pos.paymentFailed, apiErrorMessage(e)))
      } else {
        // An item that left the catalog is refused too; reload the menu so it can be picked again.
        void queryClient.invalidateQueries({ queryKey: ['products', tenantId] })
        void queryClient.invalidateQueries({ queryKey: ['cafe-products', tenantId] })
        refreshVatAfter(e)
        toast.error(t.pos.paymentFailed, apiErrorMessage(e))
      }
    },
  })

  const splitCashNum = parseFloat(splitCash) || 0
  const splitCardNum = parseFloat(splitCard) || 0
  // What the cash has to cover once the card is charged; the server gets exactly this, so card + cash is the total.
  const splitCashDue = round2(grandTotal - splitCardNum)
  const splitChange = round2(splitCashNum - splitCashDue)
  const splitValid = payMode !== 'Split' || (
    splitCardNum > 0 && splitCashDue > 0 && splitChange >= 0
  )
  const cashShort = payMode === 'Cash' && cashTendered !== '' && (parseFloat(cashTendered) || 0) < grandTotal
  const canCheckout = cart.length > 0 && splitValid && !cashShort && !discountOverCap && (!needsPin || approvalPin.trim().length >= 4)

  // ── AI Cashier checkout ────────────────────────────────────────────────────

  // The AI may add items and pay in the same reply; paying waits for that cart to render, so the
  // checkout reads the cart the AI just wrote. Resolves false on failure so the agent can say so.
  const [aiPayRequest, setAiPayRequest] = useState<{ mode: 'Cash' | 'Card'; resolve: (ok: boolean) => void } | null>(null)
  const handleAiCompleteOrder = useCallback(
    (paymentMethod: 'Cash' | 'Card') => new Promise<boolean>((resolve) => setAiPayRequest({ mode: paymentMethod, resolve })),
    [],
  )
  useEffect(() => {
    if (!aiPayRequest) return
    const { mode, resolve } = aiPayRequest
    setAiPayRequest(null)
    if (checkout.isPending) { resolve(false); return }
    checkout.mutateAsync({ mode, viaAi: true }).then(() => resolve(true), () => resolve(false))
  }, [aiPayRequest, checkout])

  // ── Gaming mutations ───────────────────────────────────────────────────────

  const extendSessionMut = useMutation({
    mutationFn: ({ sessionId, minutes }: { sessionId: string; minutes: number }) =>
      gamingApi.extendSession(branchId!, sessionId, minutes),
    onSuccess: (_, v) => {
      void refetchStations()
      toast.success(`تم تمديد الجلسة ${v.minutes === 60 ? 'ساعة' : `${v.minutes} دقيقة`}`)
    },
    onError: () => toast.error('تعذّر تمديد الجلسة'),
  })

  const startSessionMut = useMutation({
    mutationFn: async (form: StartSessionForm) => {
      if (!branchId) throw new Error('no-branch')
      return gamingApi.startSession(branchId, form.stationId, {
        playerName: form.playerName,
        durationMinutes: form.durationMinutes,
        ratePerHour: canManage && form.hourlyRate !== form.stationRate ? form.hourlyRate : undefined,
        packageId: form.packageId,
      })
    },
    onSuccess: () => {
      setStartSessionForm(null)
      void refetchStations()
      toast.success('تم بدء جلسة الألعاب')
    },
    onError: (err) => toast.error('فشل في بدء الجلسة', apiErrorMessage(err)),
  })

  const endSessionMut = useMutation({
    mutationFn: async (sessionId: string) => {
      if (!branchId) throw new Error('no-branch')
      const res = await gamingApi.endSessionById(branchId, sessionId)
      return res.data as GameSessionBillResponse
    },
    onSuccess: (bill) => {
      setGamingBill(bill)
      void refetchStations()
    },
    onError: () => toast.error('فشل في إنهاء الجلسة'),
  })

  const formatElapsed = (startIso: string) => {
    const sec = Math.max(0, Math.floor((gamingNow - new Date(startIso).getTime()) / 1000))
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = sec % 60
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const elapsedSAR = (startIso: string, rate: number) => {
    const hours = Math.max(0, (gamingNow - new Date(startIso).getTime()) / 3600000)
    return hours * rate
  }

  const STATION_ICON: Record<string, string> = {
    Console: '🎮', PC: '💻', VR: '🥽', Arcade: '🕹️', Board: '🎲',
  }

  // ── Keyboard shortcuts ───────────────────────────────────────────────────

  // Enter in the search: a scanned or typed barcode/SKU adds that exact size (a drink with add-ons opens
  // the picker on that size); otherwise the best match is tapped, which adds a single-size drink or opens
  // its size picker.
  const addFirstMatch = () => {
    if (searchTerm) {
      for (const product of products) {
        const variant = exactCodeVariant(product, searchTerm)
        if (variant) {
          const groups = productGroups(product.modifierGroups)
          if (groups.length > 0) {
            setSizePicker({ product, selectedId: variant.id, picks: initialPicks(groups, readLastModifiers(product.id)), fromSearch: true })
            return
          }
          if (addToCart(variant.id, product.name, variant.name, variant.salePrice, variant.costPrice)) setProductSearch('')
          return
        }
      }
    }
    const top = products[0]
    if (top) {
      openProduct(top, true)
      return
    }
    if (searchTerm) toast.error(t.pos.noMatchingProduct, productSearch)
  }

  const lastCartLine = () =>
    cart.some((i) => i.lineKey === lastLineRef.current) ? lastLineRef.current : cart[cart.length - 1]?.lineKey

  const shortcutHints = [
    { keys: ['F2', '/'], label: t.pos.keySearch },
    { keys: ['Enter'], label: t.pos.keyAddFirst },
    { keys: ['+', '-'], label: t.pos.keyQty },
    { keys: ['F5', 'F6', 'F7'], label: t.pos.keyPayMode },
    { keys: ['F9', 'Ctrl+Enter'], label: t.pos.keyPay },
    { keys: ['F4'], label: t.pos.repeatLast },
    { keys: ['F8'], label: t.pos.keyClear },
    { keys: ['?'], label: t.pos.keyHelp },
  ]

  useShortcuts([
    {
      keys: ['F2', '/'],
      label: 'search',
      allowInInputs: true,
      run: () => {
        if (selectedCategoryId === '__gaming__') setSelectedCategoryId('all')
        window.setTimeout(() => searchInputRef.current?.focus(), 0)
      },
    },
    { keys: ['+', '='], label: 'inc', run: () => { const k = lastCartLine(); if (k) updateQty(k, 1) } },
    { keys: ['-'], label: 'dec', run: () => { const k = lastCartLine(); if (k) updateQty(k, -1) } },
    { keys: ['F5'], label: 'cash', allowInInputs: true, run: () => setPayMode('Cash') },
    { keys: ['F6'], label: 'card', allowInInputs: true, run: () => setPayMode('Card') },
    { keys: ['F7'], label: 'split', allowInInputs: true, run: () => setPayMode('Split') },
    {
      keys: ['F9', 'Ctrl+Enter'],
      label: 'pay',
      allowInInputs: true,
      run: () => {
        if (!canCheckout) {
          if (cart.length === 0) toast.error('السلة فارغة')
          else if (discountOverCap) toast.error(`أقصى خصم للكاشير ${discountCap}٪`)
          else if (cashShort) toast.error('المبلغ المستلم أقل من الإجمالي')
          else toast.error('تحقق من مبالغ الدفع المقسّم')
          return
        }
        if (!checkout.isPending) checkout.mutate({ mode: payMode })
      },
    },
    { keys: ['F4'], label: 'repeat', allowInInputs: true, run: repeatLastOrder },
    { keys: ['F8'], label: 'clear', allowInInputs: true, run: () => { if (cart.length > 0) setConfirmClearCart(true) } },
    { keys: ['Escape'], label: 'close-cart', allowInInputs: true, enabled: cartOpen, run: () => setCartOpen(false) },
    { keys: ['?', '؟', 'F1'], label: 'help', allowInInputs: false, run: () => setShowShortcuts(true) },
  ])

  // The open picker: its add-on groups and sizes, the drink so far, and whether every group's rule is met.
  const pickerGroups = productGroups(sizePicker?.product.modifierGroups)
  const pickerSizes = sizePicker?.product.variants.filter((v) => v.isActive) ?? []
  const pickerVariant = pickerSizes.find((v) => v.id === sizePicker?.selectedId)
  const pickerModifiers = sizePicker ? pickedModifiers(pickerGroups, sizePicker.picks) : []
  const pickerReady = !!pickerVariant && pickerGroups.every((g) => groupSatisfied(g, sizePicker?.picks[g.id]?.length ?? 0))

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col overflow-hidden bg-surface-2" style={CAFE_ACCENT}>
      <OfflineBanner />
      <ShortcutsHelp open={showShortcuts} onClose={() => setShowShortcuts(false)} hints={shortcutHints} />
      <ConfirmModal
        open={confirmClearCart}
        onClose={() => setConfirmClearCart(false)}
        onConfirm={() => {
          setCart([])
          clearDraft(branchId)
          setQtyEdit(null)
          setConfirmClearCart(false)
          lastLineRef.current = null
          setCallName('')
          callNameAutoRef.current = ''
          setDiscountInput('')
          setShowDiscount(false)
          clearDiscountCode()
        }}
        title="تفريغ السلة"
        message="سيتم حذف كل الأصناف من السلة. هل تريد المتابعة؟"
        confirmLabel="تفريغ"
        confirmVariant="danger"
      />
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface px-3 py-2.5 shadow-sm sm:px-5 sm:py-3">
        <div className="flex items-center gap-3">
          <Coffee className="h-5 w-5 text-brand-ink" />
          <h1 className="text-base font-bold text-fg">{t.pos.title}</h1>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {lastKitchenTicket && (
            <button
              onClick={repeatLastOrder}
              title={`${t.pos.repeatLast} (F4)`}
              aria-label={t.pos.repeatLast}
              className="flex min-h-9 items-center gap-1.5 rounded-xl border border-brand/40 px-3 py-1.5 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand/10"
            >
              <RotateCcw className="h-4 w-4" />
              <span className="hidden sm:inline">{t.pos.repeatLast}</span>
            </button>
          )}
          {lastKitchenTicket && (
            <button
              onClick={() => setShowKitchenTicket(true)}
              title={`إعادة طباعة تذكرة المطبخ #${lastKitchenTicket.ticketNo}`}
              className="flex min-h-9 items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-sm font-semibold text-fg transition-colors hover:bg-surface-2"
            >
              <ChefHat className="h-4 w-4 text-brand-strong" />
              <span className="tabular-nums" dir="ltr">#{lastKitchenTicket.ticketNo}</span>
            </button>
          )}
          {/* The pickup screen runs on its own TV, so it opens in a new tab. */}
          <a
            href="/cafe/ready"
            target="_blank"
            rel="noopener noreferrer"
            title={t.pos.readyDisplay}
            aria-label={t.pos.readyDisplay}
            className="flex min-h-9 items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-sm font-semibold text-fg transition-colors hover:bg-surface-2"
          >
            <Megaphone className="h-4 w-4 text-brand-strong" />
            <span className="hidden sm:inline">{t.pos.readyDisplay}</span>
          </a>
          {aiCashierAvailable && (
            <button
              onClick={() => setAiCashierActive((v) => !v)}
              title="كاشير AI"
              className={cn(
                'flex min-h-9 items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors',
                aiCashierActive
                  ? 'bg-brand text-brand-fg'
                  : 'border border-brand/40 text-brand-ink hover:bg-brand/10',
              )}
            >
              <Bot className="h-4 w-4" />
              <span className="hidden sm:inline">كاشير AI</span>
            </button>
          )}
          {shift ? (
            <ShiftBadge shift={shift} onCloseShift={() => setShowCloseShift(true)} />
          ) : (
            <button
              onClick={() => setShowOpenShift(true)}
              className="min-h-9 rounded-xl bg-brand px-4 py-1.5 text-sm font-semibold text-brand-fg"
            >
              {t.shiftGate.openShift}
            </button>
          )}
        </div>
      </div>

      <ShiftGate onOpenShift={() => setShowOpenShift(true)} onCloseShift={() => setShowCloseShift(true)}>
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* ── Cart: a side column at the start edge from md up (right in RTL), a bottom sheet below it ── */}
          {cartOpen && (
            <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setCartOpen(false)} aria-hidden="true" />
          )}
          <aside
            ref={cartSheetRef}
            id="cafe-cart"
            role={cartOpen ? 'dialog' : undefined}
            aria-modal={cartOpen || undefined}
            aria-label={cartOpen ? t.pos.currentOrder : undefined}
            // The till's F-keys keep working while the sheet is open.
            data-page-shortcuts={cartOpen || undefined}
            className={cn(
              'flex-col bg-surface',
              cartOpen
                ? 'fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] animate-float-up overflow-y-auto overscroll-contain rounded-t-2xl border-t border-border pb-[env(safe-area-inset-bottom)] shadow-2xl'
                : 'hidden',
              'md:static md:z-auto md:flex md:max-h-none md:w-72 md:flex-shrink-0 md:animate-none md:overflow-hidden md:rounded-none md:border-e md:border-t-0 md:pb-0 md:shadow-none lg:w-80',
            )}
          >
            {/* Sheet title and close, phones only */}
            <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border bg-surface px-3 py-2 md:hidden">
              <span className="text-sm font-bold text-fg">{t.pos.currentOrder}</span>
              <button
                type="button"
                onClick={() => setCartOpen(false)}
                aria-label={t.pos.closeCart}
                data-autofocus
                className="flex h-10 w-10 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-fg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {/* Order type toggle */}
            <div className="space-y-2 border-b border-border p-3">
              <div className="flex overflow-hidden rounded-xl border border-border">
                <button
                  onClick={() => pickOrderType('here')}
                  aria-pressed={orderType === 'here'}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 py-2 text-sm font-semibold transition-colors',
                    orderType === 'here'
                      ? 'bg-brand text-brand-fg'
                      : 'text-muted hover:bg-surface-2',
                  )}
                >
                  {t.pos.dineIn}
                </button>
                <button
                  onClick={() => pickOrderType('takeaway')}
                  aria-pressed={orderType === 'takeaway'}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 py-2 text-sm font-semibold transition-colors',
                    orderType === 'takeaway'
                      ? 'bg-brand text-brand-fg'
                      : 'text-muted hover:bg-surface-2',
                  )}
                >
                  <ShoppingBag className="h-3.5 w-3.5" />
                  {t.pos.takeaway}
                </button>
              </div>

              {orderType === 'here' && (
                <button
                  onClick={() => setShowTablePicker(true)}
                  className={cn(
                    'w-full rounded-xl border-2 py-2 text-sm font-bold transition-colors',
                    tableNumber
                      ? 'border-brand bg-brand-soft text-brand-ink'
                      : 'border-dashed border-brand/40 bg-brand-soft/60 text-brand-ink hover:border-brand',
                  )}
                >
                  {tableNumber ? `${t.pos.tableNumber} ${tableNumber} ✏️` : `+ ${t.pos.pickTable}`}
                </button>
              )}

              <label className="block">
                <span className="sr-only">{t.pos.callName}</span>
                <input
                  type="text"
                  value={callName}
                  onChange={(e) => setCallName(e.target.value)}
                  maxLength={CALL_NAME_MAX}
                  enterKeyHint="done"
                  autoComplete="off"
                  placeholder={t.pos.callNamePlaceholder}
                  title={t.pos.callName}
                  className="min-h-10 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold text-fg placeholder:font-normal placeholder:text-muted focus:border-brand focus:outline-none"
                />
              </label>
            </div>

            {/* Cart header; the sheet has its own title */}
            <div
              className="hidden border-b border-border px-4 py-2 md:block"
              style={{ background: 'linear-gradient(to left, color-mix(in srgb, var(--accent) 8%, transparent), transparent)' }}
            >
              <p className="text-sm font-bold text-fg">
                {t.pos.currentOrder}
                {orderType === 'takeaway' && <span className="mr-1 text-info">— {t.pos.takeaway}</span>}
                {orderType === 'here' && tableNumber && <span className="mr-1 text-brand-ink">— {t.pos.tableNumber} {tableNumber}</span>}
              </p>
            </div>

            {/* Cart items: the list scrolls in the side column; in the sheet the whole sheet scrolls */}
            <div className="space-y-2 p-3 md:min-h-0 md:flex-1 md:overflow-y-auto">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-14 text-muted/50">
                  <Coffee className="h-8 w-8" />
                  <p className="text-sm">{t.pos.addProducts}</p>
                  {lastKitchenTicket && (
                    <button
                      type="button"
                      onClick={repeatLastOrder}
                      className="mt-2 flex min-h-11 items-center gap-2 rounded-xl border border-brand/40 px-4 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand/10"
                    >
                      <RotateCcw className="h-4 w-4" />
                      {t.pos.repeatLast}
                      <kbd className="hidden rounded border border-border bg-surface-2 px-1 font-mono text-[10px] text-muted md:inline">F4</kbd>
                    </button>
                  )}
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.lineKey}
                    className="rounded-xl border border-border bg-surface-2 p-3"
                  >
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-fg">
                          {shownProduct(item)}
                        </p>
                        {!isPlainVariant(item.variantName, item.productName) && (
                          <p className="text-xs text-muted">{shownSize(item)}</p>
                        )}
                        {item.modifiers.length > 0 && (
                          <p className="text-xs font-medium text-brand-ink">{modifierSummary(shownModifiers(item.modifiers))}</p>
                        )}
                      </div>
                      <p className="shrink-0 text-sm font-bold tabular-nums" style={{ color: 'var(--accent)' }}>
                        {formatCurrency(item.unitPrice * item.quantity)}
                      </p>
                    </div>

                    {/* Quantity: 36px buttons with a 44px hit area (after:-inset-1); tapping the number types one */}
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateQty(item.lineKey, -1)}
                        aria-label={t.pos.qtyDecrease}
                        className={QTY_BUTTON}
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      {qtyEdit?.lineKey === item.lineKey ? (
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          autoFocus
                          value={qtyEdit.text}
                          onFocus={(e) => e.currentTarget.select()}
                          onChange={(e) => setQtyEdit({ lineKey: item.lineKey, text: e.target.value.replace(/[^0-9٠-٩۰-۹]/g, '').slice(0, 3) })}
                          onBlur={commitQty}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); commitQty() }
                            else if (e.key === 'Escape') { e.preventDefault(); setQtyEdit(null) }
                          }}
                          aria-label={t.pos.qtyLabel}
                          className="h-9 w-14 shrink-0 rounded-lg border border-brand bg-surface text-center text-base font-bold tabular-nums text-fg outline-none focus:ring-2 focus:ring-brand/40"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setQtyEdit({ lineKey: item.lineKey, text: String(item.quantity) })}
                          aria-label={`${t.pos.qtyLabel}: ${item.quantity}`}
                          title={t.pos.qtyTapToType}
                          className={cn(HIT_AREA, 'h-9 min-w-14 shrink-0 rounded-lg px-2 text-base font-bold tabular-nums text-fg hover:bg-surface')}
                        >
                          {item.quantity}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => updateQty(item.lineKey, 1)}
                        aria-label={t.pos.qtyIncrease}
                        className={QTY_BUTTON}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeItem(item.lineKey)}
                        aria-label={t.pos.removeLine}
                        className={cn(HIT_AREA, 'ms-auto h-9 w-9 shrink-0 rounded-lg text-danger hover:bg-danger/10 dark:hover:bg-danger/15')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Per-item notes */}
                    {editingNoteId === item.lineKey ? (
                      <input
                        type="text"
                        value={item.notes}
                        maxLength={200}
                        onChange={(e) => updateNote(item.lineKey, e.target.value)}
                        onBlur={finishNote}
                        onKeyDown={(e) => e.key === 'Enter' && finishNote()}
                        autoFocus
                        placeholder={t.pos.kitchenNotePlaceholder}
                        className="mt-1.5 w-full rounded-lg border border-brand/40 bg-brand-soft px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-brand/40"
                      />
                    ) : (
                      <button
                        onClick={() => setEditingNoteId(item.lineKey)}
                        className="mt-1 flex min-h-8 items-center gap-1 text-xs text-muted hover:text-brand-ink transition-colors"
                      >
                        <MessageSquare className="h-3 w-3" />
                        {item.notes ? (
                          <span className="font-medium text-brand-ink">{item.notes}</span>
                        ) : t.pos.addNoteShort}
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Totals & checkout */}
            {cart.length > 0 && (
              <div className="border-t border-border p-4 space-y-3">
                <LoyaltyPanel
                  customer={loyaltyCustomer}
                  onCustomerChange={setLoyaltyCustomer}
                  redeemPoints={appliedPoints}
                  onRedeemPointsChange={setRedeemPoints}
                  maxRedeemable={maxRedeemable}
                  earnBase={grandTotal}
                  rules={loyaltyRules}
                />
                {appliedCode ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 rounded-xl border border-success/40 bg-success/10 px-2.5 py-1.5">
                      <TicketPercent className="h-4 w-4 shrink-0 text-success" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-success">
                          <bdi>{appliedCodeName(appliedCode)}</bdi>
                          {' · '}
                          <span className="tabular-nums">
                            {appliedCode.type === 'Percentage' ? `${appliedCode.value.toLocaleString(intlLocale())}٪` : formatCurrency(appliedCode.value)}
                          </span>
                        </p>
                        {appliedCode.label && (
                          <bdi dir="ltr" className="block truncate font-mono text-[11px] text-muted">{appliedCode.code}</bdi>
                        )}
                      </div>
                      <button
                        onClick={clearDiscountCode}
                        title={t.pos.removeCode}
                        aria-label={t.pos.removeCode}
                        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted after:absolute after:-inset-1 hover:bg-surface hover:text-fg"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="text-[11px] text-muted">{t.pos.codeOneDiscount}</p>
                  </div>
                ) : (
                <>
                {(showDiscount || discountInput) && (
                  <div className="space-y-1.5 rounded-xl border border-border bg-surface-2 p-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex overflow-hidden rounded-lg border border-border bg-surface">
                        {(['Percentage', 'Fixed'] as DiscountMode[]).map((m) => (
                          <button
                            key={m}
                            onClick={() => setDiscountMode(m)}
                            className={cn(
                              'px-2.5 py-1 text-xs font-semibold transition-colors',
                              discountMode === m ? 'bg-brand text-brand-fg' : 'text-muted hover:bg-surface-2',
                            )}
                          >
                            {m === 'Percentage' ? '٪' : 'ر.س'}
                          </button>
                        ))}
                      </div>
                      <input
                        type="number"
                        min="0"
                        step={discountMode === 'Percentage' ? '1' : '0.5'}
                        max={discountMode === 'Percentage' ? 100 : undefined}
                        inputMode="decimal"
                        autoFocus={!discountInput}
                        placeholder={discountMode === 'Percentage' ? 'نسبة الخصم' : 'مبلغ الخصم'}
                        value={discountInput}
                        onChange={(e) => setDiscountInput(e.target.value)}
                        aria-label="قيمة الخصم"
                        className="w-full min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 py-1 text-sm tabular-nums text-fg outline-none focus:border-brand"
                      />
                      <button
                        onClick={() => { setDiscountInput(''); setShowDiscount(false) }}
                        title="إلغاء الخصم"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-fg"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {needsPin ? (
                      <label className="block">
                        <span className="mb-1 block text-[11px] font-medium text-warning">
                          الخصم أكبر من حد الكاشير ({discountCap}٪) — رمز المدير
                        </span>
                        <input
                          type="password"
                          inputMode="numeric"
                          autoComplete="off"
                          maxLength={8}
                          value={approvalPin}
                          onChange={(e) => setApprovalPin(e.target.value.replace(/\D/g, ''))}
                          placeholder="••••"
                          aria-label="رمز موافقة المدير"
                          className="input-3d w-full py-1.5 text-sm tabular-nums"
                        />
                      </label>
                    ) : discountOverCap ? (
                      <p className="text-[11px] font-medium text-danger">
                        أقصى خصم للكاشير {discountCap}٪ — الأعلى يحتاج المدير
                      </p>
                    ) : !isManager ? (
                      <p className="text-[11px] text-muted">حتى {discountCap}٪ من الفاتورة</p>
                    ) : null}
                  </div>
                )}
                {showCodeInput ? (
                  <div className="space-y-1.5 rounded-xl border border-border bg-surface-2 p-2.5">
                    <div className="flex items-center gap-2">
                      <TicketPercent className="h-4 w-4 shrink-0 text-muted" />
                      <input
                        type="text"
                        dir="ltr"
                        autoFocus
                        autoComplete="off"
                        autoCapitalize="characters"
                        spellCheck={false}
                        maxLength={32}
                        placeholder={t.pos.discountCodePlaceholder}
                        value={codeInput}
                        onChange={(e) => { setCodeInput(e.target.value.toUpperCase()); setCodeError(null) }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); void applyDiscountCode() }
                          if (e.key === 'Escape') { e.stopPropagation(); clearDiscountCode() }
                        }}
                        aria-label={t.pos.discountCode}
                        aria-invalid={codeError ? true : undefined}
                        className="w-full min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 py-1.5 font-mono text-sm text-fg outline-none focus:border-brand"
                      />
                      <button
                        onClick={() => void applyDiscountCode()}
                        disabled={!codeInput.trim() || codeChecking}
                        className="flex h-9 min-w-[3.5rem] shrink-0 items-center justify-center rounded-lg bg-brand px-3 text-xs font-semibold text-brand-fg transition-colors hover:bg-brand/90 disabled:opacity-50"
                      >
                        {codeChecking ? <Loader2 className="h-4 w-4 animate-spin" /> : t.pos.applyCode}
                      </button>
                      <button
                        onClick={clearDiscountCode}
                        title={t.common.cancel}
                        aria-label={t.common.cancel}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-fg"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {codeError && <p role="alert" className="text-[11px] font-medium text-danger">{codeError}</p>}
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    {!(showDiscount || discountInput) && (
                      <button
                        onClick={() => setShowDiscount(true)}
                        className="flex min-h-8 items-center gap-1 text-xs font-medium text-muted transition-colors hover:text-brand-ink"
                      >
                        <Percent className="h-3 w-3" />
                        {t.pos.addDiscountShort}
                      </button>
                    )}
                    <button
                      onClick={() => { setShowCodeInput(true); setCodeError(null) }}
                      className="flex min-h-8 items-center gap-1 text-xs font-medium text-muted transition-colors hover:text-brand-ink"
                    >
                      <TicketPercent className="h-3 w-3" />
                      {t.pos.discountCode}
                    </button>
                  </div>
                )}
                </>
                )}
                {/* Discounts come off the listed prices first; net and VAT below are of what is left, as on the receipt. */}
                <div className="space-y-1 text-sm">
                  {/* Without VAT there is no net or VAT row: the listed prices, the discounts and the total. */}
                  {!vat.enabled && (discountGross > 0 || appliedPoints > 0) && (
                    <div className="flex justify-between text-muted">
                      <span>{t.pos.subtotal}</span>
                      <span className="tabular-nums">{formatCurrency(cartTotal)}</span>
                    </div>
                  )}
                  {discountGross > 0 && (
                    <div className="flex justify-between text-success">
                      <span>
                        الخصم
                        {appliedCode && <> (<bdi>{appliedCodeName(appliedCode)}</bdi>)</>}
                        {discountKind === 'Percentage' ? ` ${Math.min(discountRaw, 100).toLocaleString(intlLocale())}٪` : ''}
                      </span>
                      <span className="tabular-nums">−{formatCurrency(discountGross)}</span>
                    </div>
                  )}
                  {appliedPoints > 0 && (
                    <div className="flex justify-between text-success">
                      <span>خصم النقاط</span>
                      <span className="tabular-nums">−{formatCurrency(loyaltyDiscount)}</span>
                    </div>
                  )}
                  {vat.enabled && (
                    <>
                      <div className="flex justify-between text-muted">
                        <span>{t.pos.subtotal}</span>
                        <span className="tabular-nums">{formatCurrency(subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-muted">
                        <span>{t.pos.tax}</span>
                        <span className="tabular-nums">{formatCurrency(tax)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between text-base font-bold text-fg">
                    <span>{t.pos.total}</span>
                    <span className="tabular-nums">{formatCurrency(grandTotal)}</span>
                  </div>
                </div>

                {/* Payment mode */}
                <div className="flex overflow-hidden rounded-xl border border-border">
                  {(['Cash', 'Card', 'Split'] as PayMode[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => { setPayMode(m); setSplitCash(''); setSplitCard(''); setSplitCardTyped(false) }}
                      className={cn(
                        'flex flex-1 items-center justify-center gap-1 py-2 text-xs font-medium transition-colors',
                        payMode === m
                          ? 'bg-brand text-brand-fg'
                          : 'text-muted hover:bg-surface-2',
                      )}
                    >
                      {m === 'Cash' && <Banknote className="h-3 w-3" />}
                      {m === 'Card' && <CreditCard className="h-3 w-3" />}
                      {m === 'Split' && <span className="text-[10px] font-bold">½</span>}
                      {m === 'Cash' ? t.pos.cash : m === 'Card' ? t.pos.card : t.pos.split}
                    </button>
                  ))}
                </div>

                {/* Split inputs */}
                {payMode === 'Cash' && (
                  <CashTender total={grandTotal} value={cashTendered} onChange={setCashTendered} compact />
                )}

                {payMode === 'Split' && (
                  <div className="space-y-2 rounded-xl border border-dashed border-brand/40 bg-brand/5 p-3">
                    <p className="text-center text-xs font-semibold text-muted">
                      {t.pos.total}: {(grandTotal).toFixed(2)} ر.س
                    </p>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="mb-1 block text-[10px] font-medium text-muted">{t.pos.splitCash}</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={splitCash}
                          onChange={(e) => {
                            setSplitCash(e.target.value)
                            if (splitCardTyped) return
                            const cash = parseFloat(e.target.value) || 0
                            const remaining = grandTotal - cash
                            setSplitCard(remaining > 0 ? remaining.toFixed(2) : '')
                          }}
                          className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm tabular-nums outline-none focus:border-brand"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="mb-1 block text-[10px] font-medium text-muted">{t.pos.splitCard}</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={splitCard}
                          onChange={(e) => {
                            setSplitCard(e.target.value)
                            setSplitCardTyped(e.target.value !== '')
                            const card = parseFloat(e.target.value) || 0
                            const remaining = grandTotal - card
                            setSplitCash(remaining > 0 ? remaining.toFixed(2) : '')
                          }}
                          className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm tabular-nums outline-none focus:border-brand"
                        />
                      </div>
                    </div>
                    {splitCardNum > 0 && splitCashDue > 0 && splitCash !== '' && (
                      splitChange >= 0 ? (
                        <div className="flex items-baseline justify-between rounded-lg bg-success/10 px-3 py-1.5" aria-live="polite">
                          <span className="text-xs font-medium text-success">{t.pos.splitChange}</span>
                          <span className="text-lg font-bold tabular-nums text-success">{formatCurrency(splitChange)}</span>
                        </div>
                      ) : (
                        <div role="alert" className="flex items-baseline justify-between rounded-lg bg-danger/10 px-3 py-1.5">
                          <span className="text-xs font-medium text-danger">{t.pos.splitCashShort}</span>
                          <span className="text-lg font-bold tabular-nums text-danger">{formatCurrency(-splitChange)}</span>
                        </div>
                      )
                    )}
                    {splitCardNum > 0 && splitCashDue <= 0 && (
                      <p role="alert" className="text-center text-[10px] font-semibold text-danger">{t.pos.splitCardTooHigh}</p>
                    )}
                  </div>
                )}

                <button
                  onClick={() => checkout.mutate({ mode: payMode })}
                  disabled={checkout.isPending || !canCheckout}
                  className="bg-brand w-full rounded-xl py-3 text-sm font-bold text-brand-fg transition-all disabled:opacity-50"
                >
                  {checkout.isPending ? t.common.loading : t.pos.checkout}
                </button>
              </div>
            )}
          </aside>

          {/* ── Products area ── */}
          <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
            {/* Category tabs */}
            <div className="flex gap-2 overflow-x-auto border-b border-border bg-surface px-4 py-3">
              <button
                onClick={() => setSelectedCategoryId('all')}
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-full transition-all whitespace-nowrap',
                  selectedCategoryId === 'all'
                    ? 'bg-brand text-brand-fg shadow-sm'
                    : 'text-muted hover:text-fg hover:bg-surface-2',
                )}
              >
                {t.pos.allCategories}
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCategoryId(c.id)}
                  className={cn(
                    'px-4 py-2 text-sm font-medium rounded-full transition-all whitespace-nowrap',
                    selectedCategoryId === c.id
                      ? 'bg-brand text-brand-fg shadow-sm'
                      : 'text-muted hover:text-fg hover:bg-surface-2',
                  )}
                >
                  {localName(c, lang)}
                </button>
              ))}
              {isGamingLounge && (
                <button
                  onClick={() => setSelectedCategoryId('__gaming__')}
                  className={cn(
                    'flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-full transition-all whitespace-nowrap',
                    selectedCategoryId === '__gaming__'
                      ? 'bg-brand text-brand-fg shadow-sm'
                      : 'text-muted hover:text-fg hover:bg-surface-2',
                  )}
                >
                  <Gamepad2 className="h-3.5 w-3.5" />
                  الألعاب
                  {gamingAlertCounts.expired > 0 ? (
                    <span className="rounded-full bg-danger px-1.5 text-[11px] font-bold leading-5 text-white tabular-nums" aria-label={`${gamingAlertCounts.expired} جلسة انتهى وقتها`}>
                      {gamingAlertCounts.expired}
                    </span>
                  ) : gamingAlertCounts.warning > 0 ? (
                    <span className="rounded-full bg-warning px-1.5 text-[11px] font-bold leading-5 text-white tabular-nums" aria-label={`${gamingAlertCounts.warning} جلسة قاربت على الانتهاء`}>
                      {gamingAlertCounts.warning}
                    </span>
                  ) : null}
                </button>
              )}
            </div>

            {isGamingLounge && (
              <GamingTimeAlerts
                stations={stations}
                onCountsChange={setGamingAlertCounts}
                onOpenGaming={() => setSelectedCategoryId('__gaming__')}
                showBanner={selectedCategoryId !== '__gaming__'}
              />
            )}

            {/* Gaming stations panel */}
            {selectedCategoryId === '__gaming__' && (
              <div className="flex-1 overflow-y-auto p-4">
                {stations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted/50">
                    <Gamepad2 className="h-10 w-10" />
                    <p className="text-sm">لا توجد محطات ألعاب</p>
                    <p className="text-xs text-muted">أضف محطات من صفحة الألعاب أولاً</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {stations.map((station) => (
                      <div
                        key={station.id}
                        className={cn(
                          'relative flex flex-col rounded-xl border-2 p-4 transition-all',
                          station.status === 'Available'
                            ? 'border-success/30 bg-success/10 dark:border-success/60 dark:bg-success/15'
                            : station.status === 'InUse'
                            ? 'border-brand/40 bg-brand-soft'
                            : 'border-border bg-surface-2',
                        )}
                      >
                        {/* Station header */}
                        <div className="mb-2 flex items-start justify-between">
                          <div>
                            <p className="text-xl">{STATION_ICON[station.type] ?? '🎮'}</p>
                            <p className="text-sm font-bold text-fg">{station.name}</p>
                            <p className="text-xs text-muted">{station.type}</p>
                          </div>
                          <span className={cn(
                            'rounded-full px-2 py-0.5 text-xs font-semibold',
                            station.status === 'Available'
                              ? 'bg-success/10 text-success dark:bg-success/15'
                              : station.status === 'InUse'
                              ? 'bg-brand-soft text-brand-ink'
                              : 'bg-surface-2 text-muted',
                          )}>
                            {station.status === 'Available' ? 'متاح' : station.status === 'InUse' ? 'شاغل' : 'صيانة'}
                          </span>
                        </div>

                        {/* Hourly rate */}
                        <p className="mb-3 text-sm font-semibold text-brand-ink">
                          {formatCurrency(station.hourlyRate)} / ساعة
                        </p>

                        {/* Active session info */}
                        {station.status === 'InUse' && station.activeSession && (() => {
                          const left = sessionSecondsLeft(station.activeSession, gamingNow)
                          if (left === null) return null
                          return (
                            <div
                              className={cn(
                                'mb-2 flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-bold',
                                left <= 0 ? 'bg-danger/15 text-danger' : left <= WARNING_SECONDS ? 'bg-warning/15 text-warning' : 'bg-surface text-muted',
                              )}
                            >
                              <span>{left <= 0 ? 'انتهى الوقت' : 'المتبقي'}</span>
                              <span className="font-mono tabular-nums">{left <= 0 ? '+' : ''}{formatClock(left)}</span>
                            </div>
                          )
                        })()}
                        {station.status === 'InUse' && station.activeSession && (
                          <div className="mb-3 rounded-lg bg-brand-soft/60 p-2.5">
                            <p className="text-xs font-semibold text-brand-ink">
                              👤 {station.activeSession.playerName}
                              {station.activeSession.packageName && (
                                <span className="ms-1.5 rounded-full bg-surface px-1.5 py-0.5 text-[10px] text-muted">
                                  {station.activeSession.packageName}
                                </span>
                              )}
                            </p>
                            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-brand-ink">
                              <Clock className="h-3 w-3" />
                              <span className="font-mono tabular-nums font-bold">
                                {formatElapsed(station.activeSession.startTime)}
                              </span>
                              <span className="mr-auto font-bold">
                                {formatCurrency(elapsedSAR(station.activeSession.startTime, station.activeSession.ratePerHour))}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Actions */}
                        {station.status === 'Available' && (
                          <button
                            onClick={() => setStartSessionForm({
                              stationId: station.id,
                              stationName: station.name,
                              stationTypeKey: station.type,
                              stationRate: station.hourlyRate,
                              hourlyRate: station.hourlyRate,
                              playerName: '',
                              durationMinutes: 60,
                            })}
                            className="mt-auto flex items-center justify-center gap-1.5 rounded-xl bg-success py-2 text-sm font-bold text-white hover:bg-success transition-colors"
                          >
                            <Play className="h-3.5 w-3.5" />
                            ابدأ جلسة
                          </button>
                        )}
                        {station.status === 'InUse' && station.activeSession && (
                          <div className="mb-2 grid grid-cols-2 gap-1.5">
                            {[30, 60].map((m) => (
                              <button
                                key={m}
                                onClick={() => extendSessionMut.mutate({ sessionId: station.activeSession!.sessionId, minutes: m })}
                                disabled={extendSessionMut.isPending}
                                className="rounded-lg border border-border bg-surface py-1.5 text-xs font-semibold text-fg hover:bg-surface-2 disabled:opacity-50"
                              >
                                +{m === 60 ? 'ساعة' : '30 د'}
                              </button>
                            ))}
                          </div>
                        )}
                        {station.status === 'InUse' && station.activeSession && (
                          <button
                            onClick={() => endSessionMut.mutate(station.activeSession!.sessionId)}
                            disabled={endSessionMut.isPending}
                            className="mt-auto flex items-center justify-center gap-1.5 rounded-xl bg-danger py-2 text-sm font-bold text-white hover:bg-danger transition-colors disabled:opacity-50"
                          >
                            <Square className="h-3.5 w-3.5 fill-current" />
                            إنهاء وادفع
                          </button>
                        )}
                        {station.status === 'Maintenance' && (
                          <p className="mt-auto text-center text-xs text-muted">في الصيانة</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {selectedCategoryId !== '__gaming__' && (
              <div className="flex items-center gap-2 border-b border-border bg-surface px-4 py-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <input
                    ref={searchInputRef}
                    className="input ps-9 text-sm"
                    placeholder={t.pos.searchAndEnter}
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addFirstMatch()
                      } else if (e.key === 'Escape' && productSearch) {
                        e.preventDefault()
                        setProductSearch('')
                      }
                    }}
                    aria-label={t.pos.searchProductLabel}
                  />
                </div>
                <ShortcutsHelpButton onClick={() => setShowShortcuts(true)} />
              </div>
            )}

            {/* Product grid */}
            {selectedCategoryId !== '__gaming__' && (
            <div className="flex-1 overflow-y-auto p-4">
              {productsLoading ? (
                <div className={PRODUCT_GRID}>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="h-28 animate-pulse rounded-xl bg-border" />
                  ))}
                </div>
              ) : products.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted/50">
                  <Coffee className="h-10 w-10" />
                  <p className="text-sm">{searchTerm ? 'لا يوجد منتج مطابق' : 'لا توجد منتجات'}</p>
                  {!searchTerm && <p className="text-xs text-muted">أضف منتجات من صفحة المنتجات أولاً</p>}
                </div>
              ) : (
                <div className={PRODUCT_GRID}>
                  {products.map((product) => {
                    // One tile per drink: a single size shows its price, several show the lowest as "from".
                    const sizes = product.variants.filter((v) => v.isActive)
                    const only = sizes.length === 1 ? sizes[0] : null
                    const lowest = Math.min(...sizes.map((v) => v.salePrice))
                    // Sold out only when every size is; a drink with one size left still opens its picker.
                    const soldOut = sizes.every((v) => isSoldOut(v.id))
                    return (
                      <button
                        key={product.id}
                        onClick={() => openProduct(product)}
                        disabled={soldOut}
                        aria-label={soldOut ? `${localName(product, lang)} · ${t.pos.soldOut}` : undefined}
                        className={cn(
                          'group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-surface p-2.5 text-start transition-all duration-200',
                          soldOut
                            ? 'cursor-not-allowed'
                            : 'hover:-translate-y-0.5 hover:border-brand hover:shadow-md active:translate-y-0 active:scale-[0.98]',
                        )}
                      >
                        {soldOut && (
                          <span className="absolute end-4 top-4 z-10 rounded-full border border-danger/30 bg-surface px-2 py-0.5 text-xs font-bold text-danger shadow-sm">
                            {t.pos.soldOut}
                          </span>
                        )}
                        {/* product art: the photo when there is one, otherwise its initial on a mint tile */}
                        <span className={cn(
                          'mb-2.5 flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl bg-brand-soft font-display text-3xl font-semibold text-brand-ink transition-colors duration-200',
                          soldOut ? 'opacity-40 grayscale' : 'group-hover:bg-brand group-hover:text-brand-fg',
                        )}>
                          {product.imageUrl ? (
                            <img src={product.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                          ) : (
                            localName(product, lang).trim().charAt(0)
                          )}
                        </span>
                        <p className={cn('px-0.5 text-sm font-semibold leading-snug', soldOut ? 'text-muted' : 'text-fg')}>
                          {localName(product, lang)}
                        </p>
                        {only ? (
                          !isPlainVariant(only.name, product.name) && (
                            <p className="px-0.5 text-xs text-muted">{localName(only, lang)}</p>
                          )
                        ) : (
                          <p className="px-0.5 text-xs text-muted">{t.pos.sizesCount.replace('{n}', String(sizes.length))}</p>
                        )}
                        <p className={cn('mt-auto px-0.5 pt-2 font-display text-sm font-semibold tabular-nums', soldOut ? 'text-muted line-through' : 'text-brand-ink')}>
                          {only ? formatCurrency(only.salePrice) : t.pos.fromPrice.replace('{price}', formatCurrency(lowest))}
                        </p>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
            )}

            {/* ── Phones: the order total stays in reach; tapping it opens the cart sheet ── */}
            <div className="shrink-0 border-t border-border bg-surface p-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] md:hidden">
              <button
                type="button"
                onClick={() => setCartOpen(true)}
                aria-controls="cafe-cart"
                aria-expanded={cartOpen}
                className="flex h-12 w-full items-center justify-between gap-3 rounded-xl bg-brand px-4 text-brand-fg shadow-sm transition-transform active:scale-[0.99]"
              >
                <span className="flex items-center gap-2 text-sm font-bold">
                  <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-brand-fg/20 px-1.5 text-sm tabular-nums" aria-hidden="true">
                    {cartCount}
                  </span>
                  <span className="sr-only">{t.pos.itemsInCart.replace('{n}', String(cartCount))}</span>
                  {t.pos.viewOrder}
                </span>
                <span className="text-base font-bold tabular-nums">{formatCurrency(grandTotal)}</span>
              </button>
            </div>
          </main>
        </div>
      </ShiftGate>

      {/* ── Size and add-on picker: the last size and add-ons sold here are preselected. Without add-ons the last
          size is focused, so Enter or one tap adds it; with add-ons the chips are picked and 'أضف للطلب' adds the drink. ── */}
      <Modal
        open={!!sizePicker}
        onClose={() => setSizePicker(null)}
        title={sizePicker
          ? pickerGroups.length > 0 ? localName(sizePicker.product, lang) : `${t.pos.pickSize} · ${localName(sizePicker.product, lang)}`
          : t.pos.pickSize}
        size="md"
        footer={sizePicker && pickerGroups.length > 0 && pickerVariant ? (
          <Button
            size="lg"
            className="w-full"
            onClick={addPicked}
            disabled={!pickerReady}
            data-autofocus={pickerReady || undefined}
          >
            {t.pos.addToOrder} · {formatCurrency(unitPriceWith(pickerVariant.salePrice, pickerModifiers))}
          </Button>
        ) : undefined}
      >
        {sizePicker && (
          <div className="space-y-5">
            {(pickerGroups.length === 0 || pickerSizes.length > 1) && (
              <section aria-label={t.pos.pickSize}>
                {pickerGroups.length > 0 && <h3 className="mb-2 text-sm font-semibold text-muted">{t.pos.pickSize}</h3>}
                <div
                  className="grid grid-cols-2 gap-3 sm:grid-cols-3"
                  onKeyDown={(e) => {
                    // Arrow keys walk the sizes; Enter presses the focused one.
                    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return
                    const buttons = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button'))
                    const at = buttons.indexOf(document.activeElement as HTMLButtonElement)
                    if (at === -1 || buttons.length === 0) return
                    e.preventDefault()
                    const rtl = getComputedStyle(e.currentTarget).direction === 'rtl'
                    const forward = e.key === 'ArrowDown' || e.key === (rtl ? 'ArrowLeft' : 'ArrowRight')
                    buttons[(at + (forward ? 1 : buttons.length - 1)) % buttons.length].focus()
                  }}
                >
                  {pickerSizes.map((v) => {
                    const selected = v.id === sizePicker.selectedId
                    const out = !canAddMore(v.id)
                    return (
                      <button
                        key={v.id}
                        type="button"
                        data-autofocus={(selected && (pickerGroups.length === 0 || !pickerReady)) || undefined}
                        aria-pressed={pickerGroups.length > 0 ? selected : undefined}
                        onClick={() => pickSize(v.id)}
                        className={cn(
                          'flex min-h-24 flex-col items-center justify-center gap-1 rounded-2xl border-2 p-4 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
                          selected ? 'border-brand bg-brand-soft' : 'border-border bg-surface hover:border-brand',
                          out && 'opacity-50',
                        )}
                      >
                        <span className="text-lg font-bold leading-snug text-fg">
                          {isPlainVariant(v.name, sizePicker.product.name) ? localName(sizePicker.product, lang) : localName(v, lang)}
                        </span>
                        <span className="font-display text-base font-semibold tabular-nums text-brand-ink">
                          {formatCurrency(v.salePrice)}
                        </span>
                        {out && <span className="text-xs font-medium text-danger">{t.pos.sizeOutOfStock}</span>}
                      </button>
                    )
                  })}
                </div>
              </section>
            )}

            {/* One row of chips per add-on group, in the order the owner set; prices include VAT. */}
            {pickerGroups.map((group) => {
              const picked = sizePicker.picks[group.id] ?? []
              const met = groupSatisfied(group, picked.length)
              const full = group.maxSelect > 1 && picked.length >= group.maxSelect
              return (
                <section key={group.id} aria-labelledby={`addon-group-${group.id}`}>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h3 id={`addon-group-${group.id}`} className="text-base font-bold text-fg">{localName(group, lang)}</h3>
                    <span className={cn(
                      'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                      group.isRequired && !met ? 'bg-warning/15 text-warning' : 'bg-surface-2 text-muted',
                    )}>
                      {group.isRequired ? `${t.pos.addOnRequired} · ` : ''}{groupRule(group, t.products)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {group.options.map((o) => {
                      const on = picked.includes(o.id)
                      const delta = grossDelta(o.priceDelta)
                      return (
                        <button
                          key={o.id}
                          type="button"
                          aria-pressed={on}
                          disabled={!on && full}
                          onClick={() => togglePick(group, o.id)}
                          className={cn(
                            'flex min-h-11 items-center gap-2 rounded-full border-2 px-4 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50',
                            on ? 'border-brand bg-brand-soft text-brand-ink' : 'border-border bg-surface text-fg hover:border-brand',
                          )}
                        >
                          <span>{localName(o, lang)}</span>
                          <span className={cn('text-xs tabular-nums', on ? 'text-brand-ink' : 'text-muted')}>
                            {delta > 0 ? `+${formatCurrency(delta)}` : t.products.free}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </Modal>

      {/* ── Table Picker Modal ── */}
      {showTablePicker && (
        <OverlayDialog
          onClose={() => setShowTablePicker(false)}
          labelledBy="cafe-table-picker-title"
          backdropClassName="bg-black/50"
          panelClassName="w-72 rounded-2xl bg-surface shadow-2xl"
        >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h3 id="cafe-table-picker-title" className="font-bold text-fg">{t.pos.pickTable}</h3>
              <button onClick={() => setShowTablePicker(false)} className="text-muted hover:text-fg">
                <X className="h-4 w-4" />
              </button>
            </div>
            <TablePicker
              selected={tableNumber}
              onSelect={(n) => {
                setTableNumber(n)
                setShowTablePicker(false)
              }}
            />
        </OverlayDialog>
      )}

      {/* ── Shift Modals ── */}
      {showOpenShift && <OpenShiftModal onClose={() => setShowOpenShift(false)} />}
      {showCloseShift && shift && (
        <CloseShiftModal shift={shift} onClose={() => setShowCloseShift(false)} />
      )}

      {/* ── Customer Receipt (shown after checkout) ── */}
      {customerReceipt && (
        <CustomerReceiptModal
          receipt={customerReceipt}
          onClose={() => setCustomerReceipt(null)}
          onKitchenTicket={lastKitchenTicket ? () => { setCustomerReceipt(null); setShowKitchenTicket(true) } : undefined}
        />
      )}

      {/* ── Kitchen Ticket: a paper copy of the last sale's ticket for kitchens without a screen ── */}
      {showKitchenTicket && lastKitchenTicket && !customerReceipt && (
        <KitchenTicketModal ticket={lastKitchenTicket} onClose={() => setShowKitchenTicket(false)} />
      )}

      {/* ── Start Gaming Session Modal ── */}
      {startSessionForm && (
        <OverlayDialog
          onClose={() => setStartSessionForm(null)}
          labelledBy="cafe-start-session-title"
          closeOnBackdrop={false}
          panelClassName="w-80 rounded-2xl bg-surface shadow-2xl"
        >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">{STATION_ICON[startSessionForm.stationTypeKey] ?? '🎮'}</span>
                <h3 id="cafe-start-session-title" className="font-bold text-fg">{startSessionForm.stationName}</h3>
              </div>
              <button onClick={() => setStartSessionForm(null)} className="text-muted hover:text-fg">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 p-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-fg">اسم اللاعب</label>
                <input
                  type="text"
                  value={startSessionForm.playerName}
                  onChange={(e) => setStartSessionForm(f => f && { ...f, playerName: e.target.value })}
                  placeholder="أدخل اسم اللاعب"
                  autoFocus
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/40 text-fg"
                />
              </div>
              <PackagePicker
                stationType={startSessionForm.stationTypeKey}
                selectedId={startSessionForm.packageId ?? null}
                onSelect={(pkg) =>
                  setStartSessionForm((f) => f && (pkg
                    ? { ...f, packageId: pkg.id, packageName: pkg.name, packagePrice: pkg.price, durationMinutes: pkg.durationMinutes }
                    : { ...f, packageId: undefined, packageName: undefined, packagePrice: undefined }))
                }
              />
              {!startSessionForm.packageId && (
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-fg">المدة</label>
                <div className="mb-2 flex gap-1.5">
                  {[30, 60, 120, 180].map((m) => (
                    <button
                      key={m}
                      onClick={() => setStartSessionForm(f => f && { ...f, durationMinutes: m })}
                      className={cn(
                        'flex-1 rounded-lg py-1.5 text-xs font-bold transition-colors',
                        startSessionForm.durationMinutes === m
                          ? 'bg-brand text-brand-fg'
                          : 'border border-border text-muted hover:bg-surface-2',
                      )}
                    >
                      {m === 60 ? '1س' : m === 120 ? '2س' : m === 180 ? '3س' : '30د'}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    value={startSessionForm.durationMinutes}
                    onChange={(e) => setStartSessionForm(f => f && { ...f, durationMinutes: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm tabular-nums outline-none focus:border-brand text-fg"
                  />
                  <span className="shrink-0 text-xs text-muted">دقيقة</span>
                </div>
              </div>
              )}
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-fg">
                  {startSessionForm.packageId ? 'سعر الساعة للوقت الإضافي (ر.س)' : 'السعر / ساعة (ر.س)'}
                </label>
                {canManage ? (
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={startSessionForm.hourlyRate}
                  onChange={(e) => setStartSessionForm(f => f && { ...f, hourlyRate: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm tabular-nums outline-none focus:border-brand text-fg"
                />
                ) : (
                <div className="w-full rounded-xl bg-surface-2 px-3 py-2 text-sm font-semibold tabular-nums text-fg">
                  {formatCurrency(startSessionForm.stationRate)}
                </div>
                )}
              </div>
              <div className="rounded-xl bg-brand-soft py-3 text-center">
                <p className="text-xs text-muted">الإجمالي المتوقع</p>
                <p className="mt-0.5 text-2xl font-black tabular-nums text-brand-ink">
                  {formatCurrency(startSessionForm.packagePrice ?? (startSessionForm.durationMinutes / 60) * startSessionForm.hourlyRate)}
                </p>
                <p className="text-xs text-muted">
                  {startSessionForm.packageId
                    ? `${startSessionForm.packageName} · الإضافي ${formatCurrency(startSessionForm.hourlyRate)}/ساعة`
                    : `${startSessionForm.durationMinutes} د × ${formatCurrency(startSessionForm.hourlyRate)}/ساعة`}
                </p>
              </div>
            </div>
            <div className="flex gap-2 border-t border-border p-4">
              <button
                onClick={() => startSessionMut.mutate(startSessionForm)}
                disabled={startSessionMut.isPending || !startSessionForm.playerName.trim()}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand py-2.5 text-sm font-bold text-brand-fg hover:bg-brand/90 disabled:opacity-50 transition-colors"
              >
                <Play className="h-4 w-4" />
                {startSessionMut.isPending ? 'جارٍ البدء...' : 'ابدأ الجلسة'}
              </button>
              <button
                onClick={() => setStartSessionForm(null)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-semibold text-fg hover:bg-surface-2 transition-colors"
              >
                <X className="h-4 w-4" />
                إلغاء
              </button>
            </div>
        </OverlayDialog>
      )}

      {/* ── Gaming Bill Modal ── */}
      {gamingBill && (
        <OverlayDialog
          onClose={closeGamingBill}
          label="فاتورة جلسة ألعاب"
          closeOnBackdrop={false}
          panelClassName="w-80 rounded-2xl bg-surface shadow-2xl"
        >
            <div id="gaming-bill-print" className="p-5">
              <div className="mb-4 border-b border-dashed border-border pb-4 text-center">
                <div className="mb-1 text-3xl">{STATION_ICON[gamingBill.stationType] ?? '🎮'}</div>
                <p className="text-base font-black text-fg">فاتورة جلسة ألعاب</p>
                <p className="text-sm text-muted">{gamingBill.stationName}</p>
              </div>
              <div className="mb-4 space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">اللاعب</span>
                  <span className="font-semibold text-fg">{gamingBill.playerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">البداية</span>
                  <span className="tabular-nums text-fg">
                    {new Date(gamingBill.startTime).toLocaleTimeString(intlLocale(), { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">النهاية</span>
                  <span className="tabular-nums text-fg">
                    {new Date(gamingBill.endTime).toLocaleTimeString(intlLocale(), { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">المدة الفعلية</span>
                  <span className="font-semibold tabular-nums text-fg">
                    {gamingBill.actualDurationMinutes >= 60
                      ? `${Math.floor(gamingBill.actualDurationMinutes / 60)}س ${gamingBill.actualDurationMinutes % 60 > 0 ? `${gamingBill.actualDurationMinutes % 60}د` : ''}`
                      : `${gamingBill.actualDurationMinutes} دقيقة`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">السعر / ساعة</span>
                  <span className="tabular-nums text-fg">{formatCurrency(gamingBill.ratePerHour)}</span>
                </div>
              </div>
              <div className="mb-2 rounded-xl bg-brand-soft py-4 text-center">
                <PackageBillLines bill={gamingBill} />
                <p className="mt-2 text-xs text-muted">الإجمالي</p>
                <p className="mt-1 text-3xl font-black tabular-nums text-brand-ink">
                  {formatCurrency(gamingBill.totalAmount)}
                </p>
              </div>
            </div>
            <div className="space-y-2 border-t border-border p-4">
              <SessionPayButtons
                bill={gamingBill}
                onPaid={() => {
                  setGamingBill(null)
                  void refetchStations()
                }}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => printElement(document.getElementById('gaming-bill-print'))}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border py-2 text-sm font-semibold text-fg hover:bg-surface-2 transition-colors"
                >
                  <Printer className="h-4 w-4" />
                  طباعة
                </button>
                <button
                  onClick={closeGamingBill}
                  className="flex flex-1 items-center justify-center rounded-xl py-2 text-sm text-muted hover:bg-surface-2 hover:text-fg transition-colors"
                >
                  {gamingBill.paidAt ? 'إغلاق' : 'لاحقاً'}
                </button>
              </div>
            </div>
        </OverlayDialog>
      )}

      {/* ── AI Cashier Agent overlay ── */}
      {aiCashierActive && branchId && (
        <AiCashierAgent
          branchId={branchId}
          allProducts={allProducts}
          getCart={getAiCartSnapshot}
          onAddVariant={addVariantById}
          onSetQuantity={setVariantQtyById}
          onRemoveVariant={removeVariantById}
          onCompleteOrder={handleAiCompleteOrder}
          onDeactivate={() => setAiCashierActive(false)}
        />
      )}
    </div>
  )
}
