import { Printer, RotateCcw, X } from 'lucide-react'
import { ReceiptDocument } from '@/components/pos/ReceiptDocument'
import { WhatsAppShare } from '@/components/pos/WhatsAppShare'
import { useReceiptSettings, useSellerIdentity } from '@/lib/receipt'
import { orderReceiptFigures, paymentLabel } from '@/lib/orderReceipt'
import { invoiceNo } from '@/lib/invoiceNumber'
import { generateZatcaQr } from '@/lib/zatca'
import { buildReceiptMessage } from '@/lib/whatsapp'
import { printElement } from '@/lib/print'
import { formatCurrency } from '@/lib/utils'
import type { OrderResponse, ReturnOrderResponse } from '@/types/api'

/* A saved sale opened from the invoices list or a shift report: the store's receipt, printable at roll size,
   and shareable on WhatsApp. A refunded sale says so on the slip and shows how much went back. */
export function InvoiceReceiptModal({
  order,
  refund,
  onClose,
}: {
  order: OrderResponse
  refund?: ReturnOrderResponse
  onClose: () => void
}) {
  const settings = useReceiptSettings()
  const { sellerName, vatNumber } = useSellerIdentity()
  const figures = orderReceiptFigures(order)
  const number = invoiceNo(order)
  const issuedAt = order.completedAt ?? order.createdAt
  const qr = generateZatcaQr({
    sellerName: sellerName || 'flowin',
    vatNumber,
    timestamp: issuedAt,
    totalWithVat: order.totalAmount,
    vatAmount: order.taxAmount,
  })

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
            badge={refund ? (
              <span className="inline-flex items-center gap-1 text-danger">
                <RotateCcw className="h-3.5 w-3.5" />
                مستردة · {formatCurrency(refund.refundAmount)}
              </span>
            ) : undefined}
            qr={qr}
          />
        </div>
        <div className="space-y-3 border-t border-border p-4">
          <WhatsAppShare
            message={buildReceiptMessage({
              storeName: sellerName || 'flowin',
              invoiceNo: number,
              date: new Date(issuedAt).toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' }),
              items: figures.lines.map((l) => ({ name: l.name, quantity: l.quantity, total: l.total })),
              discount: figures.discount,
              vat: figures.tax,
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
    </div>
  )
}
