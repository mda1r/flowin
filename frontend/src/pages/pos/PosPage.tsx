import { useState, useCallback, useRef } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Search, Plus, Minus, Trash2, CreditCard, Banknote, X, ScanBarcode, Unlock, PauseCircle, PlayCircle, Clock } from 'lucide-react'
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
import type { ProductResponse, ProductVariantResponse, PaymentMethod, OrderResponse, CustomerResponse } from '@/types/api'
import { RestaurantPosPage } from './RestaurantPosPage'
import { HotelPosPage } from './HotelPosPage'
import { CafePosPage } from './CafePosPage'
import { useShift, ShiftGate, ShiftBadge, OpenShiftModal, CloseShiftModal } from './ShiftGate'
import { useI18n } from '@/i18n'
import { apiErrorMessage } from '@/lib/apiError'
import { LoyaltyPanel } from '@/components/pos/LoyaltyPanel'
import { CashTender } from '@/components/pos/CashTender'
import { OfflineBanner } from '@/components/pos/OfflineBanner'
import { isNetworkError, newClientReference, queueSale } from '@/lib/offlineSales'
import type { CheckoutPayload } from '@/api/orders'
import { ShortcutsHelp, ShortcutsHelpButton } from '@/components/pos/ShortcutsHelp'
import { ConfirmModal } from '@/components/ui/Modal'
import { useShortcuts } from '@/lib/useShortcuts'
import { maxRedeemablePoints, pointsValue, useLoyaltyRules } from '@/lib/loyalty'
import { ReceiptDocument } from '@/components/pos/ReceiptDocument'
import { useReceiptSettings } from '@/lib/receipt'
import { orderReceiptFigures, paymentLabel } from '@/lib/orderReceipt'
import { WhatsAppShare } from '@/components/pos/WhatsAppShare'
import { buildReceiptMessage } from '@/lib/whatsapp'
import { printElement } from '@/lib/print'

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
      return <CafePosPage />
    default:
      return <RetailPosPage />
  }
}

/* indigo retail accent scoped to this page */
const RETAIL_ACCENT: React.CSSProperties = {
  '--accent-l': '#4F46E5',
  '--accent-d': '#A5B4FC',
} as React.CSSProperties

type PayMode = 'Cash' | 'Card' | 'Split'

function RetailPosPage() {
  const [search, setSearch] = useState('')
  const [payMode, setPayMode] = useState<PayMode>('Cash')
  const [amountTendered, setAmountTendered] = useState('')
  const [loyaltyCustomer, setLoyaltyCustomer] = useState<CustomerResponse | null>(null)
  const loyaltyRules = useLoyaltyRules()
  const [redeemPoints, setRedeemPoints] = useState(0)
  const [splitCash, setSplitCash] = useState('')
  const [splitCard, setSplitCard] = useState('')
  const [showPayment, setShowPayment] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [confirmClearCart, setConfirmClearCart] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [showHeld, setShowHeld] = useState(false)
  const [completedOrder, setCompletedOrder] = useState<OrderResponse | null>(null)
  const [completedPhone, setCompletedPhone] = useState<string | undefined>(undefined)
  const [completedOffline, setCompletedOffline] = useState(false)
  const [lastScanned, setLastScanned] = useState<string | null>(null)
  const [showOpenShift, setShowOpenShift] = useState(false)
  const [showCloseShift, setShowCloseShift] = useState(false)
  const { shift } = useShift()
  const { lines, addLine, removeLine, updateQuantity, subtotal, clear } = useCartStore()
  const { hold, restore, carts: heldCarts } = useHeldCartsStore()
  const { branchId, tenantId } = useAuthStore()
  const { t, lang } = useI18n()

  // أسعار المنتجات شاملة الضريبة — نستخرج الضريبة من الإجمالي
  const cartTotal = subtotal()
  const maxRedeemable = loyaltyCustomer ? maxRedeemablePoints(loyaltyCustomer.loyaltyPoints, cartTotal, loyaltyRules) : 0
  const appliedPoints = Math.min(redeemPoints, maxRedeemable)
  const loyaltyDiscount = pointsValue(appliedPoints, loyaltyRules)
  // grossTotal is what the customer pays, after any loyalty discount.
  const grossTotal = Math.round((cartTotal - loyaltyDiscount) * 100) / 100
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
        const currentQty = useCartStore.getState().lines.find(l => l.variantId === hit.variant.id)?.quantity ?? 0
        if (!canAddToCart(hit.variant.id, currentQty)) {
          toast.error('المخزون غير كافٍ', `المتاح: ${stockMap[hit.variant.id] ?? 0} وحدة`)
        } else {
          addLine({
            variantId: hit.variant.id,
            productName: hit.product.name,
            variantName: hit.variant.name,
            unitPrice: hit.variant.salePrice,
            costPrice: hit.variant.costPrice,
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
      const tendered = payMode === 'Cash' ? Math.max(parseFloat(amountTendered) || grossTotal, grossTotal) : grossTotal
      const clientReference = newClientReference()
      const payload: CheckoutPayload = {
        clientReference,
        currency: 'SAR',
        taxRate: SAUDI_VAT_RATE,
        customerId: loyaltyCustomer?.id,
        lines: lines.map((line) => ({
          variantId: line.variantId,
          productName: line.productName,
          variantName: line.variantName,
          unitPrice: Math.round((line.unitPrice / preTaxRate) * 10000) / 10000,
          costPrice: line.costPrice,
          quantity: line.quantity,
        })),
        loyaltyPoints: appliedPoints,
        paymentMethod: payMode as PaymentMethod,
        amountTendered: tendered,
        ...(payMode === 'Split' && {
          cashAmount: parseFloat(splitCash) || 0,
          cardAmount: parseFloat(splitCard) || 0,
        }),
      }

      // Keep selling without a connection: the sale waits on this device and syncs when the network returns.
      const saveOffline = (): { order: OrderResponse; offline: boolean } => {
        const now = new Date().toISOString()
        queueSale({
          clientReference,
          tenantId: tenantId!,
          branchId: branchId!,
          payload: { ...payload, offlineCreatedAt: now },
          total: grossTotal,
          itemCount: lines.reduce((s, l) => s + l.quantity, 0),
        })
        const tax = Math.round((grossTotal * SAUDI_VAT_RATE / preTaxRate) * 100) / 100
        // A local receipt with the same figures the server will record; its number is provisional.
        const order: OrderResponse = {
          id: clientReference,
          tenantId: tenantId!,
          branchId: branchId!,
          currency: 'SAR',
          status: 'Completed',
          subtotalAmount: Math.round((grossTotal - tax) * 100) / 100,
          discountAmount: 0,
          taxAmount: tax,
          totalAmount: grossTotal,
          taxRate: SAUDI_VAT_RATE,
          paymentMethod: payMode as PaymentMethod,
          amountTendered: tendered,
          splitCash: payload.cashAmount,
          splitCard: payload.cardAmount,
          createdAt: now,
          completedAt: now,
          lines: lines.map((l, i) => ({
            id: `${clientReference}-${i}`,
            variantId: l.variantId,
            productName: l.productName,
            variantName: l.variantName,
            quantity: l.quantity,
            unitPrice: l.unitPrice / preTaxRate,
            costPrice: l.costPrice,
            lineTotal: Math.round((l.unitPrice * l.quantity / preTaxRate) * 100) / 100,
          })),
        }
        return { order, offline: true }
      }

      if (!navigator.onLine) {
        if (appliedPoints > 0) throw new Error('offline-loyalty')
        return saveOffline()
      }
      try {
        const { data } = await ordersApi.checkout(branchId!, payload)
        return { order: data, offline: false }
      } catch (err) {
        if (isNetworkError(err)) return saveOffline()
        throw err
      }
    },
    onSuccess: ({ order, offline }) => {
      setCompletedOffline(offline)
      if (offline) toast.warning('حُفظت العملية دون اتصال', 'ستُسجَّل تلقائياً عند عودة الإنترنت')
      setCompletedOrder(order)
      setCompletedPhone(loyaltyCustomer?.phone ?? undefined)
      clear()
      setShowPayment(false)
      setPayMode('Cash')
      setAmountTendered('')
      setSplitCash('')
      setSplitCard('')
      setLoyaltyCustomer(null)
      setRedeemPoints(0)
      toast.success(t.pos.paymentSuccess, t.pos.orderProcessed)
    },
    onError: (err: Error) =>
      err.message === 'offline-loyalty'
        ? toast.error('لا يمكن استبدال النقاط دون اتصال', 'ألغِ الاستبدال وأكمل البيع')
        : toast.error(t.pos.paymentFailed, apiErrorMessage(err)),
  })

  const handleHold = () => {
    if (lines.length === 0) return
    hold(lines)
    clear()
    toast.success(t.pos.ordersHeld, 'يمكنك استردادها في أي وقت')
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
    toast.success(t.pos.orderResumed)
  }


  const canConfirmPayment = !(
    (payMode === 'Cash' && !!amountTendered && parseFloat(amountTendered) < grossTotal) ||
    (payMode === 'Split' && (() => {
      const c = parseFloat(splitCash) || 0
      const k = parseFloat(splitCard) || 0
      return !(c > 0 && k > 0 && Math.abs(c + k - grossTotal) < 0.01)
    })())
  )

  const choosePayMode = (mode: PayMode) => {
    setPayMode(mode)
    setAmountTendered('')
    setSplitCash('')
    setSplitCard('')
  }

  const lastLine = () => lines[lines.length - 1]

  const shortcutHints = [
    { keys: ['F2', '/'], label: 'البحث / مسح الباركود' },
    { keys: ['+', '-'], label: 'زيادة / إنقاص آخر صنف' },
    { keys: ['F9', 'Ctrl+Enter'], label: 'الدفع، ثم تأكيد الدفع' },
    { keys: ['F5', 'F6', 'F7'], label: 'نقداً / بطاقة / تقسيم (في نافذة الدفع)' },
    { keys: ['Escape'], label: 'إغلاق نافذة الدفع' },
    { keys: ['F8'], label: 'تفريغ السلة' },
    { keys: ['?'], label: 'عرض الاختصارات' },
  ]

  useShortcuts([
    { keys: ['F2', '/'], label: 'search', allowInInputs: true, run: () => searchInputRef.current?.focus() },
    {
      keys: ['+', '='],
      label: 'inc',
      run: () => {
        const l = lastLine()
        if (l && canAddToCart(l.variantId, l.quantity)) updateQuantity(l.variantId, l.quantity + 1)
      },
    },
    { keys: ['-'], label: 'dec', run: () => { const l = lastLine(); if (l) updateQuantity(l.variantId, l.quantity - 1) } },
    {
      keys: ['F9', 'Ctrl+Enter'],
      label: 'pay',
      allowInInputs: true,
      run: () => {
        if (!showPayment) {
          if (lines.length === 0) toast.error('السلة فارغة')
          else { setShowPayment(true); setAmountTendered('') }
          return
        }
        if (canConfirmPayment && !checkout.isPending) checkout.mutate()
      },
    },
    { keys: ['F5'], label: 'cash', allowInInputs: true, enabled: showPayment, run: () => choosePayMode('Cash') },
    { keys: ['F6'], label: 'card', allowInInputs: true, enabled: showPayment, run: () => choosePayMode('Card') },
    { keys: ['F7'], label: 'split', allowInInputs: true, enabled: showPayment, run: () => choosePayMode('Split') },
    { keys: ['Escape'], label: 'close', allowInInputs: true, enabled: showPayment, run: () => setShowPayment(false) },
    { keys: ['F8'], label: 'clear', allowInInputs: true, run: () => { if (lines.length > 0) setConfirmClearCart(true) } },
    { keys: ['?', '؟', 'F1'], label: 'help', run: () => setShowShortcuts(true) },
  ])

  return (
    <div dir="rtl" className="flex h-[calc(100vh-0px)] flex-col" style={RETAIL_ACCENT}>
      <ShortcutsHelp open={showShortcuts} onClose={() => setShowShortcuts(false)} hints={shortcutHints} />
      <ConfirmModal
        open={confirmClearCart}
        onClose={() => setConfirmClearCart(false)}
        onConfirm={() => {
          clear()
          setConfirmClearCart(false)
        }}
        title="تفريغ السلة"
        message="سيتم حذف كل الأصناف من السلة. هل تريد المتابعة؟"
        confirmLabel="تفريغ"
        confirmVariant="danger"
      />
      <OfflineBanner />
      <PageHeader
        title={t.pos.title}
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
                lastScanned ? 'animate-glow-pulse' : 'text-muted',
              )}
              style={lastScanned ? { color: 'var(--accent)', borderColor: 'var(--accent)' } : undefined}
            >
              <ScanBarcode className="h-4 w-4" />
              {lastScanned ? `✓ ${lastScanned}` : t.pos.barcodeHint}
            </div>
          </div>
        }
      />
      <ShiftGate onOpenShift={() => setShowOpenShift(true)}>
      <div className="flex flex-1 overflow-hidden">
        {/* Product shelf */}
        <div className="flex flex-1 flex-col overflow-hidden border-e" style={{ borderColor: 'var(--card-border)' }}>
          <div className="p-4">
            <div className="mb-2 flex justify-end">
              <ShortcutsHelpButton onClick={() => setShowShortcuts(true)} />
            </div>
            {/* inset 3D search with scan-beam on barcode hit */}
            <div className="relative overflow-hidden rounded-xl">
              <Search className="absolute start-3 top-2.5 z-10 h-4 w-4 text-muted" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder={`${t.pos.searchProducts} (F2)`}
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
                          costPrice: variant.costPrice,
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
            <h2 className="font-semibold text-fg">{t.pos.currentOrder}</h2>
          </div>

          <div className="flex-1 overflow-y-auto">
            {lines.length === 0 ? (
              <p className="mt-16 text-center text-sm text-muted">
                {t.pos.addProducts}
              </p>
            ) : (
              <ul className="space-y-2 p-3">
                {lines.map((line) => (
                  <li key={line.variantId} className="card-3d animate-float-up p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-fg">
                          {line.productName}
                        </p>
                        <p className="text-xs text-muted">{line.variantName}</p>
                        <p className="text-xs text-muted">
                          {formatCurrency(line.unitPrice)} {t.pos.each}
                        </p>
                      </div>
                      <button
                        onClick={() => removeLine(line.variantId)}
                        className="shrink-0 text-muted/50 transition-colors hover:text-danger"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateQuantity(line.variantId, line.quantity - 1)}
                          className="card-3d card-3d-lift flex h-6 w-6 items-center justify-center !rounded-md text-muted"
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
                          className="card-3d card-3d-lift flex h-6 w-6 items-center justify-center !rounded-md text-muted"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <span className="text-sm font-semibold tabular-nums text-fg">
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
              <div className="flex justify-between text-muted">
                <span>{t.pos.subtotal}</span>
                <span className="tabular-nums">{formatCurrency(preTaxAmount)}</span>
              </div>
              <div className="flex justify-between text-muted">
                <span>{t.pos.tax}</span>
                <span className="tabular-nums">{formatCurrency(extractedTax)}</span>
              </div>
            </div>
            <div className="mb-4 flex items-center justify-between border-t pt-2" style={{ borderColor: 'var(--card-border)' }}>
              <span className="font-medium text-fg">{t.pos.total}</span>
              <span className="text-emboss text-xl font-bold text-fg">
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
                {t.pos.clear}
              </Button>
              {/* Hold current order */}
              <button
                onClick={handleHold}
                disabled={lines.length === 0}
                title={t.pos.holdOrder}
                className="card-3d card-3d-lift flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-warning disabled:opacity-40"
              >
                <PauseCircle className="h-4 w-4" />
                {t.pos.holdOrder}
              </button>
              {/* Held orders badge */}
              {heldCarts.length > 0 && (
                <button
                  onClick={() => setShowHeld(true)}
                  className="relative card-3d card-3d-lift flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-info"
                  title={t.pos.heldOrders}
                >
                  <PlayCircle className="h-4 w-4" />
                  <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-warning text-[10px] font-bold text-white">
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
              className="btn-3d w-full"
            >
              {t.pos.payment}
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
            <h2 className="mb-4 text-lg font-semibold">{t.pos.payment}</h2>
            <div className="mb-4 space-y-1 text-sm">
              <div className="flex justify-between text-muted">
                <span>{t.pos.subtotal}</span>
                <span>{formatCurrency(preTaxAmount)}</span>
              </div>
              <div className="flex justify-between text-muted">
                <span>{t.pos.tax}</span>
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
              {appliedPoints > 0 && (
                <p className="text-xs text-success">خصم النقاط −{formatCurrency(loyaltyDiscount)}</p>
              )}
              <p className="text-sm text-muted">{t.pos.amountDue}</p>
              <p className="text-emboss text-3xl font-bold" style={{ color: 'var(--accent)' }}>
                {formatCurrency(grossTotal)}
              </p>
            </div>

            <div className="mb-4">
              <LoyaltyPanel
                customer={loyaltyCustomer}
                onCustomerChange={setLoyaltyCustomer}
                redeemPoints={appliedPoints}
                onRedeemPointsChange={(n) => {
                  setRedeemPoints(n)
                  setAmountTendered('')
                  setSplitCash('')
                  setSplitCard('')
                }}
                maxRedeemable={maxRedeemable}
                payable={grossTotal}
                rules={loyaltyRules}
              />
            </div>

            {/* Payment mode selector */}
            <p className="mb-3 text-sm font-medium text-fg">{t.pos.paymentMethod}</p>
            <div className="mb-4 grid grid-cols-3 gap-2">
              {([
                { mode: 'Cash',  icon: <Banknote className="h-4 w-4" />,   label: t.pos.cash    },
                { mode: 'Card',  icon: <CreditCard className="h-4 w-4" />, label: t.pos.card    },
                { mode: 'Split', icon: <span className="text-sm font-black">½</span>, label: t.pos.split },
              ] as { mode: PayMode; icon: React.ReactNode; label: string }[]).map(({ mode, icon, label }) => (
                <button
                  key={mode}
                  onClick={() => choosePayMode(mode)}
                  className={cn(
                    'card-3d flex flex-col items-center gap-1 p-3 text-xs font-medium transition-all',
                    payMode === mode ? 'neon-border' : 'card-3d-lift text-muted',
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
                <CashTender total={grossTotal} value={amountTendered} onChange={setAmountTendered} autoFocus />
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
                  <p className="text-center text-xs font-semibold text-muted">
                    الإجمالي: {formatCurrency(grossTotal)}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted">{t.pos.splitCash}</label>
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
                      <label className="mb-1 block text-xs font-medium text-muted">{t.pos.splitCard}</label>
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
                    <p className="text-center text-xs font-semibold text-danger">
                      الفرق: {(grossTotal - cashNum - cardNum).toFixed(2)} ر.س
                    </p>
                  )}
                  {splitOk && (
                    <p className="text-center text-xs font-semibold text-success">✓ مجموع صحيح</p>
                  )}
                </div>
              )
            })()}

            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setShowPayment(false)} className="flex-1">
                {t.common.cancel}
              </Button>
              <Button
                variant="primary"
                onClick={() => checkout.mutate()}
                loading={checkout.isPending}
                disabled={!canConfirmPayment}
                className="btn-3d flex-1"
              >
                {t.pos.confirmPayment}
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
              <h2 className="font-semibold text-fg">{t.pos.heldOrders}</h2>
              <button onClick={() => setShowHeld(false)} className="text-muted hover:text-fg">
                <X className="h-5 w-5" />
              </button>
            </div>
            {heldCarts.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted">{t.pos.noHeldOrders}</p>
            ) : (
              <ul className="space-y-2 max-h-80 overflow-y-auto">
                {heldCarts.map((cart) => (
                  <li key={cart.id} className="card-3d flex items-center justify-between gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 shrink-0 text-muted" />
                        <span className="text-xs text-muted">
                          {new Date(cart.heldAt).toLocaleTimeString(lang === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm font-medium text-fg">
                        {cart.lines.length} منتج · {formatCurrency(
                          cart.lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0)
                        )}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {cart.lines.map((l) => l.productName).join('، ')}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRestore(cart.id)}
                      className="bg-brand shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold text-brand-fg"
                    >
                      {t.pos.resumeOrder}
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
          offline={completedOffline}
          customerPhone={completedPhone}
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
      <p className="line-clamp-2 text-sm font-medium text-fg">
        {product.name}
      </p>
      <p className="mt-0.5 text-xs text-muted">{variant.name}</p>
      <div className="mt-auto flex w-full items-center justify-between pt-2">
        <p className="text-sm font-bold" style={{ color: 'var(--accent)' }}>
          {formatCurrency(variant.salePrice)}
        </p>
        {stockQty !== null && (
          <span className={cn(
            'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
            outOfStock
              ? 'bg-danger/10 text-danger dark:bg-danger/15'
              : stockQty <= 5
              ? 'bg-warning/10 text-warning dark:bg-warning/15'
              : 'bg-surface-2 text-muted',
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
  offline,
  customerPhone,
  onClose,
}: {
  order: OrderResponse
  offline?: boolean
  customerPhone?: string
  onClose: () => void
}) {
  const { data: zatcaSettings } = useQuery({
    queryKey: ['zatca-settings'],
    queryFn: () => zatcaApi.getSettings(),
    staleTime: 60_000,
  })
  const vatNumber = zatcaSettings?.data?.vatRegistrationNumber ?? ''
  const receiptSettings = useReceiptSettings()

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
        <div className="-mx-2 mb-4 max-h-[60vh] overflow-y-auto px-2">
          <ReceiptDocument
            id="retail-receipt-print"
            settings={receiptSettings}
            sellerName={zatcaSettings?.data?.sellerName ?? ''}
            vatNumber={vatNumber}
            invoiceNo={order.id.slice(-8).toUpperCase()}
            issuedAt={order.completedAt ?? order.createdAt}
            {...orderReceiptFigures(order)}
            paymentLabel={paymentLabel(order.paymentMethod)}
            tendered={order.paymentMethod === 'Cash' ? order.amountTendered ?? undefined : undefined}
            badge={offline ? 'رقم مؤقت · تصدر الفاتورة عند المزامنة' : undefined}
            qr={qrCode}
          />
        </div>

        <div data-no-print className="mb-4">
          <p className="mb-1.5 text-xs font-medium text-muted">إرسال الفاتورة على واتساب</p>
          <WhatsAppShare
            defaultPhone={customerPhone}
            message={buildReceiptMessage({
              storeName: zatcaSettings?.data?.sellerName ?? 'flowin',
              invoiceNo: order.id.slice(-8).toUpperCase(),
              date: new Date(order.completedAt ?? order.createdAt).toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' }),
              items: order.lines.map((l) => ({ name: l.productName, quantity: l.quantity, total: l.lineTotal })),
              discount: order.discountAmount || undefined,
              vat: order.taxAmount,
              total: order.totalAmount,
              payment:
                order.paymentMethod === 'Cash' ? 'نقداً' :
                order.paymentMethod === 'Card' ? 'بطاقة' :
                order.paymentMethod === 'Split' ? 'تقسيم (نقد + بطاقة)' : String(order.paymentMethod ?? ''),
            })}
          />
        </div>

        <div data-no-print className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            إغلاق
          </Button>
          <Button
            variant="primary"
            onClick={() => printElement(document.getElementById('retail-receipt-print'))}
            className="btn-3d flex-1"
          >
            طباعة
          </Button>
        </div>
      </div>
    </div>
  )
}
