import type { OrderResponse, ReturnOrderResponse } from '@/types/api'

// One set of numbers for the whole reports page, so the cards, charts, VAT summary and export agree.
//
// Orders store net amounts: subtotal is the lines before VAT, discount is the manual discount plus
// the loyalty redemption (both pre-tax), and VAT is charged on what is left. A return is a credit
// note: its refund carries VAT, so it is split back into net and VAT, and the goods' cost comes back too.

/** What the sale really earned before VAT: lines minus the order and loyalty discounts. */
export const orderNet = (o: OrderResponse) => o.subtotalAmount - (o.discountAmount ?? 0)

export const orderCost = (o: OrderResponse) =>
  o.lines.reduce((s, l) => s + (l.costPrice ?? 0) * l.quantity, 0)

export const returnNet = (r: ReturnOrderResponse) =>
  r.netAmount ?? r.lines.reduce((s, l) => s + l.lineTotal, 0)

export const returnVat = (r: ReturnOrderResponse) => r.taxAmount ?? r.refundAmount - returnNet(r)

export interface ReturnTotals {
  count: number
  /** What the customers got back, VAT included. */
  refund: number
  net: number
  vat: number
  /** Cost of the returned goods, taken off the cost of goods sold. */
  cost: number
}

export function summarizeReturns(returns: ReturnOrderResponse[], orders: OrderResponse[]): ReturnTotals {
  // Older servers don't send the line cost; fall back to the sale line when it is in the period.
  const lineCost = new Map<string, number>()
  for (const o of orders) for (const l of o.lines) lineCost.set(l.id, l.costPrice ?? 0)

  let refund = 0, net = 0, vat = 0, cost = 0
  for (const r of returns) {
    refund += r.refundAmount
    net += returnNet(r)
    vat += returnVat(r)
    for (const l of r.lines) cost += (l.costPrice || lineCost.get(l.originalLineId) || 0) * l.quantity
  }
  return { count: returns.length, refund, net, vat, cost }
}

export interface ReportSummary {
  orders: number
  /** Collected from customers, VAT included. */
  collected: number
  /** Sales before VAT, after discounts. */
  sales: number
  outputVat: number
  cogs: number
  returns: ReturnTotals
  /** Sales minus returns, before VAT. */
  netSales: number
  /** Cost of goods sold minus the cost of what came back. */
  netCogs: number
  grossProfit: number
  /** Gross profit as a share of net sales, 0–100. */
  margin: number
  /** Output VAT minus the VAT given back on returns: what goes on the VAT return. */
  netVat: number
  avgOrder: number
}

export function summarize(orders: OrderResponse[], returns: ReturnOrderResponse[]): ReportSummary {
  const collected = orders.reduce((s, o) => s + o.totalAmount, 0)
  const sales = orders.reduce((s, o) => s + orderNet(o), 0)
  const outputVat = orders.reduce((s, o) => s + o.taxAmount, 0)
  const cogs = orders.reduce((s, o) => s + orderCost(o), 0)
  const ret = summarizeReturns(returns, orders)

  const netSales = sales - ret.net
  const netCogs = cogs - ret.cost
  const grossProfit = netSales - netCogs

  return {
    orders: orders.length,
    collected,
    sales,
    outputVat,
    cogs,
    returns: ret,
    netSales,
    netCogs,
    grossProfit,
    margin: netSales > 0 ? (grossProfit / netSales) * 100 : 0,
    netVat: outputVat - ret.vat,
    avgOrder: orders.length > 0 ? collected / orders.length : 0,
  }
}
