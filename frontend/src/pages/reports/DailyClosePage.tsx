import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle, Banknote, ChevronLeft, ChevronRight, ClipboardCheck, CreditCard, Gamepad2, Printer,
  Receipt, RotateCcw, TrendingUp, UtensilsCrossed,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { StatCard } from '@/components/ui/StatCard'
import { salesApi } from '@/api/sales'
import { ordersApi } from '@/api/orders'
import { shiftsApi } from '@/api/shifts'
import { restaurantApi } from '@/api/restaurant'
import { gamingApi } from '@/api/gaming'
import { useAuthStore } from '@/stores/authStore'
import { BUSINESS_TYPE_ROUTES } from '@/lib/businessRoutes'
import { localDaysToUtcRange, localYmd } from '@/lib/dates'
import { cn, formatCurrency } from '@/lib/utils'
import type { OrderResponse, ReturnOrderResponse, ShiftResponse } from '@/types/api'

const PAYMENT_LABELS: Record<string, string> = {
  Cash: 'نقداً', Card: 'بطاقة', BankTransfer: 'تحويل بنكي', Voucher: 'قسيمة', StoreCredit: 'رصيد متجر',
}

const shiftDate = (iso: string | null) => (iso ? localYmd(new Date(iso)) : null)
const timeOf = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : '—'

function addDays(ymd: string, days: number) {
  const d = new Date(`${ymd}T00:00:00`)
  d.setDate(d.getDate() + days)
  return localYmd(d)
}

function Section({ title, icon, children, className }: { title: string; icon: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('card-3d p-5 break-inside-avoid', className)}>
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-fg [&>svg]:h-4 [&>svg]:w-4 [&>svg]:text-muted">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  )
}

const TONE_TEXT = { danger: 'text-danger', success: 'text-success', warning: 'text-warning' } as const

function Row({ label, value, strong, tone }: { label: React.ReactNode; value: React.ReactNode; strong?: boolean; tone?: 'danger' | 'success' | 'warning' }) {
  return (
    <div className={cn('flex items-center justify-between gap-4 py-1.5 text-sm', strong && 'font-semibold')}>
      <span className={strong ? 'text-fg' : 'text-muted'}>{label}</span>
      <span className={cn('tabular-nums', tone ? TONE_TEXT[tone] : 'text-fg')}>{value}</span>
    </div>
  )
}

export function DailyClosePage() {
  const { branchId, user } = useAuthStore()
  const [day, setDay] = useState(localYmd())
  const today = localYmd()
  const routes = user?.businessType ? BUSINESS_TYPE_ROUTES[user.businessType] ?? [] : []
  const hasGaming = routes.includes('/gaming')
  const hasRestaurant = routes.includes('/restaurant')
  const range = useMemo(() => localDaysToUtcRange(day, day), [day])

  const ordersQ = useQuery({
    queryKey: ['daily-close', 'orders', branchId, day],
    queryFn: () => salesApi.listAllCompletedOrders(branchId!, day, day),
    enabled: !!branchId,
  })
  const returnsQ = useQuery({
    queryKey: ['daily-close', 'returns', branchId],
    queryFn: () => ordersApi.listReturns(branchId!),
    enabled: !!branchId,
  })
  const shiftsQ = useQuery({
    queryKey: ['daily-close', 'shifts', branchId],
    queryFn: () => shiftsApi.list(branchId!, 1, 100),
    enabled: !!branchId,
  })
  const restaurantQ = useQuery({
    queryKey: ['daily-close', 'restaurant', branchId, day],
    queryFn: () => restaurantApi.listPaidOrders(branchId!, range.from, range.to),
    enabled: !!branchId && hasRestaurant,
  })
  const gamingQ = useQuery({
    queryKey: ['daily-close', 'gaming', branchId, day],
    queryFn: () => gamingApi.listCompletedSessions(branchId!, range.from, range.to),
    enabled: !!branchId && hasGaming,
  })

  const loading = ordersQ.isLoading || returnsQ.isLoading || shiftsQ.isLoading
    || (hasRestaurant && restaurantQ.isLoading) || (hasGaming && gamingQ.isLoading)
  const failed = ordersQ.isError || returnsQ.isError || shiftsQ.isError
    || (hasRestaurant && restaurantQ.isError) || (hasGaming && gamingQ.isError)

  const report = useMemo(() => {
    const orders: OrderResponse[] = (ordersQ.data ?? []).filter((o) => localYmd(new Date(o.completedAt ?? o.createdAt)) === day)
    const returns: ReturnOrderResponse[] = (Array.isArray(returnsQ.data?.data) ? returnsQ.data!.data : [])
      .filter((r) => localYmd(new Date(r.createdAt)) === day)
    const restaurant = hasRestaurant ? restaurantQ.data?.data ?? [] : []
    const sessions = hasGaming ? gamingQ.data?.data ?? [] : []
    const shiftsRaw: ShiftResponse[] = Array.isArray(shiftsQ.data?.data) ? shiftsQ.data!.data : []
    const shifts = shiftsRaw.filter((s) =>
      shiftDate(s.openedAt) === day || shiftDate(s.closedAt) === day ||
      (s.status === 'Open' && (shiftDate(s.openedAt) ?? '') <= day && day <= today))

    const pos = {
      count: orders.length,
      gross: orders.reduce((s, o) => s + o.totalAmount, 0),
      vat: orders.reduce((s, o) => s + o.taxAmount, 0),
      discounts: orders.reduce((s, o) => s + o.discountAmount, 0),
    }
    const payments: Record<string, number> = {}
    const add = (k: string, v: number) => { if (v) payments[k] = (payments[k] ?? 0) + v }
    for (const o of orders) {
      if (o.paymentMethod === 'Split') {
        add('Cash', o.splitCash ?? 0)
        add('Card', o.splitCard ?? 0)
      } else add(o.paymentMethod ?? 'Cash', o.totalAmount)
    }

    const products = new Map<string, { name: string; qty: number; revenue: number }>()
    for (const o of orders) {
      for (const l of o.lines) {
        const name = l.variantName && l.variantName !== 'Standard' ? `${l.productName} - ${l.variantName}` : l.productName
        const p = products.get(l.variantId) ?? { name, qty: 0, revenue: 0 }
        p.qty += l.quantity
        p.revenue += l.lineTotal
        products.set(l.variantId, p)
      }
    }
    const topProducts = [...products.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10)

    const refunds = {
      count: returns.length,
      total: returns.reduce((s, r) => s + r.refundAmount, 0),
      byMethod: returns.reduce<Record<string, number>>((m, r) => ({ ...m, [r.refundMethod]: (m[r.refundMethod] ?? 0) + r.refundAmount }), {}),
    }

    const rest = {
      count: restaurant.length,
      total: restaurant.reduce((s, o) => s + o.total, 0),
      vat: restaurant.reduce((s, o) => s + o.taxAmount, 0),
      byMethod: restaurant.reduce<Record<string, number>>((m, o) => {
        const k = o.paymentMethod ?? 'Cash'
        return { ...m, [k]: (m[k] ?? 0) + o.total }
      }, {}),
    }

    const stations = new Map<string, { name: string; sessions: number; minutes: number; revenue: number }>()
    for (const s of sessions) {
      const st = stations.get(s.stationId) ?? { name: s.stationName, sessions: 0, minutes: 0, revenue: 0 }
      st.sessions++
      st.minutes += s.actualMinutes
      st.revenue += s.totalAmount
      stations.set(s.stationId, st)
    }
    const gaming = {
      count: sessions.length,
      minutes: sessions.reduce((s, x) => s + x.actualMinutes, 0),
      total: sessions.reduce((s, x) => s + x.totalAmount, 0),
      stations: [...stations.values()].sort((a, b) => b.revenue - a.revenue),
    }

    const revenue = pos.gross + rest.total + gaming.total
    return { pos, payments, topProducts, refunds, rest, gaming, shifts, revenue, net: revenue - refunds.total }
  }, [ordersQ.data, returnsQ.data, restaurantQ.data, gamingQ.data, shiftsQ.data, day, today, hasGaming, hasRestaurant])

  const dayLabel = new Date(`${day}T00:00:00`).toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div>
      <PageHeader
        icon={<ClipboardCheck className="h-5 w-5" />}
        title="الإقفال اليومي"
        description={dayLabel}
        action={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Button variant="secondary" size="sm" onClick={() => setDay(addDays(day, -1))} aria-label="اليوم السابق">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <input
              type="date"
              className="input w-40 text-sm"
              value={day}
              max={today}
              onChange={(e) => e.target.value && setDay(e.target.value)}
              aria-label="اختر اليوم"
            />
            <Button variant="secondary" size="sm" onClick={() => setDay(addDays(day, 1))} disabled={day >= today} aria-label="اليوم التالي">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {day !== today && (
              <Button variant="ghost" size="sm" onClick={() => setDay(today)}>اليوم</Button>
            )}
            <Button size="sm" onClick={() => window.print()} disabled={loading}>
              <Printer className="h-4 w-4" />
              طباعة
            </Button>
          </div>
        }
      />

      <div className="space-y-5 p-4 sm:p-6 print:p-0">
        {failed && (
          <div role="alert" className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            تعذّر تحميل بعض بيانات اليوم. الأرقام أدناه قد تكون ناقصة؛ أعد المحاولة.
          </div>
        )}

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-28" />)}
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="إجمالي الإيرادات" value={formatCurrency(report.revenue)} icon={<TrendingUp />} hint="شامل الضريبة" />
              <StatCard label="المرتجعات" value={formatCurrency(report.refunds.total)} icon={<RotateCcw />} tone="danger"
                hint={`${report.refunds.count.toLocaleString('ar-SA')} عملية`} />
              <StatCard label="الصافي" value={formatCurrency(report.net)} icon={<Receipt />} tone="success" />
              <StatCard label="ضريبة القيمة المضافة" value={formatCurrency(report.pos.vat + report.rest.vat)} icon={<ClipboardCheck />} tone="info"
                hint={hasGaming ? 'لا تشمل جلسات الألعاب' : undefined} />
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <Section title="مبيعات نقطة البيع" icon={<Receipt />}>
                <Row label="عدد الطلبات" value={report.pos.count.toLocaleString('ar-SA')} />
                <Row label="الخصومات" value={formatCurrency(report.pos.discounts)} />
                <Row label="الضريبة" value={formatCurrency(report.pos.vat)} />
                <Row label="الإجمالي" value={formatCurrency(report.pos.gross)} strong />
                <div className="mt-3 border-t border-border pt-3">
                  <p className="mb-1 text-xs font-medium text-muted">حسب طريقة الدفع</p>
                  {Object.keys(report.payments).length === 0 ? (
                    <p className="text-sm text-muted">لا توجد مبيعات</p>
                  ) : Object.entries(report.payments).map(([k, v]) => (
                    <Row key={k} label={<span className="flex items-center gap-1.5">{k === 'Cash' ? <Banknote className="h-3.5 w-3.5" /> : <CreditCard className="h-3.5 w-3.5" />}{PAYMENT_LABELS[k] ?? k}</span>} value={formatCurrency(v)} />
                  ))}
                </div>
              </Section>

              <Section title="المرتجعات" icon={<RotateCcw />}>
                {report.refunds.count === 0 ? (
                  <p className="text-sm text-muted">لا توجد مرتجعات في هذا اليوم</p>
                ) : (
                  <>
                    {Object.entries(report.refunds.byMethod).map(([k, v]) => (
                      <Row key={k} label={PAYMENT_LABELS[k] ?? k} value={formatCurrency(v)} />
                    ))}
                    <Row label={`الإجمالي (${report.refunds.count.toLocaleString('ar-SA')})`} value={formatCurrency(report.refunds.total)} strong tone="danger" />
                  </>
                )}
              </Section>

              {hasRestaurant && (
                <Section title="طلبات المطعم المدفوعة" icon={<UtensilsCrossed />}>
                  <Row label="عدد الطلبات" value={report.rest.count.toLocaleString('ar-SA')} />
                  {Object.entries(report.rest.byMethod).map(([k, v]) => (
                    <Row key={k} label={PAYMENT_LABELS[k] ?? k} value={formatCurrency(v)} />
                  ))}
                  <Row label="الضريبة" value={formatCurrency(report.rest.vat)} />
                  <Row label="الإجمالي" value={formatCurrency(report.rest.total)} strong />
                </Section>
              )}

              {hasGaming && (
                <Section title="جلسات الألعاب" icon={<Gamepad2 />}>
                  <Row label="عدد الجلسات" value={report.gaming.count.toLocaleString('ar-SA')} />
                  <Row label="ساعات اللعب" value={(report.gaming.minutes / 60).toLocaleString('ar-SA', { maximumFractionDigits: 1 })} />
                  {report.gaming.stations.map((s) => (
                    <Row key={s.name} label={`${s.name} · ${s.sessions.toLocaleString('ar-SA')} جلسة`} value={formatCurrency(s.revenue)} />
                  ))}
                  <Row label="الإجمالي" value={formatCurrency(report.gaming.total)} strong />
                </Section>
              )}

              <Section title="الأكثر مبيعاً" icon={<TrendingUp />} className="lg:col-span-2">
                {report.topProducts.length === 0 ? (
                  <p className="text-sm text-muted">لا توجد مبيعات</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-xs text-muted">
                          <th className="py-2 text-start font-semibold">المنتج</th>
                          <th className="py-2 text-start font-semibold">الكمية</th>
                          <th className="py-2 text-end font-semibold">الإيراد قبل الضريبة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {report.topProducts.map((p) => (
                          <tr key={p.name}>
                            <td className="py-2 text-fg">{p.name}</td>
                            <td className="py-2 tabular-nums text-fg">{p.qty.toLocaleString('ar-SA')}</td>
                            <td className="py-2 text-end tabular-nums text-fg">{formatCurrency(p.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>

              <Section title="الشفتات" icon={<ClipboardCheck />} className="lg:col-span-2">
                {report.shifts.length === 0 ? (
                  <p className="text-sm text-muted">لا توجد شفتات في هذا اليوم</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-xs text-muted">
                          <th className="py-2 text-start font-semibold">الكاشير</th>
                          <th className="py-2 text-start font-semibold">من - إلى</th>
                          <th className="py-2 text-start font-semibold">المبيعات</th>
                          <th className="py-2 text-start font-semibold">النقد المتوقع</th>
                          <th className="py-2 text-start font-semibold">النقد الفعلي</th>
                          <th className="py-2 text-end font-semibold">فرق النقد</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {report.shifts.map((s) => {
                          const v = s.cashVariance
                          return (
                            <tr key={s.id}>
                              <td className="py-2 text-fg">{s.cashierName}</td>
                              <td className="whitespace-nowrap py-2 tabular-nums text-muted">
                                {timeOf(s.openedAt)} - {s.status === 'Open' ? 'مفتوح' : timeOf(s.closedAt)}
                              </td>
                              <td className="py-2 tabular-nums text-fg">{formatCurrency(s.totalSales)}</td>
                              <td className="py-2 tabular-nums text-fg">{s.expectedCash != null ? formatCurrency(s.expectedCash) : '—'}</td>
                              <td className="py-2 tabular-nums text-fg">{s.closingCash != null ? formatCurrency(s.closingCash) : '—'}</td>
                              <td className={cn('py-2 text-end font-semibold tabular-nums',
                                v == null ? 'text-muted' : Math.abs(v) < 0.01 ? 'text-success' : v < 0 ? 'text-danger' : 'text-warning')}>
                                {v == null ? '—' : `${v > 0 ? '+' : ''}${formatCurrency(v)}`}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>
            </div>

            {(hasGaming || hasRestaurant) && (
              <p className="flex items-start gap-2 rounded-xl bg-warning/10 px-4 py-3 text-xs text-warning">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {hasGaming ? 'إيرادات جلسات الألعاب' : 'طلبات المطعم المدفوعة'}{hasGaming && hasRestaurant ? ' وطلبات المطعم المدفوعة' : ''}
                {' '}لا تُسجَّل حالياً ضمن مبيعات الشفت ولا في زاتكا، لذلك قد يظهر فائض في النقد عند إغلاق الشفت بقيمتها.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
