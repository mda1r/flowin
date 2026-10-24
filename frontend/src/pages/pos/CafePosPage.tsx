import { useState, useRef, useCallback, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  Coffee, ShoppingBag, ChefHat, X, Plus, Minus, Trash2,
  Printer, MessageSquare, CreditCard, Banknote, Bot, QrCode,
  Gamepad2, Clock, Play, Square,
} from 'lucide-react'
import { catalogApi } from '@/api/catalog'
import { ordersApi } from '@/api/orders'
import { inventoryApi } from '@/api/inventory'
import { zatcaApi } from '@/api/zatca'
import { useAuthStore } from '@/stores/authStore'
import { toast } from '@/components/ui/Toast'
import { formatCurrency, cn } from '@/lib/utils'
import { SAUDI_VAT_RATE, generateZatcaQr } from '@/lib/zatca'
import { useShift, ShiftGate, ShiftBadge, OpenShiftModal, CloseShiftModal } from './ShiftGate'
import { pushKitchenTicket } from '@/lib/cafeKitchen'
import { restaurantApi } from '@/api/restaurant'
import { aiCashierApi } from '@/api/aiCashier'
import { AiCashierAgent } from '@/components/cafe/AiCashierAgent'
import { gamingApi } from '@/api/gaming'
import type { PaymentMethod, CategoryResponse, ProductResponse, GameStationResponse, GameSessionBillResponse } from '@/types/api'
import { useI18n } from '@/i18n'

// ── Types ─────────────────────────────────────────────────────────────────────

interface StartSessionForm {
  stationId: string
  stationName: string
  stationTypeKey: string
  hourlyRate: number
  playerName: string
  durationMinutes: number
}

interface CafeCartItem {
  variantId: string
  productName: string
  variantName: string
  unitPrice: number
  costPrice: number
  quantity: number
  notes: string
}

interface KitchenTicketData {
  items: CafeCartItem[]
  orderType: 'here' | 'takeaway'
  tableNumber: number | null
  ticketNumber: number
}

interface CustomerReceiptData {
  orderId: string
  items: CafeCartItem[]
  grandTotal: number
  tax: number
  subtotal: number
  payMode: PayMode
  splitCash?: number
  splitCard?: number
  tableNumber: number | null
  orderType: 'here' | 'takeaway'
  completedAt: string
}

type PayMode = 'Cash' | 'Card' | 'Split'

const CAFE_ACCENT: React.CSSProperties = {
  '--accent-l': '#0B7A65',
  '--accent-d': '#3FD3B0',
} as React.CSSProperties

const TOTAL_TABLES = 16

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
              ? 'scale-95 border-brand bg-brand-soft text-brand'
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
  const now = new Date()
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" dir="rtl">
      <div className="w-80 overflow-hidden rounded-2xl bg-surface shadow-2xl">
        <div id="cafe-kitchen-print" className="p-5">
          {/* Header */}
          <div className="mb-4 border-b border-dashed border-border pb-4 text-center">
            <div className="mb-1 flex items-center justify-center gap-2 text-lg font-black">
              <ChefHat className="h-5 w-5 text-brand" />
              طلب المطبخ
            </div>
            <p className="text-xs text-muted">
              {now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
            </p>
            <div className="mt-2 flex items-center justify-center gap-2">
              <span className={cn(
                'rounded-full px-3 py-0.5 text-sm font-bold',
                ticket.orderType === 'here'
                  ? 'bg-brand-soft text-brand'
                  : 'bg-info/10 text-info',
              )}>
                {ticket.orderType === 'here'
                  ? ticket.tableNumber ? `طاولة ${ticket.tableNumber}` : 'بدون طاولة'
                  : '🛍 تيك أواي'}
              </span>
              <span className="text-sm text-muted">#{ticket.ticketNumber}</span>
            </div>
          </div>

          {/* Items */}
          <div className="space-y-3">
            {ticket.items.map((item, i) => (
              <div key={i} className="border-b border-border pb-3 last:border-0 last:pb-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-fg">{item.productName}</p>
                    {item.variantName && item.variantName !== 'افتراضي' && item.variantName !== item.productName && (
                      <p className="text-xs text-muted">{item.variantName}</p>
                    )}
                    {item.notes && (
                      <p className="mt-0.5 text-xs font-medium text-brand">
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
            onClick={() => window.print()}
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
      </div>
    </div>
  )
}

// ── Customer Receipt Modal ────────────────────────────────────────────────────

function CustomerReceiptModal({
  receipt,
  onClose,
}: {
  receipt: CustomerReceiptData
  onClose: () => void
}) {
  const { data: zatcaSettings } = useQuery({
    queryKey: ['zatca-settings'],
    queryFn: () => zatcaApi.getSettings(),
    staleTime: 60_000,
  })

  const sellerName = zatcaSettings?.data?.sellerName ?? ''
  const vatNumber = zatcaSettings?.data?.vatRegistrationNumber ?? ''

  const qrCode = generateZatcaQr({
    sellerName: sellerName || 'كافيه',
    vatNumber,
    timestamp: receipt.completedAt,
    totalWithVat: receipt.grandTotal,
    vatAmount: receipt.tax,
  })

  const payLabel =
    receipt.payMode === 'Cash' ? 'نقداً' :
    receipt.payMode === 'Card' ? 'بطاقة' :
    `تقسيم — نقد ${formatCurrency(receipt.splitCash ?? 0)} / بطاقة ${formatCurrency(receipt.splitCard ?? 0)}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" dir="rtl">
      <div className="w-80 overflow-hidden rounded-2xl bg-surface shadow-2xl">
        <div id="cafe-receipt-print" className="p-5">
          {/* Header */}
          <div className="mb-4 border-b border-dashed border-border pb-4 text-center">
            {sellerName && (
              <p className="text-base font-black text-fg">{sellerName}</p>
            )}
            {vatNumber && (
              <p className="text-xs text-muted">الرقم الضريبي: {vatNumber}</p>
            )}
            <p className="text-xs text-muted mt-1">
              {new Date(receipt.completedAt).toLocaleString('ar-SA', {
                year: 'numeric', month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </p>
            <p className="text-xs font-mono text-muted">#{receipt.orderId.slice(-8).toUpperCase()}</p>
            {receipt.orderType === 'here' && receipt.tableNumber && (
              <span className="mt-1 inline-block rounded-full bg-brand-soft px-2 py-0.5 text-xs font-bold text-brand">
                طاولة {receipt.tableNumber}
              </span>
            )}
            {receipt.orderType === 'takeaway' && (
              <span className="mt-1 inline-block rounded-full bg-info/10 px-2 py-0.5 text-xs font-bold text-info">
                🛍 تيك أواي
              </span>
            )}
          </div>

          {/* Items */}
          <div className="mb-4 space-y-2 text-sm">
            {receipt.items.map((item) => (
              <div key={item.variantId} className="flex justify-between text-fg">
                <span className="flex-1">
                  {item.productName}
                  {item.quantity > 1 && <span className="text-muted"> ×{item.quantity}</span>}
                  {item.notes && <span className="block text-xs text-brand">📝 {item.notes}</span>}
                </span>
                <span className="tabular-nums">{formatCurrency(item.unitPrice * item.quantity)}</span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="mb-4 space-y-1 border-t border-dashed border-border pt-3 text-sm">
            <div className="flex justify-between text-muted">
              <span>المجموع قبل الضريبة</span>
              <span className="tabular-nums">{formatCurrency(receipt.subtotal)}</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>ضريبة القيمة المضافة 15%</span>
              <span className="tabular-nums">{formatCurrency(receipt.tax)}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-fg">
              <span>الإجمالي</span>
              <span className="tabular-nums">{formatCurrency(receipt.grandTotal)}</span>
            </div>
          </div>

          {/* Payment */}
          <div className="mb-4 rounded-lg bg-surface-2 px-3 py-2 text-center text-xs text-muted">
            {payLabel}
          </div>

          {/* ZATCA QR */}
          <div className="mb-2 flex flex-col items-center gap-1">
            <QrCode className="h-4 w-4 text-muted" />
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(qrCode)}`}
              alt="QR ZATCA"
              width={110}
              height={110}
              className="rounded-lg"
            />
            <p className="text-[10px] text-muted">رمز ZATCA للتحقق</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 border-t border-border p-4">
          <button
            onClick={() => window.print()}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-fg py-2.5 text-sm font-semibold text-bg hover:bg-fg/85"
          >
            <Printer className="h-4 w-4" />
            طباعة
          </button>
          <button
            onClick={onClose}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-semibold text-fg hover:bg-surface-2"
          >
            <X className="h-4 w-4" />
            إغلاق
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function CafePosPage() {
  const { branchId, tenantId } = useAuthStore()
  const { t } = useI18n()
  const { shift } = useShift()

  // Order type & table
  const [orderType, setOrderType] = useState<'here' | 'takeaway'>('here')
  const [tableNumber, setTableNumber] = useState<number | null>(null)
  const [showTablePicker, setShowTablePicker] = useState(false)

  // Products
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all')

  // Cart
  const [cart, setCart] = useState<CafeCartItem[]>([])
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [payMode, setPayMode] = useState<PayMode>('Cash')
  const payModeRef = useRef<PayMode>('Cash')

  // AI Cashier
  const [aiCashierActive, setAiCashierActive] = useState(false)

  // Gaming
  const [startSessionForm, setStartSessionForm] = useState<StartSessionForm | null>(null)
  const [gamingBill, setGamingBill] = useState<GameSessionBillResponse | null>(null)
  const [gamingNow, setGamingNow] = useState(() => Date.now())

  // Shift
  const [showOpenShift, setShowOpenShift] = useState(false)
  const [showCloseShift, setShowCloseShift] = useState(false)

  // Split payment
  const [splitCash, setSplitCash] = useState<string>('')
  const [splitCard, setSplitCard] = useState<string>('')

  // Kitchen ticket & customer receipt
  const [kitchenTicket, setKitchenTicket] = useState<KitchenTicketData | null>(null)
  const [customerReceipt, setCustomerReceipt] = useState<CustomerReceiptData | null>(null)
  const [ticketCounter, setTicketCounter] = useState(1)

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
    enabled: !!branchId && selectedCategoryId === '__gaming__',
    refetchInterval: selectedCategoryId === '__gaming__' ? 15_000 : false,
  })
  const stations: GameStationResponse[] = Array.isArray(stationsData?.data)
    ? (stationsData!.data as GameStationResponse[])
    : []

  const _rawCats = categoriesData?.data
  const categories: CategoryResponse[] = Array.isArray(_rawCats) ? _rawCats : ((_rawCats as any)?.items ?? [])
  const _rawProds = productsData?.data
  const products: ProductResponse[] = Array.isArray(_rawProds) ? _rawProds : ((_rawProds as any)?.items ?? [])
  const _rawAll = allProductsData?.data
  const allProducts: ProductResponse[] = Array.isArray(_rawAll) ? _rawAll : ((_rawAll as any)?.items ?? [])

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

  // Timer: update every second only while gaming tab is open
  useEffect(() => {
    if (selectedCategoryId !== '__gaming__') return
    const id = setInterval(() => setGamingNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [selectedCategoryId])

  const cartQty = (variantId: string) => cart.find(i => i.variantId === variantId)?.quantity ?? 0

  const canAddMore = (variantId: string, addingQty = 1): boolean => {
    if (!trackMap[variantId]) return true
    const available = stockMap[variantId]
    if (available === undefined) return true
    return cartQty(variantId) + addingQty <= available
  }

  // ── Cart ops ──────────────────────────────────────────────────────────────

  const addToCart = (
    variantId: string,
    productName: string,
    variantName: string,
    unitPrice: number,
    costPrice: number,
  ) => {
    if (!canAddMore(variantId)) {
      toast.error('المخزون غير كافٍ', `المتاح: ${stockMap[variantId] ?? 0} وحدة`)
      return
    }
    setCart((prev) => {
      const existing = prev.find((i) => i.variantId === variantId)
      if (existing) return prev.map((i) => i.variantId === variantId ? { ...i, quantity: i.quantity + 1 } : i)
      return [...prev, { variantId, productName, variantName, unitPrice, costPrice, quantity: 1, notes: '' }]
    })
  }

  const addVariantById = useCallback((variantId: string, qty: number, notes: string) => {
    for (const product of allProducts) {
      const variant = product.variants.find((v) => v.id === variantId)
      if (variant) {
        if (product.trackInventory) {
          const available = stockMap[variantId]
          if (available !== undefined) {
            const inCart = cartQty(variantId)
            if (inCart + qty > available) {
              toast.error('المخزون غير كافٍ', `المتاح: ${available} وحدة`)
              return
            }
          }
        }
        setCart((prev) => {
          const existing = prev.find((i) => i.variantId === variantId)
          if (existing) {
            return prev.map((i) => i.variantId === variantId ? { ...i, quantity: i.quantity + qty, notes: notes || i.notes } : i)
          }
          return [...prev, { variantId, productName: product.name, variantName: variant.name, unitPrice: variant.salePrice, costPrice: variant.costPrice, quantity: qty, notes: notes ?? '' }]
        })
        break
      }
    }
  }, [allProducts, stockMap, cartQty])

  const updateQty = (variantId: string, delta: number) => {
    if (delta > 0 && !canAddMore(variantId)) {
      toast.error('المخزون غير كافٍ', `المتاح: ${stockMap[variantId] ?? 0} وحدة`)
      return
    }
    setCart((prev) =>
      prev
        .map((i) => i.variantId === variantId ? { ...i, quantity: i.quantity + delta } : i)
        .filter((i) => i.quantity > 0),
    )
  }

  const removeItem = (variantId: string) => setCart((prev) => prev.filter((i) => i.variantId !== variantId))

  const updateNote = (variantId: string, note: string) => {
    setCart((prev) => prev.map((i) => i.variantId === variantId ? { ...i, notes: note } : i))
  }

  // الأسعار شاملة الضريبة — نستخرج الضريبة من الإجمالي
  const grandTotal = cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
  const tax = Math.round((grandTotal * SAUDI_VAT_RATE / (1 + SAUDI_VAT_RATE)) * 100) / 100
  const subtotal = Math.round((grandTotal - tax) * 100) / 100

  // ── Checkout ──────────────────────────────────────────────────────────────

  const checkout = useMutation({
    mutationFn: async () => {
      if (!branchId || !tenantId) throw new Error('no-branch')
      if (cart.length === 0) throw new Error('empty')

      // الأسعار شاملة الضريبة: نرسل سعر ما قبل الضريبة للباك اند ليحسب الضريبة
      const preTaxRate = 1 + SAUDI_VAT_RATE
      const orderRes = await ordersApi.createOrder(branchId, {
        tenantId,
        currency: 'SAR',
        taxRate: SAUDI_VAT_RATE,
      })
      const orderId = orderRes.data.id

      await Promise.all(
        cart.map((item) =>
          ordersApi.addLine(branchId, orderId, {
            variantId: item.variantId,
            productName: item.productName,
            variantName: item.variantName,
            unitPrice: Math.round((item.unitPrice / preTaxRate) * 10000) / 10000,
            costPrice: item.costPrice,
            quantity: item.quantity,
          }),
        ),
      )

      await ordersApi.complete(branchId, orderId, {
        paymentMethod: payMode as PaymentMethod,
        amountTendered: grandTotal,
        ...(payMode === 'Split' && {
          cashAmount: parseFloat(splitCash) || 0,
          cardAmount: parseFloat(splitCard) || 0,
        }),
      })

      return orderId
    },
    onSuccess: (orderId) => {
      const snapshot = {
        items: [...cart],
        grandTotal,
        tax,
        subtotal,
        payMode,
        splitCash: splitCashNum || undefined,
        splitCard: splitCardNum || undefined,
        tableNumber,
        orderType,
      }

      // Push to kitchen (fire and forget)
      if (tenantId) {
        pushKitchenTicket(tenantId, {
          ticketNumber: ticketCounter,
          tableNumber,
          orderType,
          items: cart.map((i) => ({
            productName: i.productName,
            variantName: i.variantName,
            quantity: i.quantity,
            notes: i.notes,
          })),
        })
      }
      if (branchId && tenantId) {
        restaurantApi
          .createOrder(branchId, {
            tenantId,
            tableNumber: orderType === 'takeaway' ? 99 : (tableNumber ?? 1),
            items: cart.map((i) => ({
              menuItemId: i.variantId,
              itemName: i.productName,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              notes: i.notes || undefined,
            })),
          })
          .catch(() => {})
      }

      // Show customer receipt
      setCustomerReceipt({
        orderId,
        ...snapshot,
        completedAt: new Date().toISOString(),
      })
      setTicketCounter((n) => n + 1)
      setCart([])
      setTableNumber(null)
      setSplitCash('')
      setSplitCard('')
      setPayMode('Cash')
      toast.success(t.pos.orderProcessed)
    },
    onError: (e: Error) => {
      if (e.message === 'empty') toast.error('السلة فارغة')
      else toast.error(t.pos.paymentFailed)
    },
  })

  const splitCashNum = parseFloat(splitCash) || 0
  const splitCardNum = parseFloat(splitCard) || 0
  const splitValid = payMode !== 'Split' || (
    splitCashNum > 0 && splitCardNum > 0 &&
    Math.abs(splitCashNum + splitCardNum - grandTotal) < 0.01
  )
  const canCheckout = cart.length > 0 && splitValid

  // ── AI Cashier checkout ────────────────────────────────────────────────────

  const aiCheckout = useMutation({
    mutationFn: async (paymentMethod: 'Cash' | 'Card') => {
      if (!branchId || !tenantId) throw new Error('no-branch')
      if (cart.length === 0) throw new Error('empty')
      const preTaxRate = 1 + SAUDI_VAT_RATE
      const orderRes = await ordersApi.createOrder(branchId, { tenantId, currency: 'SAR', taxRate: SAUDI_VAT_RATE })
      const orderId = orderRes.data.id
      await Promise.all(
        cart.map((item) =>
          ordersApi.addLine(branchId, orderId, {
            variantId: item.variantId,
            productName: item.productName,
            variantName: item.variantName,
            unitPrice: Math.round((item.unitPrice / preTaxRate) * 10000) / 10000,
            costPrice: item.costPrice,
            quantity: item.quantity,
          }),
        ),
      )
      await ordersApi.complete(branchId, orderId, { paymentMethod, amountTendered: grandTotal })
      return orderId
    },
    onSuccess: (orderId) => {
      if (tenantId) {
        pushKitchenTicket(tenantId, {
          ticketNumber: ticketCounter,
          tableNumber,
          orderType,
          items: cart.map((i) => ({ productName: i.productName, variantName: i.variantName, quantity: i.quantity, notes: i.notes })),
        })
      }
      if (branchId && tenantId) {
        restaurantApi.createOrder(branchId, {
          tenantId,
          tableNumber: orderType === 'takeaway' ? 99 : (tableNumber ?? 1),
          items: cart.map((i) => ({ menuItemId: i.variantId, itemName: i.productName, quantity: i.quantity, unitPrice: i.unitPrice, notes: i.notes || undefined })),
        }).catch(() => {})
      }
      setCustomerReceipt({
        orderId,
        items: [...cart],
        grandTotal,
        tax,
        subtotal,
        payMode: payModeRef.current,
        tableNumber,
        orderType,
        completedAt: new Date().toISOString(),
      })
      setTicketCounter((n) => n + 1)
      setCart([])
      setTableNumber(null)
      setAiCashierActive(false)
      toast.success('تم إتمام الطلب عبر كاشير AI')
    },
    onError: () => toast.error(t.pos.paymentFailed),
  })

  const handleAiCompleteOrder = useCallback((paymentMethod: 'Cash' | 'Card') => {
    payModeRef.current = paymentMethod
    aiCheckout.mutate(paymentMethod)
  }, [aiCheckout])

  // ── Gaming mutations ───────────────────────────────────────────────────────

  const startSessionMut = useMutation({
    mutationFn: async (form: StartSessionForm) => {
      if (!branchId) throw new Error('no-branch')
      return gamingApi.startSession(branchId, form.stationId, {
        playerName: form.playerName,
        durationMinutes: form.durationMinutes,
        ratePerHour: form.hourlyRate,
      })
    },
    onSuccess: () => {
      setStartSessionForm(null)
      void refetchStations()
      toast.success('تم بدء جلسة الألعاب')
    },
    onError: () => toast.error('فشل في بدء الجلسة'),
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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface-2" dir="rtl" style={CAFE_ACCENT}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b border-border bg-surface px-5 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <Coffee className="h-5 w-5 text-brand" />
          <h1 className="text-base font-bold text-fg">{t.pos.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          {aiCashierAvailable && (
            <button
              onClick={() => setAiCashierActive((v) => !v)}
              title="كاشير AI"
              className={cn(
                'flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors',
                aiCashierActive
                  ? 'bg-brand text-brand-fg'
                  : 'border border-brand/40 text-brand hover:bg-brand/10',
              )}
            >
              <Bot className="h-4 w-4" />
              كاشير AI
            </button>
          )}
          {shift ? (
            <ShiftBadge shift={shift} onCloseShift={() => setShowCloseShift(true)} />
          ) : (
            <button
              onClick={() => setShowOpenShift(true)}
              className="rounded-xl bg-brand px-4 py-1.5 text-sm font-semibold text-white"
            >
              فتح شفت
            </button>
          )}
        </div>
      </div>

      <ShiftGate onOpenShift={() => setShowOpenShift(true)}>
        <div className="flex flex-1 overflow-hidden">
          {/* ── Cart sidebar (appears RIGHT in RTL) ── */}
          <aside className="flex w-72 flex-shrink-0 flex-col border-l border-border bg-surface">
            {/* Order type toggle */}
            <div className="space-y-2 border-b border-border p-3">
              <div className="flex overflow-hidden rounded-xl border border-border">
                <button
                  onClick={() => { setOrderType('here'); setTableNumber(null) }}
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
                  onClick={() => { setOrderType('takeaway'); setTableNumber(null) }}
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
                      ? 'border-brand bg-brand-soft text-brand'
                      : 'border-dashed border-brand/40 bg-brand-soft/60 text-brand hover:border-brand',
                  )}
                >
                  {tableNumber ? `${t.pos.tableNumber} ${tableNumber} ✏️` : '+ اختر طاولة'}
                </button>
              )}
            </div>

            {/* Cart header */}
            <div
              className="border-b border-border px-4 py-2"
              style={{ background: 'linear-gradient(to left, color-mix(in srgb, var(--accent) 8%, transparent), transparent)' }}
            >
              <p className="text-sm font-bold text-fg">
                {t.pos.currentOrder}
                {orderType === 'takeaway' && <span className="mr-1 text-info">— {t.pos.takeaway}</span>}
                {orderType === 'here' && tableNumber && <span className="mr-1 text-brand">— {t.pos.tableNumber} {tableNumber}</span>}
              </p>
            </div>

            {/* Cart items */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-14 text-muted/50">
                  <Coffee className="h-8 w-8" />
                  <p className="text-sm">{t.pos.addProducts}</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.variantId}
                    className="rounded-xl border border-border bg-surface-2 p-3"
                  >
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-fg">
                          {item.productName}
                        </p>
                        {item.variantName && item.variantName !== 'افتراضي' && item.variantName !== item.productName && (
                          <p className="text-xs text-muted">{item.variantName}</p>
                        )}
                        <p className="text-xs font-bold tabular-nums" style={{ color: 'var(--accent)' }}>
                          {formatCurrency(item.unitPrice * item.quantity)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateQty(item.variantId, -1)}
                          className="flex h-6 w-6 items-center justify-center rounded-lg bg-border hover:bg-border"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-5 text-center text-sm font-bold tabular-nums">{item.quantity}</span>
                        <button
                          onClick={() => updateQty(item.variantId, 1)}
                          className="flex h-6 w-6 items-center justify-center rounded-lg bg-border hover:bg-border"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => removeItem(item.variantId)}
                          className="flex h-6 w-6 items-center justify-center rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    {/* Per-item notes */}
                    {editingNoteId === item.variantId ? (
                      <input
                        type="text"
                        value={item.notes}
                        onChange={(e) => updateNote(item.variantId, e.target.value)}
                        onBlur={() => setEditingNoteId(null)}
                        onKeyDown={(e) => e.key === 'Enter' && setEditingNoteId(null)}
                        autoFocus
                        placeholder="ملاحظة للمطبخ..."
                        className="mt-1.5 w-full rounded-lg border border-brand/40 bg-brand-soft px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-brand/40"
                      />
                    ) : (
                      <button
                        onClick={() => setEditingNoteId(item.variantId)}
                        className="mt-1 flex items-center gap-1 text-xs text-muted hover:text-brand transition-colors"
                      >
                        <MessageSquare className="h-3 w-3" />
                        {item.notes ? (
                          <span className="font-medium text-brand">{item.notes}</span>
                        ) : 'إضافة ملاحظة'}
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Totals & checkout */}
            {cart.length > 0 && (
              <div className="border-t border-border p-4 space-y-3">
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between text-muted">
                    <span>{t.pos.subtotal}</span>
                    <span className="tabular-nums">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-muted">
                    <span>{t.pos.tax}</span>
                    <span className="tabular-nums">{formatCurrency(tax)}</span>
                  </div>
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
                      onClick={() => { setPayMode(m); setSplitCash(''); setSplitCard('') }}
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
                            const card = parseFloat(e.target.value) || 0
                            const remaining = grandTotal - card
                            setSplitCash(remaining > 0 ? remaining.toFixed(2) : '')
                          }}
                          className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm tabular-nums outline-none focus:border-brand"
                        />
                      </div>
                    </div>
                    {splitCashNum + splitCardNum > 0 && Math.abs(splitCashNum + splitCardNum - grandTotal) > 0.01 && (
                      <p className="text-center text-[10px] font-semibold text-red-500">
                        الفرق: {(grandTotal - splitCashNum - splitCardNum).toFixed(2)} ر.س
                      </p>
                    )}
                  </div>
                )}

                <button
                  onClick={() => checkout.mutate()}
                  disabled={checkout.isPending || !canCheckout}
                  className="bg-brand w-full rounded-xl py-3 text-sm font-bold text-brand-fg transition-all disabled:opacity-50"
                >
                  {checkout.isPending ? t.common.loading : t.pos.checkout}
                </button>
              </div>
            )}
          </aside>

          {/* ── Products area ── */}
          <main className="flex flex-1 flex-col overflow-hidden">
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
                الكل
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
                  {c.name}
                </button>
              ))}
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
              </button>
            </div>

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
                            ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20'
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
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                              : station.status === 'InUse'
                              ? 'bg-brand-soft text-brand'
                              : 'bg-surface-2 text-muted',
                          )}>
                            {station.status === 'Available' ? 'متاح' : station.status === 'InUse' ? 'شاغل' : 'صيانة'}
                          </span>
                        </div>

                        {/* Hourly rate */}
                        <p className="mb-3 text-sm font-semibold text-brand">
                          {formatCurrency(station.hourlyRate)} / ساعة
                        </p>

                        {/* Active session info */}
                        {station.status === 'InUse' && station.activeSession && (
                          <div className="mb-3 rounded-lg bg-brand-soft/60 p-2.5">
                            <p className="text-xs font-semibold text-brand">
                              👤 {station.activeSession.playerName}
                            </p>
                            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-brand">
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
                              hourlyRate: station.hourlyRate,
                              playerName: '',
                              durationMinutes: 60,
                            })}
                            className="mt-auto flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-2 text-sm font-bold text-white hover:bg-emerald-600 transition-colors"
                          >
                            <Play className="h-3.5 w-3.5" />
                            ابدأ جلسة
                          </button>
                        )}
                        {station.status === 'InUse' && station.activeSession && (
                          <button
                            onClick={() => endSessionMut.mutate(station.activeSession!.sessionId)}
                            disabled={endSessionMut.isPending}
                            className="mt-auto flex items-center justify-center gap-1.5 rounded-xl bg-red-500 py-2 text-sm font-bold text-white hover:bg-red-600 transition-colors disabled:opacity-50"
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

            {/* Product grid */}
            {selectedCategoryId !== '__gaming__' && (
            <div className="flex-1 overflow-y-auto p-4">
              {productsLoading ? (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="h-28 animate-pulse rounded-xl bg-border" />
                  ))}
                </div>
              ) : products.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted/50">
                  <Coffee className="h-10 w-10" />
                  <p className="text-sm">لا توجد منتجات</p>
                  <p className="text-xs text-muted">أضف منتجات من صفحة المنتجات أولاً</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {products.flatMap((product) =>
                    product.variants
                      .filter((v) => v.isActive)
                      .map((variant) => (
                        <button
                          key={variant.id}
                          onClick={() =>
                            addToCart(variant.id, product.name, variant.name, variant.salePrice, variant.costPrice)
                          }
                          className="group relative flex flex-col items-start overflow-hidden rounded-xl border border-border bg-surface p-3 text-right transition-all duration-200 hover:border-brand hover:shadow-md hover:scale-[1.01] active:scale-[0.99]"
                        >
                          <p className="text-sm font-semibold leading-snug text-fg">
                            {product.name}
                          </p>
                          {variant.name && variant.name !== 'افتراضي' && variant.name !== product.name && (
                            <p className="text-xs text-muted">{variant.name}</p>
                          )}
                          <p className="mt-auto pt-3 text-sm font-bold tabular-nums" style={{ color: 'var(--accent)' }}>
                            {formatCurrency(variant.salePrice)}
                          </p>
                          <span
                            className="bg-brand pointer-events-none absolute inset-x-0 bottom-0 h-0.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100 text-brand-fg"
                          />
                        </button>
                      )),
                  )}
                </div>
              )}
            </div>
            )}
          </main>
        </div>
      </ShiftGate>

      {/* ── Table Picker Modal ── */}
      {showTablePicker && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowTablePicker(false)}
          dir="rtl"
        >
          <div
            className="w-72 rounded-2xl bg-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h3 className="font-bold text-fg">اختر طاولة</h3>
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
          </div>
        </div>
      )}

      {/* ── Shift Modals ── */}
      {showOpenShift && <OpenShiftModal onClose={() => setShowOpenShift(false)} />}
      {showCloseShift && shift && (
        <CloseShiftModal shift={shift} onClose={() => setShowCloseShift(false)} />
      )}

      {/* ── Customer Receipt (shown after checkout) ── */}
      {customerReceipt && (
        <CustomerReceiptModal receipt={customerReceipt} onClose={() => setCustomerReceipt(null)} />
      )}

      {/* ── Kitchen Ticket (for kitchen display only) ── */}
      {kitchenTicket && !customerReceipt && (
        <KitchenTicketModal ticket={kitchenTicket} onClose={() => setKitchenTicket(null)} />
      )}

      {/* ── Start Gaming Session Modal ── */}
      {startSessionForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" dir="rtl">
          <div className="w-80 rounded-2xl bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">{STATION_ICON[startSessionForm.stationTypeKey] ?? '🎮'}</span>
                <h3 className="font-bold text-fg">{startSessionForm.stationName}</h3>
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
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-fg">السعر / ساعة (ر.س)</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={startSessionForm.hourlyRate}
                  onChange={(e) => setStartSessionForm(f => f && { ...f, hourlyRate: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm tabular-nums outline-none focus:border-brand text-fg"
                />
              </div>
              <div className="rounded-xl bg-brand-soft py-3 text-center">
                <p className="text-xs text-muted">الإجمالي المتوقع</p>
                <p className="mt-0.5 text-2xl font-black tabular-nums text-brand">
                  {formatCurrency((startSessionForm.durationMinutes / 60) * startSessionForm.hourlyRate)}
                </p>
                <p className="text-xs text-muted">
                  {startSessionForm.durationMinutes} د × {formatCurrency(startSessionForm.hourlyRate)}/ساعة
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
          </div>
        </div>
      )}

      {/* ── Gaming Bill Modal ── */}
      {gamingBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" dir="rtl">
          <div className="w-80 overflow-hidden rounded-2xl bg-surface shadow-2xl">
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
                    {new Date(gamingBill.startTime).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">النهاية</span>
                  <span className="tabular-nums text-fg">
                    {new Date(gamingBill.endTime).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
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
                <p className="text-xs text-muted">الإجمالي</p>
                <p className="mt-1 text-3xl font-black tabular-nums text-brand">
                  {formatCurrency(gamingBill.totalAmount)}
                </p>
              </div>
            </div>
            <div className="flex gap-2 border-t border-border p-4">
              <button
                onClick={() => window.print()}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-fg py-2.5 text-sm font-semibold text-bg hover:bg-fg/85 transition-colors"
              >
                <Printer className="h-4 w-4" />
                طباعة
              </button>
              <button
                onClick={() => setGamingBill(null)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand py-2.5 text-sm font-bold text-brand-fg hover:bg-brand/90 transition-colors"
              >
                تم الدفع ✓
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── AI Cashier Agent overlay ── */}
      {aiCashierActive && branchId && (
        <AiCashierAgent
          branchId={branchId}
          allProducts={allProducts}
          onAddVariant={addVariantById}
          onCompleteOrder={handleAiCompleteOrder}
          onDeactivate={() => setAiCashierActive(false)}
        />
      )}
    </div>
  )
}
