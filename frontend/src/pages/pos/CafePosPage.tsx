import { useState, useRef, useCallback } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  Coffee, ShoppingBag, ChefHat, X, Plus, Minus, Trash2,
  Printer, MessageSquare, CreditCard, Banknote, Bot, QrCode,
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
import type { PaymentMethod, CategoryResponse, ProductResponse } from '@/types/api'

// ── Types ─────────────────────────────────────────────────────────────────────

interface CafeCartItem {
  variantId: string
  productName: string
  variantName: string
  unitPrice: number
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
  '--accent': '#4F46E5',
  '--glow': 'rgba(79,70,229,0.35)',
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
              ? 'scale-95 border-[var(--accent)] bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
              : 'border-gray-200 bg-white text-gray-700 hover:border-indigo-300 hover:bg-indigo-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300',
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
      <div className="w-80 overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
        <div id="cafe-kitchen-print" className="p-5">
          {/* Header */}
          <div className="mb-4 border-b border-dashed border-gray-200 pb-4 text-center dark:border-gray-700">
            <div className="mb-1 flex items-center justify-center gap-2 text-lg font-black">
              <ChefHat className="h-5 w-5 text-indigo-500" />
              طلب المطبخ
            </div>
            <p className="text-xs text-gray-400">
              {now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
            </p>
            <div className="mt-2 flex items-center justify-center gap-2">
              <span className={cn(
                'rounded-full px-3 py-0.5 text-sm font-bold',
                ticket.orderType === 'here'
                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400'
                  : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
              )}>
                {ticket.orderType === 'here'
                  ? ticket.tableNumber ? `طاولة ${ticket.tableNumber}` : 'بدون طاولة'
                  : '🛍 تيك أواي'}
              </span>
              <span className="text-sm text-gray-400">#{ticket.ticketNumber}</span>
            </div>
          </div>

          {/* Items */}
          <div className="space-y-3">
            {ticket.items.map((item, i) => (
              <div key={i} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0 dark:border-gray-800">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-gray-900 dark:text-gray-100">{item.productName}</p>
                    {item.variantName && item.variantName !== 'افتراضي' && item.variantName !== item.productName && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">{item.variantName}</p>
                    )}
                    {item.notes && (
                      <p className="mt-0.5 text-xs font-medium text-indigo-600 dark:text-indigo-400">
                        📝 {item.notes}
                      </p>
                    )}
                  </div>
                  <span className="text-2xl font-black tabular-nums text-gray-900 dark:text-gray-100">
                    ×{item.quantity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 border-t border-gray-200 p-4 dark:border-gray-700">
          <button
            onClick={() => window.print()}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gray-900 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-700 dark:bg-white dark:text-gray-900"
          >
            <Printer className="h-4 w-4" />
            طباعة
          </button>
          <button
            onClick={onClose}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
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
      <div className="w-80 overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
        <div id="cafe-receipt-print" className="p-5">
          {/* Header */}
          <div className="mb-4 border-b border-dashed border-gray-200 pb-4 text-center dark:border-gray-700">
            {sellerName && (
              <p className="text-base font-black text-gray-900 dark:text-gray-100">{sellerName}</p>
            )}
            {vatNumber && (
              <p className="text-xs text-gray-500">الرقم الضريبي: {vatNumber}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              {new Date(receipt.completedAt).toLocaleString('ar-SA', {
                year: 'numeric', month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </p>
            <p className="text-xs font-mono text-gray-400">#{receipt.orderId.slice(-8).toUpperCase()}</p>
            {receipt.orderType === 'here' && receipt.tableNumber && (
              <span className="mt-1 inline-block rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400">
                طاولة {receipt.tableNumber}
              </span>
            )}
            {receipt.orderType === 'takeaway' && (
              <span className="mt-1 inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">
                🛍 تيك أواي
              </span>
            )}
          </div>

          {/* Items */}
          <div className="mb-4 space-y-2 text-sm">
            {receipt.items.map((item) => (
              <div key={item.variantId} className="flex justify-between text-gray-700 dark:text-gray-300">
                <span className="flex-1">
                  {item.productName}
                  {item.quantity > 1 && <span className="text-gray-400"> ×{item.quantity}</span>}
                  {item.notes && <span className="block text-xs text-indigo-500">📝 {item.notes}</span>}
                </span>
                <span className="tabular-nums">{formatCurrency(item.unitPrice * item.quantity)}</span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="mb-4 space-y-1 border-t border-dashed border-gray-200 pt-3 text-sm dark:border-gray-700">
            <div className="flex justify-between text-gray-500">
              <span>المجموع قبل الضريبة</span>
              <span className="tabular-nums">{formatCurrency(receipt.subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>ضريبة القيمة المضافة 15%</span>
              <span className="tabular-nums">{formatCurrency(receipt.tax)}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-gray-900 dark:text-gray-100">
              <span>الإجمالي</span>
              <span className="tabular-nums">{formatCurrency(receipt.grandTotal)}</span>
            </div>
          </div>

          {/* Payment */}
          <div className="mb-4 rounded-lg bg-gray-50 px-3 py-2 text-center text-xs text-gray-500 dark:bg-gray-800">
            {payLabel}
          </div>

          {/* ZATCA QR */}
          <div className="mb-2 flex flex-col items-center gap-1">
            <QrCode className="h-4 w-4 text-gray-400" />
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(qrCode)}`}
              alt="QR ZATCA"
              width={110}
              height={110}
              className="rounded-lg"
            />
            <p className="text-[10px] text-gray-400">رمز ZATCA للتحقق</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 border-t border-gray-200 p-4 dark:border-gray-700">
          <button
            onClick={() => window.print()}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gray-900 py-2.5 text-sm font-semibold text-white hover:bg-gray-700 dark:bg-white dark:text-gray-900"
          >
            <Printer className="h-4 w-4" />
            طباعة
          </button>
          <button
            onClick={onClose}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
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
    queryKey: ['cafe-all-products', tenantId],
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
  ) => {
    if (!canAddMore(variantId)) {
      toast.error('المخزون غير كافٍ', `المتاح: ${stockMap[variantId] ?? 0} وحدة`)
      return
    }
    setCart((prev) => {
      const existing = prev.find((i) => i.variantId === variantId)
      if (existing) return prev.map((i) => i.variantId === variantId ? { ...i, quantity: i.quantity + 1 } : i)
      return [...prev, { variantId, productName, variantName, unitPrice, quantity: 1, notes: '' }]
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
          return [...prev, { variantId, productName: product.name, variantName: variant.name, unitPrice: variant.salePrice, quantity: qty, notes: notes ?? '' }]
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
      toast.success('تم إتمام الطلب')
    },
    onError: (e: Error) => {
      if (e.message === 'empty') toast.error('السلة فارغة')
      else toast.error('فشل إتمام الطلب')
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
            quantity: item.quantity,
          }),
        ),
      )
      await ordersApi.complete(branchId, orderId, { paymentMethod, amountTendered: grandTotal })
      return orderId
    },
    onSuccess: () => {
      const ticket: KitchenTicketData = { items: [...cart], orderType, tableNumber, ticketNumber: ticketCounter }
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
      setKitchenTicket(ticket)
      setTicketCounter((n) => n + 1)
      setCart([])
      setTableNumber(null)
      setAiCashierActive(false)
      toast.success('تم إتمام الطلب عبر كاشير AI')
    },
    onError: () => toast.error('فشل إتمام الطلب'),
  })

  const handleAiCompleteOrder = useCallback((paymentMethod: 'Cash' | 'Card') => {
    payModeRef.current = paymentMethod
    aiCheckout.mutate(paymentMethod)
  }, [aiCheckout])

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-50 dark:bg-gray-950" dir="rtl" style={CAFE_ACCENT}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-5 py-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-3">
          <Coffee className="h-5 w-5 text-indigo-400" />
          <h1 className="text-base font-bold text-gray-900 dark:text-gray-100">نقطة البيع — كافيه</h1>
        </div>
        <div className="flex items-center gap-2">
          {aiCashierAvailable && (
            <button
              onClick={() => setAiCashierActive((v) => !v)}
              title="كاشير AI"
              className={cn(
                'flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors',
                aiCashierActive
                  ? 'bg-indigo-600 text-white'
                  : 'border border-indigo-400/40 text-indigo-400 hover:bg-indigo-400/10',
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
              className="rounded-xl bg-[var(--accent)] px-4 py-1.5 text-sm font-semibold text-white"
            >
              فتح شفت
            </button>
          )}
        </div>
      </div>

      <ShiftGate onOpenShift={() => setShowOpenShift(true)}>
        <div className="flex flex-1 overflow-hidden">
          {/* ── Cart sidebar (appears RIGHT in RTL) ── */}
          <aside className="flex w-72 flex-shrink-0 flex-col border-l border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            {/* Order type toggle */}
            <div className="space-y-2 border-b border-gray-100 p-3 dark:border-gray-800">
              <div className="flex overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => { setOrderType('here'); setTableNumber(null) }}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 py-2 text-sm font-semibold transition-colors',
                    orderType === 'here'
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400',
                  )}
                >
                  هنا
                </button>
                <button
                  onClick={() => { setOrderType('takeaway'); setTableNumber(null) }}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 py-2 text-sm font-semibold transition-colors',
                    orderType === 'takeaway'
                      ? 'bg-blue-500 text-white'
                      : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400',
                  )}
                >
                  <ShoppingBag className="h-3.5 w-3.5" />
                  تيك أواي
                </button>
              </div>

              {orderType === 'here' && (
                <button
                  onClick={() => setShowTablePicker(true)}
                  className={cn(
                    'w-full rounded-xl border-2 py-2 text-sm font-bold transition-colors',
                    tableNumber
                      ? 'border-indigo-400 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400'
                      : 'border-dashed border-indigo-300 bg-indigo-50/50 text-indigo-500 hover:border-indigo-400',
                  )}
                >
                  {tableNumber ? `طاولة ${tableNumber} ✏️` : '+ اختر طاولة'}
                </button>
              )}
            </div>

            {/* Cart header */}
            <div
              className="border-b border-gray-100 px-4 py-2 dark:border-gray-800"
              style={{ background: 'linear-gradient(to left, color-mix(in srgb, var(--accent) 8%, transparent), transparent)' }}
            >
              <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
                الطلب
                {orderType === 'takeaway' && <span className="mr-1 text-blue-500">— تيك أواي</span>}
                {orderType === 'here' && tableNumber && <span className="mr-1 text-indigo-500">— طاولة {tableNumber}</span>}
              </p>
            </div>

            {/* Cart items */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-14 text-gray-300">
                  <Coffee className="h-8 w-8" />
                  <p className="text-sm">أضف منتجات للطلب</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.variantId}
                    className="rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-800/50"
                  >
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {item.productName}
                        </p>
                        {item.variantName && item.variantName !== 'افتراضي' && item.variantName !== item.productName && (
                          <p className="text-xs text-gray-400">{item.variantName}</p>
                        )}
                        <p className="text-xs font-bold tabular-nums" style={{ color: 'var(--accent)' }}>
                          {formatCurrency(item.unitPrice * item.quantity)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateQty(item.variantId, -1)}
                          className="flex h-6 w-6 items-center justify-center rounded-lg bg-gray-200 hover:bg-gray-300 dark:bg-gray-700"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-5 text-center text-sm font-bold tabular-nums">{item.quantity}</span>
                        <button
                          onClick={() => updateQty(item.variantId, 1)}
                          className="flex h-6 w-6 items-center justify-center rounded-lg bg-gray-200 hover:bg-gray-300 dark:bg-gray-700"
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
                        className="mt-1.5 w-full rounded-lg border border-indigo-300 bg-indigo-50 px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-indigo-400 dark:bg-indigo-900/20 dark:border-indigo-700"
                      />
                    ) : (
                      <button
                        onClick={() => setEditingNoteId(item.variantId)}
                        className="mt-1 flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-500 transition-colors"
                      >
                        <MessageSquare className="h-3 w-3" />
                        {item.notes ? (
                          <span className="font-medium text-indigo-600 dark:text-indigo-400">{item.notes}</span>
                        ) : 'إضافة ملاحظة'}
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Totals & checkout */}
            {cart.length > 0 && (
              <div className="border-t border-gray-200 p-4 space-y-3 dark:border-gray-800">
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between text-gray-500">
                    <span>المجموع</span>
                    <span className="tabular-nums">{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>ضريبة 15%</span>
                    <span className="tabular-nums">{formatCurrency(tax)}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold text-gray-900 dark:text-gray-100">
                    <span>الإجمالي</span>
                    <span className="tabular-nums">{formatCurrency(grandTotal)}</span>
                  </div>
                </div>

                {/* Payment mode */}
                <div className="flex overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
                  {(['Cash', 'Card', 'Split'] as PayMode[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => { setPayMode(m); setSplitCash(''); setSplitCard('') }}
                      className={cn(
                        'flex flex-1 items-center justify-center gap-1 py-2 text-xs font-medium transition-colors',
                        payMode === m
                          ? 'bg-[var(--accent)] text-white'
                          : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400',
                      )}
                    >
                      {m === 'Cash' && <Banknote className="h-3 w-3" />}
                      {m === 'Card' && <CreditCard className="h-3 w-3" />}
                      {m === 'Split' && <span className="text-[10px] font-bold">½</span>}
                      {m === 'Cash' ? 'نقداً' : m === 'Card' ? 'بطاقة' : 'تقسيم'}
                    </button>
                  ))}
                </div>

                {/* Split inputs */}
                {payMode === 'Split' && (
                  <div className="space-y-2 rounded-xl border border-dashed border-[var(--accent)]/40 bg-[var(--accent)]/5 p-3">
                    <p className="text-center text-xs font-semibold text-gray-500">
                      الإجمالي: {(grandTotal).toFixed(2)} ر.س
                    </p>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="mb-1 block text-[10px] font-medium text-gray-500">نقداً</label>
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
                          className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm tabular-nums outline-none focus:border-[var(--accent)] dark:border-gray-700 dark:bg-gray-800"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="mb-1 block text-[10px] font-medium text-gray-500">بطاقة</label>
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
                          className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm tabular-nums outline-none focus:border-[var(--accent)] dark:border-gray-700 dark:bg-gray-800"
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
                  className="w-full rounded-xl py-3 text-sm font-bold text-white transition-all disabled:opacity-50"
                  style={{ background: 'var(--accent)' }}
                >
                  {checkout.isPending ? 'جاري...' : 'إتمام الطلب'}
                </button>
              </div>
            )}
          </aside>

          {/* ── Products area ── */}
          <main className="flex flex-1 flex-col overflow-hidden">
            {/* Category tabs */}
            <div className="flex gap-2 overflow-x-auto border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
              <button
                onClick={() => setSelectedCategoryId('all')}
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-full transition-all whitespace-nowrap',
                  selectedCategoryId === 'all'
                    ? 'bg-[var(--accent)] text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800',
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
                      ? 'bg-[var(--accent)] text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800',
                  )}
                >
                  {c.name}
                </button>
              ))}
            </div>

            {/* Product grid */}
            <div className="flex-1 overflow-y-auto p-4">
              {productsLoading ? (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="h-28 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
                  ))}
                </div>
              ) : products.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-20 text-gray-300">
                  <Coffee className="h-10 w-10" />
                  <p className="text-sm">لا توجد منتجات</p>
                  <p className="text-xs text-gray-400">أضف منتجات من صفحة المنتجات أولاً</p>
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
                            addToCart(variant.id, product.name, variant.name, variant.salePrice)
                          }
                          className="group relative flex flex-col items-start overflow-hidden rounded-xl border border-gray-200 bg-white p-3 text-right transition-all duration-200 hover:border-indigo-400 hover:shadow-md hover:scale-[1.01] active:scale-[0.99] dark:border-gray-700 dark:bg-gray-800"
                        >
                          <p className="text-sm font-semibold leading-snug text-gray-900 dark:text-gray-100">
                            {product.name}
                          </p>
                          {variant.name && variant.name !== 'افتراضي' && variant.name !== product.name && (
                            <p className="text-xs text-gray-400">{variant.name}</p>
                          )}
                          <p className="mt-auto pt-3 text-sm font-bold tabular-nums" style={{ color: 'var(--accent)' }}>
                            {formatCurrency(variant.salePrice)}
                          </p>
                          <span
                            className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                            style={{ background: 'var(--accent)' }}
                          />
                        </button>
                      )),
                  )}
                </div>
              )}
            </div>
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
            className="w-72 rounded-2xl bg-white shadow-2xl dark:bg-gray-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
              <h3 className="font-bold text-gray-900 dark:text-gray-100">اختر طاولة</h3>
              <button onClick={() => setShowTablePicker(false)} className="text-gray-400 hover:text-gray-600">
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
