import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Plus, Minus, Trash2, CreditCard, Banknote, X,
  Tag, ChefHat, ToggleLeft, ToggleRight,
  ExternalLink, FlaskConical, Ban,
} from 'lucide-react'
import { RecipeModal } from '@/pages/catalog/RecipeModal'
import { recipesApi } from '@/api/recipes'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Modal, ConfirmModal } from '@/components/ui/Modal'
import { Card } from '@/components/ui/Card'
import { RestaurantReceiptModal } from '@/components/restaurant/RestaurantReceiptModal'
import { restaurantApi, type OrderItemInput } from '@/api/restaurant'
import { useAuthStore } from '@/stores/authStore'
import { toast } from '@/components/ui/Toast'
import { formatCurrency } from '@/lib/utils'
import { SAUDI_VAT_RATE } from '@/lib/zatca'
import { marginPercent } from '@/lib/pricing'
import { restaurantErrorMessage } from '@/lib/restaurantErrors'
import { discountCodeState } from '@/lib/discountCodes'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n'
import type {
  MenuItemResponse,
  MenuCategory,
  RestaurantOrderResponse,
  RestaurantOrderStatus,
  ValidateDiscountCodeResponse,
} from '@/types/api'

// ── Constants ────────────────────────────────────────────────────────────────

const TOTAL_TABLES = 20
const VAT = SAUDI_VAT_RATE

const CATEGORY_LABELS: Record<MenuCategory, string> = {
  Starters: 'المقبلات',
  Mains: 'الأطباق الرئيسية',
  Sides: 'الأطباق الجانبية',
  Beverages: 'المشروبات',
  Desserts: 'الحلويات',
  Specials: 'العروض الخاصة',
}

const CATEGORY_LIST: MenuCategory[] = ['Starters', 'Mains', 'Sides', 'Beverages', 'Desserts', 'Specials']

const CANCEL_REASONS = ['طلب خاطئ', 'العميل غادر', 'طلب مكرر']

// ── Cart types ────────────────────────────────────────────────────────────────

interface CartItem {
  menuItemId: string
  itemName: string
  unitPrice: number
  quantity: number
  notes?: string
}

// What the table owes across all its open orders. Menu prices include VAT, so the VAT is a share of the total.
interface TableBill {
  tableNumber: number
  orderCount: number
  subTotal: number
  discountAmount: number
  taxAmount: number
  total: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const r2 = (v: number) => Math.round(v * 100) / 100
// Order totals keep four decimals; a payment rounded up to the halala always covers them.
const toHalala = (v: number) => Math.ceil(v * 100 - 1e-6) / 100

// Open restaurant orders of a table. Cafe kitchen copies were paid at the cafe till and are not a table's bill.
function openTableOrders(tableNumber: number, orders: RestaurantOrderResponse[]) {
  return orders.filter(
    (o) => o.tableNumber === tableNumber && !o.kitchenOnly && !['Paid', 'Cancelled'].includes(o.status),
  )
}

function getTableColor(
  tableNumber: number,
  orders: RestaurantOrderResponse[],
): 'empty' | 'busy' | 'ready' {
  const tableOrders = openTableOrders(tableNumber, orders)
  if (tableOrders.length === 0) return 'empty'
  if (tableOrders.some((o) => o.status === 'Ready' || o.status === 'Served')) return 'ready'
  return 'busy'
}

const STATUS_LABEL: Partial<Record<RestaurantOrderStatus, string>> = {
  Pending: 'قيد الانتظار',
  InKitchen: 'في المطبخ',
  Ready: 'جاهز',
  Served: 'تم التقديم',
}

function OrderStatusBadge({ status }: { status: RestaurantOrderStatus }) {
  return (
    <span className={cn(
      'inline-block rounded-full px-2 py-0.5 text-xs font-medium',
      status === 'Pending' && 'bg-warning/10 text-warning',
      status === 'InKitchen' && 'bg-info/10 text-info',
      status === 'Ready' && 'bg-success/10 text-success',
      status === 'Served' && 'bg-brand-soft text-brand-ink dark:bg-brand/20',
    )}>
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type Tab = 'cashier' | 'manager'

export function RestaurantPage() {
  const [activeTab, setActiveTab] = useState<Tab>('cashier')
  const { branchId, user } = useAuthStore()
  const { t } = useI18n()
  // Menu, discount codes and voids are for owners and managers; the server enforces the same.
  const canManage = user?.role === 'Owner' || user?.role === 'Manager'
  const tab: Tab = canManage ? activeTab : 'cashier'

  return (
    <div className="flex h-[calc(100vh-0px)] flex-col" dir="rtl">
      <PageHeader
        title={t.restaurant.title}
        action={
          <div className="flex items-center gap-2">
            <a
              href="/restaurant/kitchen"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted hover:bg-surface-2"
            >
              <ExternalLink className="h-4 w-4" />
              عرض المطبخ
            </a>
            {canManage && (
              <div className="flex rounded-lg border border-border overflow-hidden">
                {([['cashier', 'الكاشير'], ['manager', 'الإدارة']] as [Tab, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={cn(
                      'px-4 py-1.5 text-sm font-medium transition-colors',
                      tab === key
                        ? 'bg-brand text-brand-fg'
                        : 'text-muted hover:bg-surface-2',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        }
      />

      {tab === 'cashier' && branchId && <CashierView branchId={branchId} canManage={canManage} />}
      {tab === 'manager' && branchId && <ManagerView branchId={branchId} />}
    </div>
  )
}

// ── Cashier View ──────────────────────────────────────────────────────────────

function CashierView({ branchId, canManage }: { branchId: string; canManage: boolean }) {
  const qc = useQueryClient()
  const { t } = useI18n()

  const [selectedTable, setSelectedTable] = useState<number | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<MenuCategory | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [notes, setNotes] = useState('')
  const [discountInput, setDiscountInput] = useState('')
  const [discount, setDiscount] = useState<ValidateDiscountCodeResponse | null>(null)
  const [showPayment, setShowPayment] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card'>('Cash')
  const [amountTendered, setAmountTendered] = useState('')
  const [paidOrders, setPaidOrders] = useState<RestaurantOrderResponse[] | null>(null)
  const [cancelTarget, setCancelTarget] = useState<RestaurantOrderResponse | null>(null)
  // A voided line has already reached the kitchen and cannot be brought back, so it is confirmed first.
  const [voidTarget, setVoidTarget] = useState<{ orderId: string; itemId: string; label: string } | null>(null)

  const { data: menuData } = useQuery({
    queryKey: ['menu-items', branchId],
    queryFn: () => restaurantApi.listMenuItems(branchId),
    enabled: !!branchId,
  })

  const { data: ordersData } = useQuery({
    queryKey: ['restaurant-orders', branchId],
    queryFn: () => restaurantApi.listActiveOrders(branchId),
    enabled: !!branchId,
    refetchInterval: 10000,
  })

  const menuItems = menuData?.data ?? []
  // Cafe kitchen tickets were paid at the cafe till; they belong on the kitchen screen, not the open tables.
  const orders = (ordersData?.data ?? []).filter((o) => !o.kitchenOnly)
  const refreshOrders = () => qc.invalidateQueries({ queryKey: ['restaurant-orders', branchId] })

  const filteredItems = selectedCategory
    ? menuItems.filter((i) => i.category === selectedCategory && i.isAvailable)
    : menuItems.filter((i) => i.isAvailable)

  // Every open order of the table makes one bill; new rounds join the latest one.
  const tableOrders = selectedTable ? openTableOrders(selectedTable, orders) : []
  const openOrder = tableOrders.length > 0 ? tableOrders[tableOrders.length - 1] : null
  const bill: TableBill | null = selectedTable && tableOrders.length > 0
    ? {
        tableNumber: selectedTable,
        orderCount: tableOrders.length,
        subTotal: r2(tableOrders.reduce((s, o) => s + o.subTotal, 0)),
        discountAmount: r2(tableOrders.reduce((s, o) => s + o.discountAmount, 0)),
        taxAmount: r2(tableOrders.reduce((s, o) => s + o.taxAmount, 0)),
        total: toHalala(tableOrders.reduce((s, o) => s + o.total, 0)),
      }
    : null

  // ── Cart logic ────────────────────────────────────────────────────────────

  const addToCart = (item: MenuItemResponse) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItemId === item.id)
      if (existing) {
        return prev.map((c) =>
          c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c,
        )
      }
      return [...prev, {
        menuItemId: item.id,
        itemName: item.name,
        unitPrice: item.price,
        quantity: 1,
      }]
    })
  }

  const removeFromCart = (menuItemId: string) =>
    setCart((prev) => prev.filter((c) => c.menuItemId !== menuItemId))

  const updateQty = (menuItemId: string, qty: number) => {
    if (qty <= 0) {
      removeFromCart(menuItemId)
      return
    }
    setCart((prev) =>
      prev.map((c) => c.menuItemId === menuItemId ? { ...c, quantity: qty } : c),
    )
  }

  const clearCart = () => {
    setCart([])
    setNotes('')
    setDiscountInput('')
    setDiscount(null)
  }

  // ── Totals ────────────────────────────────────────────────────────────────

  const subTotal = cart.reduce((s, c) => s + c.unitPrice * c.quantity, 0)
  // A discount code is applied when the table's order is opened; later rounds join that order as they are.
  const canDiscount = !openOrder
  const discountAmount = canDiscount && discount?.isValid ? (discount.discountAmount ?? 0) : 0
  // Menu prices include VAT: the customer pays the listed price less any discount.
  const total = Math.round((subTotal - discountAmount) * 100) / 100
  const taxAmount = Math.round((total * VAT / (1 + VAT)) * 100) / 100

  // ── Discount validation ───────────────────────────────────────────────────

  const validateDiscount = useCallback(async () => {
    if (!discountInput.trim()) return
    try {
      const { data } = await restaurantApi.validateDiscountCode(branchId, discountInput.trim(), subTotal)
      setDiscount(data)
      if (data.isValid) {
        toast.success('تم تطبيق الخصم', `خصم ${formatCurrency(data.discountAmount)}`)
      } else {
        toast.error('رمز الخصم غير صالح', data.errorMessage ?? '')
      }
    } catch {
      toast.error('خطأ', 'تعذر التحقق من رمز الخصم')
    }
  }, [discountInput, branchId, subTotal])

  // ── Send to kitchen ────────────────────────────────────────────────────────
  // One call each way: a new order is opened and sent together, and a later round joins the open order,
  // so retrying after a failure never leaves a stray order on the table.

  const sendToKitchenMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTable) throw new Error('No table selected')
      if (cart.length === 0) throw new Error('Cart empty')
      const items: OrderItemInput[] = cart.map((c) => ({
        menuItemId: c.menuItemId,
        quantity: c.quantity,
        notes: c.notes,
      }))

      if (openOrder) {
        const { data } = await restaurantApi.addItems(branchId, openOrder.id, items)
        return data
      }

      const { data } = await restaurantApi.createOrder(branchId, {
        tableNumber: selectedTable,
        items,
        notes: notes || undefined,
        discountCode: discount?.isValid ? discountInput.trim() : undefined,
        sendToKitchen: true,
      })
      return data
    },
    onSuccess: () => {
      void refreshOrders()
      clearCart()
      toast.success('تم الإرسال للمطبخ', `الطاولة ${selectedTable}`)
    },
    onError: (e) => {
      void refreshOrders()
      toast.error('فشل الإرسال', restaurantErrorMessage(e, 'يرجى المحاولة مرة أخرى'))
    },
  })

  // ── Pay ───────────────────────────────────────────────────────────────────

  const payMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTable || !bill) throw new Error('No active order')
      const tendered = paymentMethod === 'Cash'
        ? Math.max(parseFloat(amountTendered) || 0, bill.total)
        : bill.total
      const { data } = await restaurantApi.payTable(branchId, {
        tableNumber: selectedTable,
        orderIds: tableOrders.map((o) => o.id),
        paymentMethod,
        amountTendered: tendered,
      })
      return data
    },
    onSuccess: (paid) => {
      setPaidOrders(paid)
      void refreshOrders()
      setShowPayment(false)
      toast.success('تمت عملية الدفع', `الطاولة ${selectedTable}`)
    },
    onError: (e) => {
      void refreshOrders()
      toast.error('فشلت عملية الدفع', restaurantErrorMessage(e, 'يرجى المحاولة مرة أخرى'))
    },
  })

  // ── Manager: void a line or cancel an order ───────────────────────────────

  const removeItemMutation = useMutation({
    mutationFn: ({ orderId, itemId }: { orderId: string; itemId: string }) =>
      restaurantApi.removeItem(branchId, orderId, itemId),
    onSuccess: () => {
      void refreshOrders()
      setVoidTarget(null)
      toast.success('حُذف الصنف من الطلب')
    },
    onError: (e) => toast.error('تعذّر حذف الصنف', restaurantErrorMessage(e)),
  })

  const cancelMutation = useMutation({
    mutationFn: ({ orderId, reason }: { orderId: string; reason: string }) =>
      restaurantApi.cancelOrder(branchId, orderId, reason),
    onSuccess: () => {
      void refreshOrders()
      setCancelTarget(null)
      toast.success('أُلغي الطلب')
    },
    onError: (e) => toast.error('تعذّر إلغاء الطلب', restaurantErrorMessage(e)),
  })

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Start: Table grid + Menu */}
      <div className="flex flex-1 flex-col overflow-hidden border-e border-border">
        {/* Table grid */}
        <div className="border-b border-border p-4">
          <p className="mb-3 text-sm font-semibold text-fg">{t.restaurant.selectTable}</p>
          <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
            {Array.from({ length: TOTAL_TABLES }, (_, i) => i + 1).map((n) => {
              const color = getTableColor(n, orders)
              return (
                <button
                  key={n}
                  onClick={() => setSelectedTable(n)}
                  className={cn(
                    'flex h-10 w-full items-center justify-center rounded-lg text-sm font-bold transition-all',
                    selectedTable === n && 'ring-2 ring-offset-1',
                    color === 'empty' && 'bg-success/10 text-success dark:bg-success/15 hover:bg-success/20',
                    color === 'busy' && 'bg-danger/10 text-danger dark:bg-danger/15 hover:bg-danger/20',
                    color === 'ready' && 'bg-warning/10 text-warning dark:bg-warning/15 hover:bg-warning/20',
                    selectedTable === n && color === 'empty' && 'ring-success/40',
                    selectedTable === n && color === 'busy' && 'ring-danger/40',
                    selectedTable === n && color === 'ready' && 'ring-warning/40',
                  )}
                  title={
                    color === 'empty' ? t.restaurant.available :
                    color === 'busy' ? t.restaurant.occupied : 'جاهزة للخدمة'
                  }
                >
                  {n}
                </button>
              )
            })}
          </div>
          <div className="mt-2 flex items-center gap-4 text-xs text-muted">
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-success" />{t.restaurant.available}</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-danger" />{t.restaurant.occupied}</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-warning" />{t.kitchen.ready}</span>
          </div>
        </div>

        {/* Menu items */}
        {selectedTable && (
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Category filter */}
            <div className="flex gap-2 overflow-x-auto border-b border-border px-4 py-2">
              <button
                onClick={() => setSelectedCategory(null)}
                className={cn(
                  'shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  selectedCategory === null
                    ? 'bg-brand text-brand-fg'
                    : 'bg-surface-2 text-muted hover:bg-border',
                )}
              >
                {t.restaurant.all}
              </button>
              {CATEGORY_LIST.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    'shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors',
                    selectedCategory === cat
                      ? 'bg-brand text-brand-fg'
                      : 'bg-surface-2 text-muted hover:bg-border',
                  )}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
            {/* Items grid */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {filteredItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => addToCart(item)}
                    className="flex flex-col rounded-xl border border-border bg-surface p-3 text-start transition-all hover:border-info/30 hover:shadow-sm active:scale-[0.98]"
                  >
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10 dark:bg-warning/15">
                      <span className="text-lg">🍽️</span>
                    </div>
                    <p className="line-clamp-2 text-sm font-medium text-fg">
                      {item.name}
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted">
                      {CATEGORY_LABELS[item.category]}
                    </p>
                    <p className="mt-auto pt-2 text-sm font-bold text-info">
                      {formatCurrency(item.price)}
                    </p>
                  </button>
                ))}
                {filteredItems.length === 0 && (
                  <p className="col-span-full py-12 text-center text-sm text-muted">
                    لا توجد أصناف متاحة
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {!selectedTable && (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <ChefHat className="mx-auto mb-3 h-12 w-12 text-muted/50" />
              <p className="text-sm text-muted">{t.restaurant.selectTable}</p>
            </div>
          </div>
        )}
      </div>

      {/* End: Order panel */}
      <div className="flex w-80 flex-col bg-surface">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-semibold text-fg">
            {selectedTable ? t.restaurant.orderFor.replace('{n}', String(selectedTable)) : 'الطلب الحالي'}
          </h2>
          {tableOrders.length === 1 && <div className="mt-1"><OrderStatusBadge status={tableOrders[0].status} /></div>}
          {tableOrders.length > 1 && (
            <p className="mt-1 text-xs text-muted">{tableOrders.length} طلبات مفتوحة · فاتورة واحدة</p>
          )}
        </div>

        {/* What the table already sent: always shown, so the cashier sees it while adding a round */}
        {tableOrders.length > 0 && (
          <div className={cn('overflow-y-auto border-b border-border p-4', cart.length > 0 ? 'max-h-48' : 'max-h-[45%]')}>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium text-muted">المُرسل للمطبخ</p>
              {bill && <p className="text-xs font-semibold tabular-nums text-fg">{formatCurrency(bill.total)}</p>}
            </div>
            <div className="space-y-3">
              {tableOrders.map((order, idx) => (
                <div key={order.id}>
                  {(tableOrders.length > 1 || canManage) && (
                    <div className="mb-1 flex items-center justify-between gap-2">
                      {tableOrders.length > 1
                        ? <span className="flex items-center gap-2 text-xs text-muted">طلب {idx + 1} <OrderStatusBadge status={order.status} /></span>
                        : <span />}
                      {canManage && (
                        <button
                          onClick={() => setCancelTarget(order)}
                          className="flex items-center gap-1 text-xs text-muted hover:text-danger"
                        >
                          <Ban className="h-3 w-3" />
                          إلغاء الطلب
                        </button>
                      )}
                    </div>
                  )}
                  <ul className="space-y-1">
                    {order.items.map((item) => (
                      <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="min-w-0 flex-1 truncate text-fg">
                          {item.itemName} × {item.quantity}
                        </span>
                        <span className={cn(
                          'shrink-0 text-xs',
                          item.status === 'Ready' ? 'text-success' :
                          item.status === 'Preparing' ? 'text-info' : 'text-muted',
                        )}>
                          {item.status === 'Ready' ? t.kitchen.ready :
                           item.status === 'Preparing' ? t.kitchen.preparing : 'انتظار'}
                        </span>
                        {canManage && item.status !== 'Ready' && order.items.length > 1 && (
                          <button
                            onClick={() => setVoidTarget({
                              orderId: order.id,
                              itemId: item.id,
                              label: `${item.itemName} × ${item.quantity}`,
                            })}
                            disabled={removeItemMutation.isPending}
                            className="shrink-0 rounded-md p-1 text-muted/50 hover:bg-surface-2 hover:text-danger disabled:opacity-40"
                            aria-label={`حذف ${item.itemName}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cart items: the next round */}
        <div className="flex-1 overflow-y-auto">
          {cart.length === 0 ? (
            <p className="mt-16 text-center text-sm text-muted">
              {!selectedTable ? 'اختر طاولة أولاً' : openOrder ? 'أضف أصنافاً لجولة جديدة' : 'أضف أصنافاً للطلب'}
            </p>
          ) : (
            <>
              {openOrder && <p className="px-4 pt-3 text-xs font-medium text-muted">جولة جديدة</p>}
              <ul className="divide-y divide-border">
                {cart.map((item) => (
                  <li key={item.menuItemId} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium text-fg">
                          {item.itemName}
                        </p>
                        <p className="text-xs text-muted">
                          {formatCurrency(item.unitPrice)} للوحدة
                        </p>
                      </div>
                      <button onClick={() => removeFromCart(item.menuItemId)}
                        className="text-muted/50 hover:text-danger">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateQty(item.menuItemId, item.quantity - 1)}
                          className="flex h-6 w-6 items-center justify-center rounded-md border border-border text-muted hover:bg-surface-2"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                        <button
                          onClick={() => updateQty(item.menuItemId, item.quantity + 1)}
                          className="flex h-6 w-6 items-center justify-center rounded-md border border-border text-muted hover:bg-surface-2"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <span className="text-sm font-semibold text-fg">
                        {formatCurrency(item.unitPrice * item.quantity)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* Discount code: applied when the table's order is opened */}
        {cart.length > 0 && canDiscount && (
          <div className="border-t border-border px-4 py-3">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="رمز الخصم"
                value={discountInput}
                onChange={(e) => {
                  setDiscountInput(e.target.value.toUpperCase())
                  setDiscount(null)
                }}
                onKeyDown={(e) => e.key === 'Enter' && validateDiscount()}
                className="input flex-1 text-sm"
                dir="ltr"
              />
              <Button size="sm" variant="secondary" onClick={validateDiscount}
                disabled={!discountInput.trim()}>
                <Tag className="h-3.5 w-3.5" />
                تطبيق
              </Button>
            </div>
            {discount && (
              <p className={cn(
                'mt-1 text-xs',
                discount.isValid ? 'text-success' : 'text-danger',
              )}>
                {discount.isValid
                  ? `${t.restaurant.discount}: ${formatCurrency(discount.discountAmount)}`
                  : discount.errorMessage}
              </p>
            )}
          </div>
        )}

        {/* Totals + actions */}
        <div className="border-t border-border p-4">
          {cart.length > 0 && (
            <div className="mb-3 space-y-1 text-sm">
              <div className="flex justify-between text-muted">
                <span>{t.restaurant.subtotal}</span>
                <span className="tabular-nums">{formatCurrency(subTotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-success">
                  <span>{t.restaurant.discount}</span>
                  <span className="tabular-nums">- {formatCurrency(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-muted">
                <span>{t.restaurant.tax}</span>
                <span className="tabular-nums">{formatCurrency(taxAmount)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-2">
                <span className="font-medium text-fg">{openOrder ? 'الجولة الجديدة' : t.restaurant.total}</span>
                <span className="text-xl font-bold text-fg">
                  {formatCurrency(total)}
                </span>
              </div>
              {bill && (
                <div className="flex justify-between text-xs text-muted">
                  <span>مع المُرسل سابقاً</span>
                  <span className="tabular-nums">{formatCurrency(r2(bill.total + total))}</span>
                </div>
              )}
            </div>
          )}

          {bill && cart.length === 0 && (
            <div className="mb-3 space-y-1 text-sm">
              <div className="flex justify-between text-muted">
                <span>{t.restaurant.subtotal}</span>
                <span className="tabular-nums">{formatCurrency(bill.subTotal)}</span>
              </div>
              {bill.discountAmount > 0 && (
                <div className="flex justify-between text-success">
                  <span>{t.restaurant.discount}</span>
                  <span className="tabular-nums">- {formatCurrency(bill.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-muted">
                <span>{t.restaurant.tax}</span>
                <span className="tabular-nums">{formatCurrency(bill.taxAmount)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-2">
                <span className="font-medium text-fg">{t.restaurant.total}</span>
                <span className="text-xl font-bold text-fg">
                  {formatCurrency(bill.total)}
                </span>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={clearCart}
              disabled={cart.length === 0}
              className="flex-1"
            >
              <X className="h-4 w-4" />
              {t.restaurant.clear}
            </Button>

            {cart.length > 0 && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => sendToKitchenMutation.mutate()}
                loading={sendToKitchenMutation.isPending}
                disabled={!selectedTable || cart.length === 0}
                className="flex-1"
              >
                <ChefHat className="h-4 w-4" />
                {t.kitchen.sendToKitchen}
              </Button>
            )}

            {bill && cart.length === 0 && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => { setShowPayment(true); setAmountTendered('') }}
                className="flex-1"
              >
                <CreditCard className="h-4 w-4" />
                {t.restaurant.pay}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Payment modal */}
      {showPayment && bill && (
        <PaymentModal
          bill={bill}
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
          amountTendered={amountTendered}
          setAmountTendered={setAmountTendered}
          onClose={() => setShowPayment(false)}
          onConfirm={() => payMutation.mutate()}
          isPending={payMutation.isPending}
        />
      )}

      {cancelTarget && (
        <CancelOrderModal
          order={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onConfirm={(reason) => cancelMutation.mutate({ orderId: cancelTarget.id, reason })}
          isPending={cancelMutation.isPending}
        />
      )}

      <ConfirmModal
        open={!!voidTarget}
        onClose={() => setVoidTarget(null)}
        onConfirm={() => voidTarget && removeItemMutation.mutate({ orderId: voidTarget.orderId, itemId: voidTarget.itemId })}
        title="حذف الصنف؟"
        message={`${voidTarget?.label ?? ''} سيُحذف من طلب الطاولة`}
        confirmLabel="حذف"
        confirmVariant="danger"
        loading={removeItemMutation.isPending}
      />

      {/* ZATCA Receipt */}
      {paidOrders && paidOrders.length > 0 && (
        <RestaurantReceiptModal
          orders={paidOrders}
          label={`${t.restaurant.table} ${paidOrders[0].tableNumber}`}
          onClose={() => setPaidOrders(null)}
        />
      )}
    </div>
  )
}

// ── Payment Modal ─────────────────────────────────────────────────────────────

function PaymentModal({
  bill,
  paymentMethod,
  setPaymentMethod,
  amountTendered,
  setAmountTendered,
  onClose,
  onConfirm,
  isPending,
}: {
  bill: TableBill
  paymentMethod: 'Cash' | 'Card'
  setPaymentMethod: (m: 'Cash' | 'Card') => void
  amountTendered: string
  setAmountTendered: (v: string) => void
  onClose: () => void
  onConfirm: () => void
  isPending: boolean
}) {
  const { t } = useI18n()
  const total = bill.total
  const tendered = parseFloat(amountTendered) || 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" dir="rtl">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl bg-surface p-6 shadow-2xl mx-4">
        <h2 className="mb-1 text-lg font-semibold">{t.restaurant.pay} — {t.restaurant.table} {bill.tableNumber}</h2>
        {bill.orderCount > 1 && (
          <p className="mb-2 text-xs text-muted">تشمل {bill.orderCount} طلبات على الطاولة</p>
        )}
        <div className="mb-4 space-y-1 text-sm">
          <div className="flex justify-between text-muted">
            <span>{t.restaurant.subtotal}</span>
            <span>{formatCurrency(bill.subTotal)}</span>
          </div>
          {bill.discountAmount > 0 && (
            <div className="flex justify-between text-success">
              <span>{t.restaurant.discount}</span>
              <span>- {formatCurrency(bill.discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-muted">
            <span>{t.restaurant.tax}</span>
            <span>{formatCurrency(bill.taxAmount)}</span>
          </div>
        </div>
        <div className="mb-6 rounded-xl bg-surface-2 p-4">
          <p className="text-sm text-muted">المبلغ المستحق</p>
          <p className="text-3xl font-bold text-fg">{formatCurrency(total)}</p>
        </div>
        <p className="mb-3 text-sm font-medium text-fg">طريقة الدفع</p>
        <div className="mb-6 grid grid-cols-2 gap-2">
          {(['Cash', 'Card'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setPaymentMethod(m)}
              className={cn(
                'flex items-center gap-2 rounded-xl border p-3 text-sm font-medium transition-colors',
                paymentMethod === m
                  ? 'border-brand bg-brand-soft text-brand-ink'
                  : 'border-border text-muted hover:bg-surface-2',
              )}
            >
              {m === 'Cash' ? <Banknote className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
              {m === 'Cash' ? 'نقداً' : 'بطاقة'}
            </button>
          ))}
        </div>
        {paymentMethod === 'Cash' && (
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-fg">
              المبلغ المستلم (ر.س)
            </label>
            <input
              type="number"
              min={total}
              step="0.01"
              placeholder={String(total)}
              value={amountTendered}
              onChange={(e) => setAmountTendered(e.target.value)}
              className="input w-full"
              dir="ltr"
            />
            {tendered >= total && tendered > 0 && (
              <p className="mt-1 text-sm text-success">
                الباقي: {formatCurrency(tendered - total)}
              </p>
            )}
          </div>
        )}
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">{t.common.cancel}</Button>
          <Button
            variant="primary"
            onClick={onConfirm}
            loading={isPending}
            disabled={paymentMethod === 'Cash' && !!amountTendered && tendered < total}
            className="flex-1"
          >
            تأكيد الدفع
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Cancel Order Modal ────────────────────────────────────────────────────────

function CancelOrderModal({
  order,
  onClose,
  onConfirm,
  isPending,
}: {
  order: RestaurantOrderResponse
  onClose: () => void
  onConfirm: (reason: string) => void
  isPending: boolean
}) {
  const { t } = useI18n()
  const [reason, setReason] = useState('')
  const trimmed = reason.trim()

  return (
    <Modal
      open
      onClose={onClose}
      title={`إلغاء طلب الطاولة ${order.tableNumber}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isPending}>{t.common.back}</Button>
          <Button variant="danger" onClick={() => onConfirm(trimmed)} loading={isPending} disabled={!trimmed}>
            إلغاء الطلب
          </Button>
        </>
      }
    >
      <div className="space-y-3" dir="rtl">
        <p className="text-sm text-muted">
          {order.items.length} أصناف بقيمة {formatCurrency(order.total)}. لا يمكن التراجع عن الإلغاء.
        </p>
        <div className="flex flex-wrap gap-2">
          {CANCEL_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                trimmed === r ? 'border-danger bg-danger/10 text-danger' : 'border-border text-muted hover:bg-surface-2',
              )}
            >
              {r}
            </button>
          ))}
        </div>
        <Input
          label="سبب الإلغاء"
          value={reason}
          maxLength={256}
          onChange={(e) => setReason(e.target.value)}
          placeholder="اكتب السبب"
        />
      </div>
    </Modal>
  )
}

// ── Manager View ──────────────────────────────────────────────────────────────

const discountSchema = z.object({
  code: z.string().min(2).max(32).toUpperCase(),
  type: z.enum(['Percentage', 'Fixed']),
  value: z.coerce.number().positive(),
  minOrderAmount: z.coerce.number().min(0),
  maxUses: z.coerce.number().int().min(0),
  expiryDate: z.string().min(1, 'التاريخ مطلوب'),
})

const menuSchema = z.object({
  name: z.string().min(1, 'الاسم مطلوب'),
  description: z.string().optional(),
  category: z.enum(['Starters', 'Mains', 'Sides', 'Beverages', 'Desserts', 'Specials']),
  price: z.coerce.number().positive('يجب أن يكون السعر موجباً'),
  currency: z.string().length(3),
  sortOrder: z.coerce.number().int().min(0),
})

type DiscountFormData = z.infer<typeof discountSchema>
type MenuFormData = z.infer<typeof menuSchema>

function ManagerView({ branchId }: { branchId: string }) {
  const { tenantId } = useAuthStore()
  const qc = useQueryClient()
  const { t } = useI18n()
  const [showDiscountModal, setShowDiscountModal] = useState(false)
  const [showMenuModal, setShowMenuModal] = useState(false)
  const [editingMenuItem, setEditingMenuItem] = useState<MenuItemResponse | null>(null)
  const [recipeItem, setRecipeItem] = useState<MenuItemResponse | null>(null)
  const { data: recipeSummaries } = useQuery({
    queryKey: ['recipe-summaries', tenantId],
    queryFn: () => recipesApi.listSummaries(tenantId!),
    enabled: !!tenantId,
  })
  const recipeCost = new Map((recipeSummaries?.data ?? []).map((r) => [r.variantId, r.totalCost]))

  const { data: discountsData } = useQuery({
    queryKey: ['discount-codes', tenantId],
    queryFn: () => restaurantApi.listDiscountCodes(branchId),
    enabled: !!tenantId,
  })

  const { data: ordersData } = useQuery({
    queryKey: ['restaurant-orders', branchId],
    queryFn: () => restaurantApi.listActiveOrders(branchId),
    enabled: !!branchId,
  })

  const { data: menuData, isLoading: menuLoading } = useQuery({
    queryKey: ['menu-items', branchId],
    queryFn: () => restaurantApi.listMenuItems(branchId),
    enabled: !!branchId,
  })

  // The active list never holds paid orders; today's takings come from the orders paid since midnight.
  const [dayStart] = useState(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  })
  const { data: paidData } = useQuery({
    queryKey: ['restaurant-orders', branchId, 'paid', dayStart.toISOString()],
    queryFn: () => restaurantApi.listPaidOrders(
      branchId, dayStart.toISOString(), new Date(dayStart.getTime() + 86_400_000).toISOString()),
    enabled: !!branchId,
  })

  const discounts = discountsData?.data ?? []
  const orders = (ordersData?.data ?? []).filter((o) => !o.kitchenOnly)
  const menuItems = menuData?.data ?? []
  const paidToday = (paidData?.data ?? []).filter((o) => !o.kitchenOnly)

  const todayRevenue = paidToday.reduce((s, o) => s + o.total, 0)

  const discountForm = useForm<DiscountFormData>({
    resolver: zodResolver(discountSchema),
    defaultValues: { type: 'Percentage', minOrderAmount: 0, maxUses: 0 },
  })

  const menuForm = useForm<MenuFormData>({
    resolver: zodResolver(menuSchema),
    defaultValues: { currency: 'SAR', category: 'Mains', sortOrder: 0 },
  })

  const createDiscountMutation = useMutation({
    mutationFn: (data: DiscountFormData) =>
      restaurantApi.createDiscountCode(branchId, {
        code: data.code,
        type: data.type,
        value: data.value,
        minOrderAmount: data.minOrderAmount,
        maxUses: data.maxUses,
        expiryDate: new Date(data.expiryDate).toISOString(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['discount-codes', tenantId] })
      setShowDiscountModal(false)
      discountForm.reset()
      toast.success('تم إنشاء رمز الخصم')
    },
    onError: (e) => toast.error('فشل إنشاء رمز الخصم', restaurantErrorMessage(e)),
  })

  const saveMenuMutation = useMutation({
    mutationFn: (data: MenuFormData) =>
      editingMenuItem
        ? restaurantApi.updateMenuItem(branchId, editingMenuItem.id, {
            name: data.name,
            description: data.description,
            category: data.category,
            price: data.price,
            sortOrder: data.sortOrder,
          })
        : restaurantApi.createMenuItem(branchId, {
            name: data.name,
            description: data.description,
            category: data.category,
            price: data.price,
            currency: data.currency,
            sortOrder: data.sortOrder,
          }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu-items', branchId] })
      setShowMenuModal(false)
      setEditingMenuItem(null)
      menuForm.reset({ currency: 'SAR', category: 'Mains', sortOrder: 0 })
      toast.success(editingMenuItem ? 'تم تحديث الصنف' : 'تم إضافة الصنف')
    },
    onError: (e) => toast.error('فشل حفظ الصنف', restaurantErrorMessage(e)),
  })

  const toggleAvailabilityMutation = useMutation({
    mutationFn: ({ id, isAvailable }: { id: string; isAvailable: boolean }) =>
      restaurantApi.setAvailability(branchId, id, { isAvailable }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu-items', branchId] }),
    onError: (e) => toast.error('فشل تحديث التوفر', restaurantErrorMessage(e)),
  })

  const openEditMenuItem = (item: MenuItemResponse) => {
    setEditingMenuItem(item)
    menuForm.reset({
      name: item.name,
      description: item.description ?? '',
      category: item.category,
      price: item.price,
      currency: item.currency,
      sortOrder: item.sortOrder,
    })
    setShowMenuModal(true)
  }

  const openCreateMenuItem = () => {
    setEditingMenuItem(null)
    menuForm.reset({ currency: 'SAR', category: 'Mains', sortOrder: 0 })
    setShowMenuModal(true)
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6" dir="rtl">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-sm text-muted">الطلبات النشطة</p>
          <p className="text-3xl font-bold text-info">
            {orders.filter((o) => !['Paid', 'Cancelled'].includes(o.status)).length}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted">إيرادات اليوم</p>
          <p className="text-2xl font-bold text-success">
            {formatCurrency(todayRevenue)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted">الطلبات المدفوعة</p>
          <p className="text-3xl font-bold text-fg">
            {paidToday.length}
          </p>
        </Card>
      </div>

      {/* Menu management */}
      <Card>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="font-semibold text-fg">إدارة القائمة</h3>
          <Button size="sm" onClick={openCreateMenuItem}>
            <Plus className="h-4 w-4" />
            إضافة صنف
          </Button>
        </div>
        <div className="divide-y divide-border">
          {menuLoading && (
            <div className="p-4 text-center text-sm text-muted">{t.common.loading}</div>
          )}
          {menuItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2 cursor-pointer"
              onClick={() => openEditMenuItem(item)}
            >
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-fg">
                  {item.name}
                </p>
                <p className="text-xs text-muted">
                  {CATEGORY_LABELS[item.category]} — {formatCurrency(item.price)}
                  {recipeCost.has(item.id) && item.price > 0 && (
                    <span className="ms-2 tabular-nums">
                      · تكلفة {recipeCost.get(item.id)!.toFixed(2)} ر.س · هامش{' '}
                      {marginPercent(item.price, recipeCost.get(item.id)!)!.toFixed(0)}%
                    </span>
                  )}
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation()
                  setRecipeItem(item)
                }}
                aria-label={`وصفة ${item.name}`}
              >
                <FlaskConical className="h-3.5 w-3.5" />
                {recipeCost.has(item.id) ? 'الوصفة' : 'إضافة وصفة'}
              </Button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  toggleAvailabilityMutation.mutate({ id: item.id, isAvailable: !item.isAvailable })
                }}
                className={cn('text-sm', item.isAvailable ? 'text-success' : 'text-muted')}
              >
                {item.isAvailable
                  ? <ToggleRight className="h-5 w-5" />
                  : <ToggleLeft className="h-5 w-5" />
                }
              </button>
            </div>
          ))}
          {!menuLoading && menuItems.length === 0 && (
            <p className="p-4 text-center text-sm text-muted">لا توجد أصناف بعد</p>
          )}
        </div>
      </Card>

      {recipeItem && (
        <RecipeModal
          variant={{ id: recipeItem.id, name: recipeItem.name, salePrice: recipeItem.price, currency: recipeItem.currency }}
          onClose={() => setRecipeItem(null)}
        />
      )}

      {/* Discount codes */}
      <Card>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="font-semibold text-fg">رموز الخصم</h3>
          <Button size="sm" onClick={() => setShowDiscountModal(true)}>
            <Plus className="h-4 w-4" />
            إضافة رمز
          </Button>
        </div>
        <div className="divide-y divide-border">
          {discounts.map((dc) => (
            <div key={dc.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="font-mono text-sm font-medium text-fg">
                  {dc.code}
                </p>
                <p className="text-xs text-muted">
                  {dc.type === 'Percentage' ? `${dc.value}%` : formatCurrency(dc.value)}
                  {dc.minOrderAmount > 0 && ` — حد أدنى ${formatCurrency(dc.minOrderAmount)}`}
                  {' — '}
                  {dc.maxUses === 0 ? 'غير محدود' : `${dc.usedCount}/${dc.maxUses} استخدام`}
                </p>
              </div>
              <div className="text-end">
                <span className={cn(
                  'rounded-full px-2 py-0.5 text-xs font-medium',
                  discountCodeState(dc) === 'active'
                    ? 'bg-success/10 text-success'
                    : 'bg-surface-2 text-muted',
                )}>
                  {discountCodeState(dc) === 'active' ? 'نشط' : 'منتهي'}
                </span>
              </div>
            </div>
          ))}
          {discounts.length === 0 && (
            <p className="p-4 text-center text-sm text-muted">لا توجد رموز خصم بعد</p>
          )}
        </div>
      </Card>

      {/* Create Discount Modal */}
      <Modal
        open={showDiscountModal}
        onClose={() => setShowDiscountModal(false)}
        title="إضافة رمز خصم جديد"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowDiscountModal(false)}>{t.common.cancel}</Button>
            <Button
              loading={createDiscountMutation.isPending}
              onClick={discountForm.handleSubmit((d) => createDiscountMutation.mutate(d))}
            >
              إنشاء
            </Button>
          </>
        }
      >
        <form className="space-y-4" dir="rtl">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="رمز الخصم"
              placeholder="مثال: RAMADAN20"
              error={discountForm.formState.errors.code?.message}
              {...discountForm.register('code')}
              className="uppercase"
            />
            <Select label="النوع" {...discountForm.register('type')}>
              <option value="Percentage">نسبة مئوية %</option>
              <option value="Fixed">مبلغ ثابت ر.س</option>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input
              label="القيمة"
              type="number"
              step="0.01"
              error={discountForm.formState.errors.value?.message}
              {...discountForm.register('value')}
            />
            <Input
              label="الحد الأدنى للطلب"
              type="number"
              step="0.01"
              {...discountForm.register('minOrderAmount')}
            />
            <Input
              label="أقصى استخدامات (0 = غير محدود)"
              type="number"
              {...discountForm.register('maxUses')}
            />
          </div>
          <Input
            label="تاريخ الانتهاء"
            type="datetime-local"
            error={discountForm.formState.errors.expiryDate?.message}
            {...discountForm.register('expiryDate')}
          />
        </form>
      </Modal>

      {/* Create/Edit Menu Item Modal */}
      <Modal
        open={showMenuModal}
        onClose={() => { setShowMenuModal(false); setEditingMenuItem(null) }}
        title={editingMenuItem ? 'تعديل الصنف' : 'إضافة صنف جديد'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setShowMenuModal(false); setEditingMenuItem(null) }}>
              {t.common.cancel}
            </Button>
            <Button
              loading={saveMenuMutation.isPending}
              onClick={menuForm.handleSubmit((d) => saveMenuMutation.mutate(d))}
            >
              {editingMenuItem ? 'تحديث' : 'إضافة'}
            </Button>
          </>
        }
      >
        <form className="space-y-4" dir="rtl">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="اسم الصنف"
              error={menuForm.formState.errors.name?.message}
              {...menuForm.register('name')}
            />
            <Select label="التصنيف" {...menuForm.register('category')}>
              {CATEGORY_LIST.map((c) => (
                <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
              ))}
            </Select>
          </div>
          <Input label="الوصف" {...menuForm.register('description')} />
          <div className="grid grid-cols-3 gap-4">
            <Input
              label="السعر"
              type="number"
              step="0.01"
              error={menuForm.formState.errors.price?.message}
              {...menuForm.register('price')}
            />
            <Input label="العملة" maxLength={3} {...menuForm.register('currency')} />
            <Input label="الترتيب" type="number" {...menuForm.register('sortOrder')} />
          </div>
        </form>
      </Modal>
    </div>
  )
}
