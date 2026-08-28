import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Receipt, Printer, RotateCcw, X, QrCode, Search } from 'lucide-react'
import { ordersApi } from '@/api/orders'
import { zatcaApi } from '@/api/zatca'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency, cn } from '@/lib/utils'
import { generateZatcaQr } from '@/lib/zatca'
import { useI18n } from '@/i18n'
import type { OrderResponse, ReturnOrderResponse } from '@/types/api'

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
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t.invoices.title}</h1>
        <div className="relative w-64">
          <Search className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder={t.invoices.search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-4 pr-9 text-sm outline-none focus:border-[color:var(--accent)] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-[color:var(--accent)]" />
        </div>
      ) : orders.length === 0 ? (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
          <Receipt className="h-12 w-12 text-gray-300" />
          <p className="text-gray-500">{t.invoices.noInvoices}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="px-4 py-3 text-right font-semibold text-gray-500">#</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-500">{t.invoices.columns.date}</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-500">{t.invoices.columns.items}</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-500">{t.invoices.columns.method}</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-500">{t.invoices.columns.amount}</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-500">{t.invoices.columns.status}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {orders.map((order) => {
                const isReturn = returnedOrderIds.has(order.id)
                return (
                  <tr
                    key={order.id}
                    className={cn(
                      'transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50',
                      isReturn && 'bg-red-50/50 dark:bg-red-900/10',
                    )}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">
                      #{order.id.slice(-6).toUpperCase()}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {new Date(order.completedAt ?? order.createdAt).toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-US', {
                        year: 'numeric', month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      <span className="truncate max-w-[180px] block" title={order.lines.map((l) => l.productName).join('، ')}>
                        {order.lines.map((l) => `${l.productName} ×${l.quantity}`).join('، ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-medium',
                        order.paymentMethod === 'Cash'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                      )}>
                        {order.paymentMethod === 'Cash' ? t.invoices.payment.cash : t.invoices.payment.card}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold tabular-nums text-gray-900 dark:text-gray-100">
                      {formatCurrency(order.totalAmount)}
                    </td>
                    <td className="px-4 py-3">
                      {isReturn ? (
                        <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700 dark:bg-red-900/30 dark:text-red-400">
                          <RotateCcw className="h-3 w-3" />
                          {t.invoices.refunded}
                        </span>
                      ) : (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-800">
                          {t.invoices.completed}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
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
  const { t, lang } = useI18n()
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

  const handlePrint = () => window.print()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" dir="rtl">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900">
        <button
          onClick={onClose}
          className="absolute left-4 top-4 rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="mb-4 text-center">
          {isReturn && (
            <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-sm font-bold text-red-700 dark:bg-red-900/30 dark:text-red-400">
              <RotateCcw className="h-3.5 w-3.5" />
              {t.invoices.refunded}
            </div>
          )}
          {sellerName && (
            <p className="text-base font-bold text-gray-900 dark:text-gray-100">{sellerName}</p>
          )}
          {vatNumber && (
            <p className="text-xs text-gray-500">{t.zatca.vatNumber}: {vatNumber}</p>
          )}
          <p className="mt-1 text-xs text-gray-400">
            {new Date(order.completedAt ?? order.createdAt).toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-US', {
              year: 'numeric', month: 'short', day: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </p>
          <p className="text-xs font-mono text-gray-400">#{order.id.slice(-8).toUpperCase()}</p>
        </div>

        {/* Lines */}
        <div className="mb-4 space-y-2 text-sm">
          {order.lines.map((line) => (
            <div key={line.id} className="flex justify-between text-gray-700 dark:text-gray-300">
              <span className="flex-1 truncate">
                {line.productName}
                {line.quantity > 1 && <span className="text-gray-400"> ×{line.quantity}</span>}
              </span>
              <span className="tabular-nums">{formatCurrency(line.lineTotal)}</span>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="mb-4 space-y-1 border-t border-gray-100 pt-3 text-sm dark:border-gray-800">
          <div className="flex justify-between text-gray-500">
            <span>المجموع قبل الضريبة</span>
            <span className="tabular-nums">{formatCurrency(order.subtotalAmount)}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>ضريبة القيمة المضافة 15%</span>
            <span className="tabular-nums">{formatCurrency(order.taxAmount)}</span>
          </div>
          <div className="flex justify-between font-bold text-gray-900 dark:text-gray-100">
            <span>الإجمالي</span>
            <span className="tabular-nums">{formatCurrency(order.totalAmount)}</span>
          </div>
        </div>

        {/* Payment */}
        <div className="mb-4 rounded-lg bg-gray-50 px-3 py-2 text-center text-xs text-gray-500 dark:bg-gray-800">
          {order.paymentMethod === 'Cash' ? t.invoices.payment.cash : t.invoices.payment.card}
          {order.amountTendered && order.amountTendered > order.totalAmount && (
            <span> · الباقي {formatCurrency(order.amountTendered - order.totalAmount)}</span>
          )}
        </div>

        {/* ZATCA QR */}
        <div className="mb-4 flex flex-col items-center gap-2">
          <QrCode className="h-4 w-4 text-gray-400" />
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(qrCode)}`}
            alt="QR"
            width={100}
            height={100}
            className="rounded-lg"
          />
          <p className="text-[10px] text-gray-400">{t.invoices.qrVerification}</p>
        </div>

        <button
          onClick={handlePrint}
          className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white"
          style={{ background: 'var(--accent)' }}
        >
          <Printer className="h-4 w-4" />
          {t.common.print}
        </button>
      </div>
    </div>
  )
}
