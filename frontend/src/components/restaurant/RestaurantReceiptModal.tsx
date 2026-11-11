import { Printer, X } from 'lucide-react'
import { ReceiptDocument, type ReceiptLine } from '@/components/pos/ReceiptDocument'
import { WhatsAppShare } from '@/components/pos/WhatsAppShare'
import { useReceiptSettings, useSellerIdentity } from '@/lib/receipt'
import { paymentLabel } from '@/lib/orderReceipt'
import { useVat } from '@/lib/vat'
import { invoiceNo } from '@/lib/invoiceNumber'
import { generateZatcaQr } from '@/lib/zatca'
import { buildReceiptMessage } from '@/lib/whatsapp'
import { printElement } from '@/lib/print'
import type { RestaurantOrderResponse } from '@/types/api'

const r2 = (v: number) => Math.round(v * 100) / 100

/* The customer's receipt after a table or a quick order is paid. Menu prices include VAT, so the lines,
   discount and total are what the customer saw; the net subtotal is the total less its VAT share.
   A table paid with several rounds prints them on one slip. */
export function RestaurantReceiptModal({
  orders,
  label,
  onClose,
}: {
  orders: RestaurantOrderResponse[]
  label: string
  onClose: () => void
}) {
  const settings = useReceiptSettings()
  const { sellerName, vatNumber } = useSellerIdentity()

  const lines: ReceiptLine[] = orders.flatMap((o) =>
    o.items.map((i) => ({ key: i.id, name: i.itemName, quantity: i.quantity, total: r2(i.lineTotal), detail: i.notes || undefined })),
  )
  const total = r2(orders.reduce((s, o) => s + o.total, 0))
  const tax = r2(orders.reduce((s, o) => s + o.taxAmount, 0))
  const discount = r2(orders.reduce((s, o) => s + o.discountAmount, 0))
  const method = orders[0]?.paymentMethod
  const tendered = method === 'Cash' ? r2(orders.reduce((s, o) => s + (o.amountTendered ?? o.total), 0)) : undefined
  const issuedAt = orders.map((o) => o.paidAt ?? o.createdAt).sort().pop() ?? new Date().toISOString()
  const number = orders.map((o) => invoiceNo(o)).join(' · ')
  // Paid orders decide by their own tax, not today's setting: VAT stays on a reprint of an order that had it,
  // and an order opened with VAT off prints a plain invoice. Only a bill of nothing follows the shop's setting.
  const shopVat = useVat().enabled
  const hasVat = tax > 0 || (total <= 0 && shopVat)
  const qr = hasVat
    ? generateZatcaQr({
        sellerName: sellerName || 'flowin',
        vatNumber,
        timestamp: issuedAt,
        totalWithVat: total,
        vatAmount: tax,
      })
    : undefined

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl" role="dialog" aria-modal="true" aria-label={`فاتورة ${label}`}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[92vh] w-full max-w-[22rem] flex-col overflow-hidden rounded-2xl bg-surface shadow-2xl">
        <button
          onClick={onClose}
          className="absolute end-3 top-3 z-10 rounded-lg p-1 text-muted hover:bg-surface-2 hover:text-fg"
          aria-label="إغلاق"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="overflow-y-auto p-5">
          <ReceiptDocument
            id="restaurant-receipt-print"
            settings={settings}
            sellerName={sellerName}
            vatNumber={vatNumber}
            invoiceNo={number}
            issuedAt={issuedAt}
            lines={lines}
            subtotal={r2(total - tax)}
            tax={tax}
            vat={hasVat}
            total={total}
            discount={discount || undefined}
            paymentLabel={paymentLabel(method)}
            tendered={tendered}
            badge={label}
            qr={qr}
          />
        </div>
        <div className="space-y-3 border-t border-border p-4">
          <WhatsAppShare
            message={buildReceiptMessage({
              storeName: sellerName || 'flowin',
              invoiceNo: number,
              date: new Date(issuedAt).toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' }),
              items: lines.map((l) => ({ name: l.name, quantity: l.quantity, total: l.total })),
              discount: discount || undefined,
              vat: hasVat ? tax : undefined,
              vatIncluded: true,
              total,
              payment: paymentLabel(method),
            })}
          />
          <button
            onClick={() => printElement(document.getElementById('restaurant-receipt-print'))}
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
