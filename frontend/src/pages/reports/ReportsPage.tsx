import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  TrendingUp,
  ShoppingCart,
  DollarSign,
  Receipt,
  Package,
  CreditCard,
  Banknote,
  Landmark,
  Ticket,
  Calendar,
  AlertTriangle,
  RotateCcw,
  Wallet,
  Download,
  Printer,
  Lock,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/components/ui/Toast'
import { cn, formatCurrency } from '@/lib/utils'
import { downloadCsv } from '@/lib/csv'
import { invoiceNo } from '@/lib/invoiceNumber'
import { printElement } from '@/lib/print'
import { useSellerIdentity } from '@/lib/receipt'
import { useAuthStore } from '@/stores/authStore'
import { salesApi } from '@/api/sales'
import { ordersApi } from '@/api/orders'
import { useI18n } from '@/i18n'
import type { OrderResponse, ReturnOrderResponse } from '@/types/api'
import { ReportsCharts } from './ReportsCharts'
import { orderNet, returnNet, returnVat, summarize, type ReportSummary } from './reportMath'

// Reports show cost and profit, which most owners keep from cashiers.
const REPORT_ROLES = ['Owner', 'Manager', 'Accountant']

// ── Period helpers ─────────────────────────────────────────────────────────────

type Period = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom'

function localDateStr(d: Date): string {
  return d.toLocaleDateString('en-CA') // YYYY-MM-DD
}

function getDateRange(period: Period, customFrom?: string, customTo?: string): { dateFrom: string; dateTo: string } {
  const now = new Date()
  const today = localDateStr(now)

  switch (period) {
    case 'today':
      return { dateFrom: today, dateTo: today }
    case 'week': {
      const start = new Date(now)
      start.setDate(now.getDate() - 6)
      return { dateFrom: localDateStr(start), dateTo: today }
    }
    case 'month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      return { dateFrom: localDateStr(start), dateTo: today }
    }
    case 'quarter': {
      const q = Math.floor(now.getMonth() / 3)
      const start = new Date(now.getFullYear(), q * 3, 1)
      return { dateFrom: localDateStr(start), dateTo: today }
    }
    case 'year': {
      const start = new Date(now.getFullYear(), 0, 1)
      return { dateFrom: localDateStr(start), dateTo: today }
    }
    case 'custom':
      return { dateFrom: customFrom ?? today, dateTo: customTo ?? today }
    default:
      return { dateFrom: today, dateTo: today }
  }
}

function getQuarterLabel(quarterTemplate: string): string {
  const q = Math.floor(new Date().getMonth() / 3) + 1
  return quarterTemplate.replace('{n}', String(q))
}

// ── Analytics helpers ──────────────────────────────────────────────────────────

interface ProductStat {
  productName: string
  variantName: string
  quantity: number
  revenue: number
}

function computeStats(orders: OrderResponse[]) {
  const byPayment: Record<string, number> = {}
  for (const o of orders) {
    if (o.paymentMethod === 'Split') {
      byPayment['Cash'] = (byPayment['Cash'] ?? 0) + (o.splitCash ?? 0)
      byPayment['Card'] = (byPayment['Card'] ?? 0) + (o.splitCard ?? 0)
    } else {
      const m = o.paymentMethod ?? 'Unknown'
      byPayment[m] = (byPayment[m] ?? 0) + o.totalAmount
    }
  }

  const productMap = new Map<string, ProductStat>()
  for (const o of orders) {
    for (const line of o.lines) {
      const key = `${line.productName}::${line.variantName}`
      const prev = productMap.get(key) ?? { productName: line.productName, variantName: line.variantName, quantity: 0, revenue: 0 }
      productMap.set(key, { ...prev, quantity: prev.quantity + line.quantity, revenue: prev.revenue + line.lineTotal })
    }
  }
  const topProducts = Array.from(productMap.values())
    .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
    .slice(0, 10)

  return { byPayment, topProducts }
}

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ title, value, sub, icon, iconWrap, accent }: {
  title: string
  value: string
  sub?: string
  icon: React.ReactNode
  iconWrap: string
  accent: string
}) {
  return (
    <div
      className="card-3d card-3d-lift relative overflow-hidden rounded-2xl p-5"
      style={{ '--kpi-color': accent } as React.CSSProperties}
    >
      <span className="kpi-topbar" aria-hidden="true" />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted">{title}</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-fg">{value}</p>
          {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
        </div>
        <div className={cn('rounded-xl p-3', iconWrap)}>{icon}</div>
      </div>
    </div>
  )
}

// ── VAT Report Section ─────────────────────────────────────────────────────────

function VatReportSection({ dateFrom, dateTo, summary }: {
  dateFrom: string
  dateTo: string
  summary: ReportSummary
}) {
  const { t } = useI18n()
  // The tax base and VAT are both net of returns, so the rate reconciles with what was charged.
  const taxBase = summary.netSales
  const taxRate = taxBase > 0 && summary.netVat > 0 ? ((summary.netVat / taxBase) * 100).toFixed(0) : '15'
  const quarterLabel = getQuarterLabel(t.reports.quarter)

  return (
    <div className="rounded-2xl border border-warning/30 bg-warning/10 p-6 dark:border-warning/60 dark:bg-warning/15">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-warning/10 dark:bg-warning/15">
          <Receipt className="h-6 w-6 text-warning" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-bold text-fg">{t.reports.vatReport}</h3>
            <Badge variant="orange">{quarterLabel}</Badge>
          </div>
          <p className="mt-0.5 text-sm text-muted">
            {dateFrom} – {dateTo}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl bg-surface p-4 shadow-sm">
              <p className="text-xs font-medium text-muted">{t.reports.netSales}</p>
              <p className="mt-1.5 text-lg font-bold tabular-nums text-fg">{formatCurrency(taxBase)}</p>
            </div>
            <div className="rounded-xl bg-surface p-4 shadow-sm">
              <p className="text-xs font-medium text-muted">{t.reports.vatSummary}</p>
              <p className="mt-1.5 text-lg font-bold tabular-nums text-fg">{taxRate}%</p>
            </div>
            <div className="rounded-xl bg-warning/10 p-4 dark:bg-warning/15 shadow-sm">
              <p className="text-xs font-medium text-warning">{t.reports.netVat}</p>
              <p className="mt-1.5 text-lg font-bold tabular-nums text-warning">{formatCurrency(summary.netVat)}</p>
              {summary.returns.vat > 0 && (
                <p className="mt-0.5 text-[11px] tabular-nums text-muted">
                  {formatCurrency(summary.outputVat)} − {formatCurrency(summary.returns.vat)}
                </p>
              )}
            </div>
            <div className="rounded-xl bg-surface p-4 shadow-sm">
              <p className="text-xs font-medium text-muted">{t.reports.totalOrders}</p>
              <p className="mt-1.5 text-lg font-bold tabular-nums text-fg">{summary.orders}</p>
            </div>
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-xl bg-surface/70 p-3 text-xs text-muted">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
            <span>{t.reports.vatDisclaimer}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Printable VAT summary ──────────────────────────────────────────────────────

function VatSummarySlip({ id, dateFrom, dateTo, summary }: {
  id: string
  dateFrom: string
  dateTo: string
  summary: ReportSummary
}) {
  const { t } = useI18n()
  const { sellerName, vatNumber } = useSellerIdentity()
  const rows: { label: string; value: number; minus?: boolean; strong?: boolean }[] = [
    { label: t.reports.salesExVat,   value: summary.sales },
    { label: t.reports.returnsExVat, value: summary.returns.net, minus: true },
    { label: t.reports.netSales,     value: summary.netSales, strong: true },
    { label: t.reports.outputVat,    value: summary.outputVat },
    { label: t.reports.returnsVat,   value: summary.returns.vat, minus: true },
  ]

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div id={id} className="receipt-paper">
        <div className="receipt-center">
          {sellerName && <div className="receipt-store">{sellerName}</div>}
          {vatNumber && <div className="receipt-small">{t.reports.vatNumber}: <span dir="ltr">{vatNumber}</span></div>}
          <div className="receipt-title mt-1">{t.reports.vatReport}</div>
          <div className="receipt-small">
            {t.reports.period}: <span dir="ltr">{dateFrom} – {dateTo}</span>
          </div>
        </div>
        <hr className="receipt-rule" />
        <div className="receipt-totals">
          <div className="receipt-row"><span>{t.reports.invoiceCount}</span><span className="tabular-nums">{summary.orders}</span></div>
          <div className="receipt-row"><span>{t.reports.returnCount}</span><span className="tabular-nums">{summary.returns.count}</span></div>
        </div>
        <hr className="receipt-rule" />
        <div className="receipt-totals">
          {rows.map((r) => (
            <div key={r.label} className={cn('receipt-row', r.strong && 'font-bold')}>
              <span>{r.label}</span>
              <span className="tabular-nums">{r.minus && r.value > 0 ? '− ' : ''}{formatCurrency(r.value)}</span>
            </div>
          ))}
          <div className="receipt-row receipt-total">
            <span>{t.reports.netVat}</span>
            <span className="tabular-nums">{formatCurrency(summary.netVat)}</span>
          </div>
        </div>
        <hr className="receipt-rule" />
        <div className="receipt-small receipt-center">
          {t.reports.printedAt}: <span dir="ltr">{new Date().toLocaleString('en-GB', { hour12: false })}</span>
        </div>
        <div className="receipt-small receipt-center mt-1">{t.reports.vatDisclaimer}</div>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function ReportsPage() {
  const role = useAuthStore((s) => s.user?.role)
  const { t } = useI18n()

  if (!role || !REPORT_ROLES.includes(role)) {
    return (
      <div className="page-fade min-h-full p-6">
        <Card>
          <EmptyState icon={<Lock />} title={t.reports.notAllowed} description={t.reports.notAllowedHint} />
        </Card>
      </div>
    )
  }
  return <ReportsContent />
}

function ReportsContent() {
  const { branchId } = useAuthStore()
  const { t } = useI18n()
  const [vatOpen, setVatOpen] = useState(false)
  const [period, setPeriod] = useState<Period>('month')
  const [customFrom, setCustomFrom] = useState(localDateStr(new Date()))
  const [customTo, setCustomTo] = useState(localDateStr(new Date()))

  const PERIODS: { key: Period; label: string }[] = [
    { key: 'today',   label: t.reports.periods.today },
    { key: 'week',    label: t.reports.periods.last7 },
    { key: 'month',   label: t.reports.periods.thisMonth },
    { key: 'quarter', label: t.reports.periods.thisQuarter },
    { key: 'year',    label: t.reports.periods.thisYear },
    { key: 'custom',  label: t.reports.periods.custom },
  ]

  const PAYMENT_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    Cash:         { label: t.reports.paymentMethods.cash,         icon: <Banknote   className="h-4 w-4" />, color: 'text-success' },
    Card:         { label: t.reports.paymentMethods.card,         icon: <CreditCard className="h-4 w-4" />, color: 'text-info'    },
    BankTransfer: { label: t.reports.paymentMethods.bankTransfer, icon: <Landmark   className="h-4 w-4" />, color: 'text-brand-ink'  },
    Voucher:      { label: t.reports.paymentMethods.voucher,      icon: <Ticket     className="h-4 w-4" />, color: 'text-warning'   },
    Split:        { label: t.reports.paymentMethods.split,        icon: <Banknote   className="h-4 w-4" />, color: 'text-warning'  },
  }

  const { dateFrom, dateTo } = useMemo(
    () => getDateRange(period, customFrom, customTo),
    [period, customFrom, customTo],
  )

  const { data: rawOrders, isLoading, isError } = useQuery({
    queryKey: ['reports', branchId, dateFrom, dateTo],
    queryFn: () => salesApi.listAllCompletedOrders(branchId!, dateFrom, dateTo).then((data) => ({ data })),
    enabled: !!branchId,
  })

  const { data: rawReturns } = useQuery({
    queryKey: ['reports-returns', branchId],
    queryFn: () => ordersApi.listReturns(branchId!),
    enabled: !!branchId,
  })

  const orders = useMemo<OrderResponse[]>(() => {
    const raw = rawOrders?.data
    const all: OrderResponse[] = Array.isArray(raw) ? raw : ((raw as any)?.items ?? [])
    return all.filter(o => {
      const d = new Date(o.completedAt ?? o.createdAt)
      const ds = d.toLocaleDateString('en-CA')
      return ds >= dateFrom && ds <= dateTo
    })
  }, [rawOrders, dateFrom, dateTo])

  const returns = useMemo<ReturnOrderResponse[]>(() => {
    const raw = rawReturns?.data
    const all: ReturnOrderResponse[] = Array.isArray(raw) ? raw : ((raw as any)?.items ?? [])
    return all.filter(r => {
      const ds = new Date(r.createdAt).toLocaleDateString('en-CA')
      return ds >= dateFrom && ds <= dateTo
    })
  }, [rawReturns, dateFrom, dateTo])

  const summary = useMemo(() => summarize(orders, returns), [orders, returns])
  const stats = useMemo(() => computeStats(orders), [orders])

  // One sheet for the accountant: the period's invoices, then its returns as negative credit notes.
  const exportCsv = () => {
    if (orders.length === 0 && returns.length === 0) {
      toast.info(t.reports.nothingToExport)
      return
    }
    const c = t.reports.csv
    const byId = new Map(orders.map((o) => [o.id, o]))
    const money = (v: number) => v.toFixed(2)
    const atOf = (o: OrderResponse) => o.completedAt ?? o.createdAt

    const rows: (string | number)[][] = [...orders]
      .sort((a, b) => atOf(a).localeCompare(atOf(b)))
      .map((o) => [
        c.invoice,
        invoiceNo(o),
        new Date(atOf(o)).toLocaleDateString('en-CA'),
        timeOf(atOf(o)),
        PAYMENT_LABELS[o.paymentMethod ?? '']?.label ?? o.paymentMethod ?? '',
        money(orderNet(o)),
        money(o.taxAmount),
        money(o.totalAmount),
      ])
    for (const r of [...returns].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
      rows.push([
        c.creditNote,
        invoiceNo(byId.get(r.originalOrderId) ?? { id: r.originalOrderId }),
        new Date(r.createdAt).toLocaleDateString('en-CA'),
        timeOf(r.createdAt),
        r.refundMethod === 'StoreCredit' ? c.storeCredit : PAYMENT_LABELS[r.refundMethod]?.label ?? r.refundMethod,
        money(-returnNet(r)),
        money(-returnVat(r)),
        money(-r.refundAmount),
      ])
    }

    downloadCsv(
      `sales-${dateFrom}_${dateTo}.csv`,
      [c.type, c.invoiceNo, c.date, c.time, c.payment, c.net, c.vat, c.total],
      rows,
    )
  }

  const periodLabel = (() => {
    const p = PERIODS.find((x) => x.key === period)!
    if (period === 'custom') return `${customFrom} – ${customTo}`
    return `${p.label} · ${dateFrom}${dateFrom !== dateTo ? ` – ${dateTo}` : ''}`
  })()

  return (
    <div className="page-fade min-h-full">
      <div className="space-y-6 p-6">

        <PageHeader
          title={t.reports.title}
          description={periodLabel}
          action={
            <>
              <Button variant="secondary" size="sm" onClick={exportCsv} disabled={isLoading}>
                <Download className="h-4 w-4" />
                {t.reports.exportCsv}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setVatOpen(true)} disabled={isLoading}>
                <Printer className="h-4 w-4" />
                {t.reports.printVat}
              </Button>
            </>
          }
        />

        {/* ── Period tabs ── */}
        <div className="flex flex-wrap gap-2">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={cn(
                'rounded-xl px-4 py-2 text-sm font-medium transition-all',
                period === p.key
                  ? 'bg-brand text-brand-fg shadow-md'
                  : 'bg-surface-2 text-muted hover:bg-border',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom date range */}
        {period === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-4">
            <Calendar className="h-4 w-4 text-muted shrink-0" />
            <div className="flex items-center gap-2 flex-wrap">
              <label className="text-sm text-muted">{t.reports.from}</label>
              <input
                type="date"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
                className="rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-sm text-fg"
              />
              <label className="text-sm text-muted">{t.reports.to}</label>
              <input
                type="date"
                value={customTo}
                onChange={e => setCustomTo(e.target.value)}
                className="rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-sm text-fg"
              />
            </div>
          </div>
        )}

        {/* ── KPI grid ── */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="card-3d h-28 animate-pulse rounded-2xl bg-surface-2" />
            ))}
          </div>
        ) : isError ? (
          <div className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger dark:border-danger/60 dark:bg-danger/15">
            {t.common.noData}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              <KpiCard
                title={t.reports.netSales}
                value={formatCurrency(summary.netSales)}
                sub={t.reports.netSalesHint}
                icon={<ShoppingCart className="h-5 w-5 text-brand-strong" />}
                iconWrap="bg-brand-soft text-brand-strong"
                accent="rgb(var(--brand))"
              />
              <KpiCard
                title={t.reports.grossProfit}
                value={formatCurrency(summary.grossProfit)}
                sub={t.reports.margin.replace('{n}', summary.margin.toFixed(0))}
                icon={<DollarSign className="h-5 w-5 text-brand-strong" />}
                iconWrap="bg-brand-soft text-brand-strong"
                accent="rgb(var(--brand))"
              />
              <KpiCard
                title={t.reports.avgOrderValue}
                value={formatCurrency(summary.avgOrder)}
                sub={`${summary.orders} · ${t.reports.totalOrders}`}
                icon={<TrendingUp className="h-5 w-5 text-brand-strong" />}
                iconWrap="bg-brand-soft text-brand-strong"
                accent="rgb(var(--brand))"
              />
            </div>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              <KpiCard
                title={t.reports.netVat}
                value={formatCurrency(summary.netVat)}
                sub={t.reports.netVatHint}
                icon={<Receipt className="h-5 w-5 text-brand-strong" />}
                iconWrap="bg-brand-soft text-brand-strong"
                accent="rgb(var(--brand))"
              />
              <KpiCard
                title={t.sales.returns}
                value={String(summary.returns.count)}
                sub={summary.returns.count > 0 ? formatCurrency(summary.returns.refund) : t.common.noData}
                icon={<RotateCcw className="h-5 w-5 text-danger" />}
                iconWrap="bg-danger/10 dark:bg-danger/15"
                accent="rgb(var(--danger))"
              />
              <KpiCard
                title={t.reports.collected}
                value={formatCurrency(summary.collected)}
                icon={<Wallet className="h-5 w-5 text-brand-strong" />}
                iconWrap="bg-brand-soft text-brand-strong"
                accent="rgb(var(--brand))"
              />
            </div>

            {/* ── Charts ── */}
            <ReportsCharts orders={orders} summary={summary} />

            {/* ── VAT Report (shown for quarter and year) ── */}
            {(period === 'quarter' || period === 'year') && (
              <VatReportSection
                dateFrom={dateFrom}
                dateTo={dateTo}
                summary={summary}
              />
            )}

            {/* ── Main content: products + payment breakdown ── */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">

              {/* Best selling products */}
              <div className="lg:col-span-3">
                <Card>
                  <div
                    className="flex items-center justify-between border-b px-6 py-4"
                    style={{ borderColor: 'var(--card-border)' }}
                  >
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted" />
                      <h2 className="text-sm font-semibold text-fg">{t.reports.topProducts}</h2>
                    </div>
                    <Badge variant="gray">{stats.topProducts.length}</Badge>
                  </div>

                  {stats.topProducts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Package className="mb-3 h-10 w-10 text-muted/50" />
                      <p className="text-sm text-muted">{t.common.noData}</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {stats.topProducts.map((p, i) => {
                        const pct = summary.sales > 0 ? Math.min(100, (p.revenue / summary.sales) * 100) : 0
                        return (
                          <div key={i} className="flex items-center gap-4 px-6 py-3.5">
                            <span className="w-5 shrink-0 text-right text-xs font-bold tabular-nums text-muted/50">
                              {i + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="truncate text-sm font-medium text-fg">{p.productName}</p>
                              {p.variantName && p.variantName !== p.productName && (
                                <p className="text-xs text-muted">{p.variantName}</p>
                              )}
                              <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-surface-2">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{ width: `${pct}%`, background: 'var(--accent)' }}
                                />
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-sm font-bold tabular-nums text-fg">{formatCurrency(p.revenue)}</p>
                              <p className="text-xs text-muted">{p.quantity} {t.reports.quantity}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </Card>
              </div>

              {/* Payment method breakdown */}
              <div className="lg:col-span-2 space-y-4">
                <Card>
                  <div
                    className="border-b px-6 py-4"
                    style={{ borderColor: 'var(--card-border)' }}
                  >
                    <h2 className="text-sm font-semibold text-fg">{t.sales.method}</h2>
                  </div>
                  <div className="p-4 space-y-3">
                    {Object.entries(stats.byPayment).length === 0 ? (
                      <p className="py-4 text-center text-sm text-muted">{t.common.noData}</p>
                    ) : (
                      Object.entries(stats.byPayment)
                        .sort(([, a], [, b]) => b - a)
                        .map(([method, amount]) => {
                          const meta = PAYMENT_LABELS[method]
                          const pct = summary.collected > 0 ? (amount / summary.collected) * 100 : 0
                          return (
                            <div key={method} className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <div className={cn('flex items-center gap-2 text-sm', meta?.color ?? 'text-muted')}>
                                  {meta?.icon}
                                  <span>{meta?.label ?? method}</span>
                                </div>
                                <div className="text-right">
                                  <span className="text-sm font-bold tabular-nums text-fg">{formatCurrency(amount)}</span>
                                  <span className="ml-1.5 text-xs text-muted">{pct.toFixed(0)}%</span>
                                </div>
                              </div>
                              <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                                <div
                                  className="h-full rounded-full"
                                  style={{ width: `${pct}%`, background: 'var(--accent)' }}
                                />
                              </div>
                            </div>
                          )
                        })
                    )}
                  </div>
                </Card>

                {/* Summary card */}
                <Card>
                  <div
                    className="border-b px-6 py-4"
                    style={{ borderColor: 'var(--card-border)' }}
                  >
                    <h2 className="text-sm font-semibold text-fg">{t.reports.profitSummary}</h2>
                  </div>
                  <div className="divide-y divide-border p-0">
                    {[
                      { label: t.reports.salesExVat,   value: formatCurrency(summary.sales) },
                      { label: t.reports.returnsExVat, value: summary.returns.net > 0 ? `- ${formatCurrency(summary.returns.net)}` : formatCurrency(0), red: summary.returns.net > 0 },
                      { label: t.reports.netSales,     value: formatCurrency(summary.netSales), bold: true },
                      { label: t.reports.costOfGoods,  value: `- ${formatCurrency(summary.netCogs)}`, red: true },
                      { label: t.reports.grossProfit,  value: formatCurrency(summary.grossProfit), bold: true },
                      { label: t.reports.netVat,       value: formatCurrency(summary.netVat) },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center justify-between px-6 py-3">
                        <span className="text-sm text-muted">{row.label}</span>
                        <span className={cn('tabular-nums text-sm',
                          row.bold ? 'font-bold text-fg' :
                          (row as any).red ? 'font-medium text-danger' :
                          'text-fg')}>
                          {row.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          </>
        )}
      </div>

      <Modal
        open={vatOpen}
        onClose={() => setVatOpen(false)}
        title={t.reports.printVat}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setVatOpen(false)}>{t.common.close}</Button>
            <Button onClick={() => printElement(document.getElementById('vat-summary-print'))}>
              <Printer className="h-4 w-4" />
              {t.common.print}
            </Button>
          </>
        }
      >
        <VatSummarySlip id="vat-summary-print" dateFrom={dateFrom} dateTo={dateTo} summary={summary} />
      </Modal>
    </div>
  )
}
