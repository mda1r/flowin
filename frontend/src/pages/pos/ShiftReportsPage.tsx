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
import { paymentLabel } from '@/lib/orderReceipt'
import { useReceiptSettings, useSellerIdentity } from '@/lib/receipt'
import { printElement } from '@/lib/print'
import type { OrderResponse, ReturnOrderResponse, ShiftResponse } from '@/types/api'

type Period = '7d' | '30d' | 'all'

const n = (v: number) => v.toLocaleString('ar-SA')
const time = (iso: string) => new Date(iso).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
const day = (iso: string) => new Date(iso).toLocaleDateString('ar-SA', { weekday: 'short', day: 'numeric', month: 'short' })

// "3 س 20 د", or "2 يوم 4 س" for shifts left open past a day.
function duration(fromIso: string, toIso?: string | null) {
  const ms = (toIso ? new Date(toIso).getTime() : Date.now()) - new Date(fromIso).getTime()
  const mins = Math.max(0, Math.floor(ms / 60_000))
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  return d > 0 ? `${n(d)} يوم ${n(h)} س` : `${n(h)} س ${n(m)} د`
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
    <div dir="rtl">
      <PageHeader title="تقارير الشفتات" description="مطابقة الدرج، أداء كل شفت، وتقرير الإقفال للطباعة" icon={<FileText className="h-5 w-5" />} />

      <div className="space-y-5 p-4 sm:p-6">
        {current && (
          <section aria-label="الشفت الحالي">
            <p className="mb-2 text-xs font-semibold text-brand-ink">الشفت الحالي</p>
            <ShiftCard shift={current} returns={returns} isCurrent />
          </section>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-xl border border-border bg-surface p-1" role="tablist" aria-label="الفترة">
            {([['7d', '7 أيام'], ['30d', '30 يوم'], ['all', 'الكل']] as const).map(([k, label]) => (
              <button key={k} role="tab" aria-selected={period === k} onClick={() => setPeriod(k)}
                className={cn('rounded-lg px-3 py-1.5 text-sm font-medium transition-colors', period === k ? 'bg-brand text-brand-fg' : 'text-muted hover:bg-surface-2 hover:text-fg')}>
                {label}
              </button>
            ))}
          </div>
          {cashiers.length > 1 && (
            <select className="input w-auto" value={cashier} onChange={(e) => setCashier(e.target.value)} aria-label="الكاشير">
              <option value="all">كل الكاشيرية</option>
              {cashiers.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Summary label="شفتات مغلقة" value={n(closed.length)} />
          <Summary label="مبيعات الشفتات" value={formatCurrency(totals.sales)} strong />
          <Summary label="الفواتير" value={n(totals.orders)} />
          <Summary
            label={totals.deficits ? `صافي الفروقات · ${n(totals.deficits)} بعجز` : 'صافي الفروقات'}
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
            <p className="text-muted">لا توجد شفتات مغلقة في هذه الفترة</p>
          </div>
        ) : (
          <div className="space-y-3">
            {closed.map((s) => <ShiftCard key={s.id} shift={s} returns={returns} />)}
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

function ShiftCard({ shift: stored, returns, isCurrent = false }: { shift: ShiftResponse; returns: ReturnOrderResponse[]; isCurrent?: boolean }) {
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
              {' · '}{duration(shift.openedAt, shift.closedAt)}
            </p>
          </div>
          {isCurrent ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-ink">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-strong motion-reduce:animate-none" />
              مفتوح
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-xs text-muted">
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
              مغلق
            </span>
          )}
        </div>

        {isCurrent && openHours > LONG_OPEN_HOURS && (
          <p className="mt-3 flex items-center gap-2 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            الشفت مفتوح منذ {duration(shift.openedAt)}. أغلقه وطابق الدرج في نهاية كل يوم حتى تصح التقارير.
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Cell label="المبيعات" value={formatCurrency(shift.totalSales)} strong />
          <Cell label="الفواتير" value={n(shift.totalOrders)} />
          <Cell label="متوسط الفاتورة" value={formatCurrency(avg)} />
          <Cell label="الضريبة" value={formatCurrency(shift.totalTax)} />
        </div>

        {shift.totalSales > 0 && (
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs text-muted">
              <span>نقداً {formatCurrency(shift.totalCashSales)}</span>
              <span>بطاقة {formatCurrency(shift.totalCardSales)}</span>
            </div>
            <div className="flex h-2 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`نقداً ${Math.round(cashShare)}٪`}>
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
                <th className="py-1.5 text-start font-medium">المطابقة</th>
                <th className="py-1.5 text-end font-medium">المتوقع</th>
                <th className="py-1.5 text-end font-medium">المعدود</th>
                <th className="py-1.5 text-end font-medium">الفرق</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="py-2 text-fg">النقد في الدرج <span className="text-xs text-muted">(عهدة {formatCurrency(shift.openingCash)} + مبيعات نقدية)</span></td>
                <td className="py-2 text-end tabular-nums">{formatCurrency(r.expectedCash)}</td>
                <td className="py-2 text-end tabular-nums">{r.countedCash != null ? formatCurrency(r.countedCash) : '—'}</td>
                <td className="py-2 text-end"><Variance v={r.cashVariance} /></td>
              </tr>
              <tr>
                <td className="py-2 text-fg">البطاقات <span className="text-xs text-muted">(جهاز الشبكة)</span></td>
                <td className="py-2 text-end tabular-nums">{formatCurrency(shift.totalCardSales)}</td>
                <td className="py-2 text-end tabular-nums">{r.countedCard != null ? formatCurrency(r.countedCard) : '—'}</td>
                <td className="py-2 text-end"><Variance v={r.cardVariance} /></td>
              </tr>
            </tbody>
          </table>
        </div>

        {(refundsInShift.count > 0 || shift.notes) && (
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {refundsInShift.count > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-danger/10 px-2.5 py-1 text-danger">
                <RotateCcw className="h-3 w-3" />
                {n(refundsInShift.count)} مرتجع · {formatCurrency(refundsInShift.amount)}
              </span>
            )}
            {shift.notes && <span className="rounded-full bg-surface-2 px-2.5 py-1 text-muted">ملاحظة: {shift.notes}</span>}
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
          {wantPrint ? 'جارٍ التجهيز…' : isCurrent ? 'طباعة تقرير منتصف الشفت (X)' : 'طباعة تقرير الإقفال (Z)'}
        </button>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs text-muted hover:bg-surface-2 hover:text-fg"
        >
          {expanded ? 'إخفاء التفاصيل' : 'الفواتير والأكثر مبيعاً'}
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')} />
        </button>
      </div>

      {expanded && (
        <div className="grid gap-4 border-t border-border p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted">
              <Receipt className="h-3.5 w-3.5" />
              الفواتير ({n(orders.length)})
            </p>
            {isLoading ? (
              <div className="flex justify-center py-6"><div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-brand" /></div>
            ) : orders.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted">لا توجد فواتير في هذا الشفت</p>
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
                        <span className="rounded-full bg-surface px-1.5 py-0.5 text-muted">{paymentLabel(o.paymentMethod)}</span>
                        <span className="truncate text-muted">{o.lines.map((l) => l.productName).join('، ')}</span>
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums text-fg">{formatCurrency(o.totalAmount)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold text-muted">الأكثر مبيعاً في الشفت</p>
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
        <ShiftReportDocument id={`z-report-${shift.id}`} shift={shift} topProducts={topProducts} refunds={refundsInShift} isCurrent={isCurrent} />
      </div>

      {selected && <InvoiceReceiptModal order={selected} onClose={() => setSelected(null)} />}
    </article>
  )
}

function ShiftReportDocument({ id, shift, topProducts, refunds, isCurrent }: {
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
    <div id={id} className="receipt-paper scheme-light bg-surface text-fg" data-paper={settings.paperWidthMm} dir="rtl">
      <header className="receipt-center">
        {settings.logoPath && <img src={settings.logoPath} alt="" className="receipt-logo" />}
        {sellerName && <p className="receipt-store">{sellerName}</p>}
        {vatNumber && <p className="receipt-small">الرقم الضريبي: {vatNumber}</p>}
      </header>
      <hr className="receipt-rule" />
      <div className="receipt-center">
        <p className="receipt-title">{isCurrent ? 'تقرير منتصف الشفت (X)' : 'تقرير إقفال الشفت (Z)'}</p>
        <p className="receipt-small">{shift.cashierName}</p>
        <p className="receipt-small">
          {new Date(shift.openedAt).toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' })}
          {shift.closedAt && ` — ${new Date(shift.closedAt).toLocaleString('ar-SA', { timeStyle: 'short' })}`}
        </p>
        <p className="receipt-small">المدة: {duration(shift.openedAt, shift.closedAt)}</p>
      </div>
      <hr className="receipt-rule" />
      <div className="receipt-totals">
        {row('عدد الفواتير', n(shift.totalOrders))}
        {row('مبيعات نقدية', formatCurrency(shift.totalCashSales))}
        {row('مبيعات بطاقة', formatCurrency(shift.totalCardSales))}
        {refunds.count > 0 && row(`المرتجعات (${n(refunds.count)})`, `−${formatCurrency(refunds.amount)}`)}
        {row('ضريبة القيمة المضافة', formatCurrency(shift.totalTax))}
        <div className="receipt-row receipt-total"><span>إجمالي المبيعات</span><span className="tabular-nums">{formatCurrency(shift.totalSales)}</span></div>
      </div>
      <hr className="receipt-rule" />
      <p className="receipt-title">مطابقة الدرج</p>
      <div className="receipt-totals">
        {row('عهدة الافتتاح', formatCurrency(shift.openingCash))}
        {row('النقد المتوقع', formatCurrency(r.expectedCash))}
        {row('النقد المعدود', r.countedCash != null ? formatCurrency(r.countedCash) : '—')}
        {row('فرق النقد', v(r.cashVariance))}
        {row('البطاقات المسجلة', r.countedCard != null ? formatCurrency(r.countedCard) : '—')}
        {row('فرق البطاقات', v(r.cardVariance))}
      </div>
      {topProducts.length > 0 && (
        <>
          <hr className="receipt-rule" />
          <p className="receipt-title">الأكثر مبيعاً</p>
          <div className="receipt-totals">
            {topProducts.map((p) => row(`${p.name} ×${n(p.qty)}`, formatCurrency(p.total)))}
          </div>
        </>
      )}
      {shift.notes && <p className="receipt-note">ملاحظة: {shift.notes}</p>}
      <hr className="receipt-rule" />
      <p className="receipt-small receipt-center">طُبع {new Date().toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' })}</p>
      <p className="receipt-small receipt-center" style={{ marginTop: '0.8rem' }}>توقيع الكاشير ____________</p>
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

function Variance({ v }: { v: number | null }) {
  if (v == null) return <span className="text-muted">—</span>
  if (Math.abs(v) < 0.005) return <span className="inline-flex items-center gap-1 text-xs font-semibold text-success"><CheckCircle2 className="h-3.5 w-3.5" />مطابق</span>
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums', v < 0 ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success')}>
      {v < 0 && <AlertTriangle className="h-3 w-3" />}
      {v < 0 ? 'عجز' : 'فائض'} {formatCurrency(Math.abs(v))}
    </span>
  )
}
