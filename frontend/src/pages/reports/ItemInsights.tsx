import { useMemo, useState } from 'react'
import { ArrowDown, Download, Lightbulb, Search, TrendingDown, TrendingUp, Info } from 'lucide-react'
import type { OrderResponse } from '@/types/api'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn, formatCurrency, normalizeArabic } from '@/lib/utils'
import { fmtDate, fmtNum } from '@/lib/locale'
import { downloadCsv } from '@/lib/csv'
import { useI18n } from '@/i18n'
import { adviceTone, buildAdvice, buildItemDaily, dropAlerts, type Advice, type ItemDaily } from './itemSalesMath'

const TOP_ROWS = 15

const fill = (text: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce((s, [k, v]) => s.split(`{${k}}`).join(String(v)), text)

function colLabel(data: ItemDaily, i: number) {
  const c = data.columns[i]
  return {
    top: data.byWeek ? fmtDate(c.start, { day: 'numeric', month: 'short' }) : fmtDate(c.start, { weekday: 'short' }),
    bottom: data.byWeek ? '' : fmtDate(c.start, { day: 'numeric', month: 'numeric' }),
    full: fmtDate(c.start, { weekday: 'long', day: 'numeric', month: 'long' }),
  }
}

export function ItemInsights({ orders, dateFrom, dateTo, netSales, returnsNet }: {
  orders: OrderResponse[]
  dateFrom: string
  dateTo: string
  netSales: number
  returnsNet: number
}) {
  const data = useMemo(() => buildItemDaily(orders, dateFrom, dateTo), [orders, dateFrom, dateTo])
  const alerts = useMemo(() => dropAlerts(data), [data])
  const advice = useMemo(() => {
    const discounts = orders.reduce((s, o) => s + (o.discountAmount ?? 0), 0)
    return buildAdvice(orders, data, { netSales, returnsNet, discounts }, dateFrom, dateTo)
  }, [orders, data, netSales, returnsNet, dateFrom, dateTo])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <AdviceCard advice={advice} className="xl:col-span-3" />
        <DropsCard data={data} alerts={alerts} className="xl:col-span-2" />
      </div>
      <ItemTable data={data} dateFrom={dateFrom} dateTo={dateTo} />
    </div>
  )
}

// ── Recommendations ─────────────────────────────────────────────────────────────

function AdviceCard({ advice, className }: { advice: Advice[]; className?: string }) {
  const { t } = useI18n()
  const a = t.reports.advice
  const text = (x: Advice): { title: string; body: string } => {
    const names = 'names' in x ? x.names.join('، ') : ''
    switch (x.kind) {
      case 'salesDown': return { title: fill(a.salesDown.title, { pct: x.pct }), body: a.salesDown.body }
      case 'salesUp': return { title: fill(a.salesUp.title, { pct: x.pct }), body: a.salesUp.body }
      case 'itemsDown': return { title: a.itemsDown.title, body: fill(a.itemsDown.body, { names, pct: x.pct }) }
      case 'itemsUp': return { title: a.itemsUp.title, body: fill(a.itemsUp.body, { names, pct: x.pct }) }
      case 'stars': return { title: fill(a.stars.title, { share: x.share }), body: fill(a.stars.body, { names }) }
      case 'lowMargin': return { title: a.lowMargin.title, body: fill(a.lowMargin.body, { names, margin: x.margin }) }
      case 'slowItems': return { title: fill(a.slowItems.title, { count: x.count }), body: fill(a.slowItems.body, { names }) }
      case 'weakWeekday': {
        const day = fmtDate(new Date(2024, 0, 7 + x.weekday), { weekday: 'long' })
        return { title: fill(a.weakWeekday.title, { day }), body: fill(a.weakWeekday.body, { pct: x.pct }) }
      }
      case 'peakHour': {
        const hour = fmtDate(new Date(2024, 0, 1, x.hour), { hour: 'numeric' })
        return { title: fill(a.peakHour.title, { hour }), body: fill(a.peakHour.body, { share: x.share }) }
      }
      case 'smallBaskets': return { title: fill(a.smallBaskets.title, { n: fmtNum(x.perOrder) }), body: a.smallBaskets.body }
      case 'highDiscounts': return { title: fill(a.highDiscounts.title, { share: x.share }), body: a.highDiscounts.body }
      case 'highReturns': return { title: fill(a.highReturns.title, { share: x.share }), body: a.highReturns.body }
    }
  }
  const toneStyle = {
    warn: { icon: <TrendingDown className="h-4 w-4" />, wrap: 'bg-warning/15 text-warning' },
    good: { icon: <TrendingUp className="h-4 w-4" />, wrap: 'bg-success/10 text-success' },
    info: { icon: <Info className="h-4 w-4" />, wrap: 'bg-info/10 text-info' },
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-brand-ink" />
          <div>
            <h2 className="text-sm font-semibold text-fg">{a.title}</h2>
            <p className="text-xs text-muted">{a.hint}</p>
          </div>
        </div>
      </CardHeader>
      {advice.length === 0 ? (
        <EmptyState icon={<Lightbulb />} title={a.none} />
      ) : (
        <ul className="divide-y divide-border">
          {advice.map((x, i) => {
            const { title, body } = text(x)
            const tone = toneStyle[adviceTone(x)]
            return (
              <li key={`${x.kind}-${i}`} className="flex gap-3 px-6 py-3.5">
                <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', tone.wrap)}>{tone.icon}</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-fg">{title}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-muted">{body}</p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

// ── Drops ───────────────────────────────────────────────────────────────────────

function DropsCard({ data, alerts, className }: { data: ItemDaily; alerts: ReturnType<typeof dropAlerts>; className?: string }) {
  const { t } = useI18n()
  const d = t.reports.drops
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ArrowDown className="h-4 w-4 text-danger" />
          <div>
            <h2 className="text-sm font-semibold text-fg">{d.title}</h2>
            <p className="text-xs text-muted">{d.hint}</p>
          </div>
        </div>
      </CardHeader>
      {alerts.length === 0 ? (
        <EmptyState icon={<TrendingUp />} title={d.none} />
      ) : (
        <ul className="divide-y divide-border">
          {alerts.map((x, i) => {
            const day = data.byWeek
              ? fill(t.reports.items.weekOf, { date: colLabel(data, x.column).top })
              : colLabel(data, x.column).full
            return (
              <li key={i} className="flex items-start gap-3 px-6 py-3">
                <span className={cn('mt-1 h-2 w-2 shrink-0 rounded-full', x.item ? 'bg-warning' : 'bg-danger')} aria-hidden="true" />
                <p className="text-sm text-fg">
                  {x.item
                    ? fill(x.times > 1 ? d.itemRepeated : d.item, {
                        item: x.item.name, day, actual: fmtNum(x.actual), usual: fmtNum(Math.round(x.usual)), pct: x.pct, n: x.times,
                      })
                    : fill(d.day, { day, actual: formatCurrency(x.actual), usual: formatCurrency(x.usual), pct: x.pct })}
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

// ── Item × day table ────────────────────────────────────────────────────────────

function ItemTable({ data, dateFrom, dateTo }: { data: ItemDaily; dateFrom: string; dateTo: string }) {
  const { t } = useI18n()
  const it = t.reports.items
  const [term, setTerm] = useState('')
  const [all, setAll] = useState(false)

  const q = normalizeArabic(term.trim().toLowerCase())
  const matched = q ? data.items.filter((r) => normalizeArabic(r.name.toLowerCase()).includes(q)) : data.items
  const rows = all || q ? matched : matched.slice(0, TOP_ROWS)
  const max = Math.max(1, ...data.items.flatMap((r) => r.qty))

  const exportCsv = () => {
    const heads = data.columns.map((c) => c.key)
    downloadCsv(
      `item-sales-${dateFrom}_${dateTo}.csv`,
      [it.item, ...heads, it.total],
      [
        ...data.items.map((r) => [r.name, ...r.qty, r.total]),
        [it.dayTotal, ...data.totals.map((x) => x.revenue.toFixed(2)), data.totals.reduce((s, x) => s + x.revenue, 0).toFixed(2)],
      ],
    )
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-wrap">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-fg">{data.byWeek ? it.titleWeekly : it.title}</h2>
          <p className="mt-0.5 max-w-2xl text-xs text-muted">{data.byWeek ? it.hintWeekly : it.hint}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder={it.search}
              aria-label={it.search}
              className="input h-9 w-48 ps-9"
            />
          </div>
          <Button size="sm" variant="secondary" onClick={exportCsv} disabled={data.items.length === 0}>
            <Download className="h-4 w-4" />
            {it.exportCsv}
          </Button>
        </div>
      </CardHeader>

      {data.items.length === 0 ? (
        <EmptyState title={it.none} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-4 px-6 pt-3 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-brand/20" aria-hidden="true" />
              <span className="h-3 w-3 rounded-sm bg-brand/60" aria-hidden="true" />
              {it.legendQty}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm bg-danger/20 ring-1 ring-danger/50" aria-hidden="true" />
              {it.legendDrop}
            </span>
          </div>
          <div className="overflow-x-auto p-3">
            <table className="w-full border-separate border-spacing-0 text-xs tabular-nums">
              <thead>
                <tr>
                  <th className="sticky start-0 z-10 min-w-40 bg-surface px-3 py-2 text-start text-xs font-semibold text-muted">{it.item}</th>
                  {data.columns.map((c, i) => {
                    const l = colLabel(data, i)
                    return (
                      <th key={c.key} title={c.open ? it.today : l.full} className={cn('min-w-11 px-1 py-2 text-center font-medium text-muted', c.open && 'text-brand-ink')}>
                        <span className="block">{l.top}</span>
                        {l.bottom && <span className="block text-[10px] opacity-80">{l.bottom}</span>}
                      </th>
                    )
                  })}
                  <th className="sticky end-0 z-10 bg-surface px-3 py-2 text-end font-semibold text-muted">{it.total}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} className="group">
                    <th scope="row" className="sticky start-0 z-10 max-w-56 truncate border-t border-border bg-surface px-3 py-1.5 text-start text-sm font-medium text-fg group-hover:bg-surface-2">
                      {r.name}
                    </th>
                    {r.qty.map((q2, i) => {
                      const drop = r.drops[i]
                      const usual = r.usual[i]
                      const tip = drop && usual !== null
                        ? fill(it.cellDrop, { qty: fmtNum(q2), usual: fmtNum(Math.round(usual)) })
                        : usual !== null ? fill(it.cellUsual, { usual: fmtNum(Math.round(usual)) }) : undefined
                      return (
                        <td key={i} className="border-t border-border p-0.5 text-center">
                          <span
                            title={tip}
                            className={cn(
                              'flex h-7 items-center justify-center rounded-md',
                              drop ? 'bg-danger/15 font-semibold text-danger ring-1 ring-inset ring-danger/40' : q2 === 0 ? 'text-muted/50' : 'text-fg',
                            )}
                            style={!drop && q2 > 0 ? { background: `rgb(var(--brand) / ${0.1 + (q2 / max) * 0.5})` } : undefined}
                          >
                            {q2 === 0 ? '·' : fmtNum(q2)}
                            {drop && <ArrowDown className="ms-0.5 h-3 w-3" aria-hidden="true" />}
                          </span>
                        </td>
                      )
                    })}
                    <td className="sticky end-0 z-10 border-t border-border bg-surface px-3 py-1.5 text-end text-sm font-bold text-fg group-hover:bg-surface-2">
                      {fmtNum(r.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" className="sticky start-0 z-10 border-t-2 border-border bg-surface px-3 py-2 text-start text-sm font-semibold text-fg">{it.dayTotal}</th>
                  {data.totals.map((x, i) => (
                    <td key={i} className="border-t-2 border-border p-0.5 text-center">
                      <span
                        title={x.usual !== null ? fill(it.cellUsual, { usual: formatCurrency(x.usual) }) : undefined}
                        className={cn('flex h-7 items-center justify-center rounded-md px-1 text-[11px] font-semibold', x.drop ? 'bg-danger/15 text-danger ring-1 ring-inset ring-danger/40' : 'text-fg')}
                      >
                        {x.revenue > 0 ? fmtNum(Math.round(x.revenue)) : '·'}
                      </span>
                    </td>
                  ))}
                  <td className="sticky end-0 z-10 border-t-2 border-border bg-surface px-3 py-2 text-end text-sm font-bold text-fg">
                    {formatCurrency(data.totals.reduce((s, x) => s + x.revenue, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          {!q && data.items.length > TOP_ROWS && (
            <div className="border-t border-border px-6 py-3">
              <Button size="sm" variant="ghost" onClick={() => setAll((v) => !v)}>
                {all ? fill(it.showLess, { n: TOP_ROWS }) : fill(it.showAll, { n: data.items.length })}
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  )
}
