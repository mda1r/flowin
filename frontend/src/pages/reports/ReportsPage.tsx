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
  TrendingDown,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { cn, formatCurrency } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { salesApi } from '@/api/sales'
import { ordersApi } from '@/api/orders'
import { useI18n } from '@/i18n'
import type { OrderResponse, ReturnOrderResponse } from '@/types/api'

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
  const totalRevenue = orders.reduce((s, o) => s + o.totalAmount, 0)
  const totalTax = orders.reduce((s, o) => s + o.taxAmount, 0)
  const totalSubtotal = orders.reduce((s, o) => s + o.subtotalAmount, 0)
  const totalOrders = orders.length
  const avgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0

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

  return { totalRevenue, totalTax, totalSubtotal, totalOrders, avgOrder, byPayment, topProducts }
}

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
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{value}</p>
          {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
        </div>
        <div className={cn('rounded-xl p-3', iconWrap)}>{icon}</div>
      </div>
    </div>
  )
}

// ── VAT Report Section ─────────────────────────────────────────────────────────

function VatReportSection({ dateFrom, dateTo, totalTax, totalSubtotal, totalOrders }: {
  dateFrom: string
  dateTo: string
  totalTax: number
  totalSubtotal: number
  totalOrders: number
}) {
  const { t } = useI18n()
  const taxBase = totalSubtotal
  const taxRate = totalSubtotal > 0 && totalTax > 0 ? ((totalTax / totalSubtotal) * 100).toFixed(0) : '15'
  const quarterLabel = getQuarterLabel(t.reports.quarter)

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-6 dark:border-amber-800/40 dark:bg-amber-900/10">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/40">
          <Receipt className="h-6 w-6 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">{t.reports.vatReport}</h3>
            <Badge variant="orange">{quarterLabel}</Badge>
          </div>
          <p className="mt-0.5 text-sm text-gray-500">
            {dateFrom} – {dateTo}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl bg-white p-4 dark:bg-gray-800 shadow-sm">
              <p className="text-xs font-medium text-gray-400">{t.reports.totalRevenue}</p>
              <p className="mt-1.5 text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(taxBase)}</p>
            </div>
            <div className="rounded-xl bg-white p-4 dark:bg-gray-800 shadow-sm">
              <p className="text-xs font-medium text-gray-400">{t.reports.vatSummary}</p>
              <p className="mt-1.5 text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">{taxRate}%</p>
            </div>
            <div className="rounded-xl bg-amber-100 p-4 dark:bg-amber-900/30 shadow-sm">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400">{t.reports.totalVat}</p>
              <p className="mt-1.5 text-lg font-bold tabular-nums text-amber-800 dark:text-amber-300">{formatCurrency(totalTax)}</p>
            </div>
            <div className="rounded-xl bg-white p-4 dark:bg-gray-800 shadow-sm">
              <p className="text-xs font-medium text-gray-400">{t.reports.totalOrders}</p>
              <p className="mt-1.5 text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">{totalOrders}</p>
            </div>
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-xl bg-white/70 p-3 text-xs text-gray-500 dark:bg-gray-800/50">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
            <span>{t.reports.vatDisclaimer}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function ReportsPage() {
  const { branchId } = useAuthStore()
  const { t } = useI18n()
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
    Cash:         { label: t.reports.paymentMethods.cash,         icon: <Banknote   className="h-4 w-4" />, color: 'text-emerald-600' },
    Card:         { label: t.reports.paymentMethods.card,         icon: <CreditCard className="h-4 w-4" />, color: 'text-blue-600'    },
    BankTransfer: { label: t.reports.paymentMethods.bankTransfer, icon: <Landmark   className="h-4 w-4" />, color: 'text-violet-600'  },
    Voucher:      { label: t.reports.paymentMethods.voucher,      icon: <Ticket     className="h-4 w-4" />, color: 'text-amber-600'   },
    Split:        { label: t.reports.paymentMethods.split,        icon: <Banknote   className="h-4 w-4" />, color: 'text-orange-600'  },
  }

  const { dateFrom, dateTo } = useMemo(
    () => getDateRange(period, customFrom, customTo),
    [period, customFrom, customTo],
  )

  const { data: rawOrders, isLoading, isError } = useQuery({
    queryKey: ['reports', branchId, dateFrom, dateTo],
    queryFn: () => salesApi.listCompletedOrders(branchId!, { dateFrom, dateTo }),
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

  const returnStats = useMemo(() => ({
    count: returns.length,
    total: returns.reduce((s, r) => s + r.refundAmount, 0),
  }), [returns])

  const stats = useMemo(() => computeStats(orders), [orders])

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
                  ? 'bg-[var(--accent)] text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom date range */}
        {period === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
            <Calendar className="h-4 w-4 text-gray-400 shrink-0" />
            <div className="flex items-center gap-2 flex-wrap">
              <label className="text-sm text-gray-500">{t.reports.from}</label>
              <input
                type="date"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
                className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
              <label className="text-sm text-gray-500">{t.reports.to}</label>
              <input
                type="date"
                value={customTo}
                onChange={e => setCustomTo(e.target.value)}
                className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
          </div>
        )}

        {/* ── KPI grid ── */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="card-3d h-28 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
            ))}
          </div>
        ) : isError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
            {t.common.noData}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              <KpiCard
                title={t.sales.netRevenue}
                value={formatCurrency(stats.totalRevenue - returnStats.total)}
                sub={String(stats.totalOrders)}
                icon={<DollarSign className="h-5 w-5 text-blue-600" />}
                iconWrap="bg-blue-50 dark:bg-blue-900/30"
                accent="#3b82f6"
              />
              <KpiCard
                title={t.reports.totalOrders}
                value={String(stats.totalOrders)}
                icon={<ShoppingCart className="h-5 w-5 text-purple-600" />}
                iconWrap="bg-purple-50 dark:bg-purple-900/30"
                accent="#a855f7"
              />
              <KpiCard
                title={t.reports.avgOrderValue}
                value={formatCurrency(stats.avgOrder)}
                icon={<TrendingUp className="h-5 w-5 text-green-600" />}
                iconWrap="bg-green-50 dark:bg-green-900/30"
                accent="#22c55e"
              />
            </div>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              <KpiCard
                title={t.reports.totalVat}
                value={formatCurrency(stats.totalTax)}
                sub={t.reports.vatSummary}
                icon={<Receipt className="h-5 w-5 text-amber-600" />}
                iconWrap="bg-amber-50 dark:bg-amber-900/30"
                accent="#f59e0b"
              />
              <KpiCard
                title={t.sales.returns}
                value={String(returnStats.count)}
                sub={returnStats.count > 0 ? formatCurrency(returnStats.total) : t.common.noData}
                icon={<RotateCcw className="h-5 w-5 text-red-600" />}
                iconWrap="bg-red-50 dark:bg-red-900/30"
                accent="#ef4444"
              />
              <KpiCard
                title={t.reports.totalRevenue}
                value={formatCurrency(stats.totalRevenue)}
                icon={<TrendingDown className="h-5 w-5 text-gray-500" />}
                iconWrap="bg-gray-100 dark:bg-gray-800"
                accent="#6b7280"
              />
            </div>

            {/* ── VAT Report (shown for quarter and year) ── */}
            {(period === 'quarter' || period === 'year') && (
              <VatReportSection
                dateFrom={dateFrom}
                dateTo={dateTo}
                totalTax={stats.totalTax}
                totalSubtotal={stats.totalSubtotal}
                totalOrders={stats.totalOrders}
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
                      <Package className="h-4 w-4 text-gray-400" />
                      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t.reports.topProducts}</h2>
                    </div>
                    <Badge variant="gray">{stats.topProducts.length}</Badge>
                  </div>

                  {stats.topProducts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Package className="mb-3 h-10 w-10 text-gray-200 dark:text-gray-700" />
                      <p className="text-sm text-gray-400">{t.common.noData}</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                      {stats.topProducts.map((p, i) => {
                        const pct = stats.totalRevenue > 0 ? (p.revenue / stats.totalRevenue) * 100 : 0
                        return (
                          <div key={i} className="flex items-center gap-4 px-6 py-3.5">
                            <span className="w-5 shrink-0 text-right text-xs font-bold tabular-nums text-gray-300 dark:text-gray-600">
                              {i + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{p.productName}</p>
                              {p.variantName && p.variantName !== p.productName && (
                                <p className="text-xs text-gray-400">{p.variantName}</p>
                              )}
                              <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{ width: `${pct}%`, background: 'var(--accent)' }}
                                />
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(p.revenue)}</p>
                              <p className="text-xs text-gray-400">{p.quantity} {t.reports.quantity}</p>
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
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t.sales.method}</h2>
                  </div>
                  <div className="p-4 space-y-3">
                    {Object.entries(stats.byPayment).length === 0 ? (
                      <p className="py-4 text-center text-sm text-gray-400">{t.common.noData}</p>
                    ) : (
                      Object.entries(stats.byPayment)
                        .sort(([, a], [, b]) => b - a)
                        .map(([method, amount]) => {
                          const meta = PAYMENT_LABELS[method]
                          const pct = stats.totalRevenue > 0 ? (amount / stats.totalRevenue) * 100 : 0
                          return (
                            <div key={method} className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <div className={cn('flex items-center gap-2 text-sm', meta?.color ?? 'text-gray-600')}>
                                  {meta?.icon}
                                  <span>{meta?.label ?? method}</span>
                                </div>
                                <div className="text-right">
                                  <span className="text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(amount)}</span>
                                  <span className="ml-1.5 text-xs text-gray-400">{pct.toFixed(0)}%</span>
                                </div>
                              </div>
                              <div className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
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
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t.reports.vatSummary}</h2>
                  </div>
                  <div className="divide-y divide-gray-100 p-0 dark:divide-gray-800">
                    {[
                      { label: t.reports.totalRevenue,  value: formatCurrency(stats.totalSubtotal) },
                      { label: t.reports.totalVat,      value: formatCurrency(stats.totalTax) },
                      { label: t.sales.totalRevenue,    value: formatCurrency(stats.totalRevenue) },
                      { label: t.sales.returns,         value: returnStats.total > 0 ? `- ${formatCurrency(returnStats.total)}` : formatCurrency(0), red: returnStats.total > 0 },
                      { label: t.sales.netRevenue,      value: formatCurrency(stats.totalRevenue - returnStats.total), bold: true },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center justify-between px-6 py-3">
                        <span className="text-sm text-gray-500">{row.label}</span>
                        <span className={cn('tabular-nums text-sm',
                          row.bold ? 'font-bold text-gray-900 dark:text-gray-100' :
                          (row as any).red ? 'font-medium text-red-600 dark:text-red-400' :
                          'text-gray-700 dark:text-gray-300')}>
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
    </div>
  )
}
