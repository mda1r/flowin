import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Utensils, Plus, Minus, Trash2, CreditCard, Banknote } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/stores/authStore'
import { restaurantApi } from '@/api/restaurant'
import { toast } from '@/components/ui/Toast'
import { cn, formatCurrency } from '@/lib/utils'
import type { MenuCategory, MenuItemResponse } from '@/types/api'

const VAT = 0.15

/* warm restaurant accent scoped to this page */
const RESTAURANT_ACCENT: React.CSSProperties = {
  '--accent': '#FF6B35',
  '--glow': 'rgba(255,107,53,0.35)',
} as React.CSSProperties

const CATEGORIES: { key: MenuCategory | 'All'; label: string }[] = [
  { key: 'All', label: 'الكل' },
  { key: 'Starters', label: 'مقبلات' },
  { key: 'Mains', label: 'رئيسي' },
  { key: 'Sides', label: 'إضافات' },
  { key: 'Beverages', label: 'مشروبات' },
  { key: 'Desserts', label: 'حلويات' },
  { key: 'Specials', label: 'مميزات' },
]

interface OrderLine {
  menuItemId: string
  name: string
  price: number
  quantity: number
}

export function RestaurantPosPage() {
  const { branchId, tenantId } = useAuthStore()
  const qc = useQueryClient()
  const [category, setCategory] = useState<MenuCategory | 'All'>('All')
  const [tableNumber, setTableNumber] = useState(1)
  const [isTakeaway, setIsTakeaway] = useState(false)
  const [lines, setLines] = useState<OrderLine[]>([])
  const [showPayment, setShowPayment] = useState(false)
  const [payMethod, setPayMethod] = useState<'Cash' | 'Card'>('Cash')
  const [amountTendered, setAmountTendered] = useState('')

  const { data: menuItems = [] } = useQuery({
    queryKey: ['restaurant', 'menu', branchId],
    queryFn: () => restaurantApi.listMenuItems(branchId!, { isAvailable: true }).then(r => r.data),
    enabled: !!branchId,
  })

  const filtered = category === 'All' ? menuItems : menuItems.filter(i => i.category === category)

  const addItem = (item: MenuItemResponse) =>
    setLines(prev => {
      const ex = prev.find(l => l.menuItemId === item.id)
      if (ex) { return prev.map(l => l.menuItemId === item.id ? { ...l, quantity: l.quantity + 1 } : l) }
      return [...prev, { menuItemId: item.id, name: item.name, price: item.price, quantity: 1 }]
    })

  const updateQty = (id: string, qty: number) =>
    qty <= 0
      ? setLines(prev => prev.filter(l => l.menuItemId !== id))
      : setLines(prev => prev.map(l => l.menuItemId === id ? { ...l, quantity: qty } : l))

  const subtotal = lines.reduce((s, l) => s + l.price * l.quantity, 0)
  const vat = subtotal * VAT
  const total = subtotal + vat

  const createOrder = useMutation({
    mutationFn: async () => {
      const { data: order } = await restaurantApi.createOrder(branchId!, {
        tenantId: tenantId!,
        tableNumber: isTakeaway ? 0 : tableNumber,
        items: lines.map(l => ({ menuItemId: l.menuItemId, itemName: l.name, quantity: l.quantity, unitPrice: l.price })),
      })
      await restaurantApi.sendToKitchen(branchId!, order.id)
      const tendered = payMethod === 'Cash' ? (parseFloat(amountTendered) || total) : total
      await restaurantApi.payOrder(branchId!, order.id, { paymentMethod: payMethod, amountTendered: tendered })
    },
    onSuccess: () => {
      toast.success('تمت عملية الدفع', isTakeaway ? 'تيك أواي' : `طاولة ${tableNumber}`)
      setLines([])
      setShowPayment(false)
      setAmountTendered('')
      qc.invalidateQueries({ queryKey: ['restaurant'] })
    },
    onError: () => toast.error('فشلت العملية', 'يرجى المحاولة مرة أخرى'),
  })

  return (
    <div dir="rtl" className="flex h-[calc(100vh-0px)] flex-col" style={RESTAURANT_ACCENT}>
      <PageHeader title="نقطة البيع — المطعم" />
      <div className="flex flex-1 overflow-hidden">

        {/* Menu */}
        <div className="flex flex-1 flex-col overflow-hidden border-e" style={{ borderColor: 'var(--card-border)' }}>
          {/* 3D pill tabs — active tab physically depresses */}
          <div className="flex gap-2 overflow-x-auto px-4 py-3">
            {CATEGORIES.map(c => (
              <button
                key={c.key}
                onClick={() => setCategory(c.key)}
                className={cn('tab-3d', category === c.key ? 'tab-3d-active' : 'tab-3d-idle')}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Tilt-card menu grid */}
          <div className="scene-3d flex-1 overflow-y-auto p-4 pt-1">
            {menuItems.length === 0 ? (
              <div className="mt-20 text-center text-sm text-gray-400">
                <Utensils className="mx-auto mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" />
                <p>لا توجد عناصر في القائمة</p>
                <p className="mt-1 text-xs">أضف عناصر من قسم المطعم أولاً</p>
              </div>
            ) : filtered.length === 0 ? (
              <p className="mt-16 text-center text-sm text-gray-400">لا توجد عناصر في هذه الفئة</p>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {filtered.map(item => {
                  const qty = lines.find(l => l.menuItemId === item.id)?.quantity ?? 0
                  return (
                    <button
                      key={item.id}
                      onClick={() => addItem(item)}
                      className="card-3d tilt-card relative flex flex-col items-start p-3 text-start"
                    >
                      {qty > 0 && (
                        <span
                          className="absolute end-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white"
                          style={{
                            background: 'var(--accent)',
                            boxShadow: '0 2px 0 rgba(0,0,0,0.3), 0 0 12px var(--glow)',
                          }}
                        >
                          {qty}
                        </span>
                      )}
                      <div
                        className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl"
                        style={{
                          background: 'color-mix(in srgb, var(--accent) 14%, transparent)',
                          boxShadow: 'inset 0 1px 0 var(--rim-3d), 0 2px 6px var(--shadow-mid)',
                        }}
                      >
                        <Utensils className="h-5 w-5" style={{ color: 'var(--accent)' }} />
                      </div>
                      <p className="line-clamp-2 text-sm font-medium text-gray-900 dark:text-gray-100">{item.name}</p>
                      {item.description && <p className="mt-0.5 line-clamp-1 text-xs text-gray-400">{item.description}</p>}
                      <p className="mt-auto pt-2 text-sm font-bold" style={{ color: 'var(--accent)' }}>
                        {formatCurrency(item.price)}
                      </p>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Cart — raised 3D drawer */}
        <div className="glass-panel z-10 flex w-80 animate-float-up flex-col rounded-none border-y-0 border-e-0">
          {/* Table / Takeaway */}
          <div className="border-b p-3" style={{ borderColor: 'var(--card-border)' }}>
            <div className="mb-3 flex gap-2">
              <button
                onClick={() => setIsTakeaway(false)}
                className={cn('tab-3d flex-1', !isTakeaway ? 'tab-3d-active' : 'tab-3d-idle')}
              >
                طاولة
              </button>
              <button
                onClick={() => setIsTakeaway(true)}
                className={cn('tab-3d flex-1', isTakeaway ? 'tab-3d-active' : 'tab-3d-idle')}
              >
                تيك أواي
              </button>
            </div>
            {!isTakeaway && (
              /* isometric mini-table selector */
              <div className="scene-3d grid grid-cols-5 gap-1.5">
                {Array.from({ length: 20 }, (_, i) => i + 1).map(n => {
                  const active = tableNumber === n
                  return (
                    <button
                      key={n}
                      onClick={() => setTableNumber(n)}
                      className="group flex flex-col items-center gap-1 rounded-md py-1.5 transition-colors"
                      title={`طاولة ${n}`}
                    >
                      <span
                        className="iso-tile block h-4 w-4 rounded-[3px] border group-hover:scale-110"
                        style={
                          active
                            ? {
                                background: 'var(--accent)',
                                borderColor: 'color-mix(in srgb, var(--accent) 60%, black)',
                                boxShadow: '2px 2px 0 color-mix(in srgb, var(--accent) 45%, black), 0 0 10px var(--glow)',
                              }
                            : {
                                background: 'var(--surface-3d)',
                                borderColor: 'var(--card-border)',
                                boxShadow: '2px 2px 0 var(--edge-3d)',
                              }
                        }
                      />
                      <span
                        className={cn('text-[10px] font-semibold leading-none', !active && 'text-gray-500')}
                        style={active ? { color: 'var(--accent)' } : undefined}
                      >
                        {n}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Order lines */}
          <div className="flex-1 overflow-y-auto">
            {lines.length === 0 ? (
              <p className="mt-16 text-center text-sm text-gray-400">أضف عناصر لبدء الطلب</p>
            ) : (
              <ul className="space-y-2 p-3">
                {lines.map(line => (
                  <li key={line.menuItemId} className="card-3d animate-float-up p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="flex-1 truncate text-sm font-medium">{line.name}</p>
                      <button onClick={() => updateQty(line.menuItemId, 0)} className="text-gray-300 transition-colors hover:text-red-500">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateQty(line.menuItemId, line.quantity - 1)}
                          className="card-3d card-3d-lift flex h-6 w-6 items-center justify-center !rounded-md text-gray-600 dark:text-gray-400"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-8 text-center text-sm font-semibold tabular-nums">{line.quantity}</span>
                        <button
                          onClick={() => updateQty(line.menuItemId, line.quantity + 1)}
                          className="card-3d card-3d-lift flex h-6 w-6 items-center justify-center !rounded-md text-gray-600 dark:text-gray-400"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <span className="text-sm font-semibold tabular-nums">{formatCurrency(line.price * line.quantity)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Totals */}
          <div className="border-t p-4" style={{ borderColor: 'var(--card-border)' }}>
            <div className="mb-2 space-y-1 text-sm">
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>المجموع</span><span className="tabular-nums">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>ضريبة 15%</span><span className="tabular-nums">{formatCurrency(vat)}</span>
              </div>
            </div>
            <div className="mb-4 flex items-center justify-between border-t pt-2" style={{ borderColor: 'var(--card-border)' }}>
              <span className="font-medium text-gray-700 dark:text-gray-300">الإجمالي</span>
              <span className="text-emboss text-xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(total)}</span>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setLines([])} disabled={lines.length === 0} className="flex-1">
                مسح
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => { setShowPayment(true); setAmountTendered('') }}
                disabled={lines.length === 0}
                className="btn-3d flex-1 !bg-[color:var(--accent)] hover:!bg-[color:var(--accent)]"
              >
                الدفع
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Payment modal */}
      {showPayment && (
        <div className="scene-3d fixed inset-0 z-50 flex items-center justify-center" style={RESTAURANT_ACCENT}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowPayment(false)} />
          <div className="glass-panel relative mx-4 w-full max-w-sm animate-float-up p-6">
            <h2 className="mb-4 text-lg font-semibold">الدفع</h2>
            <div
              className="mb-6 rounded-xl p-4"
              style={{
                background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
                boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.12), 0 0 18px var(--glow)',
              }}
            >
              <p className="text-sm text-gray-500">{isTakeaway ? 'تيك أواي' : `طاولة ${tableNumber}`}</p>
              <p className="text-emboss text-3xl font-bold" style={{ color: 'var(--accent)' }}>{formatCurrency(total)}</p>
            </div>
            <div className="mb-6 grid grid-cols-2 gap-2">
              {(['Cash', 'Card'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setPayMethod(m)}
                  className={cn(
                    'card-3d flex items-center gap-2 p-3 text-sm font-medium transition-all',
                    payMethod === m ? 'neon-border' : 'card-3d-lift text-gray-600 dark:text-gray-400',
                  )}
                  style={payMethod === m ? { color: 'var(--accent)' } : undefined}
                >
                  {m === 'Cash' ? <Banknote className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
                  {m === 'Cash' ? 'نقداً' : 'بطاقة'}
                </button>
              ))}
            </div>
            {payMethod === 'Cash' && (
              <div className="mb-4">
                <label className="mb-1 block text-sm font-medium">المبلغ المستلم</label>
                <input
                  type="number"
                  min={total}
                  placeholder={total.toFixed(2)}
                  value={amountTendered}
                  onChange={e => setAmountTendered(e.target.value)}
                  className="input-3d w-full"
                />
                {amountTendered && parseFloat(amountTendered) >= total && (
                  <p className="mt-1 text-sm text-green-600">الباقي: {formatCurrency(parseFloat(amountTendered) - total)}</p>
                )}
              </div>
            )}
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setShowPayment(false)} className="flex-1">إلغاء</Button>
              <Button
                variant="primary"
                onClick={() => createOrder.mutate()}
                loading={createOrder.isPending}
                disabled={payMethod === 'Cash' && !!amountTendered && parseFloat(amountTendered) < total}
                className="btn-3d flex-1 !bg-[color:var(--accent)] hover:!bg-[color:var(--accent)]"
              >
                تأكيد الدفع
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
