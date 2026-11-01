import type { OrderResponse, RefundMethod, ReturnOrderResponse, ReturnReason } from '@/types/api'
import type { ReceiptLine } from '@/components/pos/ReceiptDocument'
import { lineDisplayName } from '@/lib/variantName'
import { lineDetail } from '@/lib/modifiers'

const r2 = (v: number) => Math.round(v * 100) / 100

const PAYMENT_LABEL: Record<string, string> = {
  Cash: 'نقداً',
  Card: 'بطاقة',
  Digital: 'دفع رقمي',
  Split: 'تقسيم (نقد + بطاقة)',
  BankTransfer: 'تحويل بنكي',
  Voucher: 'قسيمة',
}

export const paymentLabel = (method?: string | null) => (method ? PAYMENT_LABEL[method] ?? method : '—')

const REFUND_LABEL: Record<RefundMethod, string> = {
  Cash: 'نقداً',
  Card: 'إلى البطاقة',
  StoreCredit: 'رصيد في المتجر',
}

export const refundLabel = (method: RefundMethod) => REFUND_LABEL[method] ?? method

const REASON_LABEL: Record<ReturnReason, string> = {
  DefectiveProduct: 'منتج تالف',
  CustomerRequest: 'طلب العميل',
  OrderError: 'خطأ في الطلب',
  Other: 'سبب آخر',
}

const lineName = (l: { productName: string; variantName: string }) => lineDisplayName(l.productName, l.variantName)

/* A saved order shown as a customer receipt. The server keeps net prices; the receipt shows lines and the
   discounts with VAT included (what the customer saw), then the net subtotal, the VAT and the total.
   discountAmount already includes the loyalty redemption, so the two are printed apart. */
export function orderReceiptFigures(order: OrderResponse) {
  const gross = 1 + (order.taxRate ?? 0.15)
  const lines: ReceiptLine[] = order.lines.map((l) => ({
    key: l.id,
    name: lineName(l),
    detail: lineDetail(l.modifiers?.map((m) => m.name), l.notes),
    quantity: l.quantity,
    total: r2(l.lineTotal * gross),
  }))
  const loyaltyNet = order.loyaltyDiscountAmount ?? 0
  const manualNet = Math.max((order.discountAmount ?? 0) - loyaltyNet, 0)
  return {
    lines,
    discount: manualNet > 0 ? r2(manualNet * gross) : undefined,
    discountLabel: manualNet > 0 ? order.discountCode ?? undefined : undefined,
    loyalty: loyaltyNet > 0 ? { amount: r2(loyaltyNet * gross), points: order.loyaltyPointsRedeemed ?? 0 } : undefined,
    split: order.paymentMethod === 'Split' && (order.splitCash != null || order.splitCard != null)
      ? { cash: order.splitCash ?? 0, card: order.splitCard ?? 0 }
      : undefined,
    subtotal: r2(order.subtotalAmount - (order.discountAmount ?? 0)),
    tax: r2(order.taxAmount),
    total: r2(order.totalAmount),
  }
}

/* A return as a credit note. Returned lines are kept net on the server and the refund adds VAT on top,
   so the VAT on the note is the refund less the net lines. */
export function returnReceiptFigures(ret: ReturnOrderResponse, taxRate?: number) {
  const net = ret.lines.reduce((s, l) => s + l.lineTotal, 0)
  const gross = taxRate != null ? 1 + taxRate : net > 0 ? ret.refundAmount / net : 1.15
  const lines: ReceiptLine[] = ret.lines.map((l) => ({
    key: l.id,
    name: lineName(l),
    quantity: l.quantity,
    total: r2(l.lineTotal * gross),
    detail: REASON_LABEL[l.reason],
  }))
  return {
    lines,
    subtotal: r2(net),
    tax: r2(ret.refundAmount - net),
    total: r2(ret.refundAmount),
  }
}

// A credit note has no store number of its own; it is told apart by a short code from its id.
export const returnNo = (ret: { id: string }) => `R-${ret.id.slice(-6).toUpperCase()}`

export type RefundState = 'none' | 'partial' | 'full'

/* Whether a sale was given back in full: every unit of every line returned. Comparing amounts alone
   misleads when the sale had a discount, because refunds are priced at the undiscounted line price. */
export function refundState(order: OrderResponse, returns: ReturnOrderResponse[]): RefundState {
  if (returns.length === 0) return 'none'
  const returned = new Map<string, number>()
  for (const r of returns) for (const l of r.lines) returned.set(l.originalLineId, (returned.get(l.originalLineId) ?? 0) + l.quantity)
  const allBack = order.lines.length > 0 && order.lines.every((l) => (returned.get(l.id) ?? 0) >= l.quantity)
  return allBack ? 'full' : 'partial'
}
