import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Receipt, Printer, RotateCcw, X, Search } from 'lucide-react'
import { ordersApi } from '@/api/orders'
import { zatcaApi } from '@/api/zatca'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency, cn } from '@/lib/utils'
import { generateZatcaQr } from '@/lib/zatca'
import { useI18n } from '@/i18n'
import type { OrderResponse, ReturnOrderResponse } from '@/types/api'
import { ReceiptDocument } from '@/components/pos/ReceiptDocument'
import { useReceiptSettings } from '@/lib/receipt'
import { orderReceiptFigures, paymentLabel } from '@/lib/orderReceipt'
import { printElement } from '@/lib/print'

export function InvoicesPage() {
  const { branchId } = useAuthStore()
  const { t, lang } = useI18n()
  const [search, setSearch] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<OrderResponse | null>(null)

  const { data: ordersRaw = [], isLoading } = useQuery({
    queryKey: ['invoices', branchId],
    queryFn: async () => {
      if (!branchId) return []
      const { data } = await ordersApi.listOrders(branchId, { status: 'Completed', pageSize: 100 })
      return (Array.isArray(data) ? data : (data as any)?.items ?? []) as OrderResponse[]
    },
    enabled: !!branchId,
  })

  const { data: returns = [] } = useQuery({
    queryKey: ['returns', branchId],
    queryFn: async () => {
      if (!branchId) return []
      const { data } = await ordersApi.listReturns(branchId)
      return (Array.isArray(data) ? data : []) as ReturnOrderResponse[]
    },
    enabled: !!branchId,
  })

  const returnedOrderIds = new Set(returns.map((r) => r.originalOrderId))

  const orders = ordersRaw.filter((o) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      o.id.toLowerCase().includes(q) ||
      o.lines.some((l) => l.productName.toLowerCase().includes(q))
    )
  })

  return (
    <div className="p-6" dir="rtl">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-fg">{t.invoices.title}</h1>
        <div className="relative w-64">
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted" />
          <input
            type="text"
            placeholder={t.invoices.search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface py-2 pl-4 pr-9 text-sm outline-none focus:border-brand text-fg"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-brand" />
        </div>
      ) : orders.length === 0 ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
          <Receipt className="h-12 w-12 text-muted/50" />
          <p className="text-muted">{t.invoices.noInvoices}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-right font-semibold text-muted">#</th>
                <th className="px-4 py-3 text-right font-semibold text-muted">{t.invoices.columns.date}</th>
                <th className="px-4 py-3 text-right font-semibold text-muted">{t.invoices.columns.items}</th>
                <th className="px-4 py-3 text-right font-semibold text-muted">{t.invoices.columns.method}</th>
                <th className="px-4 py-3 text-right font-semibold text-muted">{t.invoices.columns.amount}</th>
                <th className="px-4 py-3 text-right font-semibold text-muted">{t.invoices.columns.status}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orders.map((order) => {
                const isReturn = returnedOrderIds.has(order.id)
                return (
                  <tr
                    key={order.id}
                    className={cn(
                      'transition-colors hover:bg-surface-2',
                      isReturn && 'bg-danger/10 dark:bg-danger/15',
                    )}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-muted">
                      #{order.id.slice(-6).toUpperCase()}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {new Date(order.completedAt ?? order.createdAt).toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-US', {
                        year: 'numeric', month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      <span className="truncate max-w-[180px] block" title={order.lines.map((l) => l.productName).join('، ')}>
                        {order.lines.map((l) => `${l.productName} ×${l.quantity}`).join('، ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-medium',
                        order.paymentMethod === 'Cash'
                          ? 'bg-success/10 text-success dark:bg-success/15'
                          : 'bg-info/10 text-info',
                      )}>
                        {order.paymentMethod === 'Cash' ? t.invoices.payment.cash : t.invoices.payment.card}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold tabular-nums text-fg">
                      {formatCurrency(order.totalAmount)}
                    </td>
                    <td className="px-4 py-3">
                      {isReturn ? (
                        <span className="flex items-center gap-1 rounded-full bg-danger/10 px-2 py-0.5 text-xs font-bold text-danger dark:bg-danger/15">
                          <RotateCcw className="h-3 w-3" />
                          {t.invoices.refunded}
                        </span>
                      ) : (
                        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">
                          {t.invoices.completed}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-surface-2"
                        title={t.invoices.printReceipt}
                      >
                        <Printer className="h-3.5 w-3.5" />
                        {t.common.print}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Receipt modal */}
      {selectedOrder && (
        <ReceiptModal
          order={selectedOrder}
          isReturn={returnedOrderIds.has(selectedOrder.id)}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </div>
  )
}

function ReceiptModal({
  order,
  isReturn,
  onClose,
}: {
  order: OrderResponse
  isReturn: boolean
  onClose: () => void
}) {
  const { t } = useI18n()
  const { data: zatcaSettings } = useQuery({
    queryKey: ['zatca-settings'],
    queryFn: () => zatcaApi.getSettings(),
    staleTime: 60_000,
  })

  const sellerName = zatcaSettings?.data?.sellerName ?? ''
  const vatNumber = zatcaSettings?.data?.vatRegistrationNumber ?? ''

  const qrCode = generateZatcaQr({
    sellerName: sellerName || 'flowin',
    vatNumber,
    timestamp: order.completedAt ?? order.createdAt,
    totalWithVat: order.totalAmount,
    vatAmount: order.taxAmount,
  })

  const receiptSettings = useReceiptSettings()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[22rem] overflow-hidden rounded-2xl bg-surface shadow-2xl">
        <button
          onClick={onClose}
          className="absolute left-3 top-3 z-10 rounded-lg p-1 text-muted hover:bg-surface-2 hover:text-fg"
          aria-label={t.common.close}
        >
          <X className="h-4 w-4" />
        </button>
        <div className="max-h-[70vh] overflow-y-auto p-5">
          <ReceiptDocument
            id="invoice-receipt-print"
            settings={receiptSettings}
            sellerName={sellerName}
            vatNumber={vatNumber}
            invoiceNo={order.id.slice(-8).toUpperCase()}
            issuedAt={order.completedAt ?? order.createdAt}
            {...orderReceiptFigures(order)}
            paymentLabel={paymentLabel(order.paymentMethod)}
            tendered={order.paymentMethod === 'Cash' ? order.amountTendered ?? undefined : undefined}
            badge={isReturn ? (
              <span className="inline-flex items-center gap-1 text-danger">
                <RotateCcw className="h-3.5 w-3.5" />
                {t.invoices.refunded}
              </span>
            ) : undefined}
            qr={qrCode}
          />
        </div>
        <div className="border-t border-border p-4">
          <button
            onClick={() => printElement(document.getElementById('invoice-receipt-print'))}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-fg py-2.5 text-sm font-semibold text-bg hover:bg-fg/85"
          >
            <Printer className="h-4 w-4" />
            {t.common.print}
          </button>
        </div>
      </div>
    </div>
  )
}
