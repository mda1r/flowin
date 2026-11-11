import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, Printer, RotateCcw, X } from 'lucide-react'
import { customersApi } from '@/api/customers'
import { useAuthStore } from '@/stores/authStore'
import { ReceiptDocument } from '@/components/pos/ReceiptDocument'
import { CreditNoteModal } from '@/components/pos/CreditNoteModal'
import { WhatsAppShare } from '@/components/pos/WhatsAppShare'
import { useReceiptSettings, useSellerIdentity } from '@/lib/receipt'
import { orderReceiptFigures, paymentLabel, refundLabel, refundState, returnNo } from '@/lib/orderReceipt'
import { invoiceNo } from '@/lib/invoiceNumber'
import { generateZatcaQr } from '@/lib/zatca'
import { buildReceiptMessage } from '@/lib/whatsapp'
import { printElement } from '@/lib/print'
import { formatCurrency } from '@/lib/utils'
import type { OrderResponse, ReturnOrderResponse } from '@/types/api'
import { intlLocale } from '@/lib/locale'

/* A saved sale opened from the invoices list or a shift report: the store's receipt, printable at roll size,
   and shareable on WhatsApp. A refunded sale says so on the slip, and each return on it opens its own
   credit note to print or send. */
export function InvoiceReceiptModal({
  order,
  returns = [],
  onClose,
}: {
  order: OrderResponse
  returns?: ReturnOrderResponse[]
  onClose: () => void
}) {
  const { tenantId } = useAuthStore()
  const settings = useReceiptSettings()
  const { sellerName, vatNumber } = useSellerIdentity()
  const [creditNote, setCreditNote] = useState<ReturnOrderResponse | null>(null)
  const figures = orderReceiptFigures(order)
  const number = invoiceNo(order)
  const issuedAt = order.completedAt ?? order.createdAt
  // The sale's own tax decides (documentHasVat), not today's setting: a tax invoice reprinted after VAT was
  // switched off keeps its VAT and QR; a sale made without VAT prints none.
  const qr = figures.vat
    ? generateZatcaQr({
        sellerName: sellerName || 'flowin',
        vatNumber,
        timestamp: issuedAt,
        totalWithVat: order.totalAmount,
        vatAmount: order.taxAmount,
      })
    : undefined

  // The customer on the sale, so the reprint matches the original slip and WhatsApp is prefilled.
  // A cashier without access to customers still gets the receipt, just without the name.
  const { data: customer } = useQuery({
    queryKey: ['customer', tenantId, order.customerId],
    queryFn: async () => (await customersApi.get(tenantId!, order.customerId!)).data,
    enabled: !!tenantId && !!order.customerId,
    retry: false,
    staleTime: 5 * 60_000,
  })

  const state = refundState(order, returns)
  const refunded = returns.reduce((s, r) => s + r.refundAmount, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl" role="dialog" aria-modal="true" aria-label={`فاتورة رقم ${number}`}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[92vh] w-full max-w-[22rem] flex-col overflow-hidden rounded-2xl bg-surface shadow-2xl">
        <button
          onClick={onClose}
          className="absolute left-3 top-3 z-10 rounded-lg p-1 text-muted hover:bg-surface-2 hover:text-fg"
          aria-label="إغلاق"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="overflow-y-auto p-5">
          <ReceiptDocument
            id="invoice-receipt-print"
            settings={settings}
            sellerName={sellerName}
            vatNumber={vatNumber}
            invoiceNo={number}
            issuedAt={issuedAt}
            {...figures}
            paymentLabel={paymentLabel(order.paymentMethod)}
            tendered={order.paymentMethod === 'Cash' ? order.amountTendered ?? undefined : undefined}
            customer={customer ? { name: customer.name } : undefined}
            badge={state !== 'none' ? (
              <span className={`inline-flex items-center gap-1 ${state === 'full' ? 'text-danger' : 'text-warning'}`}>
                <RotateCcw className="h-3.5 w-3.5" />
                {state === 'full' ? 'مستردة' : 'مستردة جزئياً'} · {formatCurrency(refunded)}
              </span>
            ) : undefined}
            qr={qr}
          />

          {returns.length > 0 && (
            <div className="mt-4 space-y-1.5">
              <p className="text-xs font-medium text-muted">إشعارات الاسترداد</p>
              {returns.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setCreditNote(r)}
                  className="flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2 text-start text-sm hover:bg-surface-2"
                >
                  <RotateCcw className="h-3.5 w-3.5 shrink-0 text-muted" />
                  <span className="min-w-0 flex-1">
                    <bdi dir="ltr" className="font-semibold tabular-nums text-fg">{returnNo(r)}</bdi>
                    <span className="block text-xs text-muted">
                      {new Date(r.createdAt).toLocaleString(intlLocale(), { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · {refundLabel(r.refundMethod)}
                    </span>
                  </span>
                  <span className="font-display font-semibold tabular-nums text-danger">{formatCurrency(r.refundAmount)}</span>
                  <ChevronLeft className="h-4 w-4 shrink-0 text-muted" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-3 border-t border-border p-4">
          <WhatsAppShare
            key={customer?.id ?? 'none'}
            defaultPhone={customer?.phone}
            message={buildReceiptMessage({
              storeName: sellerName || 'flowin',
              invoiceNo: number,
              date: new Date(issuedAt).toLocaleString(intlLocale('ar'), { dateStyle: 'medium', timeStyle: 'short' }),
              items: figures.lines.map((l) => ({ name: l.name, quantity: l.quantity, total: l.total, detail: l.detail })),
              discount: (figures.discount ?? 0) + (figures.loyalty?.amount ?? 0) || undefined,
              // The code names the discount only when no points are folded into the same line.
              discountLabel: figures.loyalty ? undefined : figures.discountLabel,
              vat: figures.vat ? figures.tax : undefined,
              vatIncluded: true,
              total: figures.total,
              payment: paymentLabel(order.paymentMethod),
            })}
          />
          <button
            onClick={() => printElement(document.getElementById('invoice-receipt-print'))}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-fg py-2.5 text-sm font-semibold text-bg hover:bg-fg/85"
          >
            <Printer className="h-4 w-4" />
            طباعة الفاتورة
          </button>
        </div>
      </div>

      {creditNote && (
        <CreditNoteModal ret={creditNote} order={order} defaultPhone={customer?.phone} onClose={() => setCreditNote(null)} />
      )}
    </div>
  )
}
