import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, ChevronDown, Clock, FileText, Lock, Printer, Receipt, RotateCcw, UserCheck } from 'lucide-react'
import { shiftsApi } from '@/api/shifts'
import { ordersApi, RETURNS_MAX_LIMIT } from '@/api/orders'
import { useAuthStore } from '@/stores/authStore'
import { cn, formatCurrency } from '@/lib/utils'
import { PageHeader } from '@/components/layout/PageHeader'
import { InvoiceReceiptModal } from '@/components/pos/InvoiceReceiptModal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { toast } from '@/components/ui/Toast'
import { invoiceNo } from '@/lib/invoiceNumber'
import { paymentLabel } from '@/lib/orderReceipt'
import { printElement } from '@/lib/print'
import { apiErrorMessage } from '@/lib/apiError'
import { logActivity } from '@/lib/activityLog'
import { CashCountField } from './CashCountGrid'
import { ShiftReportDocument, n, reconcile, shiftDuration as duration, topProductsOf } from './ShiftReportDocument'
import { staleShiftReason } from '@/lib/shifts'
import type { OrderResponse, ReturnOrderResponse, ShiftResponse } from '@/types/api'

type Period = '7d' | '30d' | 'all'

const time = (iso: string) => new Date(iso).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
const day = (iso: string) => new Date(iso).toLocaleDateString('ar-SA', { weekday: 'short', day: 'numeric', month: 'short' })


export function ShiftReportsPage() {
  const { branchId, user } = useAuthStore()
  // The shift history carries every cashier's cash variances, so the server keeps it for owners and managers.
  const canManage = user?.role === 'Owner' || user?.role === 'Manager'
  const [period, setPeriod] = useState<Period>('7d')
  const [cashier, setCashier] = useState('all')
  const [forceClosing, setForceClosing] = useState<ShiftResponse | null>(null)

  const { data: current } = useQuery({
    queryKey: ['shift-current', branchId],
    queryFn: async () => (await shiftsApi.getCurrent(branchId!)).data || null,
    enabled: !!branchId,
    refetchInterval: 30_000,
  })
  const { data: openShifts } = useQuery({
    queryKey: ['shifts-open', branchId],
    queryFn: async () => {
      const { data } = await shiftsApi.listOpen(branchId!)
      return (Array.isArray(data) ? data : []) as ShiftResponse[]
    },
    enabled: !!branchId && canManage,
    refetchInterval: 60_000,
  })
  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ['shifts', branchId],
    queryFn: async () => {
      const { data } = await shiftsApi.list(branchId!, 1, 100)
      return (Array.isArray(data) ? data : []) as ShiftResponse[]
    },
    enabled: !!branchId && canManage,
  })
  // Only refunds since the oldest shift listed can land in any shift card.
  const since = useMemo(() => {
    const opened = [...shifts, ...(current ? [current] : [])].map((s) => new Date(s.openedAt).getTime())
    return opened.length ? new Date(Math.min(...opened)).toISOString() : undefined
  }, [shifts, current])
  const { data: returns = [] } = useQuery({
    queryKey: ['returns', branchId, 'shifts', since],
    queryFn: async () => {
      const { data } = await ordersApi.listReturns(branchId!, { from: since, limit: RETURNS_MAX_LIMIT })
      return (Array.isArray(data) ? data : []) as ReturnOrderResponse[]
    },
    enabled: !!branchId && !!since,
  })

  // Managers see every open shift in the branch; a cashier sees their own.
  const open = useMemo(() => {
    const list = canManage && openShifts ? openShifts : current ? [current] : []
    return [...list].sort((a, b) => Number(b.userId === user?.id) - Number(a.userId === user?.id))
  }, [canManage, openShifts, current, user?.id])

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
      <PageHeader title="تقارير الشفتات" description="مطابقة الدرج، أداء كل شفت، وتقرير الإقفال للطباعة" icon={<FileText className="h-5 w-5" />} />

      <div className="space-y-5 p-4 sm:p-6">
        {open.length > 0 && (
          <section aria-label={canManage ? 'الشفتات المفتوحة' : 'الشفت الحالي'} className="space-y-3">
            <p className="text-xs font-semibold text-brand-ink">
              {canManage ? `الشفتات المفتوحة (${n(open.length)})` : 'الشفت الحالي'}
            </p>
            {open.map((s) => (
              <ShiftCard
                key={s.id}
                shift={s}
                returns={returns}
                isCurrent
                isOwn={s.userId === user?.id}
                onForceClose={canManage && s.userId !== user?.id ? () => setForceClosing(s) : undefined}
              />
            ))}
          </section>
        )}

        {!canManage ? (
          <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-muted">
            سجل الشفتات وفروقات الدرج يظهر للمالك والمدير.
          </p>
        ) : (
          <>
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
          </>
        )}
      </div>

      {forceClosing && <ForceCloseModal shift={forceClosing} onClose={() => setForceClosing(null)} />}
    </div>
  )
}

function ShiftCard({ shift: stored, returns, isCurrent = false, isOwn = false, onForceClose }: {
  shift: ShiftResponse
  returns: ReturnOrderResponse[]
  isCurrent?: boolean
  isOwn?: boolean
  onForceClose?: () => void
}) {
  const { branchId } = useAuthStore()
  const [expanded, setExpanded] = useState(false)
  const [wantPrint, setWantPrint] = useState(false)
  const [selected, setSelected] = useState<OrderResponse | null>(null)
  // An open shift's stored totals are only written when it closes; the server sums them live meanwhile.
  const { data: live } = useQuery({
    queryKey: ['shift-summary', branchId, stored.id],
    queryFn: async () => (await shiftsApi.summary(branchId!, stored.id)).data,
    enabled: isCurrent && !!branchId,
    refetchInterval: isCurrent ? 30_000 : false,
  })
  // The invoices are only for the list and best sellers; the totals above never depend on this page of orders.
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['shift-orders', branchId, stored.id],
    queryFn: async () => {
      const { data } = await ordersApi.listOrders(branchId!, { status: 'Completed', from: stored.openedAt, to: stored.closedAt ?? new Date().toISOString(), pageSize: 500 })
      return (Array.isArray(data) ? data : []) as OrderResponse[]
    },
    enabled: (expanded || wantPrint) && !!branchId,
  })

  const shift = isCurrent && live ? live : stored
  const r = reconcile(shift)
  const avg = shift.totalOrders ? shift.totalSales / shift.totalOrders : 0
  const digital = shift.totalDigitalSales ?? 0
  const cashRefunds = shift.totalCashRefunds ?? 0
  const share = (v: number) => (shift.totalSales ? (v / shift.totalSales) * 100 : 0)

  const refundsInShift = useMemo(() => {
    const until = shift.closedAt ? new Date(shift.closedAt).getTime() : Date.now()
    const list = returns.filter((x) => {
      const t = new Date(x.createdAt).getTime()
      return t >= new Date(shift.openedAt).getTime() && t <= until
    })
    return { count: list.length, amount: list.reduce((a, x) => a + x.refundAmount, 0) }
  }, [returns, shift])

  const topProducts = useMemo(() => topProductsOf(orders), [orders])

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
            <p className="font-semibold text-fg">
              {shift.cashierName}
              {isCurrent && isOwn && <span className="ms-2 text-xs font-normal text-muted">(أنت)</span>}
            </p>
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

        {isCurrent && staleShiftReason(shift.openedAt) !== null && (
          <p className="mt-3 flex items-center gap-2 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {isOwn
              ? `الشفت مفتوح منذ ${duration(shift.openedAt)}. أغلقه وطابق الدرج في نهاية كل يوم حتى تصح التقارير.`
              : `الشفت مفتوح منذ ${duration(shift.openedAt)}. اطلب من الكاشير إغلاقه، أو أغلقه إدارياً بعد عدّ الدرج.`}
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
            <div className="mb-1 flex flex-wrap justify-between gap-x-3 text-xs text-muted">
              <span>نقداً {formatCurrency(shift.totalCashSales)}</span>
              <span>بطاقة {formatCurrency(shift.totalCardSales)}</span>
              {digital > 0 && <span>رقمي وأخرى {formatCurrency(digital)}</span>}
            </div>
            <div className="flex h-2 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`نقداً ${Math.round(share(shift.totalCashSales))}٪`}>
              <div className="h-full bg-brand-strong" style={{ width: `${share(shift.totalCashSales)}%` }} />
              <div className="h-full bg-fg/25" style={{ width: `${share(shift.totalCardSales)}%` }} />
              {digital > 0 && <div className="h-full bg-info/60" style={{ width: `${share(digital)}%` }} />}
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
                <td className="py-2 text-fg">
                  النقد في الدرج{' '}
                  <span className="text-xs text-muted">
                    (عهدة {formatCurrency(shift.openingCash)} + مبيعات نقدية{cashRefunds > 0 ? ` − مرتجعات نقدية ${formatCurrency(cashRefunds)}` : ''})
                  </span>
                </td>
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
              {digital > 0 && (
                <tr>
                  <td className="py-2 text-fg">دفع رقمي وأخرى <span className="text-xs text-muted">(لا يُعدّ في الدرج)</span></td>
                  <td className="py-2 text-end tabular-nums">{formatCurrency(digital)}</td>
                  <td className="py-2 text-end text-muted">—</td>
                  <td className="py-2 text-end text-muted">—</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {(refundsInShift.count > 0 || shift.notes || shift.closedByName) && (
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {refundsInShift.count > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-danger/10 px-2.5 py-1 text-danger">
                <RotateCcw className="h-3 w-3" />
                {n(refundsInShift.count)} مرتجع · {formatCurrency(refundsInShift.amount)}
              </span>
            )}
            {shift.closedByName && (
              <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2.5 py-1 text-warning">
                <UserCheck className="h-3 w-3" />
                أغلقه إدارياً: {shift.closedByName}
              </span>
            )}
            {shift.notes && <span className="rounded-full bg-surface-2 px-2.5 py-1 text-muted">ملاحظة: {shift.notes}</span>}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2">
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => setWantPrint(true)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-fg hover:bg-surface-2"
          >
            <Printer className="h-3.5 w-3.5" />
            {wantPrint ? 'جارٍ التجهيز…' : isCurrent ? 'طباعة تقرير منتصف الشفت (X)' : 'طباعة تقرير الإقفال (Z)'}
          </button>
          {onForceClose && (
            <button
              type="button"
              onClick={onForceClose}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/10"
            >
              <Lock className="h-3.5 w-3.5" />
              إغلاق إداري
            </button>
          )}
        </div>
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

// An owner or manager closes a shift the cashier left open, after counting the drawer themselves.
function ForceCloseModal({ shift, onClose }: { shift: ShiftResponse; onClose: () => void }) {
  const { branchId, user, tenantId } = useAuthStore()
  const qc = useQueryClient()
  const [countedCash, setCountedCash] = useState<number | null>(null)
  const [card, setCard] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const { data: live } = useQuery({
    queryKey: ['shift-summary', branchId, shift.id],
    queryFn: async () => (await shiftsApi.summary(branchId!, shift.id)).data,
    enabled: !!branchId,
    staleTime: 0,
  })
  const s = live ?? shift
  const expected = reconcile(s).expectedCash
  const cardAmount = Number(card) || 0
  // A skipped card total would be stored as 0 and book the whole card take as a shortfall, so it is required too.
  const invalid = countedCash == null || countedCash < 0 || card.trim() === '' || cardAmount < 0

  const submit = async () => {
    if (invalid) return
    setSaving(true)
    try {
      const { data } = await shiftsApi.forceClose(branchId!, shift.id, countedCash, cardAmount, notes.trim() || undefined)
      logActivity(tenantId ?? '', {
        userId: user?.id ?? '',
        userName: `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(),
        userEmail: user?.email,
        category: 'shift',
        action: 'إغلاق إداري لشفت',
        details: `شفت ${shift.cashierName} — متوقع ${formatCurrency(data.expectedCash ?? 0)} · معدود ${formatCurrency(countedCash)}`,
        branchId: branchId ?? undefined,
      })
      void qc.invalidateQueries({ queryKey: ['shifts', branchId] })
      void qc.invalidateQueries({ queryKey: ['shifts-open', branchId] })
      void qc.invalidateQueries({ queryKey: ['shift-current', branchId] })
      void qc.invalidateQueries({ queryKey: ['daily-close'] })
      toast.success('تم إغلاق الشفت', `${shift.cashierName} · فرق النقد ${formatCurrency(data.cashVariance ?? 0)}`)
      onClose()
    } catch (err) {
      toast.error('تعذّر إغلاق الشفت', apiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`إغلاق شفت ${shift.cashierName}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>إلغاء</Button>
          <Button variant="danger" loading={saving} disabled={invalid} onClick={submit}>
            <Lock className="h-4 w-4" />
            إغلاق الشفت
          </Button>
        </>
      }
    >
      <div className="space-y-4" dir="rtl">
        <p className="text-sm text-muted">
          مفتوح منذ {duration(shift.openedAt)}. عُدّ الدرج ثم سجّل المبلغ؛ يُحفظ اسمك على الشفت كمن أغلقه.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Cell label="النقد المتوقع" value={formatCurrency(expected)} strong />
          <Cell label="البطاقات المتوقعة" value={formatCurrency(s.totalCardSales)} />
        </div>
        <CashCountField label="النقد المعدود" onChange={setCountedCash} autoFocus />
        {countedCash != null && countedCash >= 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">فرق النقد</span>
            <Variance v={Math.round((countedCash - expected) * 100) / 100} />
          </div>
        )}
        <Input
          label="إجمالي البطاقات من جهاز الشبكة"
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          value={card}
          onChange={(e) => setCard(e.target.value)}
          error={cardAmount < 0 ? 'المبلغ لا يمكن أن يكون سالباً' : undefined}
          hint="أدخل 0 إن لم تكن هناك مبيعات بطاقة"
        />
        {card.trim() !== '' && cardAmount >= 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">فرق البطاقات</span>
            <Variance v={Math.round((cardAmount - s.totalCardSales) * 100) / 100} />
          </div>
        )}
        <Input
          label="ملاحظة (اختياري)"
          placeholder="مثال: الكاشير غادر دون إغلاق"
          value={notes}
          maxLength={1000}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
    </Modal>
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
