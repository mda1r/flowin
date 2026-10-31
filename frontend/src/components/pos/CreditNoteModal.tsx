import { Printer, X } from 'lucide-react'
import { ReceiptDocument } from '@/components/pos/ReceiptDocument'
import { WhatsAppShare } from '@/components/pos/WhatsAppShare'
import { useReceiptSettings, useSellerIdentity } from '@/lib/receipt'
import { refundLabel, returnNo, returnReceiptFigures } from '@/lib/orderReceipt'
import { invoiceNo } from '@/lib/invoiceNumber'
import { generateZatcaQr } from '@/lib/zatca'
import { buildReceiptMessage } from '@/lib/whatsapp'
import { printElement } from '@/lib/print'
import type { OrderResponse, ReturnOrderResponse } from '@/types/api'

/* The slip handed to a customer for a return: a credit note (إشعار دائن) that names the original invoice,
   lists what came back, how it was refunded and the VAT on it, with its own ZATCA QR. */
export function CreditNoteModal({
  ret,
  order,
  defaultPhone,
  onClose,
}: {
  ret: ReturnOrderResponse
  /** The original sale, for its invoice number and tax rate. */
  order: Pick<OrderResponse, 'id' | 'number' | 'taxRate'>
  defaultPhone?: string
  onClose: () => void
}) {
  const settings = useReceiptSettings()
  const { sellerName, vatNumber } = useSellerIdentity()
  const figures = returnReceiptFigures(ret, order.taxRate)
  const number = returnNo(ret)
  const reference = invoiceNo(order)
  const qr = generateZatcaQr({
    sellerName: sellerName || 'flowin',
    vatNumber,
    timestamp: ret.createdAt,
    totalWithVat: figures.total,
    vatAmount: figures.tax,
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl" role="dialog" aria-modal="true" aria-label={`إشعار دائن ${number}`}>
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
            id="credit-note-print"
            kind="credit"
            settings={settings}
            sellerName={sellerName}
            vatNumber={vatNumber}
            invoiceNo={number}
            reference={reference}
            issuedAt={ret.createdAt}
            {...figures}
            paymentLabel={refundLabel(ret.refundMethod)}
            qr={qr}
          />
        </div>
        <div className="space-y-3 border-t border-border p-4">
          <WhatsAppShare
            defaultPhone={defaultPhone}
            message={buildReceiptMessage({
              kind: 'credit',
              storeName: sellerName || 'flowin',
              invoiceNo: number,
              reference: `#${reference}`,
              date: new Date(ret.createdAt).toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' }),
              items: figures.lines.map((l) => ({ name: l.name, quantity: l.quantity, total: l.total })),
              vat: figures.tax,
              vatIncluded: true,
              total: figures.total,
              payment: refundLabel(ret.refundMethod),
            })}
          />
          <button
            onClick={() => printElement(document.getElementById('credit-note-print'))}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-fg py-2.5 text-sm font-semibold text-bg hover:bg-fg/85"
          >
            <Printer className="h-4 w-4" />
            طباعة الإشعار
          </button>
        </div>
      </div>
    </div>
  )
}
