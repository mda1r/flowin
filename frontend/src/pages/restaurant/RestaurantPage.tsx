import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Plus, Minus, Trash2, CreditCard, Banknote, X, QrCode,
  Tag, ChefHat, ToggleLeft, ToggleRight,
  ExternalLink,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Card } from '@/components/ui/Card'
import { restaurantApi } from '@/api/restaurant'
import { zatcaApi } from '@/api/zatca'
import { useAuthStore } from '@/stores/authStore'
import { toast } from '@/components/ui/Toast'
import { formatCurrency } from '@/lib/utils'
import { generateZatcaQr, SAUDI_VAT_RATE } from '@/lib/zatca'
import { cn } from '@/lib/utils'
import type {
  MenuItemResponse,
  MenuCategory,
  RestaurantOrderResponse,
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

// ── Cart types ────────────────────────────────────────────────────────────────

interface CartItem {
  menuItemId: string
  itemName: string
  unitPrice: number
  quantity: number
  notes?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTableColor(
  tableNumber: number,
  orders: RestaurantOrderResponse[],
): 'empty' | 'busy' | 'ready' {
  const tableOrders = orders.filter(
    (o) => o.tableNumber === tableNumber &&
      !['Paid', 'Cancelled'].includes(o.status),
  )
  if (tableOrders.length === 0) return 'empty'
  if (tableOrders.some((o) => o.status === 'Ready' || o.status === 'Served')) return 'ready'
  return 'busy'
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type Tab = 'cashier' | 'manager'

export function RestaurantPage() {
  const [activeTab, setActiveTab] = useState<Tab>('cashier')
  const { branchId } = useAuthStore()

  return (
    <div className="flex h-[calc(100vh-0px)] flex-col" dir="rtl">
      <PageHeader
        title="المطعم"
        action={
          <div className="flex items-center gap-2">
            <a
              href="/restaurant/kitchen"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              <ExternalLink className="h-4 w-4" />
              عرض المطبخ
            </a>
            <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              {([['cashier', 'الكاشير'], ['manager', 'الإدارة']] as [Tab, string][]).map(([tab, label]) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'px-4 py-1.5 text-sm font-medium transition-colors',
                    activeTab === tab
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        }
      />

      {activeTab === 'cashier' && branchId && <CashierView branchId={branchId} />}
      {activeTab === 'manager' && branchId && <ManagerView branchId={branchId} />}
    </div>
  )
}

// ── Cashier View ──────────────────────────────────────────────────────────────

function CashierView({ branchId }: { branchId: string }) {
  const { tenantId } = useAuthStore()
  const qc = useQueryClient()

  const [selectedTable, setSelectedTable] = useState<number | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<MenuCategory | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [notes, setNotes] = useState('')
  const [discountInput, setDiscountInput] = useState('')
  const [discount, setDiscount] = useState<ValidateDiscountCodeResponse | null>(null)
  const [showPayment, setShowPayment] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card'>('Cash')
  const [amountTendered, setAmountTendered] = useState('')
  const [completedOrder, setCompletedOrder] = useState<RestaurantOrderResponse | null>(null)

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
  const orders = ordersData?.data ?? []

  const filteredItems = selectedCategory
    ? menuItems.filter((i) => i.category === selectedCategory && i.isAvailable)
    : menuItems.filter((i) => i.isAvailable)

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
  const discountAmount = discount?.isValid ? (discount.discountAmount ?? 0) : 0
  const taxable = subTotal - discountAmount
  const taxAmount = Math.round(taxable * VAT * 100) / 100
  const total = Math.round((taxable + taxAmount) * 100) / 100

  // ── Discount validation ───────────────────────────────────────────────────

  const validateDiscount = useCallback(async () => {
    if (!discountInput.trim() || !tenantId) return
    try {
      const { data } = await restaurantApi.validateDiscountCode(
        branchId, tenantId, discountInput.trim(), subTotal,
      )
      setDiscount(data)
      if (data.isValid) {
        toast.success('تم تطبيق الخصم', `خصم ${formatCurrency(data.discountAmount)}`)
      } else {
        toast.error('رمز الخصم غير صالح', data.errorMessage ?? '')
      }
    } catch {
      toast.error('خطأ', 'تعذر التحقق من رمز الخصم')
    }
  }, [discountInput, branchId, tenantId, subTotal])

  // ── Send to kitchen ────────────────────────────────────────────────────────

  const sendToKitchenMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTable || !tenantId) throw new Error('No table selected')
      if (cart.length === 0) throw new Error('Cart empty')

      const { data: order } = await restaurantApi.createOrder(branchId, {
        tenantId,
        tableNumber: selectedTable,
        items: cart.map((c) => ({
          menuItemId: c.menuItemId,
          itemName: c.itemName,
          quantity: c.quantity,
          unitPrice: c.unitPrice,
          notes: c.notes,
        })),
        notes: notes || undefined,
        discountCode: discount?.isValid ? discountInput.trim() : undefined,
      })

      await restaurantApi.sendToKitchen(branchId, order.id)
      return order
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['restaurant-orders', branchId] })
      clearCart()
      toast.success('تم الإرسال للمطبخ', `الطاولة ${selectedTable}`)
    },
    onError: () => toast.error('فشل الإرسال', 'يرجى المحاولة مرة أخرى'),
  })

  // ── Pay ───────────────────────────────────────────────────────────────────

  const payMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTable || !tenantId) throw new Error()
      const tableActiveOrders = orders.filter(
        (o) => o.tableNumber === selectedTable && !['Paid', 'Cancelled'].includes(o.status),
      )
      if (tableActiveOrders.length === 0) throw new Error('No active order')
      const order = tableActiveOrders[0]

      const tendered = paymentMethod === 'Cash' ? (parseFloat(amountTendered) || order.total) : order.total
      const { data: paid } = await restaurantApi.payOrder(branchId, order.id, {
        paymentMethod,
        amountTendered: tendered,
      })
      return paid
    },
    onSuccess: (order) => {
      setCompletedOrder(order)
      qc.invalidateQueries({ queryKey: ['restaurant-orders', branchId] })
      setShowPayment(false)
      toast.success('تمت عملية الدفع', 'تم معالجة الطلب بنجاح')
    },
    onError: () => toast.error('فشلت عملية الدفع', 'يرجى المحاولة مرة أخرى'),
  })

  const tableOrder = selectedTable
    ? orders.find(
        (o) => o.tableNumber === selectedTable && !['Paid', 'Cancelled'].includes(o.status),
      ) ?? null
    : null

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left: Table grid + Menu */}
      <div className="flex flex-1 flex-col overflow-hidden border-l border-gray-200 dark:border-gray-800">
        {/* Table grid */}
        <div className="border-b border-gray-200 p-4 dark:border-gray-800">
          <p className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">اختر الطاولة</p>
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
                    color === 'empty' && 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200',
                    color === 'busy' && 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200',
                    color === 'ready' && 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 hover:bg-orange-200',
                    selectedTable === n && color === 'empty' && 'ring-green-500',
                    selectedTable === n && color === 'busy' && 'ring-red-500',
                    selectedTable === n && color === 'ready' && 'ring-orange-500',
                  )}
                  title={
                    color === 'empty' ? 'فارغة' :
                    color === 'busy' ? 'مشغولة' : 'جاهزة للخدمة'
                  }
                >
                  {n}
                </button>
              )
            })}
          </div>
          <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-green-400" />فارغة</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-red-400" />مشغولة</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-orange-400" />جاهزة</span>
          </div>
        </div>

        {/* Menu items */}
        {selectedTable && (
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Category filter */}
            <div className="flex gap-2 overflow-x-auto border-b border-gray-200 px-4 py-2 dark:border-gray-800">
              <button
                onClick={() => setSelectedCategory(null)}
                className={cn(
                  'shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  selectedCategory === null
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400',
                )}
              >
                الكل
              </button>
              {CATEGORY_LIST.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    'shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors',
                    selectedCategory === cat
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400',
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
                    className="flex flex-col rounded-xl border border-gray-200 bg-white p-3 text-right transition-all hover:border-blue-300 hover:shadow-sm active:scale-[0.98] dark:border-gray-800 dark:bg-gray-900 dark:hover:border-blue-700"
                  >
                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 dark:bg-orange-900/20">
                      <span className="text-lg">🍽️</span>
                    </div>
                    <p className="line-clamp-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                      {item.name}
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-gray-400">
                      {CATEGORY_LABELS[item.category]}
                    </p>
                    <p className="mt-auto pt-2 text-sm font-bold text-blue-600 dark:text-blue-400">
                      {formatCurrency(item.price)}
                    </p>
                  </button>
                ))}
                {filteredItems.length === 0 && (
                  <p className="col-span-full py-12 text-center text-sm text-gray-400">
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
              <ChefHat className="mx-auto mb-3 h-12 w-12 text-gray-300" />
              <p className="text-sm text-gray-400">اختر طاولة لبدء الطلب</p>
            </div>
          </div>
        )}
      </div>

      {/* Right: Order panel */}
      <div className="flex w-80 flex-col bg-white dark:bg-gray-900">
        <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-800">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">
            {selectedTable ? `الطاولة ${selectedTable}` : 'الطلب الحالي'}
          </h2>
          {tableOrder && (
            <span className={cn(
              'mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium',
              tableOrder.status === 'Pending' && 'bg-yellow-100 text-yellow-700',
              tableOrder.status === 'InKitchen' && 'bg-blue-100 text-blue-700',
              tableOrder.status === 'Ready' && 'bg-green-100 text-green-700',
              tableOrder.status === 'Served' && 'bg-purple-100 text-purple-700',
            )}>
              {tableOrder.status === 'Pending' && 'قيد الانتظار'}
              {tableOrder.status === 'InKitchen' && 'في المطبخ'}
              {tableOrder.status === 'Ready' && 'جاهز'}
              {tableOrder.status === 'Served' && 'تم التقديم'}
            </span>
          )}
        </div>

        {/* Current active order for the table */}
        {tableOrder && cart.length === 0 && (
          <div className="border-b border-gray-200 p-4 dark:border-gray-800">
            <p className="mb-2 text-xs font-medium text-gray-500">الطلب الحالي</p>
            <ul className="space-y-1">
              {tableOrder.items.map((item) => (
                <li key={item.id} className="flex justify-between text-sm">
                  <span className="text-gray-700 dark:text-gray-300">
                    {item.itemName} × {item.quantity}
                  </span>
                  <span className={cn(
                    'text-xs',
                    item.status === 'Ready' ? 'text-green-600' :
                    item.status === 'Preparing' ? 'text-blue-600' : 'text-gray-400',
                  )}>
                    {item.status === 'Ready' ? 'جاهز' :
                     item.status === 'Preparing' ? 'يتحضر' : 'انتظار'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto">
          {cart.length === 0 ? (
            <p className="mt-16 text-center text-sm text-gray-400">
              {selectedTable ? 'أضف أصنافاً للطلب' : 'اختر طاولة أولاً'}
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {cart.map((item) => (
                <li key={item.menuItemId} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                        {item.itemName}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatCurrency(item.unitPrice)} للوحدة
                      </p>
                    </div>
                    <button onClick={() => removeFromCart(item.menuItemId)}
                      className="text-gray-300 hover:text-red-500">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateQty(item.menuItemId, item.quantity - 1)}
                        className="flex h-6 w-6 items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                      <button
                        onClick={() => updateQty(item.menuItemId, item.quantity + 1)}
                        className="flex h-6 w-6 items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {formatCurrency(item.unitPrice * item.quantity)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Discount code */}
        {cart.length > 0 && (
          <div className="border-t border-gray-200 px-4 py-3 dark:border-gray-800">
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
                discount.isValid ? 'text-green-600' : 'text-red-500',
              )}>
                {discount.isValid
                  ? `خصم: ${formatCurrency(discount.discountAmount)}`
                  : discount.errorMessage}
              </p>
            )}
          </div>
        )}

        {/* Totals + actions */}
        <div className="border-t border-gray-200 p-4 dark:border-gray-800">
          {cart.length > 0 && (
            <div className="mb-3 space-y-1 text-sm">
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>المجموع الجزئي</span>
                <span className="tabular-nums">{formatCurrency(subTotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>الخصم</span>
                  <span className="tabular-nums">- {formatCurrency(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>ضريبة القيمة المضافة 15%</span>
                <span className="tabular-nums">{formatCurrency(taxAmount)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-gray-100 pt-2 dark:border-gray-800">
                <span className="font-medium text-gray-700 dark:text-gray-300">الإجمالي</span>
                <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {formatCurrency(total)}
                </span>
              </div>
            </div>
          )}

          {tableOrder && cart.length === 0 && (
            <div className="mb-3 space-y-1 text-sm">
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>المجموع الجزئي</span>
                <span className="tabular-nums">{formatCurrency(tableOrder.subTotal)}</span>
              </div>
              {tableOrder.discountAmount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>الخصم</span>
                  <span className="tabular-nums">- {formatCurrency(tableOrder.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>ضريبة القيمة المضافة 15%</span>
                <span className="tabular-nums">{formatCurrency(tableOrder.taxAmount)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-gray-100 pt-2 dark:border-gray-800">
                <span className="font-medium text-gray-700 dark:text-gray-300">الإجمالي</span>
                <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {formatCurrency(tableOrder.total)}
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
              مسح
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
                إرسال للمطبخ
              </Button>
            )}

            {tableOrder && cart.length === 0 && !['Paid', 'Cancelled'].includes(tableOrder.status) && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => { setShowPayment(true); setAmountTendered('') }}
                className="flex-1"
              >
                <CreditCard className="h-4 w-4" />
                دفع
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Payment modal */}
      {showPayment && tableOrder && (
        <PaymentModal
          order={tableOrder}
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
          amountTendered={amountTendered}
          setAmountTendered={setAmountTendered}
          onClose={() => setShowPayment(false)}
          onConfirm={() => payMutation.mutate()}
          isPending={payMutation.isPending}
        />
      )}

      {/* ZATCA Receipt */}
      {completedOrder && (
        <RestaurantReceiptModal
          order={completedOrder}
          onClose={() => setCompletedOrder(null)}
        />
      )}
    </div>
  )
}

// ── Payment Modal ─────────────────────────────────────────────────────────────

function PaymentModal({
  order,
  paymentMethod,
  setPaymentMethod,
  amountTendered,
  setAmountTendered,
  onClose,
  onConfirm,
  isPending,
}: {
  order: RestaurantOrderResponse
  paymentMethod: 'Cash' | 'Card'
  setPaymentMethod: (m: 'Cash' | 'Card') => void
  amountTendered: string
  setAmountTendered: (v: string) => void
  onClose: () => void
  onConfirm: () => void
  isPending: boolean
}) {
  const total = order.total
  const tendered = parseFloat(amountTendered) || 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" dir="rtl">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900 mx-4">
        <h2 className="mb-1 text-lg font-semibold">الدفع — طاولة {order.tableNumber}</h2>
        <div className="mb-4 space-y-1 text-sm">
          <div className="flex justify-between text-gray-500">
            <span>المجموع الجزئي</span>
            <span>{formatCurrency(order.subTotal)}</span>
          </div>
          {order.discountAmount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>الخصم</span>
              <span>- {formatCurrency(order.discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-gray-500">
            <span>ضريبة القيمة المضافة 15%</span>
            <span>{formatCurrency(order.taxAmount)}</span>
          </div>
        </div>
        <div className="mb-6 rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
          <p className="text-sm text-gray-500">المبلغ المستحق</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(total)}</p>
        </div>
        <p className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">طريقة الدفع</p>
        <div className="mb-6 grid grid-cols-2 gap-2">
          {(['Cash', 'Card'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setPaymentMethod(m)}
              className={cn(
                'flex items-center gap-2 rounded-xl border p-3 text-sm font-medium transition-colors',
                paymentMethod === m
                  ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400',
              )}
            >
              {m === 'Cash' ? <Banknote className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
              {m === 'Cash' ? 'نقداً' : 'بطاقة'}
            </button>
          ))}
        </div>
        {paymentMethod === 'Cash' && (
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
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
              <p className="mt-1 text-sm text-green-600 dark:text-green-400">
                الباقي: {formatCurrency(tendered - total)}
              </p>
            )}
          </div>
        )}
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">إلغاء</Button>
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

// ── Receipt Modal ─────────────────────────────────────────────────────────────

function RestaurantReceiptModal({
  order,
  onClose,
}: {
  order: RestaurantOrderResponse
  onClose: () => void
}) {
  const { data: zatcaSettings } = useQuery({
    queryKey: ['zatca-settings'],
    queryFn: () => zatcaApi.getSettings(),
    staleTime: 60_000,
  })
  const vatNumber = zatcaSettings?.data?.vatRegistrationNumber ?? ''

  const qrCode = generateZatcaQr({
    sellerName: zatcaSettings?.data?.sellerName ?? 'flowin',
    vatNumber,
    timestamp: order.paidAt ?? order.createdAt,
    totalWithVat: order.total,
    vatAmount: order.taxAmount,
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" dir="rtl">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900 mx-4">
        <div className="mb-4 text-center">
          <h2 className="text-lg font-bold">فاتورة ضريبية</h2>
          <p className="text-xs text-gray-500">طاولة {order.tableNumber}</p>
          {vatNumber && <p className="text-xs text-gray-500 mt-0.5">flowin — رقم ضريبة القيمة المضافة: {vatNumber}</p>}
        </div>
        <div className="mb-4 space-y-2 text-sm">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between text-gray-700 dark:text-gray-300">
              <span className="flex-1 truncate">{item.itemName} × {item.quantity}</span>
              <span className="tabular-nums">{formatCurrency(item.lineTotal)}</span>
            </div>
          ))}
        </div>
        <div className="mb-4 space-y-1 border-t border-gray-200 pt-3 text-sm dark:border-gray-700">
          <div className="flex justify-between text-gray-600 dark:text-gray-400">
            <span>المجموع قبل الضريبة</span>
            <span className="tabular-nums">{formatCurrency(order.subTotal)}</span>
          </div>
          {order.discountAmount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>خصم {order.appliedDiscountCode}</span>
              <span className="tabular-nums">- {formatCurrency(order.discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-gray-600 dark:text-gray-400">
            <span>ضريبة القيمة المضافة 15%</span>
            <span className="tabular-nums">{formatCurrency(order.taxAmount)}</span>
          </div>
          <div className="flex justify-between font-bold text-gray-900 dark:text-gray-100">
            <span>الإجمالي</span>
            <span className="tabular-nums">{formatCurrency(order.total)}</span>
          </div>
        </div>
        <div className="mb-4 flex flex-col items-center gap-2 rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
          <QrCode className="h-5 w-5 text-gray-500" />
          <p className="text-xs text-gray-500">رمز ZATCA للتحقق</p>
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qrCode)}`}
            alt="رمز ZATCA للتحقق"
            width={120}
            height={120}
            className="rounded-lg"
          />
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">إغلاق</Button>
          <Button variant="primary" onClick={() => window.print()} className="flex-1">طباعة</Button>
        </div>
      </div>
    </div>
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
  const [showDiscountModal, setShowDiscountModal] = useState(false)
  const [showMenuModal, setShowMenuModal] = useState(false)
  const [editingMenuItem, setEditingMenuItem] = useState<MenuItemResponse | null>(null)

  const { data: discountsData } = useQuery({
    queryKey: ['discount-codes', tenantId],
    queryFn: () => restaurantApi.listDiscountCodes(branchId, tenantId!),
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

  const discounts = discountsData?.data ?? []
  const orders = ordersData?.data ?? []
  const menuItems = menuData?.data ?? []

  const todayRevenue = orders
    .filter((o) => o.status === 'Paid')
    .reduce((s, o) => s + o.total, 0)

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
        tenantId: tenantId!,
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
    onError: () => toast.error('فشل إنشاء رمز الخصم'),
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
            tenantId: tenantId!,
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
    onError: () => toast.error('فشل حفظ الصنف'),
  })

  const toggleAvailabilityMutation = useMutation({
    mutationFn: ({ id, isAvailable }: { id: string; isAvailable: boolean }) =>
      restaurantApi.setAvailability(branchId, id, { isAvailable }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu-items', branchId] }),
    onError: () => toast.error('فشل تحديث التوفر'),
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
          <p className="text-sm text-gray-500">الطلبات النشطة</p>
          <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
            {orders.filter((o) => !['Paid', 'Cancelled'].includes(o.status)).length}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">إيرادات اليوم</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {formatCurrency(todayRevenue)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">الطلبات المدفوعة</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {orders.filter((o) => o.status === 'Paid').length}
          </p>
        </Card>
      </div>

      {/* Menu management */}
      <Card>
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">إدارة القائمة</h3>
          <Button size="sm" onClick={openCreateMenuItem}>
            <Plus className="h-4 w-4" />
            إضافة صنف
          </Button>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {menuLoading && (
            <div className="p-4 text-center text-sm text-gray-400">جاري التحميل...</div>
          )}
          {menuItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
              onClick={() => openEditMenuItem(item)}
            >
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                  {item.name}
                </p>
                <p className="text-xs text-gray-400">
                  {CATEGORY_LABELS[item.category]} — {formatCurrency(item.price)}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  toggleAvailabilityMutation.mutate({ id: item.id, isAvailable: !item.isAvailable })
                }}
                className={cn('text-sm', item.isAvailable ? 'text-green-600' : 'text-gray-400')}
              >
                {item.isAvailable
                  ? <ToggleRight className="h-5 w-5" />
                  : <ToggleLeft className="h-5 w-5" />
                }
              </button>
            </div>
          ))}
          {!menuLoading && menuItems.length === 0 && (
            <p className="p-4 text-center text-sm text-gray-400">لا توجد أصناف بعد</p>
          )}
        </div>
      </Card>

      {/* Discount codes */}
      <Card>
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">رموز الخصم</h3>
          <Button size="sm" onClick={() => setShowDiscountModal(true)}>
            <Plus className="h-4 w-4" />
            إضافة رمز
          </Button>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {discounts.map((dc) => (
            <div key={dc.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="font-mono text-sm font-medium text-gray-900 dark:text-gray-100">
                  {dc.code}
                </p>
                <p className="text-xs text-gray-400">
                  {dc.type === 'Percentage' ? `${dc.value}%` : formatCurrency(dc.value)}
                  {dc.minOrderAmount > 0 && ` — حد أدنى ${formatCurrency(dc.minOrderAmount)}`}
                  {' — '}
                  {dc.maxUses === 0 ? 'غير محدود' : `${dc.usedCount}/${dc.maxUses} استخدام`}
                </p>
              </div>
              <div className="text-left">
                <span className={cn(
                  'rounded-full px-2 py-0.5 text-xs font-medium',
                  dc.isActive && new Date(dc.expiryDate) > new Date()
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500',
                )}>
                  {dc.isActive && new Date(dc.expiryDate) > new Date() ? 'نشط' : 'منتهي'}
                </span>
              </div>
            </div>
          ))}
          {discounts.length === 0 && (
            <p className="p-4 text-center text-sm text-gray-400">لا توجد رموز خصم بعد</p>
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
            <Button variant="secondary" onClick={() => setShowDiscountModal(false)}>إلغاء</Button>
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
              إلغاء
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
