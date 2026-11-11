import type { ExpenseCategory, ExpenseSummaryResponse, OrderResponse, ReturnOrderResponse } from '@/types/api'
import type { ReportSummary } from '@/pages/reports/reportMath'

// The finance page's numbers. Sales, returns and cost of goods come from reportMath.summarize, the same
// function the Reports page uses, so the two pages always agree.

/** Costs that come back every month whatever you sell: the base of the break-even and the "copy" list. */
export const FIXED_CATEGORIES: readonly ExpenseCategory[] = ['Rent', 'Wages', 'Utilities', 'Subscriptions', 'Insurance']

/** 'YYYY-MM' → first and last day of that month as 'YYYY-MM-DD'. */
export function monthRange(month: string) {
  const last = daysInMonth(month)
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` }
}

export function daysInMonth(month: string) {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

export function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** The same day in another month, pulled back to that month's last day (31 Jan → 28/29 Feb). */
export function sameDayIn(month: string, ymd: string) {
  const day = Math.min(Number(ymd.slice(8, 10)), daysInMonth(month))
  return `${month}-${String(day).padStart(2, '0')}`
}

// Same day filter as the Reports page: an order counts on the local day it was completed.
const localDay = (iso: string) => new Date(iso).toLocaleDateString('en-CA')

export const ordersInDays = (orders: OrderResponse[], from: string, to: string) =>
  orders.filter((o) => {
    const ds = localDay(o.completedAt ?? o.createdAt)
    return ds >= from && ds <= to
  })

export const returnsInDays = (returns: ReturnOrderResponse[], from: string, to: string) =>
  returns.filter((r) => {
    const ds = localDay(r.createdAt)
    return ds >= from && ds <= to
  })

export interface IncomeStatement {
  sales: number
  returns: number
  netSales: number
  cogs: number
  grossProfit: number
  /** 0–100, null without sales. */
  grossMargin: number | null
  expenses: number
  netProfit: number
  netMargin: number | null
}

export function incomeStatement(report: ReportSummary, approvedExpenses: number): IncomeStatement {
  const netProfit = report.grossProfit - approvedExpenses
  const hasSales = report.netSales > 0
  return {
    sales: report.sales,
    returns: report.returns.net,
    netSales: report.netSales,
    cogs: report.netCogs,
    grossProfit: report.grossProfit,
    grossMargin: hasSales ? report.margin : null,
    expenses: approvedExpenses,
    netProfit,
    netMargin: hasSales ? (netProfit / report.netSales) * 100 : null,
  }
}

/** Percentage change, or null when there is nothing to compare with. */
export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null
  return ((current - previous) / Math.abs(previous)) * 100
}

/** Approved spending in the fixed categories. */
export function fixedCosts(summary: ExpenseSummaryResponse | undefined) {
  return (summary?.byCategory ?? [])
    .filter((c) => FIXED_CATEGORIES.includes(c.category))
    .reduce((s, c) => s + c.total, 0)
}

export type BreakEven =
  | { kind: 'ok'; monthly: number; daily: number; margin: number }
  | { kind: 'noFixed' | 'noSales' | 'negativeMargin' }

/** Sales needed to pay the fixed costs: fixed ÷ gross margin, spread over the month's days. */
export function breakEven(fixed: number, grossMargin: number | null, days: number): BreakEven {
  if (fixed <= 0) return { kind: 'noFixed' }
  if (grossMargin === null) return { kind: 'noSales' }
  if (grossMargin <= 0) return { kind: 'negativeMargin' }
  const monthly = fixed / (grossMargin / 100)
  return { kind: 'ok', monthly, daily: monthly / days, margin: grossMargin }
}

/** Daily sales summaries → net sales before VAT per 'YYYY-MM' (the server already takes returns off revenue and VAT). */
export function salesByMonth(days: { summaryDate: string; totalRevenue: number; totalTax: number }[]) {
  const out = new Map<string, number>()
  for (const d of days) {
    const key = d.summaryDate.slice(0, 7)
    out.set(key, (out.get(key) ?? 0) + d.totalRevenue - d.totalTax)
  }
  return out
}
