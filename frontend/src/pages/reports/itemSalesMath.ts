import type { OrderResponse } from '@/types/api'
import { lineDisplayName } from '@/lib/variantName'
import { orderNet } from './reportMath'

// Per-item quantities by day (or by week for long periods), the days an item or the whole shop sold clearly
// less than usual, and the numbers the recommendations are built from. Pure functions over the period's orders.

const DAY_MS = 86_400_000
// Up to this many days the table has a column per day; longer periods get a column per week.
export const MAX_DAY_COLUMNS = 31
// An item is flagged on a day when it sold at most this share of its usual quantity…
const DROP_RATIO = 0.5
// …and it usually sells at least this many on such a day (fewer is noise, not a drop).
const MIN_BASELINE_QTY = 3
// The shop's whole day is flagged when its sales are at most this share of its usual day.
const DAY_DROP_RATIO = 0.6

export const ymd = (d: Date) => d.toLocaleDateString('en-CA')
const atOf = (o: OrderResponse) => new Date(o.completedAt ?? o.createdAt)

export interface Column {
  key: string
  start: Date
  /** Days in the column (1, or up to 7 for a week; the last week can be shorter). */
  days: number
  weekday: number
  /** Today: still going, so it is never called a drop. */
  open: boolean
}

export interface ItemRow {
  key: string
  name: string
  variantId: string
  qty: number[]
  total: number
  revenue: number
  cost: number
  /** The usual quantity for each column (same weekday when there are enough of them), null when unknown. */
  usual: (number | null)[]
  drops: boolean[]
}

export interface DayTotal {
  qty: number
  revenue: number
  orders: number
  usual: number | null
  drop: boolean
}

export interface ItemDaily {
  byWeek: boolean
  columns: Column[]
  items: ItemRow[]
  totals: DayTotal[]
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** The usual value of column i: the median of the same weekday when the period has at least two others,
 *  otherwise the median of every other closed column. Null when there is nothing to compare with. */
function usualAt(values: number[], columns: Column[], i: number, byWeek: boolean): number | null {
  const others = columns
    .map((c, j) => ({ c, j }))
    .filter(({ c, j }) => j !== i && !c.open && c.days === columns[i].days)
  if (!byWeek) {
    const sameDay = others.filter(({ c }) => c.weekday === columns[i].weekday)
    if (sameDay.length >= 2) return median(sameDay.map(({ j }) => values[j]))
  }
  if (others.length < 3) return null
  return median(others.map(({ j }) => values[j]))
}

export function buildColumns(dateFrom: string, dateTo: string, now = new Date()): { byWeek: boolean; columns: Column[] } {
  const today = ymd(now)
  const last = dateTo > today ? today : dateTo
  const start = new Date(`${dateFrom}T12:00:00`)
  const end = new Date(`${last}T12:00:00`)
  const span = Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1
  if (span <= 0) return { byWeek: false, columns: [] }
  const byWeek = span > MAX_DAY_COLUMNS
  const step = byWeek ? 7 : 1
  const columns: Column[] = []
  for (let i = 0; i < span; i += step) {
    const d = new Date(start.getTime() + i * DAY_MS)
    const days = Math.min(step, span - i)
    const lastDay = ymd(new Date(d.getTime() + (days - 1) * DAY_MS))
    columns.push({ key: ymd(d), start: d, days, weekday: d.getDay(), open: lastDay === today })
  }
  return { byWeek, columns }
}

export function buildItemDaily(orders: OrderResponse[], dateFrom: string, dateTo: string, now = new Date()): ItemDaily {
  const { byWeek, columns } = buildColumns(dateFrom, dateTo, now)
  const index = new Map<string, number>()
  columns.forEach((c, i) => {
    for (let d = 0; d < c.days; d++) index.set(ymd(new Date(c.start.getTime() + d * DAY_MS)), i)
  })

  const rows = new Map<string, ItemRow>()
  const totals: DayTotal[] = columns.map(() => ({ qty: 0, revenue: 0, orders: 0, usual: null, drop: false }))
  for (const o of orders) {
    const col = index.get(ymd(atOf(o)))
    if (col === undefined) continue
    totals[col].orders += 1
    totals[col].revenue += orderNet(o)
    for (const l of o.lines) {
      const key = `${l.productName}::${l.variantName ?? ''}`
      let row = rows.get(key)
      if (!row) {
        row = {
          key, name: lineDisplayName(l.productName, l.variantName), variantId: l.variantId,
          qty: columns.map(() => 0), total: 0, revenue: 0, cost: 0, usual: [], drops: [],
        }
        rows.set(key, row)
      }
      row.qty[col] += l.quantity
      row.total += l.quantity
      row.revenue += l.lineTotal
      row.cost += (l.costPrice ?? 0) * l.quantity
      totals[col].qty += l.quantity
    }
  }

  const items = [...rows.values()].sort((a, b) => b.total - a.total || b.revenue - a.revenue)
  for (const row of items) {
    row.usual = columns.map((_, i) => usualAt(row.qty, columns, i, byWeek))
    row.drops = columns.map((c, i) => {
      const usual = row.usual[i]
      return !c.open && usual !== null && usual >= MIN_BASELINE_QTY * (byWeek ? 3 : 1) && row.qty[i] <= usual * DROP_RATIO
    })
  }
  const revenues = totals.map((t) => t.revenue)
  totals.forEach((t, i) => {
    t.usual = usualAt(revenues, columns, i, byWeek)
    t.drop = !columns[i].open && t.usual !== null && t.usual > 0 && t.revenue <= t.usual * DAY_DROP_RATIO
  })
  return { byWeek, columns, items, totals }
}

export interface DropAlert {
  /** The latest column with the drop. */
  column: number
  /** Null for the whole shop's day. */
  item: ItemRow | null
  actual: number
  usual: number
  /** How far under usual, 0–100. */
  pct: number
  /** For an item: how many columns in the period it dropped (one alert per item, not one per day). */
  times: number
}

/** The clearest drops first: whole days, then one line per item, by how much was lost against usual. */
export function dropAlerts(data: ItemDaily, limit = 8): DropAlert[] {
  const days: DropAlert[] = []
  data.totals.forEach((t, i) => {
    if (t.drop && t.usual) days.push({ column: i, item: null, actual: t.revenue, usual: t.usual, pct: Math.round((1 - t.revenue / t.usual) * 100), times: 1 })
  })
  const items: (DropAlert & { lost: number })[] = []
  for (const row of data.items) {
    const at = row.drops.map((d, i) => (d ? i : -1)).filter((i) => i >= 0)
    if (at.length === 0) continue
    const last = at[at.length - 1]
    const usual = row.usual[last] ?? 0
    const unitPrice = row.revenue / Math.max(1, row.total)
    const lost = at.reduce((s, i) => s + ((row.usual[i] ?? 0) - row.qty[i]) * unitPrice, 0)
    items.push({ column: last, item: row, actual: row.qty[last], usual, pct: Math.round((1 - row.qty[last] / usual) * 100), times: at.length, lost })
  }
  return [
    ...days.sort((a, b) => b.column - a.column),
    ...items.sort((a, b) => b.lost - a.lost).map(({ lost: _lost, ...a }) => a),
  ].slice(0, limit)
}

// ── Recommendations ─────────────────────────────────────────────────────────────

export type Tone = 'warn' | 'good' | 'info'

export type Advice =
  | { kind: 'salesDown' | 'salesUp'; pct: number }
  | { kind: 'itemsDown'; names: string[]; pct: number }
  | { kind: 'itemsUp'; names: string[]; pct: number }
  | { kind: 'stars'; names: string[]; share: number }
  | { kind: 'lowMargin'; names: string[]; margin: number }
  | { kind: 'slowItems'; count: number; names: string[] }
  | { kind: 'weakWeekday'; weekday: number; pct: number }
  | { kind: 'peakHour'; hour: number; share: number }
  | { kind: 'smallBaskets'; perOrder: number }
  | { kind: 'highDiscounts'; share: number }
  | { kind: 'highReturns'; share: number }

export const adviceTone = (a: Advice): Tone =>
  ['salesDown', 'itemsDown', 'lowMargin', 'weakWeekday', 'highDiscounts', 'highReturns'].includes(a.kind)
    ? 'warn'
    : ['salesUp', 'itemsUp', 'stars'].includes(a.kind) ? 'good' : 'info'

const pctChange = (now: number, before: number) => Math.round(((now - before) / before) * 100)

/** Sum of an item's (or the shop's) last 7 days against the 7 before, from orders, with today left out. */
function weekOverWeek(orders: OrderResponse[], now: Date) {
  const todayStart = new Date(`${ymd(now)}T00:00:00`).getTime()
  const recentFrom = todayStart - 7 * DAY_MS
  const prevFrom = todayStart - 14 * DAY_MS
  const shop = { recent: 0, prev: 0 }
  const items = new Map<string, { name: string; recent: number; prev: number }>()
  for (const o of orders) {
    const t = atOf(o).getTime()
    const bucket = t >= recentFrom && t < todayStart ? 'recent' : t >= prevFrom && t < recentFrom ? 'prev' : null
    if (!bucket) continue
    shop[bucket] += orderNet(o)
    for (const l of o.lines) {
      const key = `${l.productName}::${l.variantName ?? ''}`
      const it = items.get(key) ?? { name: lineDisplayName(l.productName, l.variantName), recent: 0, prev: 0 }
      it[bucket] += l.quantity
      items.set(key, it)
    }
  }
  return { shop, items: [...items.values()] }
}

export function buildAdvice(
  orders: OrderResponse[],
  data: ItemDaily,
  totals: { netSales: number; returnsNet: number; discounts: number },
  dateFrom: string,
  dateTo: string,
  now = new Date(),
): Advice[] {
  const advice: Advice[] = []
  if (orders.length === 0) return advice
  const firstAt = Math.min(...orders.map((o) => atOf(o).getTime()))
  const spanDays = (Math.min(new Date(`${dateTo}T23:59:59`).getTime(), now.getTime()) - new Date(`${dateFrom}T00:00:00`).getTime()) / DAY_MS
  const historyDays = (now.getTime() - firstAt) / DAY_MS

  // Week against week, only when there are two full weeks to compare.
  if (historyDays >= 14) {
    const wow = weekOverWeek(orders, now)
    if (wow.shop.prev > 0) {
      const pct = pctChange(wow.shop.recent, wow.shop.prev)
      if (pct <= -15) advice.push({ kind: 'salesDown', pct: -pct })
      else if (pct >= 15) advice.push({ kind: 'salesUp', pct })
    }
    const moved = wow.items.filter((i) => i.prev >= 5).map((i) => ({ ...i, pct: pctChange(i.recent, i.prev) }))
    const down = moved.filter((i) => i.pct <= -40).sort((a, b) => a.pct - b.pct)
    if (down.length) advice.push({ kind: 'itemsDown', names: down.slice(0, 3).map((i) => i.name), pct: -down[0].pct })
    const up = moved.filter((i) => i.pct >= 40).sort((a, b) => b.pct - a.pct)
    if (up.length) advice.push({ kind: 'itemsUp', names: up.slice(0, 3).map((i) => i.name), pct: up[0].pct })
  }

  const revenueAll = data.items.reduce((s, i) => s + i.revenue, 0)
  if (data.items.length >= 4 && revenueAll > 0) {
    const stars = [...data.items].sort((a, b) => b.revenue - a.revenue).slice(0, 3)
    advice.push({ kind: 'stars', names: stars.map((s) => s.name), share: Math.round((stars.reduce((s, i) => s + i.revenue, 0) / revenueAll) * 100) })
  }

  const thin = data.items
    .filter((i) => i.total >= 10 && i.revenue > 0 && i.cost > 0)
    .map((i) => ({ name: i.name, margin: Math.round(((i.revenue - i.cost) / i.revenue) * 100) }))
    .filter((i) => i.margin < 25)
    .sort((a, b) => a.margin - b.margin)
  if (thin.length) advice.push({ kind: 'lowMargin', names: thin.slice(0, 3).map((i) => i.name), margin: thin[0].margin })

  if (spanDays >= 14) {
    const slow = data.items.filter((i) => i.total <= 2)
    if (slow.length >= 2) advice.push({ kind: 'slowItems', count: slow.length, names: slow.slice(-3).map((i) => i.name) })

    // Average sales per weekday over the closed days of the period.
    const byWeekday = Array.from({ length: 7 }, () => ({ sum: 0, days: 0 }))
    if (!data.byWeek) {
      data.columns.forEach((c, i) => {
        if (c.open) return
        byWeekday[c.weekday].sum += data.totals[i].revenue
        byWeekday[c.weekday].days += 1
      })
      const avgs = byWeekday.map((w, d) => ({ d, avg: w.days ? w.sum / w.days : null })).filter((w) => w.avg !== null) as { d: number; avg: number }[]
      if (avgs.length >= 5) {
        const overall = avgs.reduce((s, w) => s + w.avg, 0) / avgs.length
        const weakest = avgs.reduce((a, b) => (b.avg < a.avg ? b : a))
        if (overall > 0 && weakest.avg <= overall * 0.7) advice.push({ kind: 'weakWeekday', weekday: weakest.d, pct: Math.round((1 - weakest.avg / overall) * 100) })
      }
    }
  }

  const hours = Array.from({ length: 24 }, () => 0)
  for (const o of orders) hours[atOf(o).getHours()] += 1
  const peak = hours.indexOf(Math.max(...hours))
  if (orders.length >= 20) advice.push({ kind: 'peakHour', hour: peak, share: Math.round((hours[peak] / orders.length) * 100) })

  const units = orders.reduce((s, o) => s + o.lines.reduce((x, l) => x + l.quantity, 0), 0)
  const perOrder = units / orders.length
  if (orders.length >= 20 && perOrder < 1.5) advice.push({ kind: 'smallBaskets', perOrder: Math.round(perOrder * 10) / 10 })

  const gross = totals.netSales + totals.returnsNet + totals.discounts
  if (gross > 0 && totals.discounts / gross >= 0.1) advice.push({ kind: 'highDiscounts', share: Math.round((totals.discounts / gross) * 100) })
  if (totals.netSales + totals.returnsNet > 0 && totals.returnsNet / (totals.netSales + totals.returnsNet) >= 0.03) {
    advice.push({ kind: 'highReturns', share: Math.round((totals.returnsNet / (totals.netSales + totals.returnsNet)) * 100) })
  }

  const order: Tone[] = ['warn', 'good', 'info']
  return advice.sort((a, b) => order.indexOf(adviceTone(a)) - order.indexOf(adviceTone(b)))
}
