import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  Coffee, ShoppingBag, ChefHat, X, Plus, Minus, Trash2,
  Printer, MessageSquare, CreditCard, Banknote,
} from 'lucide-react'
import { catalogApi } from '@/api/catalog'
import { ordersApi } from '@/api/orders'
import { useAuthStore } from '@/stores/authStore'
import { toast } from '@/components/ui/Toast'
import { formatCurrency, cn } from '@/lib/utils'
import { SAUDI_VAT_RATE } from '@/lib/zatca'
import { useShift, ShiftGate, ShiftBadge, OpenShiftModal, CloseShiftModal } from './ShiftGate'
import { pushKitchenTicket } from '@/lib/cafeKitchen'
import { restaurantApi } from '@/api/restaurant'
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

type PayMode = 'Cash' | 'Card' | 'Split'

const CAFE_ACCENT: React.CSSProperties = {
  '--accent': '#FBBF24',
  '--glow': 'rgba(251,191,36,0.35)',
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
              ? 'scale-95 border-[var(--accent)] bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
              : 'border-gray-200 bg-white text-gray-700 hover:border-amber-300 hover:bg-amber-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300',
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
              <ChefHat className="h-5 w-5 text-amber-500" />
              طلب المطبخ
            </div>
            <p className="text-xs text-gray-400">
              {now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
            </p>
            <div className="mt-2 flex items-center justify-center gap-2">
              <span className={cn(
                'rounded-full px-3 py-0.5 text-sm font-bold',
                ticket.orderType === 'here'
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                  : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
              )}>
                {ticket.orderType === 'here'
                  ? `طاولة ${ticket.tableNumber}`
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
                      <p className="mt-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
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
  const [splitCash, setSplitCash] = useState('')
  const [splitCard, setSplitCard] = useState('')

  // Shift
  const [showOpenShift, setShowOpenShift] = useState(false)
  const [showCloseShift, setShowCloseShift] = useState(false)

  // Kitchen ticket
  const [kitchenTicket, setKitchenTicket] = useState<KitchenTicketData | null>(null)
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

  const _rawCats = categoriesData?.data
  const categories: CategoryResponse[] = Array.isArray(_rawCats) ? _rawCats : ((_rawCats as any)?.items ?? [])
  const _rawProds = productsData?.data
  const products: ProductResponse[] = Array.isArray(_rawProds) ? _rawProds : ((_rawProds as any)?.items ?? [])

  // ── Cart ops ──────────────────────────────────────────────────────────────

  const addToCart = (
    variantId: string,
    productName: string,
    variantName: string,
    unitPrice: number,
  ) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.variantId === variantId)
      if (existing) return prev.map((i) => i.variantId === variantId ? { ...i, quantity: i.quantity + 1 } : i)
      return [...prev, { variantId, productName, variantName, unitPrice, quantity: 1, notes: '' }]
    })
  }

  const updateQty = (variantId: string, delta: number) => {
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

  const subtotal = cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
  const tax = subtotal * SAUDI_VAT_RATE
  const grandTotal = subtotal + tax

  // ── Checkout ──────────────────────────────────────────────────────────────

  const checkout = useMutation({
    mutationFn: async () => {
      if (!branchId || !tenantId) throw new Error('no-branch')
      if (cart.length === 0) throw new Error('empty')
      if (payMode === 'Split') {
        const c = parseFloat(splitCash) || 0
        const k = parseFloat(splitCard) || 0
        if (Math.abs(c + k - grandTotal) > 0.01) throw new Error('split-mismatch')
      }

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
            unitPrice: item.unitPrice,
            quantity: item.quantity,
          }),
        ),
      )

      await ordersApi.complete(branchId, orderId, {
        paymentMethod: payMode as PaymentMethod,
        amountTendered: grandTotal,
      })


      return orderId
    },
    onSuccess: () => {
      const ticket: KitchenTicketData = {
        items: [...cart],
        orderType,
        tableNumber,
        ticketNumber: ticketCounter,
      }
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

      // Send to kitchen via backend (fire-and-forget)
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

      setKitchenTicket(ticket)
      setTicketCounter((n) => n + 1)
      setCart([])
      setTableNumber(null)
      setSplitCash('')
      setSplitCard('')
      toast.success('تم إتمام الطلب')
    },
    onError: (e: Error) => {
      if (e.message === 'split-mismatch') toast.error('مجموع النقد والبطاقة لا يساوي الإجمالي')
      else if (e.message === 'empty') toast.error('السلة فارغة')
      else toast.error('فشل إتمام الطلب')
    },
  })

  const canCheckout = cart.length > 0 && (
    payMode !== 'Split' || (
      (parseFloat(splitCash) || 0) + (parseFloat(splitCard) || 0) > 0
    )
  )

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-50 dark:bg-gray-950" dir="rtl" style={CAFE_ACCENT}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-5 py-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-3">
          <Coffee className="h-5 w-5 text-amber-400" />
          <h1 className="text-base font-bold text-gray-900 dark:text-gray-100">نقطة البيع — كافيه</h1>
        </div>
        <div className="flex items-center gap-2">
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
                      ? 'bg-amber-400 text-white'
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
                      ? 'border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                      : 'border-dashed border-amber-300 bg-amber-50/50 text-amber-500 hover:border-amber-400',
                  )}
                >
                  {tableNumber ? `طاولة ${tableNumber} ✏️` : '+ اختر طاولة'}
                </button>
              )}
            </div>

            {/* Cart header */}
            <div className="border-b border-gray-100 px-4 py-2 dark:border-gray-800">
              <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
                الطلب
                {orderType === 'takeaway' && <span className="mr-1 text-blue-500">— تيك أواي</span>}
                {orderType === 'here' && tableNumber && <span className="mr-1 text-amber-500">— طاولة {tableNumber}</span>}
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
                        className="mt-1.5 w-full rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-amber-400 dark:bg-amber-900/20 dark:border-amber-700"
                      />
                    ) : (
                      <button
                        onClick={() => setEditingNoteId(item.variantId)}
                        className="mt-1 flex items-center gap-1 text-xs text-gray-400 hover:text-amber-500 transition-colors"
                      >
                        <MessageSquare className="h-3 w-3" />
                        {item.notes ? (
                          <span className="font-medium text-amber-600 dark:text-amber-400">{item.notes}</span>
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
                      {m === 'Cash' ? 'نقداً' : m === 'Card' ? 'بطاقة' : 'مختلط'}
                    </button>
                  ))}
                </div>

                {/* Split payment inputs */}
                {payMode === 'Split' && (
                  <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-800/40 dark:bg-amber-900/10">
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400">توزيع الدفع المختلط</p>
                    <div className="flex items-center gap-2">
                      <Banknote className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="نقداً"
                        value={splitCash}
                        onChange={(e) => setSplitCash(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="بطاقة"
                        value={splitCard}
                        onChange={(e) => setSplitCard(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800"
                      />
                    </div>
                    {splitCash && splitCard && (
                      <p className={cn('text-xs font-medium', Math.abs((parseFloat(splitCash)||0)+(parseFloat(splitCard)||0)-grandTotal) < 0.01 ? 'text-green-600' : 'text-red-500')}>
                        المجموع: {((parseFloat(splitCash)||0)+(parseFloat(splitCard)||0)).toFixed(2)} / {grandTotal.toFixed(2)} ر.س
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
                  'whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                  selectedCategoryId === 'all'
                    ? 'bg-[var(--accent)] text-white shadow-sm'
                    : 'border border-gray-200 bg-white text-gray-600 hover:border-amber-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400',
                )}
              >
                الكل
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCategoryId(c.id)}
                  className={cn(
                    'whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                    selectedCategoryId === c.id
                      ? 'bg-[var(--accent)] text-white shadow-sm'
                      : 'border border-gray-200 bg-white text-gray-600 hover:border-amber-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400',
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
                          className="flex flex-col items-start rounded-xl border border-gray-200 bg-white p-3 text-right transition-all hover:border-amber-400 hover:shadow-md active:scale-95 dark:border-gray-700 dark:bg-gray-800"
                        >
                          <p className="text-sm font-semibold leading-snug text-gray-900 dark:text-gray-100">
                            {product.name}
                          </p>
                          {variant.name && variant.name !== 'افتراضي' && variant.name !== product.name && (
                            <p className="text-xs text-gray-400">{variant.name}</p>
                          )}
                          <p className="mt-auto pt-2 text-sm font-bold tabular-nums" style={{ color: 'var(--accent)' }}>
                            {formatCurrency(variant.salePrice)}
                          </p>
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

      {/* ── Kitchen Ticket ── */}
      {kitchenTicket && (
        <KitchenTicketModal ticket={kitchenTicket} onClose={() => setKitchenTicket(null)} />
      )}
    </div>
  )
}
