import type { OrderResponse } from '@/types/api'
import type { ReceiptLine } from '@/components/pos/ReceiptDocument'

const r2 = (v: number) => Math.round(v * 100) / 100

const PAYMENT_LABEL: Record<string, string> = {
  Cash: 'نقداً',
  Card: 'بطاقة',
  Split: 'تقسيم (نقد + بطاقة)',
  BankTransfer: 'تحويل بنكي',
  Voucher: 'قسيمة',
}

export const paymentLabel = (method?: string | null) => (method ? PAYMENT_LABEL[method] ?? method : '—')

/* A saved order shown as a customer receipt. The server keeps net prices; the receipt shows lines and the
   discount with VAT included (what the customer saw), then the net subtotal, the VAT and the total. */
export function orderReceiptFigures(order: OrderResponse) {
  const gross = 1 + (order.taxRate ?? 0.15)
  const lines: ReceiptLine[] = order.lines.map((l) => ({
    key: l.id,
    name: l.variantName && !['Standard', 'افتراضي', l.productName].includes(l.variantName) ? `${l.productName} - ${l.variantName}` : l.productName,
    quantity: l.quantity,
    total: r2(l.lineTotal * gross),
  }))
  return {
    lines,
    discount: order.discountAmount ? r2(order.discountAmount * gross) : undefined,
    subtotal: r2(order.subtotalAmount - (order.discountAmount ?? 0)),
    tax: r2(order.taxAmount),
    total: r2(order.totalAmount),
  }
}
