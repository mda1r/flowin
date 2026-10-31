import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, ChevronDown, Clock, FileText, Printer, Receipt, RotateCcw } from 'lucide-react'
import { shiftsApi } from '@/api/shifts'
import { ordersApi } from '@/api/orders'
import { useAuthStore } from '@/stores/authStore'
import { cn, formatCurrency } from '@/lib/utils'
import { PageHeader } from '@/components/layout/PageHeader'
import { InvoiceReceiptModal } from '@/components/pos/InvoiceReceiptModal'
import { FlowinLogo } from '@/components/brand/Brand'
import { invoiceNo } from '@/lib/invoiceNumber'
import { useReceiptSettings, useSellerIdentity } from '@/lib/receipt'
import { printElement } from '@/lib/print'
import { useI18n } from '@/i18n'
import type { Translations } from '@/i18n/en'
import type { OrderResponse, ReturnOrderResponse, ShiftResponse } from '@/types/api'
import { fmtDate, fmtDateTime, fmtNum, fmtTime } from '@/lib/locale'

type Period = '7d' | '30d' | 'all'

type T = Translations['shiftReports']

const n = (v: number) => fmtNum(v)
const time = (iso: string) => fmtTime(iso)
const day = (iso: string) => fmtDate(iso, { weekday: 'short', day: 'numeric', month: 'short' })
const fill = (s: string, vars: Record<string, string | number>) =>
  Object.entries(vars).reduce((a, [k, v]) => a.replace(`{${k}}`, typeof v === 'number' ? n(v) : v), s)

// "3h 20m", or "2d 4h" for shifts left open past a day.
function duration(t: T, fromIso: string, toIso?: string | null) {
  const ms = (toIso ? new Date(toIso).getTime() : Date.now()) - new Date(fromIso).getTime()
  const mins = Math.max(0, Math.floor(ms / 60_000))
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  return d > 0 ? fill(t.durationDH, { d, h }) : fill(t.durationHM, { h, m })
}

const LONG_OPEN_HOURS = 16

function reconcile(s: ShiftResponse) {
  const expectedCash = s.expectedCash ?? s.openingCash + s.totalCashSales
  return {
    expectedCash,
    countedCash: s.closingCash,
    cashVariance: s.cashVariance ?? (s.closingCash != null ? s.closingCash - expectedCash : null),
    countedCard: s.closingCardCount,
    cardVariance: s.cardVariance ?? (s.closingCardCount != null ? s.closingCardCount - s.totalCardSales : null),
  }
}

export function ShiftReportsPage() {
  const { branchId } = useAuthStore()
  const { t: tr, isRtl } = useI18n()
  const t = tr.shiftReports
  const [period, setPeriod] = useState<Period>('7d')
  const [cashier, setCashier] = useState('all')

  const { data: current } = useQuery({
    queryKey: ['shift-current', branchId],
    queryFn: async () => (await shiftsApi.getCurrent(branchId!)).data as ShiftResponse | null,
    enabled: !!branchId,
    refetchInterval: 30_000,
  })
  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ['shifts', branchId],
    queryFn: async () => {
      const { data } = await shiftsApi.list(branchId!, 1, 100)
      return (Array.isArray(data) ? data : []) as ShiftResponse[]
    },
    enabled: !!branchId,
  })
  const { data: returns = [] } = useQuery({
    queryKey: ['returns', branchId],
    queryFn: async () => {
      const { data } = await ordersApi.listReturns(branchId!)
      return (Array.isArray(data) ? data : []) as ReturnOrderResponse[]
    },
    enabled: !!branchId,
  })

  const cashiers = useMemo(() => [...new Set(shifts.map((s) => s.cashierName))], [shifts])
  const closed = useMemo(() => {
    const since = period === 'all' ? 0 : Date.now() - (period === '7d' ? 7 : 30) * 86_400_000
    return shifts
      .filter((s) => s.status === 'Closed')
      .filter((s) => new Date(s.openedAt).getTime() >= since)
      .filter((s) => cashier === 'all' || s.cashierName === cashier)
  }, [shifts, period, cashier])

  const totals = useMemo(() => {
    const sales = closed.reduce((a, s) => a + s.totalSales, 0)
    const variance = closed.reduce((a, s) => a + (reconcile(s).cashVariance ?? 0) + (reconcile(s).cardVariance ?? 0), 0)
    const deficits = closed.filter((s) => (reconcile(s).cashVariance ?? 0) < 0 || (reconcile(s).cardVariance ?? 0) < 0).length
    return { sales, variance, deficits, orders: closed.reduce((a, s) => a + s.totalOrders, 0) }
  }, [closed])

  return (
    <div>
      <PageHeader title={t.title} description={t.description} icon={<FileText className="h-5 w-5" />} />

      <div className="space-y-5 p-4 sm:p-6">
        {current && (
          <section aria-label={t.currentShift}>
            <p className="mb-2 text-xs font-semibold text-brand-ink">{t.currentShift}</p>
            <ShiftCard t={t} isRtl={isRtl} shift={current} returns={returns} isCurrent />
          </section>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-xl border border-border bg-surface p-1" role="tablist" aria-label={t.period}>
            {([['7d', t.periods.d7], ['30d', t.periods.d30], ['all', t.periods.all]] as const).map(([k, label]) => (
              <button key={k} role="tab" aria-selected={period === k} onClick={() => setPeriod(k)}
                className={cn('rounded-lg px-3 py-1.5 text-sm font-medium transition-colors', period === k ? 'bg-brand text-brand-fg' : 'text-muted hover:bg-surface-2 hover:text-fg')}>
                {label}
              </button>
            ))}
          </div>
          {cashiers.length > 1 && (
            <select className="input w-auto" value={cashier} onChange={(e) => setCashier(e.target.value)} aria-label={t.cashier}>
              <option value="all">{t.allCashiers}</option>
              {cashiers.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Summary label={t.closedShifts} value={n(closed.length)} />
          <Summary label={t.shiftSales} value={formatCurrency(totals.sales)} strong />
          <Summary label={t.invoices} value={n(totals.orders)} />
          <Summary
            label={totals.deficits ? `${t.netVariance} · ${fill(t.nShort, { n: totals.deficits })}` : t.netVariance}
            value={`${totals.variance > 0 ? '+' : ''}${formatCurrency(totals.variance)}`}
            tone={totals.variance < 0 ? 'danger' : totals.variance > 0 ? 'success' : undefined}
          />
        </div>

        {isLoading ? (
          <div className="flex min-h-[30vh] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-brand" />
          </div>
        ) : closed.length === 0 ? (
          <div className="flex min-h-[25vh] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border text-center">
            <Clock className="h-10 w-10 text-muted/50" />
            <p className="text-muted">{t.noClosedShifts}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {closed.map((s) => <ShiftCard key={s.id} t={t} isRtl={isRtl} shift={s} returns={returns} />)}
          </div>
        )}
      </div>
    </div>
  )
}

// An open shift's totals are only written when it closes, so while it runs they come from its invoices.
function liveTotals(shift: ShiftResponse, orders: OrderResponse[]): ShiftResponse {
  const cash = orders.reduce((a, o) => a + (o.paymentMethod === 'Cash' ? o.totalAmount : o.paymentMethod === 'Split' ? o.splitCash ?? 0 : 0), 0)
  const card = orders.reduce((a, o) => a + (o.paymentMethod === 'Card' ? o.totalAmount : o.paymentMethod === 'Split' ? o.splitCard ?? 0 : 0), 0)
  return {
    ...shift,
    totalOrders: orders.length,
    totalSales: orders.reduce((a, o) => a + o.totalAmount, 0),
    totalCashSales: cash,
    totalCardSales: card,
    totalTax: orders.reduce((a, o) => a + o.taxAmount, 0),
    expectedCash: shift.openingCash + cash,
  }
}

function ShiftCard({ t, isRtl, shift: stored, returns, isCurrent = false }: { t: T; isRtl: boolean; shift: ShiftResponse; returns: ReturnOrderResponse[]; isCurrent?: boolean }) {
  const { branchId } = useAuthStore()
  const [expanded, setExpanded] = useState(false)
  const [wantPrint, setWantPrint] = useState(false)
  const [selected, setSelected] = useState<OrderResponse | null>(null)
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['shift-orders', branchId, stored.id],
    queryFn: async () => {
      const { data } = await ordersApi.listOrders(branchId!, { status: 'Completed', from: stored.openedAt, to: stored.closedAt ?? new Date().toISOString(), pageSize: 500 })
      return (Array.isArray(data) ? data : []) as OrderResponse[]
    },
    enabled: (isCurrent || expanded || wantPrint) && !!branchId,
    refetchInterval: isCurrent ? 30_000 : false,
  })

  const shift = isCurrent ? liveTotals(stored, orders) : stored
  const r = reconcile(shift)
  const avg = shift.totalOrders ? shift.totalSales / shift.totalOrders : 0
  const cashShare = shift.totalSales ? (shift.totalCashSales / shift.totalSales) * 100 : 0
  const openHours = (Date.now() - new Date(shift.openedAt).getTime()) / 3_600_000


  const refundsInShift = useMemo(() => {
    const until = shift.closedAt ? new Date(shift.closedAt).getTime() : Date.now()
    const list = returns.filter((x) => {
      const t = new Date(x.createdAt).getTime()
      return t >= new Date(shift.openedAt).getTime() && t <= until
    })
    return { count: list.length, amount: list.reduce((a, x) => a + x.refundAmount, 0) }
  }, [returns, shift])

  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; total: number }>()
    for (const o of orders) {
      const gross = 1 + (o.taxRate ?? 0.15)
      for (const l of o.lines) {
        const e = map.get(l.productName) ?? { name: l.productName, qty: 0, total: 0 }
        e.qty += l.quantity
        e.total += l.lineTotal * gross
        map.set(l.productName, e)
      }
    }
    return [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, 5)
  }, [orders])

  // Print once the shift's invoices are in, so the Z-report carries its best sellers.
  useEffect(() => {
    if (wantPrint && !isLoading) {
      setWantPrint(false)
      window.setTimeout(() => printElement(document.getElementById(`z-report-${shift.id}`)), 0)
    }
  }, [wantPrint, isLoading, shift.id])

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-fg">{shift.cashierName}</p>
            <p className="mt-0.5 text-xs text-muted">
              {day(shift.openedAt)} · {time(shift.openedAt)}
              {shift.closedAt && ` — ${day(shift.closedAt) !== day(shift.openedAt) ? day(shift.closedAt) + ' ' : ''}${time(shift.closedAt)}`}
              {' · '}{duration(t, shift.openedAt, shift.closedAt)}
            </p>
          </div>
          {isCurrent ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-ink">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-strong motion-reduce:animate-none" />
              {t.status.open}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-xs text-muted">
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
              {t.status.closed}
            </span>
          )}
        </div>

        {isCurrent && openHours > LONG_OPEN_HOURS && (
          <p className="mt-3 flex items-center gap-2 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {fill(t.longOpen, { d: duration(t, shift.openedAt) })}
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Cell label={t.sales} value={formatCurrency(shift.totalSales)} strong />
          <Cell label={t.invoices} value={n(shift.totalOrders)} />
          <Cell label={t.avgInvoice} value={formatCurrency(avg)} />
          <Cell label={t.tax} value={formatCurrency(shift.totalTax)} />
        </div>

        {shift.totalSales > 0 && (
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs text-muted">
              <span>{fill(t.cashAmount, { v: formatCurrency(shift.totalCashSales) })}</span>
              <span>{fill(t.cardAmount, { v: formatCurrency(shift.totalCardSales) })}</span>
            </div>
            <div className="flex h-2 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={fill(t.cashShare, { n: Math.round(cashShare) })}>
              <div className="h-full bg-brand-strong" style={{ width: `${cashShare}%` }} />
              <div className="h-full flex-1 bg-fg/25" />
            </div>
          </div>
        )}

        {/* the drawer: what should be there against what was counted */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="text-xs text-muted">
                <th className="py-1.5 text-start font-medium">{t.reconciliation}</th>
                <th className="py-1.5 text-end font-medium">{t.expected}</th>
                <th className="py-1.5 text-end font-medium">{t.counted}</th>
                <th className="py-1.5 text-end font-medium">{t.difference}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="py-2 text-fg">{t.cashInDrawer} <span className="text-xs text-muted">{fill(t.cashInDrawerHint, { v: formatCurrency(shift.openingCash) })}</span></td>
                <td className="py-2 text-end tabular-nums">{formatCurrency(r.expectedCash)}</td>
                <td className="py-2 text-end tabular-nums">{r.countedCash != null ? formatCurrency(r.countedCash) : '—'}</td>
                <td className="py-2 text-end"><Variance t={t} v={r.cashVariance} /></td>
              </tr>
              <tr>
                <td className="py-2 text-fg">{t.cards} <span className="text-xs text-muted">{t.cardsHint}</span></td>
                <td className="py-2 text-end tabular-nums">{formatCurrency(shift.totalCardSales)}</td>
                <td className="py-2 text-end tabular-nums">{r.countedCard != null ? formatCurrency(r.countedCard) : '—'}</td>
                <td className="py-2 text-end"><Variance t={t} v={r.cardVariance} /></td>
              </tr>
            </tbody>
          </table>
        </div>

        {(refundsInShift.count > 0 || shift.notes) && (
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {refundsInShift.count > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-danger/10 px-2.5 py-1 text-danger">
                <RotateCcw className="h-3 w-3" />
                {fill(t.nRefunds, { n: refundsInShift.count })} · {formatCurrency(refundsInShift.amount)}
              </span>
            )}
            {shift.notes && <span className="rounded-full bg-surface-2 px-2.5 py-1 text-muted">{t.note}: {shift.notes}</span>}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-border px-4 py-2">
        <button
          type="button"
          onClick={() => setWantPrint(true)}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-fg hover:bg-surface-2"
        >
          <Printer className="h-3.5 w-3.5" />
          {wantPrint ? t.preparing : isCurrent ? t.printX : t.printZ}
        </button>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs text-muted hover:bg-surface-2 hover:text-fg"
        >
          {expanded ? t.hideDetails : t.showDetails}
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')} />
        </button>
      </div>

      {expanded && (
        <div className="grid gap-4 border-t border-border p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted">
              <Receipt className="h-3.5 w-3.5" />
              {t.invoices} ({n(orders.length)})
            </p>
            {isLoading ? (
              <div className="flex justify-center py-6"><div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-brand" /></div>
            ) : orders.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted">{t.noOrdersInShift}</p>
            ) : (
              <ul className="max-h-80 space-y-1.5 overflow-y-auto">
                {orders.map((o) => (
                  <li key={o.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(o)}
                      className="flex w-full items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2 text-start text-xs hover:bg-border/60"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <bdi dir="ltr" className="font-display font-semibold tabular-nums text-fg">#{invoiceNo(o)}</bdi>
                        <span className="text-muted tabular-nums">{time(o.completedAt ?? o.createdAt)}</span>
                        <span className="rounded-full bg-surface px-1.5 py-0.5 text-muted">{t.payments[o.paymentMethod as keyof T['payments']] ?? o.paymentMethod ?? '—'}</span>
                        <span className="truncate text-muted">{o.lines.map((l) => l.productName).join(t.listSeparator)}</span>
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums text-fg">{formatCurrency(o.totalAmount)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold text-muted">{t.topInShift}</p>
            {topProducts.length === 0 ? (
              <p className="text-xs text-muted">—</p>
            ) : (
              <ol className="space-y-1.5">
                {topProducts.map((p, i) => (
                  <li key={p.name} className="flex items-center gap-2 text-sm">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand-ink">{n(i + 1)}</span>
                    <span className="min-w-0 flex-1 truncate text-fg">{p.name}</span>
                    <span className="text-xs tabular-nums text-muted">×{n(p.qty)}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}

      {/* the printable Z/X report, laid out like a receipt */}
      <div className="hidden">
        <ShiftReportDocument t={t} isRtl={isRtl} id={`z-report-${shift.id}`} shift={shift} topProducts={topProducts} refunds={refundsInShift} isCurrent={isCurrent} />
      </div>

      {selected && <InvoiceReceiptModal order={selected} onClose={() => setSelected(null)} />}
    </article>
  )
}

function ShiftReportDocument({ t, isRtl, id, shift, topProducts, refunds, isCurrent }: {
  t: T
  isRtl: boolean
  id: string
  shift: ShiftResponse
  topProducts: { name: string; qty: number; total: number }[]
  refunds: { count: number; amount: number }
  isCurrent: boolean
}) {
  const settings = useReceiptSettings()
  const { sellerName, vatNumber } = useSellerIdentity()
  const r = reconcile(shift)
  const row = (label: string, value: string) => (
    <div className="receipt-row"><span>{label}</span><span className="tabular-nums">{value}</span></div>
  )
  const v = (x: number | null) => (x == null ? '—' : `${x > 0 ? '+' : ''}${formatCurrency(x)}`)
  return (
    <div id={id} className="receipt-paper scheme-light bg-surface text-fg" data-paper={settings.paperWidthMm} dir={isRtl ? 'rtl' : 'ltr'}>
      <header className="receipt-center">
        {settings.logoPath && <img src={settings.logoPath} alt="" className="receipt-logo" />}
        {sellerName && <p className="receipt-store">{sellerName}</p>}
        {vatNumber && <p className="receipt-small">{t.vatNumber}: {vatNumber}</p>}
      </header>
      <hr className="receipt-rule" />
      <div className="receipt-center">
        <p className="receipt-title">{isCurrent ? t.reportX : t.reportZ}</p>
        <p className="receipt-small">{shift.cashierName}</p>
        <p className="receipt-small">
          {fmtDateTime(shift.openedAt)}
          {shift.closedAt && ` — ${fmtDateTime(shift.closedAt, { timeStyle: 'short' })}`}
        </p>
        <p className="receipt-small">{t.duration}: {duration(t, shift.openedAt, shift.closedAt)}</p>
      </div>
      <hr className="receipt-rule" />
      <div className="receipt-totals">
        {row(t.invoices, n(shift.totalOrders))}
        {row(t.cashSales, formatCurrency(shift.totalCashSales))}
        {row(t.cardSales, formatCurrency(shift.totalCardSales))}
        {refunds.count > 0 && row(fill(t.refundsN, { n: refunds.count }), `−${formatCurrency(refunds.amount)}`)}
        {row(t.tax, formatCurrency(shift.totalTax))}
        <div className="receipt-row receipt-total"><span>{t.totalSales}</span><span className="tabular-nums">{formatCurrency(shift.totalSales)}</span></div>
      </div>
      <hr className="receipt-rule" />
      <p className="receipt-title">{t.drawerMatching}</p>
      <div className="receipt-totals">
        {row(t.openingFloat, formatCurrency(shift.openingCash))}
        {row(t.expectedCash, formatCurrency(r.expectedCash))}
        {row(t.countedCash, r.countedCash != null ? formatCurrency(r.countedCash) : '—')}
        {row(t.cashVariance, v(r.cashVariance))}
        {row(t.cardsRecorded, r.countedCard != null ? formatCurrency(r.countedCard) : '—')}
        {row(t.cardVariance, v(r.cardVariance))}
      </div>
      {topProducts.length > 0 && (
        <>
          <hr className="receipt-rule" />
          <p className="receipt-title">{t.bestSellers}</p>
          <div className="receipt-totals">
            {topProducts.map((p) => row(`${p.name} ×${n(p.qty)}`, formatCurrency(p.total)))}
          </div>
        </>
      )}
      {shift.notes && <p className="receipt-note">{t.note}: {shift.notes}</p>}
      <hr className="receipt-rule" />
      <p className="receipt-small receipt-center">{fill(t.printedAt, { v: fmtDateTime(new Date()) })}</p>
      <p className="receipt-small receipt-center" style={{ marginTop: '0.8rem' }}>{t.cashierSignature} ____________</p>
      {settings.showPoweredBy && <div className="receipt-powered"><FlowinLogo tone="mono" className="h-3" /></div>}
    </div>
  )
}

function Summary({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: 'danger' | 'success' }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={cn('mt-1 font-display text-lg font-semibold tabular-nums', strong ? 'text-brand-ink' : 'text-fg', tone === 'danger' && 'text-danger', tone === 'success' && 'text-success')}>{value}</p>
    </div>
  )
}

function Cell({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2.5">
      <p className="text-xs text-muted">{label}</p>
      <p className={cn('mt-0.5 font-display font-semibold tabular-nums', strong ? 'text-brand-ink' : 'text-fg')}>{value}</p>
    </div>
  )
}

function Variance({ t, v }: { t: T; v: number | null }) {
  if (v == null) return <span className="text-muted">—</span>
  if (Math.abs(v) < 0.005) return <span className="inline-flex items-center gap-1 text-xs font-semibold text-success"><CheckCircle2 className="h-3.5 w-3.5" />{t.balanced}</span>
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums', v < 0 ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success')}>
      {v < 0 && <AlertTriangle className="h-3 w-3" />}
      {v < 0 ? t.deficit : t.surplus} {formatCurrency(Math.abs(v))}
    </span>
  )
}
