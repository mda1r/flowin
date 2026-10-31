import { SAUDI_VAT_RATE } from '@/lib/zatca'
import type { CartDiscount, CartLine } from '@/stores/cartStore'

const r2 = (v: number) => Math.round(v * 100) / 100
const r4 = (v: number) => Math.round(v * 10000) / 10000
const GROSS = 1 + SAUDI_VAT_RATE

// The pre-VAT unit price the server receives; shelf prices include VAT.
export const netUnitPrice = (grossPrice: number) => r4(grossPrice / GROSS)

// A discount as checkout expects it: a percentage, or a fixed amount in net riyals.
export function serverDiscount(d?: CartDiscount | null): { discountType: 'None' | 'Percentage' | 'Fixed'; discountValue: number } {
  if (!d || d.value <= 0) return { discountType: 'None', discountValue: 0 }
  return d.type === 'Percentage'
    ? { discountType: 'Percentage', discountValue: d.value }
    : { discountType: 'Fixed', discountValue: r4(d.value / GROSS) }
}

const amountOff = (base: number, d?: CartDiscount | null) => {
  if (!d || d.value <= 0) return 0
  return d.type === 'Percentage' ? r4((base * Math.min(d.value, 100)) / 100) : Math.min(r4(d.value / GROSS), base)
}

export interface CartLineTotals {
  variantId: string
  // Net, as the server keeps them.
  subtotal: number
  discount: number
  total: number
}

/* The bill worked out the way the server does it (net prices, four places), so the till shows the same
   figures the receipt will print. loyaltyValue is the riyal value of redeemed points, VAT included. */
export function cartTotals(lines: CartLine[], cartDiscount: CartDiscount | null, loyaltyValue = 0) {
  const lineTotals: CartLineTotals[] = lines.map((l) => {
    const subtotal = netUnitPrice(l.unitPrice) * l.quantity
    const discount = amountOff(subtotal, l.discount)
    return { variantId: l.variantId, subtotal, discount, total: subtotal - discount }
  })
  const before = lineTotals.reduce((s, l) => s + l.subtotal, 0)
  const subtotal = lineTotals.reduce((s, l) => s + l.total, 0)
  const cartOff = amountOff(subtotal, cartDiscount)
  const room = Math.max(subtotal - cartOff, 0)
  const loyaltyNet = Math.min(r4(loyaltyValue / GROSS), room)
  const manual = lineTotals.reduce((s, l) => s + l.discount, 0) + cartOff
  const taxable = subtotal - cartOff - loyaltyNet
  const tax = r4(taxable * SAUDI_VAT_RATE)
  return {
    lineTotals,
    // Net subtotal after line discounts, and the order-level discount (cart + points), as the order stores them.
    subtotalNet: subtotal,
    orderDiscountNet: cartOff + loyaltyNet,
    // What the cashier gave away by hand, VAT included, and as a share of the undiscounted bill.
    discountGross: r2(manual * GROSS),
    discountPercent: before > 0 ? r2((manual / before) * 100) : 0,
    // Payable before points; the ceiling for a loyalty redemption.
    beforeLoyalty: r2(room * GROSS),
    preTax: r2(taxable),
    tax: r2(tax),
    total: r2(r4(taxable + tax)),
  }
}

// The fraction to knock off so the customer pays a whole riyal (e.g. 47.85 → 47.00); 0 when already whole.
export const roundDownAmount = (payable: number) => r2(payable - Math.floor(payable + 0.0001))
