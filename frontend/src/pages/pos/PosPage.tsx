import { useState, useCallback } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Search, Plus, Minus, Trash2, CreditCard, Banknote, X, QrCode, ScanBarcode, Unlock, PauseCircle, PlayCircle, Clock } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { useCartStore } from '@/stores/cartStore'
import { useHeldCartsStore } from '@/stores/heldCartsStore'
import { useAuthStore } from '@/stores/authStore'
import { catalogApi } from '@/api/catalog'
import { ordersApi } from '@/api/orders'
import { zatcaApi } from '@/api/zatca'
import { inventoryApi } from '@/api/inventory'
import { toast } from '@/components/ui/Toast'
import { cn, formatCurrency } from '@/lib/utils'
import { generateZatcaQr, SAUDI_VAT_RATE } from '@/lib/zatca'
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner'
import type { ProductResponse, ProductVariantResponse, PaymentMethod, OrderResponse } from '@/types/api'
import { RestaurantPosPage } from './RestaurantPosPage'
import { HotelPosPage } from './HotelPosPage'
import { GamingPosPage } from './GamingPosPage'
import { CafePosPage } from './CafePosPage'
import { useShift, ShiftGate, ShiftBadge, OpenShiftModal, CloseShiftModal } from './ShiftGate'

export function POSPage() {
  const { user } = useAuthStore()
  switch (user?.businessType) {
    case 'Restaurant':
      return <RestaurantPosPage />
    case 'Cafe':
      return <CafePosPage />
    case 'Hotel':
      return <HotelPosPage />
    case 'Gaming':
      return <GamingPosPage />
    default:
      return <RetailPosPage />
  }
}

/* indigo retail accent scoped to this page */
const RETAIL_ACCENT: React.CSSProperties = {
  '--accent': '#4F46E5',
  '--glow': 'rgba(79,70,229,0.4)',
} as React.CSSProperties

type PayMode = 'Cash' | 'Card' | 'Split'

function RetailPosPage() {
  const [search, setSearch] = useState('')
  const [payMode, setPayMode] = useState<PayMode>('Cash')
  const [amountTendered, setAmountTendered] = useState('')
  const [splitCash, setSplitCash] = useState('')
  const [splitCard, setSplitCard] = useState('')
  const [showPayment, setShowPayment] = useState(false)
  const [showHeld, setShowHeld] = useState(false)
  const [completedOrder, setCompletedOrder] = useState<OrderResponse | null>(null)
  const [lastScanned, setLastScanned] = useState<string | null>(null)
  const [showOpenShift, setShowOpenShift] = useState(false)
  const [showCloseShift, setShowCloseShift] = useState(false)
  const { shift } = useShift()
  const { lines, addLine, removeLine, updateQuantity, subtotal, clear } = useCartStore()
  const { hold, restore, carts: heldCarts } = useHeldCartsStore()
  const { branchId, tenantId } = useAuthStore()

  // أسعار المنتجات شاملة الضريبة — نستخرج الضريبة من الإجمالي
  const grossTotal = subtotal()
  const extractedTax = Math.round(grossTotal * 0.15 / 1.15 * 100) / 100
  const preTaxAmount = Math.round((grossTotal - extractedTax) * 100) / 100

  const handleBarcodeScan = useCallback(async (barcode: string) => {
    setLastScanned(barcode)
    try {
      const { data: results } = await catalogApi.listProducts(tenantId!, { search: barcode })
      const matched = results.flatMap(p =>
        p.variants
          .filter(v => v.isActive && (v.barcode === barcode || v.sku === barcode))
          .map(v => ({ product: p, variant: v }))
      )
      const hit = matched[0] ?? (results.length === 1 && results[0].variants[0]
        ? { product: results[0], variant: results[0].variants[0] }
        : null)

      if (hit) {
        const currentQty = lines.find(l => l.variantId === hit.variant.id)?.quantity ?? 0
        if (!canAddToCart(hit.variant.id, currentQty)) {
          toast.error('المخزون غير كافٍ', `المتاح: ${stockMap[hit.variant.id] ?? 0} وحدة`)
        } else {
          addLine({
            variantId: hit.variant.id,
            productName: hit.product.name,
            variantName: hit.variant.name,
            unitPrice: hit.variant.salePrice,
          })
          toast.success('تمت الإضافة', `${hit.product.name} — ${formatCurrency(hit.variant.salePrice)}`)
        }
      } else {
        toast.error('باركود غير معروف', barcode)
      }
    } catch {
      toast.error('خطأ في البحث', 'تعذّر البحث عن الباركود')
    }
    setTimeout(() => setLastScanned(null), 1500)
  }, [addLine])

  useBarcodeScanner({ onScan: handleBarcodeScan, active: !showPayment })

  const { data: products, isLoading } = useQuery({
    queryKey: ['products', tenantId, search],
    queryFn: () => catalogApi.listProducts(tenantId!, { search: search || undefined }),
    enabled: !!tenantId,
  })

  const { data: stockData } = useQuery({
    queryKey: ['pos-stock', branchId],
    queryFn: () => inventoryApi.listItems(branchId!, { pageSize: 500 }),
    enabled: !!branchId,
    staleTime: 30_000,
  })

  const stockMap = (() => {
    const raw = stockData?.data
    const items = Array.isArray(raw) ? raw : ((raw as any)?.items ?? [])
    const m: Record<string, number> = {}
    for (const s of items) m[s.variantId] = s.quantity
    return m
  })()

  const productList = products?.data ?? []

  const trackMap = (() => {
    const m: Record<string, boolean> = {}
    const list = Array.isArray(productList) ? productList : ((productList as any)?.items ?? [])
    for (const p of list) {
      for (const v of p.variants) m[v.id] = p.trackInventory
    }
    return m
  })()

  const canAddToCart = (variantId: string, currentQty: number, addQty = 1): boolean => {
    if (!trackMap[variantId]) return true
    const available = stockMap[variantId]
    if (available === undefined) return true
    return currentQty + addQty <= available
  }

  const checkout = useMutation({
    mutationFn: async () => {
      const preTaxRate = 1 + SAUDI_VAT_RATE
      const { data: order } = await ordersApi.createOrder(branchId!, {
        tenantId: tenantId!,
        currency: 'SAR',
        taxRate: SAUDI_VAT_RATE,
      })
      for (const line of lines) {
        await ordersApi.addLine(branchId!, order.id, {
          variantId: line.variantId,
          productName: line.productName,
          variantName: line.variantName,
          unitPrice: Math.round((line.unitPrice / preTaxRate) * 10000) / 10000,
          quantity: line.quantity,
        })
      }
      const tendered = payMode === 'Cash' ? (parseFloat(amountTendered) || grossTotal) : grossTotal
      const { data: completed } = await ordersApi.complete(branchId!, order.id, {
        paymentMethod: payMode as PaymentMethod,
        amountTendered: tendered,
        ...(payMode === 'Split' && {
          cashAmount: parseFloat(splitCash) || 0,
          cardAmount: parseFloat(splitCard) || 0,
        }),
      })
      return completed
    },
    onSuccess: (order) => {
      setCompletedOrder(order)
      clear()
      setShowPayment(false)
      setPayMode('Cash')
      setAmountTendered('')
      setSplitCash('')
      setSplitCard('')
      toast.success('تمت عملية الدفع', 'تمت معالجة الطلب بنجاح')
    },
    onError: () => toast.error('فشلت عملية الدفع', 'يرجى المحاولة مرة أخرى'),
  })

  const handleHold = () => {
    if (lines.length === 0) return
    hold(lines)
    clear()
    toast.success('تم تأجيل الفاتورة', 'يمكنك استردادها في أي وقت')
  }

  const handleRestore = (id: string) => {
    const cart = restore(id)
    if (!cart) return
    clear()
    for (const line of cart.lines) {
      const { quantity, ...rest } = line
      for (let i = 0; i < quantity; i++) addLine(rest)
    }
    setShowHeld(false)
    toast.success('تم استرداد الفاتورة')
  }

  return (
    <div dir="rtl" className="flex h-[calc(100vh-0px)] flex-col" style={RETAIL_ACCENT}>
      <PageHeader
        title="نقطة البيع"
        action={
          <div className="flex items-center gap-3">
            {shift ? (
              <ShiftBadge shift={shift} onCloseShift={() => setShowCloseShift(true)} />
            ) : (
              <Button size="sm" onClick={() => setShowOpenShift(true)} className="gap-1.5">
                <Unlock className="h-3.5 w-3.5" />
                فتح شفت
              </Button>
            )}
            <div
              className={cn(
                'card-3d flex items-center gap-2 px-3 py-1.5 text-xs font-medium transition-all',
                lastScanned ? 'animate-glow-pulse' : 'text-gray-500 dark:text-gray-400',
              )}
              style={lastScanned ? { color: 'var(--accent)', borderColor: 'var(--accent)' } : undefined}
            >
              <ScanBarcode className="h-4 w-4" />
              {lastScanned ? `✓ ${lastScanned}` : 'السكنر جاهز'}
            </div>
          </div>
        }
      />
      <ShiftGate onOpenShift={() => setShowOpenShift(true)}>
      <div className="flex flex-1 overflow-hidden">
        {/* Product shelf */}
        <div className="flex flex-1 flex-col overflow-hidden border-e" style={{ borderColor: 'var(--card-border)' }}>
          <div className="p-4">
            {/* inset 3D search with scan-beam on barcode hit */}
            <div className="relative overflow-hidden rounded-xl">
              <Search className="absolute start-3 top-2.5 z-10 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="ابحث عن المنتجات..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-3d ps-9"
              />
              {lastScanned && <div className="scan-beam" aria-hidden="true" />}
            </div>
          </div>
          <div className="scene-3d flex-1 overflow-y-auto p-4 pt-0">
            {isLoading ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="shimmer-skeleton h-28" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {productList.map((product) =>
                  product.variants.filter((v) => v.isActive).map((variant) => (
                    <ProductCard
                      key={variant.id}
                      product={product}
                      variant={variant}
                      stockQty={trackMap[variant.id] ? (stockMap[variant.id] ?? 0) : null}
                      onAdd={() => {
                        const currentQty = lines.find(l => l.variantId === variant.id)?.quantity ?? 0
                        if (!canAddToCart(variant.id, currentQty)) {
                          toast.error('المخزون غير كافٍ', `المتاح: ${stockMap[variant.id] ?? 0} وحدة`)
                          return
                        }
                        addLine({
                          variantId: variant.id,
                          productName: product.name,
                          variantName: variant.name,
                          unitPrice: variant.salePrice,
                        })
                      }}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Cart — raised 3D panel */}
        <div className="glass-panel z-10 flex w-80 animate-float-up flex-col rounded-none border-y-0 border-e-0">
          <div className="border-b px-4 py-3" style={{ borderColor: 'var(--card-border)' }}>
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">الطلب الحالي</h2>
          </div>

          <div className="flex-1 overflow-y-auto">
            {lines.length === 0 ? (
              <p className="mt-16 text-center text-sm text-gray-400">
                أضف منتجات لبدء الطلب
              </p>
            ) : (
              <ul className="space-y-2 p-3">
                {lines.map((line) => (
                  <li key={line.variantId} className="card-3d animate-float-up p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                          {line.productName}
                        </p>
                        <p className="text-xs text-gray-500">{line.variantName}</p>
                        <p className="text-xs text-gray-400">
                          {formatCurrency(line.unitPrice)} للوحدة
                        </p>
                      </div>
                      <button
                        onClick={() => removeLine(line.variantId)}
                        className="shrink-0 text-gray-300 transition-colors hover:text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateQuantity(line.variantId, line.quantity - 1)}
                          className="card-3d card-3d-lift flex h-6 w-6 items-center justify-center !rounded-md text-gray-600 dark:text-gray-400"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-8 text-center text-sm font-semibold tabular-nums">{line.quantity}</span>
                        <button
                          onClick={() => {
                            if (!canAddToCart(line.variantId, line.quantity)) {
                              toast.error('المخزون غير كافٍ', `المتاح: ${stockMap[line.variantId] ?? 0} وحدة`)
                              return
                            }
                            updateQuantity(line.variantId, line.quantity + 1)
                          }}
                          className="card-3d card-3d-lift flex h-6 w-6 items-center justify-center !rounded-md text-gray-600 dark:text-gray-400"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                        {formatCurrency(line.unitPrice * line.quantity)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Totals + Checkout */}
          <div className="border-t p-4" style={{ borderColor: 'var(--card-border)' }}>
            <div className="mb-2 space-y-1 text-sm">
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>المجموع قبل الضريبة</span>
                <span className="tabular-nums">{formatCurrency(preTaxAmount)}</span>
              </div>
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>ضريبة القيمة المضافة 15%</span>
                <span className="tabular-nums">{formatCurrency(extractedTax)}</span>
              </div>
            </div>
            <div className="mb-4 flex items-center justify-between border-t pt-2" style={{ borderColor: 'var(--card-border)' }}>
              <span className="font-medium text-gray-700 dark:text-gray-300">الإجمالي</span>
              <span className="text-emboss text-xl font-bold text-gray-900 dark:text-gray-100">
                {formatCurrency(grossTotal)}
              </span>
            </div>
            <div className="mb-2 flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={clear}
                disabled={lines.length === 0}
                className="flex-1"
              >
                <X className="h-4 w-4" />
                مسح
              </Button>
              {/* Hold current order */}
              <button
                onClick={handleHold}
                disabled={lines.length === 0}
                title="تأجيل الفاتورة"
                className="card-3d card-3d-lift flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-amber-600 disabled:opacity-40 dark:text-amber-400"
              >
                <PauseCircle className="h-4 w-4" />
                هولد
              </button>
              {/* Held orders badge */}
              {heldCarts.length > 0 && (
                <button
                  onClick={() => setShowHeld(true)}
                  className="relative card-3d card-3d-lift flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400"
                  title="الفواتير المؤجلة"
                >
                  <PlayCircle className="h-4 w-4" />
                  <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                    {heldCarts.length}
                  </span>
                </button>
              )}
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => { setShowPayment(true); setAmountTendered('') }}
              disabled={lines.length === 0}
              className="btn-3d w-full !bg-[color:var(--accent)] hover:!bg-[color:var(--accent)]"
            >
              الدفع
            </Button>
          </div>
        </div>
      </div>
      </ShiftGate>

      {/* Payment modal */}
      {showPayment && (
        <div className="scene-3d fixed inset-0 z-50 flex items-center justify-center" style={RETAIL_ACCENT}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowPayment(false)} />
          <div className="glass-panel relative mx-4 w-full max-w-sm animate-float-up p-6">
            <h2 className="mb-4 text-lg font-semibold">الدفع</h2>
            <div className="mb-4 space-y-1 text-sm">
              <div className="flex justify-between text-gray-500">
                <span>قبل الضريبة</span>
                <span>{formatCurrency(preTaxAmount)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>ضريبة القيمة المضافة 15%</span>
                <span>{formatCurrency(extractedTax)}</span>
              </div>
            </div>
            <div
              className="mb-6 rounded-xl p-4"
              style={{
                background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
                boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.12), 0 0 18px var(--glow)',
              }}
            >
              <p className="text-sm text-gray-500">المبلغ المستحق</p>
              <p className="text-emboss text-3xl font-bold" style={{ color: 'var(--accent)' }}>
                {formatCurrency(grossTotal)}
              </p>
            </div>

            {/* Payment mode selector */}
            <p className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">طريقة الدفع</p>
            <div className="mb-4 grid grid-cols-3 gap-2">
              {([
                { mode: 'Cash',  icon: <Banknote className="h-4 w-4" />,   label: 'نقداً'    },
                { mode: 'Card',  icon: <CreditCard className="h-4 w-4" />, label: 'بطاقة'    },
                { mode: 'Split', icon: <span className="text-sm font-black">½</span>, label: 'تقسيم' },
              ] as { mode: PayMode; icon: React.ReactNode; label: string }[]).map(({ mode, icon, label }) => (
                <button
                  key={mode}
                  onClick={() => { setPayMode(mode); setAmountTendered(''); setSplitCash(''); setSplitCard('') }}
                  className={cn(
                    'card-3d flex flex-col items-center gap-1 p-3 text-xs font-medium transition-all',
                    payMode === mode ? 'neon-border' : 'card-3d-lift text-gray-600 dark:text-gray-400',
                  )}
                  style={payMode === mode ? { color: 'var(--accent)' } : undefined}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </div>

            {/* Cash input */}
            {payMode === 'Cash' && (
              <div className="mb-4">
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  المبلغ المستلم (ر.س)
                </label>
                <input
                  type="number"
                  min={grossTotal}
                  step="0.01"
                  placeholder={String(grossTotal)}
                  value={amountTendered}
                  onChange={(e) => setAmountTendered(e.target.value)}
                  className="input-3d w-full"
                  autoFocus
                />
                {amountTendered && parseFloat(amountTendered) >= grossTotal && (
                  <p className="mt-1 text-sm text-green-600 dark:text-green-400">
                    الباقي: {formatCurrency(parseFloat(amountTendered) - grossTotal)}
                  </p>
                )}
              </div>
            )}

            {/* Split inputs */}
            {payMode === 'Split' && (() => {
              const cashNum = parseFloat(splitCash) || 0
              const cardNum = parseFloat(splitCard) || 0
              const diff = Math.abs(cashNum + cardNum - grossTotal)
              const splitOk = cashNum > 0 && cardNum > 0 && diff < 0.01
              return (
                <div className="mb-4 space-y-3 rounded-xl border border-dashed p-3" style={{ borderColor: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 6%, transparent)' }}>
                  <p className="text-center text-xs font-semibold text-gray-500">
                    الإجمالي: {formatCurrency(grossTotal)}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">نقداً (ر.س)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={splitCash}
                        onChange={(e) => {
                          setSplitCash(e.target.value)
                          const c = parseFloat(e.target.value) || 0
                          const rem = grossTotal - c
                          setSplitCard(rem > 0 ? rem.toFixed(2) : '')
                        }}
                        className="input-3d w-full"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">بطاقة (ر.س)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={splitCard}
                        onChange={(e) => {
                          setSplitCard(e.target.value)
                          const c = parseFloat(e.target.value) || 0
                          const rem = grossTotal - c
                          setSplitCash(rem > 0 ? rem.toFixed(2) : '')
                        }}
                        className="input-3d w-full"
                      />
                    </div>
                  </div>
                  {cashNum + cardNum > 0 && !splitOk && (
                    <p className="text-center text-xs font-semibold text-red-500">
                      الفرق: {(grossTotal - cashNum - cardNum).toFixed(2)} ر.س
                    </p>
                  )}
                  {splitOk && (
                    <p className="text-center text-xs font-semibold text-green-600 dark:text-green-400">✓ مجموع صحيح</p>
                  )}
                </div>
              )
            })()}

            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setShowPayment(false)} className="flex-1">
                إلغاء
              </Button>
              <Button
                variant="primary"
                onClick={() => checkout.mutate()}
                loading={checkout.isPending}
                disabled={
                  (payMode === 'Cash' && !!amountTendered && parseFloat(amountTendered) < grossTotal) ||
                  (payMode === 'Split' && (() => {
                    const c = parseFloat(splitCash) || 0
                    const k = parseFloat(splitCard) || 0
                    return !(c > 0 && k > 0 && Math.abs(c + k - grossTotal) < 0.01)
                  })())
                }
                className="btn-3d flex-1 !bg-[color:var(--accent)] hover:!bg-[color:var(--accent)]"
              >
                تأكيد الدفع
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Held orders panel */}
      {showHeld && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowHeld(false)} />
          <div className="glass-panel relative mx-4 w-full max-w-sm animate-float-up p-5" dir="rtl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">الفواتير المؤجلة</h2>
              <button onClick={() => setShowHeld(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            {heldCarts.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">لا توجد فواتير مؤجلة</p>
            ) : (
              <ul className="space-y-2 max-h-80 overflow-y-auto">
                {heldCarts.map((cart) => (
                  <li key={cart.id} className="card-3d flex items-center justify-between gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                        <span className="text-xs text-gray-500">
                          {new Date(cart.heldAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm font-medium text-gray-900 dark:text-gray-100">
                        {cart.lines.length} منتج · {formatCurrency(
                          cart.lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0)
                        )}
                      </p>
                      <p className="truncate text-xs text-gray-400">
                        {cart.lines.map((l) => l.productName).join('، ')}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRestore(cart.id)}
                      className="shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold"
                      style={{ background: 'var(--accent)', color: '#fff' }}
                    >
                      استرداد
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* ZATCA Receipt modal */}
      {completedOrder && (
        <ZatcaReceiptModal
          order={completedOrder}
          onClose={() => setCompletedOrder(null)}
        />
      )}

      {/* Shift modals */}
      {showOpenShift && <OpenShiftModal onClose={() => setShowOpenShift(false)} />}
      {showCloseShift && shift && (
        <CloseShiftModal shift={shift} onClose={() => setShowCloseShift(false)} />
      )}
    </div>
  )
}

function ProductCard({
  product,
  variant,
  stockQty,
  onAdd,
}: {
  product: ProductResponse
  variant: ProductVariantResponse
  stockQty: number | null
  onAdd: () => void
}) {
  const outOfStock = stockQty !== null && stockQty <= 0
  return (
    <button
      onClick={onAdd}
      disabled={outOfStock}
      className={cn(
        'card-3d tilt-card extruded-3d flex flex-col items-start p-3 text-start',
        outOfStock && 'pointer-events-none opacity-50',
      )}
    >
      <div
        className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl text-lg font-bold"
        style={{
          background: 'color-mix(in srgb, var(--accent) 14%, transparent)',
          color: 'var(--accent)',
          boxShadow: 'inset 0 1px 0 var(--rim-3d), 0 2px 6px var(--shadow-mid)',
        }}
      >
        {product.name[0]}
      </div>
      <p className="line-clamp-2 text-sm font-medium text-gray-900 dark:text-gray-100">
        {product.name}
      </p>
      <p className="mt-0.5 text-xs text-gray-400">{variant.name}</p>
      <div className="mt-auto flex w-full items-center justify-between pt-2">
        <p className="text-sm font-bold" style={{ color: 'var(--accent)' }}>
          {formatCurrency(variant.salePrice)}
        </p>
        {stockQty !== null && (
          <span className={cn(
            'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
            outOfStock
              ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
              : stockQty <= 5
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
              : 'bg-gray-100 text-gray-500 dark:bg-gray-800',
          )}>
            {outOfStock ? 'نفد' : stockQty}
          </span>
        )}
      </div>
    </button>
  )
}

function ZatcaReceiptModal({
  order,
  onClose,
}: {
  order: OrderResponse
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
    timestamp: order.completedAt ?? order.createdAt,
    totalWithVat: order.totalAmount,
    vatAmount: order.taxAmount,
  })

  return (
    <div className="scene-3d fixed inset-0 z-50 flex items-center justify-center" style={RETAIL_ACCENT}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="glass-panel relative mx-4 w-full max-w-sm animate-float-up p-6">
        <div className="mb-4 text-center">
          <h2 className="text-emboss text-lg font-bold text-gray-900 dark:text-gray-100">فاتورة ضريبية</h2>
          {(zatcaSettings?.data?.sellerName) && (
            <p className="logo-3d mt-1 text-sm font-bold">{zatcaSettings.data.sellerName}</p>
          )}
          {vatNumber && <p className="text-xs text-gray-500">رقم ضريبة القيمة المضافة: {vatNumber}</p>}
        </div>

        <div className="mb-4 space-y-2 text-sm">
          {order.lines.map((line) => (
            <div key={line.id} className="flex justify-between text-gray-700 dark:text-gray-300">
              <span className="flex-1 truncate">
                {line.productName} × {line.quantity}
              </span>
              <span className="tabular-nums">{formatCurrency(line.lineTotal)}</span>
            </div>
          ))}
        </div>

        <div className="mb-4 space-y-1 border-t pt-3 text-sm" style={{ borderColor: 'var(--card-border)' }}>
          <div className="flex justify-between text-gray-600 dark:text-gray-400">
            <span>المجموع قبل الضريبة</span>
            <span className="tabular-nums">{formatCurrency(order.subtotalAmount)}</span>
          </div>
          <div className="flex justify-between text-gray-600 dark:text-gray-400">
            <span>ضريبة القيمة المضافة 15%</span>
            <span className="tabular-nums">{formatCurrency(order.taxAmount)}</span>
          </div>
          <div className="flex justify-between font-bold text-gray-900 dark:text-gray-100">
            <span>الإجمالي</span>
            <span className="tabular-nums">{formatCurrency(order.totalAmount)}</span>
          </div>
        </div>

        {/* Payment method */}
        <div className="mb-3 rounded-lg bg-gray-50 px-3 py-2 text-center text-xs text-gray-500 dark:bg-gray-800">
          {order.paymentMethod === 'Cash' ? 'نقداً' :
           order.paymentMethod === 'Card' ? 'بطاقة' :
           order.paymentMethod === 'Split' ? 'تقسيم (نقد + بطاقة)' :
           order.paymentMethod}
          {order.paymentMethod === 'Cash' && order.amountTendered && order.amountTendered > order.totalAmount && (
            <span> · الباقي {formatCurrency(order.amountTendered - order.totalAmount)}</span>
          )}
        </div>

        {/* ZATCA QR Code */}
        <div className="card-3d mb-4 flex flex-col items-center gap-2 p-4">
          <QrCode className="h-5 w-5 text-gray-500" />
          <p className="text-xs text-gray-500">رمز ZATCA للتحقق</p>
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qrCode)}`}
            alt="رمز ZATCA للتحقق"
            width={120}
            height={120}
            className="rounded-lg"
            onError={(e) => {
              const target = e.currentTarget
              target.style.display = 'none'
              const fallback = document.createElement('div')
              fallback.className = 'text-xs text-gray-400 text-center'
              fallback.textContent = qrCode.slice(0, 20) + '...'
              target.parentNode?.appendChild(fallback)
            }}
          />
        </div>

        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            إغلاق
          </Button>
          <Button
            variant="primary"
            onClick={() => window.print()}
            className="btn-3d flex-1 !bg-[color:var(--accent)] hover:!bg-[color:var(--accent)]"
          >
            طباعة
          </Button>
        </div>
      </div>
    </div>
  )
}
