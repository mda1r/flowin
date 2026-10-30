import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Banknote, CreditCard, Download, Receipt, RotateCcw, Search, Shuffle } from 'lucide-react'
import { ordersApi } from '@/api/orders'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency, cn } from '@/lib/utils'
import { useI18n } from '@/i18n'
import { PageHeader } from '@/components/layout/PageHeader'
import { InvoiceReceiptModal } from '@/components/pos/InvoiceReceiptModal'
import { invoiceNo, matchesInvoiceNo } from '@/lib/invoiceNumber'
import { paymentLabel } from '@/lib/orderReceipt'
import { localDaysToUtcRange, localYmd } from '@/lib/dates'
import { downloadCsv } from '@/lib/csv'
import type { OrderResponse, ReturnOrderResponse } from '@/types/api'

type Period = 'today' | 'yesterday' | '7d' | '30d' | 'custom'
type MethodFilter = 'all' | 'Cash' | 'Card' | 'Split'
type StatusFilter = 'all' | 'completed' | 'refunded'

const PAGE_CAP = 500

const PERIODS: { key: Period; label: string }[] = [
  { key: 'today', label: 'اليوم' },
  { key: 'yesterday', label: 'أمس' },
  { key: '7d', label: '7 أيام' },
  { key: '30d', label: '30 يوم' },
  { key: 'custom', label: 'مخصص' },
]

const daysAgo = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return localYmd(d)
}

function periodRange(period: Period, from: string, to: string) {
  switch (period) {
    case 'today': return localDaysToUtcRange(localYmd(), localYmd())
    case 'yesterday': return localDaysToUtcRange(daysAgo(1), daysAgo(1))
    case '7d': return localDaysToUtcRange(daysAgo(6), localYmd())
    case '30d': return localDaysToUtcRange(daysAgo(29), localYmd())
    default: return localDaysToUtcRange(from, to)
  }
}

const METHOD_ICON = { Cash: Banknote, Card: CreditCard, Split: Shuffle } as const

export function InvoicesPage() {
  const { branchId } = useAuthStore()
  const { t } = useI18n()
  const [period, setPeriod] = useState<Period>('today')
  const [from, setFrom] = useState(daysAgo(6))
  const [to, setTo] = useState(localYmd())
  const [method, setMethod] = useState<MethodFilter>('all')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<OrderResponse | null>(null)

  const range = periodRange(period, from, to)

  const { data: ordersRaw = [], isLoading } = useQuery({
    queryKey: ['invoices', branchId, range.from, range.to],
    queryFn: async () => {
      const { data } = await ordersApi.listOrders(branchId!, { status: 'Completed', from: range.from, to: range.to, pageSize: PAGE_CAP })
      return (Array.isArray(data) ? data : []) as OrderResponse[]
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

  const refunds = useMemo(() => {
    const map = new Map<string, ReturnOrderResponse>()
    for (const r of returns) {
      const prev = map.get(r.originalOrderId)
      map.set(r.originalOrderId, prev ? { ...prev, refundAmount: prev.refundAmount + r.refundAmount } : r)
    }
    return map
  }, [returns])

  const orders = useMemo(() => {
    const q = search.trim().toLowerCase()
    return ordersRaw.filter((o) => {
      if (method !== 'all' && o.paymentMethod !== method) return false
      const refunded = refunds.has(o.id)
      if (status === 'completed' && refunded) return false
      if (status === 'refunded' && !refunded) return false
      if (!q) return true
      return (
        matchesInvoiceNo(o, q) ||
        o.lines.some((l) => l.productName.toLowerCase().includes(q)) ||
        o.totalAmount.toFixed(2).includes(q)
      )
    })
  }, [ordersRaw, method, status, search, refunds])

  const summary = useMemo(() => {
    const total = orders.reduce((s, o) => s + o.totalAmount, 0)
    const vat = orders.reduce((s, o) => s + o.taxAmount, 0)
    const refunded = orders.filter((o) => refunds.has(o.id))
    const refundedAmount = refunded.reduce((s, o) => s + (refunds.get(o.id)?.refundAmount ?? 0), 0)
    return { count: orders.length, total, vat, refundedCount: refunded.length, refundedAmount, net: total - refundedAmount, avg: orders.length ? total / orders.length : 0 }
  }, [orders, refunds])

  const exportCsv = () =>
    downloadCsv(
      `invoices-${localYmd()}.csv`,
      ['رقم الفاتورة', 'التاريخ', 'المنتجات', 'طريقة الدفع', 'قبل الضريبة', 'الضريبة', 'الإجمالي', 'المسترد'],
      orders.map((o) => [
        invoiceNo(o),
        new Date(o.completedAt ?? o.createdAt).toLocaleString('en-CA', { hour12: false }),
        o.lines.map((l) => `${l.productName} ×${l.quantity}`).join(' | '),
        paymentLabel(o.paymentMethod),
        (o.totalAmount - o.taxAmount).toFixed(2),
        o.taxAmount.toFixed(2),
        o.totalAmount.toFixed(2),
        (refunds.get(o.id)?.refundAmount ?? 0).toFixed(2),
      ]),
    )

  return (
    <div dir="rtl">
      <PageHeader
        title={t.invoices.title}
        description="كل فواتير الفرع، بحثاً وفرزاً وطباعةً ومشاركة"
        icon={<Receipt className="h-5 w-5" />}
        action={
          <button
            type="button"
            onClick={exportCsv}
            disabled={orders.length === 0}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-fg hover:bg-surface-2 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            تصدير Excel
          </button>
        }
      />

      <div className="space-y-4 p-4 sm:p-6">
        {/* filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-surface p-1" role="tablist" aria-label="الفترة">
            {PERIODS.map((p) => (
              <button key={p.key} role="tab" aria-selected={period === p.key} onClick={() => setPeriod(p.key)}
                className={cn('rounded-lg px-3 py-1.5 text-sm font-medium transition-colors', period === p.key ? 'bg-brand text-brand-fg' : 'text-muted hover:bg-surface-2 hover:text-fg')}>
                {p.label}
              </button>
            ))}
          </div>
          {period === 'custom' && (
            <div className="flex items-center gap-2 text-sm">
              <input type="date" className="input w-auto" value={from} max={to} onChange={(e) => setFrom(e.target.value)} aria-label="من تاريخ" />
              <span className="text-muted">إلى</span>
              <input type="date" className="input w-auto" value={to} min={from} max={localYmd()} onChange={(e) => setTo(e.target.value)} aria-label="إلى تاريخ" />
            </div>
          )}
          <select className="input w-auto" value={method} onChange={(e) => setMethod(e.target.value as MethodFilter)} aria-label="طريقة الدفع">
            <option value="all">كل طرق الدفع</option>
            <option value="Cash">نقداً</option>
            <option value="Card">بطاقة</option>
            <option value="Split">مقسّم</option>
          </select>
          <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} aria-label="الحالة">
            <option value="all">كل الحالات</option>
            <option value="completed">مكتملة</option>
            <option value="refunded">مستردة</option>
          </select>
          <div className="relative ms-auto w-full sm:w-64">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input className="input ps-9" placeholder="رقم الفاتورة أو منتج أو مبلغ" value={search} onChange={(e) => setSearch(e.target.value)} aria-label={t.invoices.search} />
          </div>
        </div>

        {/* summary */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Stat label="عدد الفواتير" value={summary.count.toLocaleString('ar-SA')} />
          <Stat label="إجمالي المبيعات" value={formatCurrency(summary.total)} strong />
          <Stat label="ضريبة القيمة المضافة" value={formatCurrency(summary.vat)} />
          <Stat label="متوسط الفاتورة" value={formatCurrency(summary.avg)} />
          <Stat
            label={`المسترد (${summary.refundedCount.toLocaleString('ar-SA')})`}
            value={formatCurrency(summary.refundedAmount)}
            tone={summary.refundedAmount > 0 ? 'danger' : undefined}
          />
        </div>
        {ordersRaw.length >= PAGE_CAP && (
          <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">يظهر أول {PAGE_CAP.toLocaleString('ar-SA')} فاتورة في هذه الفترة؛ اختر فترة أقصر لرؤية الكل.</p>
        )}

        {/* list */}
        {isLoading ? (
          <div className="flex min-h-[30vh] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-brand" />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex min-h-[30vh] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border">
            <Receipt className="h-10 w-10 text-muted/50" />
            <p className="text-muted">{search || method !== 'all' || status !== 'all' ? 'لا توجد فواتير تطابق البحث' : 'لا توجد فواتير في هذه الفترة'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted">
                  <th className="px-4 py-3 text-start font-semibold">الفاتورة</th>
                  <th className="px-4 py-3 text-start font-semibold">{t.invoices.columns.date}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t.invoices.columns.items}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t.invoices.columns.method}</th>
                  <th className="px-4 py-3 text-end font-semibold">{t.invoices.columns.amount}</th>
                  <th className="px-4 py-3 text-start font-semibold">{t.invoices.columns.status}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.map((o) => {
                  const refund = refunds.get(o.id)
                  const Icon = METHOD_ICON[o.paymentMethod as keyof typeof METHOD_ICON] ?? Banknote
                  return (
                    <tr
                      key={o.id}
                      onClick={() => setSelected(o)}
                      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setSelected(o)}
                      tabIndex={0}
                      className="cursor-pointer transition-colors hover:bg-surface-2 focus-visible:bg-surface-2"
                    >
                      <td className="px-4 py-3">
                        <bdi dir="ltr" className="font-display font-semibold tabular-nums text-fg">#{invoiceNo(o)}</bdi>
                      </td>
                      <td className="px-4 py-3 text-muted tabular-nums">
                        {new Date(o.completedAt ?? o.createdAt).toLocaleString('ar-SA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="max-w-[16rem] px-4 py-3 text-muted">
                        <span className="block truncate" title={o.lines.map((l) => `${l.productName} ×${l.quantity}`).join('، ')}>
                          {o.lines.map((l) => `${l.productName} ×${l.quantity}`).join('، ')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-0.5 text-xs text-fg">
                          <Icon className="h-3.5 w-3.5 text-muted" />
                          {paymentLabel(o.paymentMethod)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-end font-display font-semibold tabular-nums text-fg">{formatCurrency(o.totalAmount)}</td>
                      <td className="px-4 py-3">
                        {refund ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-danger/10 px-2.5 py-0.5 text-xs font-semibold text-danger">
                            <RotateCcw className="h-3 w-3" />
                            مستردة {formatCurrency(refund.refundAmount)}
                          </span>
                        ) : (
                          <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand-ink">{t.invoices.completed}</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && <InvoiceReceiptModal order={selected} refund={refunds.get(selected.id)} onClose={() => setSelected(null)} />}
    </div>
  )
}

function Stat({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: 'danger' }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={cn('mt-1 font-display text-lg font-semibold tabular-nums', strong ? 'text-brand-ink' : 'text-fg', tone === 'danger' && 'text-danger')}>{value}</p>
    </div>
  )
}
