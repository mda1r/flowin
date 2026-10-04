import { useMemo, useState, type ReactNode } from 'react'
import {
  View, Text, TouchableOpacity, Pressable, StyleSheet, ActivityIndicator,
  ScrollView, RefreshControl, useWindowDimensions,
} from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { ordersApi, shiftsApi } from '@/api/index'
import { useAuthStore } from '@/stores/authStore'
import type { OrderResponse, PaymentMethod, ShiftResponse } from '@/types/api'

// ── Design tokens ─────────────────────────────────────────────────────────────

const C = {
  bg: '#0f172a', card: '#1e293b', border: '#334155', inset: '#0b1222', elevated: '#26354a',
  primary: '#10b981', danger: '#ef4444', warn: '#f59e0b', blue: '#60a5fa', violet: '#a78bfa',
  pink: '#f472b6', cyan: '#22d3ee',
  text: '#f8fafc', muted: '#94a3b8', subtle: '#64748b',
}

const TABLET_BREAKPOINT = 768
const PAGE_PADDING = 16
const GAP = 10

type IconName = keyof typeof Ionicons.glyphMap
type Period = 'today' | 'week' | 'month'

const PERIODS: { key: Period; label: string; icon: IconName }[] = [
  { key: 'today', label: 'اليوم', icon: 'today-outline' },
  { key: 'week', label: '7 أيام', icon: 'calendar-outline' },
  { key: 'month', label: 'الشهر', icon: 'calendar-number-outline' },
]

const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

const METHOD_META: Record<string, { label: string; color: string; icon: IconName }> = {
  Cash: { label: 'نقداً', color: C.primary, icon: 'cash-outline' },
  Card: { label: 'بطاقة', color: C.blue, icon: 'card-outline' },
  Split: { label: 'مختلط', color: C.violet, icon: 'git-merge-outline' },
}
const methodMeta = (m: string) => METHOD_META[m] ?? { label: 'غير محدد', color: C.subtle, icon: 'help-circle-outline' as IconName }

const pad2 = (n: number) => n.toString().padStart(2, '0')
/** Local calendar date as YYYY-MM-DD (what the DateOnly query params expect). */
const dateKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
const money = (n: number) => `${n.toFixed(2)} ر.س`
const timeLabel = (iso: string) => {
  const d = new Date(iso)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}
const orderTime = (o: OrderResponse) => o.completedAt ?? o.createdAt

function periodRange(p: Period): { from: string; to: string } {
  const now = new Date()
  const to = dateKey(now)
  if (p === 'today') return { from: to, to }
  if (p === 'week') {
    const start = new Date(now)
    start.setDate(now.getDate() - 6)
    return { from: dateKey(start), to }
  }
  return { from: dateKey(new Date(now.getFullYear(), now.getMonth(), 1)), to }
}

function parseDateKey(key: string): Date {
  const [y, m, d] = key.slice(0, 10).split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

function dayLabel(key: string) {
  const d = parseDateKey(key)
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`
}

function displayDate(key: string) {
  const d = parseDateKey(key)
  return `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`
}

interface Totals {
  totalOrders: number
  totalRevenue: number
  totalDiscounts: number
  totalTax: number
  averageOrderValue: number
}

interface DayGroup {
  dateKey: string
  totalOrders: number
  totalRevenue: number
  averageOrderValue: number
}

interface MethodGroup {
  method: string
  count: number
  amount: number
  orders: OrderResponse[]
}

interface Bucket {
  key: 'Cash' | 'Card' | 'Split'
  amount: number
}

function aggregateRecords(records: OrderResponse[]): Totals {
  const t = records.reduce(
    (acc, r) => ({
      totalOrders: acc.totalOrders + 1,
      totalRevenue: acc.totalRevenue + r.totalAmount,
      totalDiscounts: acc.totalDiscounts + r.discountAmount,
      totalTax: acc.totalTax + r.taxAmount,
    }),
    { totalOrders: 0, totalRevenue: 0, totalDiscounts: 0, totalTax: 0 },
  )
  return { ...t, averageOrderValue: t.totalOrders > 0 ? t.totalRevenue / t.totalOrders : 0 }
}

function groupByDay(records: OrderResponse[]): DayGroup[] {
  const map = new Map<string, { revenue: number; orders: number }>()
  for (const r of records) {
    const k = dateKey(new Date(r.completedAt ?? r.createdAt))
    const prev = map.get(k) ?? { revenue: 0, orders: 0 }
    map.set(k, { revenue: prev.revenue + r.totalAmount, orders: prev.orders + 1 })
  }
  return [...map.entries()]
    .map(([k, v]) => ({ dateKey: k, totalOrders: v.orders, totalRevenue: v.revenue, averageOrderValue: v.orders > 0 ? v.revenue / v.orders : 0 }))
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey))
}

/** Orders grouped by their payment method, newest first inside each group. */
function groupByMethod(records: OrderResponse[]): MethodGroup[] {
  const order: string[] = ['Cash', 'Card', 'Split']
  const map = new Map<string, MethodGroup>()
  for (const r of records) {
    const key = r.paymentMethod ?? 'Unknown'
    const g = map.get(key) ?? { method: key, count: 0, amount: 0, orders: [] }
    g.count += 1
    g.amount += r.totalAmount
    g.orders.push(r)
    map.set(key, g)
  }
  return [...map.values()]
    .map((g) => ({ ...g, orders: [...g.orders].sort((a, b) => orderTime(b).localeCompare(orderTime(a))) }))
    .sort((a, b) => {
      const ia = order.indexOf(a.method)
      const ib = order.indexOf(b.method)
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    })
}

/** Money actually taken per tender: split orders are attributed to cash/card when the amounts are known. */
function tenderBuckets(records: OrderResponse[]): Bucket[] {
  let cash = 0, card = 0, split = 0
  for (const r of records) {
    const m: PaymentMethod | undefined = r.paymentMethod
    if (m === 'Cash') cash += r.totalAmount
    else if (m === 'Card') card += r.totalAmount
    else if (m === 'Split') {
      const c = r.splitCash ?? 0
      const k = r.splitCard ?? 0
      if (c + k > 0) { cash += c; card += k } else split += r.totalAmount
    }
  }
  return ([{ key: 'Cash', amount: cash }, { key: 'Card', amount: card }, { key: 'Split', amount: split }] as Bucket[]).filter((b) => b.amount > 0)
}

// ── Pieces ────────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, color, width }: {
  label: string; value: string; icon: IconName; color: string; width: number
}) {
  return (
    <View style={[styles.statCard, { width, backgroundColor: color + '12', borderColor: color + '33' }]}>
      <View style={styles.statTop}>
        <View style={[styles.statIcon, { backgroundColor: color + '26' }]}>
          <Ionicons name={icon} size={18} color={color} />
        </View>
        <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
      </View>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  )
}

function Section({ title, icon, count, children }: {
  title: string; icon: IconName; count?: number; children: ReactNode
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <View style={styles.sectionIcon}>
            <Ionicons name={icon} size={15} color={C.muted} />
          </View>
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        {count !== undefined && (
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>{count}</Text>
          </View>
        )}
      </View>
      {children}
    </View>
  )
}

function EmptyRow({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={styles.emptyRow}>
      <Ionicons name={icon} size={22} color={C.subtle} />
      <Text style={styles.emptyRowText}>{text}</Text>
    </View>
  )
}

function SummaryRows({ totals }: { totals: Totals }) {
  const net = totals.totalRevenue - totals.totalTax
  const rows: { label: string; value: string; strong?: boolean; color?: string }[] = [
    { label: 'إجمالي المبيعات (شامل الضريبة)', value: money(totals.totalRevenue), strong: true },
    { label: 'ضريبة القيمة المضافة', value: money(totals.totalTax), color: C.warn },
    { label: 'صافي المبيعات قبل الضريبة', value: money(net) },
    { label: 'الخصومات الممنوحة', value: totals.totalDiscounts > 0 ? `- ${money(totals.totalDiscounts)}` : money(0), color: totals.totalDiscounts > 0 ? C.danger : undefined },
    { label: 'عدد الطلبات', value: String(totals.totalOrders) },
    { label: 'متوسط قيمة الطلب', value: money(totals.averageOrderValue) },
  ]
  return (
    <>
      {rows.map((r, i) => (
        <View key={r.label} style={[styles.row, i === rows.length - 1 && styles.rowLast]}>
          <Text style={[styles.rowLabel, r.strong && styles.rowStrong]}>{r.label}</Text>
          <Text style={[styles.rowValue, r.strong && styles.rowStrongValue, r.color ? { color: r.color } : null]}>{r.value}</Text>
        </View>
      ))}
    </>
  )
}

function PaymentBreakdown({ buckets, groups }: { buckets: Bucket[]; groups: MethodGroup[] }) {
  const total = buckets.reduce((s, b) => s + b.amount, 0)
  if (buckets.length === 0 || total <= 0) return <EmptyRow icon="wallet-outline" text="لا توجد مدفوعات في هذه الفترة" />
  const countOf = (key: string) => groups.find((g) => g.method === key)?.count ?? 0
  return (
    <View>
      <View style={styles.breakBar}>
        {buckets.map((b) => (
          <View key={b.key} style={{ flex: Math.max(b.amount, 0.0001), backgroundColor: methodMeta(b.key).color }} />
        ))}
      </View>
      <View style={styles.breakLegend}>
        {buckets.map((b) => {
          const meta = methodMeta(b.key)
          const pct = Math.round((b.amount / total) * 100)
          const count = countOf(b.key)
          return (
            <View key={b.key} style={[styles.breakItem, { backgroundColor: meta.color + '12', borderColor: meta.color + '33' }]}>
              <View style={styles.breakItemTop}>
                <View style={[styles.legendDot, { backgroundColor: meta.color }]} />
                <Text style={styles.breakLabel}>{meta.label}</Text>
                <Text style={[styles.breakPct, { color: meta.color }]}>{pct}%</Text>
              </View>
              <Text style={styles.breakAmount}>{money(b.amount)}</Text>
              <Text style={styles.breakCount}>{count > 0 ? `${count} طلب` : 'ضمن طلبات مختلطة'}</Text>
            </View>
          )
        })}
      </View>
    </View>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ReportsScreen() {
  const { branchId } = useAuthStore()
  const { width } = useWindowDimensions()
  const isTablet = width >= TABLET_BREAKPOINT
  const [period, setPeriod] = useState<Period>('today')

  const { from, to } = useMemo(() => periodRange(period), [period])
  const today = dateKey(new Date())

  const recordsQuery = useQuery<OrderResponse[]>({
    queryKey: ['sales-summary', branchId, period, from, to],
    queryFn: async () => {
      const fromUTC = `${from}T00:00:00Z`
      const toUTC = `${to}T23:59:59Z`
      const { data } = await ordersApi.getCompleted(branchId!, fromUTC, toUTC)
      return Array.isArray(data) ? data : []
    },
    enabled: !!branchId,
  })

  const shiftsQuery = useQuery<ShiftResponse[]>({
    queryKey: ['shifts', branchId],
    queryFn: async () => {
      const { data } = await shiftsApi.list(branchId!, { pageSize: 20 })
      return Array.isArray(data) ? data : []
    },
    enabled: !!branchId,
  })

  const records = recordsQuery.data ?? []
  const totals = useMemo(() => aggregateRecords(records), [records])
  const daysWithSales = useMemo(() => groupByDay(records).filter((d) => d.totalOrders > 0), [records])
  const bestDay = useMemo(
    () => daysWithSales.reduce<DayGroup | null>((best, d) => (!best || d.totalRevenue > best.totalRevenue ? d : best), null),
    [daysWithSales],
  )
  const methodGroups = useMemo(() => groupByMethod(records), [records])
  const buckets = useMemo(() => tenderBuckets(records), [records])
  const shiftsInRange = useMemo(
    () => (shiftsQuery.data ?? []).filter((s) => {
      const k = dateKey(new Date(s.openedAt))
      return k >= from && k <= to
    }),
    [shiftsQuery.data, from, to],
  )

  // Trend: latest selling day in the range vs. the average of the earlier days (derived from the loaded orders).
  const trend = useMemo(() => {
    if (daysWithSales.length < 2) return null
    const [latest, ...rest] = daysWithSales
    const avg = rest.reduce((s, d) => s + d.totalRevenue, 0) / rest.length
    if (avg <= 0) return null
    return { pct: ((latest.totalRevenue - avg) / avg) * 100, latestKey: latest.dateKey }
  }, [daysWithSales])

  const cols = isTablet ? 3 : 2
  const cardWidth = Math.floor((width - PAGE_PADDING * 2 - GAP * (cols - 1)) / cols)

  const isRefreshing = (recordsQuery.isFetching || shiftsQuery.isFetching) && !recordsQuery.isLoading
  const refresh = () => {
    recordsQuery.refetch()
    shiftsQuery.refetch()
  }

  const rangeLabel = from === to ? displayDate(to) : `${displayDate(from)} — ${displayDate(to)}`
  const periodTitle = PERIODS.find((p) => p.key === period)?.label ?? ''

  const stats: { label: string; value: string; icon: IconName; color: string }[] = [
    { label: 'الطلبات', value: String(totals.totalOrders), icon: 'bag-handle-outline', color: C.blue },
    { label: 'متوسط الطلب', value: money(totals.averageOrderValue), icon: 'calculator-outline', color: C.violet },
    { label: 'الضريبة', value: money(totals.totalTax), icon: 'receipt-outline', color: C.warn },
    { label: 'الخصومات', value: money(totals.totalDiscounts), icon: 'pricetag-outline', color: C.pink },
    { label: 'صافي قبل الضريبة', value: money(totals.totalRevenue - totals.totalTax), icon: 'trending-up-outline', color: C.cyan },
    { label: 'أيام البيع', value: String(daysWithSales.length), icon: 'calendar-outline', color: C.primary },
  ]

  const heroCard = (
    <View style={styles.hero}>
      <View style={styles.heroGlow} pointerEvents="none" />
      <View style={styles.heroGlowSmall} pointerEvents="none" />
      <View style={styles.heroTop}>
        <View style={styles.heroIcon}>
          <Ionicons name="cash-outline" size={20} color={C.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.heroLabel}>إجمالي الإيرادات · {periodTitle}</Text>
          <Text style={styles.heroRange}>{rangeLabel}</Text>
        </View>
        {trend && (
          <View style={[styles.trendPill, { backgroundColor: (trend.pct >= 0 ? C.primary : C.danger) + '22' }]}>
            <Ionicons name={trend.pct >= 0 ? 'trending-up' : 'trending-down'} size={14} color={trend.pct >= 0 ? C.primary : C.danger} />
            <Text style={[styles.trendText, { color: trend.pct >= 0 ? C.primary : C.danger }]}>
              {trend.pct >= 0 ? '+' : ''}{trend.pct.toFixed(0)}%
            </Text>
          </View>
        )}
      </View>
      <Text style={styles.heroValue} numberOfLines={1} adjustsFontSizeToFit>{money(totals.totalRevenue)}</Text>
      <View style={styles.heroFoot}>
        <View style={styles.heroChip}>
          <Ionicons name="bag-handle-outline" size={13} color={C.muted} />
          <Text style={styles.heroChipText}>{totals.totalOrders} طلب</Text>
        </View>
        <View style={styles.heroChip}>
          <Ionicons name="calculator-outline" size={13} color={C.muted} />
          <Text style={styles.heroChipText}>متوسط {money(totals.averageOrderValue)}</Text>
        </View>
        {trend && (
          <Text style={styles.heroTrendHint}>
            {trend.latestKey === today ? 'اليوم' : dayLabel(trend.latestKey)} مقارنةً بمتوسط الأيام السابقة في الفترة
          </Text>
        )}
      </View>
    </View>
  )

  const dailySection = (
    <Section title="المبيعات اليومية" icon="calendar-outline" count={daysWithSales.length}>
      {daysWithSales.length === 0 ? (
        <EmptyRow icon="calendar-clear-outline" text="لا توجد مبيعات في هذه الفترة" />
      ) : (
        daysWithSales.map((d, i) => {
          const isToday = d.dateKey === today
          const isBest = bestDay?.dateKey === d.dateKey && daysWithSales.length > 1
          const share = bestDay && bestDay.totalRevenue > 0 ? d.totalRevenue / bestDay.totalRevenue : 0
          return (
            <View key={d.dateKey} style={[styles.row, i === daysWithSales.length - 1 && styles.rowLast]}>
              <View style={{ flex: 1 }}>
                <View style={styles.dayTitleRow}>
                  <Text style={styles.rowLabel}>{dayLabel(d.dateKey)}</Text>
                  {isToday && <View style={styles.tag}><Text style={styles.tagText}>اليوم</Text></View>}
                  {isBest && <View style={[styles.tag, { backgroundColor: C.warn + '22' }]}><Text style={[styles.tagText, { color: C.warn }]}>الأعلى</Text></View>}
                </View>
                <Text style={styles.rowSub}>{d.totalOrders} طلب · متوسط {money(d.averageOrderValue)}</Text>
                <View style={styles.miniBar}>
                  <View style={[styles.miniBarFill, { width: `${Math.max(4, Math.round(share * 100))}%`, backgroundColor: isBest ? C.warn : C.primary }]} />
                </View>
              </View>
              <Text style={styles.rowValue}>{money(d.totalRevenue)}</Text>
            </View>
          )
        })
      )}
    </Section>
  )

  const summarySection = (
    <Section title="ملخص الفترة" icon="document-text-outline">
      <SummaryRows totals={totals} />
    </Section>
  )

  const breakdownSection = (
    <Section title="طرق الدفع" icon="wallet-outline" count={records.length}>
      <PaymentBreakdown buckets={buckets} groups={methodGroups} />
    </Section>
  )

  const salesListSection = (
    <Section title="مبيعات اليوم" icon="receipt-outline" count={records.length}>
      {methodGroups.length === 0 ? (
        <EmptyRow icon="receipt-outline" text="لم تُسجَّل مبيعات اليوم بعد" />
      ) : (
        methodGroups.map((g, gi) => {
          const meta = methodMeta(g.method)
          return (
            <View key={g.method} style={[styles.methodGroup, gi === methodGroups.length - 1 && { marginBottom: 0 }]}>
              <View style={[styles.methodHeader, { backgroundColor: meta.color + '14', borderColor: meta.color + '33' }]}>
                <View style={[styles.methodIcon, { backgroundColor: meta.color + '26' }]}>
                  <Ionicons name={meta.icon} size={15} color={meta.color} />
                </View>
                <Text style={styles.methodTitle}>{meta.label}</Text>
                <View style={styles.methodCount}><Text style={styles.methodCountText}>{g.count}</Text></View>
                <Text style={[styles.methodSum, { color: meta.color }]}>{money(g.amount)}</Text>
              </View>
              {g.orders.map((o, i) => {
                const items = (o.lines ?? []).reduce((s, l) => s + l.quantity, 0)
                return (
                  <View key={o.id} style={[styles.saleRow, i === g.orders.length - 1 && styles.rowLast]}>
                    <View style={[styles.saleDot, { backgroundColor: meta.color }]} />
                    <View style={styles.saleTime}>
                      <Ionicons name="time-outline" size={12} color={C.subtle} />
                      <Text style={styles.saleTimeText}>{timeLabel(orderTime(o))}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.saleId} numberOfLines={1}>#{o.id.slice(0, 8).toUpperCase()}</Text>
                      {items > 0 && <Text style={styles.saleItems}>{items} عنصر</Text>}
                    </View>
                    <View style={{ alignItems: 'flex-start' }}>
                      <Text style={styles.saleAmount}>{money(o.totalAmount)}</Text>
                      {o.paymentMethod === 'Split' && (o.splitCash ?? 0) + (o.splitCard ?? 0) > 0 ? (
                        <Text style={styles.saleSub}>نقد {money(o.splitCash ?? 0)} · بطاقة {money(o.splitCard ?? 0)}</Text>
                      ) : o.discountAmount > 0 ? (
                        <Text style={[styles.saleSub, { color: C.danger }]}>خصم {money(o.discountAmount)}</Text>
                      ) : null}
                    </View>
                  </View>
                )
              })}
            </View>
          )
        })
      )}
    </Section>
  )

  const shiftsSection = (
    <Section title="الورديات" icon="time-outline" count={shiftsInRange.length}>
      {shiftsInRange.length === 0 ? (
        <EmptyRow icon="time-outline" text="لا توجد ورديات في هذه الفترة" />
      ) : (
        shiftsInRange.map((s, i) => {
          const open = s.status === 'Open'
          const openedKey = dateKey(new Date(s.openedAt))
          return (
            <View key={s.id} style={[styles.row, i === shiftsInRange.length - 1 && styles.rowLast]}>
              <View style={[styles.shiftAvatar, { backgroundColor: (open ? C.primary : C.subtle) + '22' }]}>
                <Ionicons name="person-outline" size={16} color={open ? C.primary : C.muted} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.dayTitleRow}>
                  <Text style={styles.rowLabel}>{s.cashierName || 'كاشير'}</Text>
                  <View style={[styles.tag, { backgroundColor: (open ? C.primary : C.subtle) + '22' }]}>
                    <View style={[styles.tagDot, { backgroundColor: open ? C.primary : C.subtle }]} />
                    <Text style={[styles.tagText, { color: open ? C.primary : C.muted }]}>{open ? 'مفتوحة' : 'مغلقة'}</Text>
                  </View>
                </View>
                <Text style={styles.rowSub}>
                  {openedKey === today ? 'اليوم' : dayLabel(openedKey)} · {timeLabel(s.openedAt)}
                  {s.closedAt ? ` — ${timeLabel(s.closedAt)}` : ' — الآن'} · {s.totalOrders ?? 0} طلب
                </Text>
              </View>
              <Text style={styles.rowValue}>{money(s.totalSales ?? 0)}</Text>
            </View>
          )
        })
      )}
    </Section>
  )

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={C.primary} />}
    >
      <View style={styles.segment}>
        {PERIODS.map((p) => {
          const active = period === p.key
          return (
            <Pressable
              key={p.key}
              style={({ pressed }) => [styles.segmentItem, active && styles.segmentItemActive, pressed && !active && { opacity: 0.7 }]}
              onPress={() => setPeriod(p.key)}
            >
              <Ionicons name={p.icon} size={15} color={active ? '#fff' : C.subtle} />
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{p.label}</Text>
            </Pressable>
          )
        })}
      </View>

      {!branchId ? (
        <View style={styles.centerBlock}>
          <View style={styles.centerIcon}><Ionicons name="business-outline" size={36} color={C.subtle} /></View>
          <Text style={styles.centerText}>لم يتم تحديد فرع لهذا الحساب</Text>
        </View>
      ) : recordsQuery.isLoading ? (
        <View style={styles.centerBlock}>
          <ActivityIndicator color={C.primary} size="large" />
          <Text style={styles.centerText}>جارٍ تحميل التقرير…</Text>
        </View>
      ) : recordsQuery.isError ? (
        <View style={styles.centerBlock}>
          <View style={styles.centerIcon}><Ionicons name="cloud-offline-outline" size={36} color={C.subtle} /></View>
          <Text style={styles.centerText}>تعذّر تحميل التقرير — اسحب للأسفل لإعادة المحاولة</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={refresh}>
            <Ionicons name="refresh" size={16} color={C.primary} />
            <Text style={styles.retryText}>إعادة المحاولة</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {heroCard}

          <View style={styles.statsGrid}>
            {stats.map((s) => (
              <StatCard key={s.label} label={s.label} value={s.value} icon={s.icon} color={s.color} width={cardWidth} />
            ))}
          </View>

          {isTablet ? (
            <View style={styles.columns}>
              <View style={styles.col}>
                {breakdownSection}
                {period === 'today' ? salesListSection : dailySection}
              </View>
              <View style={styles.col}>
                {summarySection}
                {shiftsSection}
              </View>
            </View>
          ) : (
            <>
              {breakdownSection}
              {period === 'today' ? salesListSection : dailySection}
              {summarySection}
              {shiftsSection}
            </>
          )}
        </>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  content: { padding: PAGE_PADDING, paddingBottom: 32 },
  centerBlock: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  centerIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  centerText: { color: C.muted, marginTop: 12, fontSize: 14, textAlign: 'center' },
  retryBtn: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginTop: 14, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: C.primary + '1a', borderWidth: 1, borderColor: C.primary + '55' },
  retryText: { color: C.primary, fontSize: 13, fontWeight: '700' },

  // Segmented period tabs
  segment: {
    flexDirection: 'row-reverse', backgroundColor: C.card, borderRadius: 16, padding: 4,
    borderWidth: 1, borderColor: C.border, marginBottom: 14,
  },
  segmentItem: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12 },
  segmentItemActive: {
    backgroundColor: C.primary,
    shadowColor: C.primary, shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  segmentText: { color: C.muted, fontWeight: '700', fontSize: 13 },
  segmentTextActive: { color: '#fff' },

  // Hero
  hero: {
    backgroundColor: C.card, borderRadius: 22, padding: 18, marginBottom: 14, overflow: 'hidden',
    borderWidth: 1, borderColor: C.primary + '44',
  },
  heroGlow: { position: 'absolute', width: 320, height: 320, borderRadius: 160, backgroundColor: C.primary + '12', right: -110, top: -170 },
  heroGlowSmall: { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: C.primary + '0d', left: -40, bottom: -90 },
  heroTop: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginBottom: 12 },
  heroIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.primary + '22', justifyContent: 'center', alignItems: 'center' },
  heroLabel: { color: C.muted, fontSize: 12, fontWeight: '600', textAlign: 'right' },
  heroRange: { color: C.subtle, fontSize: 11, textAlign: 'right', marginTop: 1 },
  trendPill: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5 },
  trendText: { fontSize: 13, fontWeight: '800' },
  heroValue: { color: C.text, fontSize: 40, fontWeight: '900', textAlign: 'right', letterSpacing: -0.5 },
  heroFoot: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  heroChip: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, backgroundColor: C.inset, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5, borderWidth: 1, borderColor: C.border },
  heroChipText: { color: C.muted, fontSize: 12, fontWeight: '600' },
  heroTrendHint: { color: C.subtle, fontSize: 11, flexBasis: '100%', textAlign: 'right', marginTop: 2 },

  // Stats grid
  statsGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: GAP, marginBottom: 14 },
  statCard: { borderRadius: 16, borderWidth: 1, padding: 14 },
  statTop: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginBottom: 10 },
  statIcon: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  statLabel: { color: C.muted, fontSize: 12, flex: 1, textAlign: 'right', fontWeight: '600' },
  statValue: { color: C.text, fontSize: 19, fontWeight: '800', textAlign: 'right' },

  columns: { flexDirection: 'row-reverse', gap: 14, alignItems: 'flex-start' },
  col: { flex: 1 },

  // Sections
  section: {
    backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.border,
    padding: 16, marginBottom: 14,
  },
  sectionHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionTitleRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  sectionIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: C.inset, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { color: C.text, fontSize: 15, fontWeight: '800' },
  countPill: { backgroundColor: C.inset, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3, borderWidth: 1, borderColor: C.border },
  countPillText: { color: C.muted, fontSize: 12, fontWeight: '700' },
  emptyRow: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  emptyRowText: { color: C.subtle, fontSize: 13, textAlign: 'center' },

  row: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 10,
    paddingVertical: 11, borderBottomWidth: 1, borderColor: C.border + '99',
  },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { color: C.text, fontSize: 14, textAlign: 'right' },
  rowSub: { color: C.muted, fontSize: 12, textAlign: 'right', marginTop: 2 },
  rowValue: { color: C.primary, fontSize: 14, fontWeight: '800' },
  rowStrong: { fontWeight: '800' },
  rowStrongValue: { fontWeight: '900', color: C.text, fontSize: 15 },
  dayTitleRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  tag: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, backgroundColor: C.primary + '22', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  tagDot: { width: 5, height: 5, borderRadius: 3 },
  tagText: { color: C.primary, fontSize: 10, fontWeight: '800' },
  miniBar: { height: 4, borderRadius: 2, backgroundColor: C.inset, marginTop: 7, overflow: 'hidden', flexDirection: 'row-reverse' },
  miniBarFill: { height: 4, borderRadius: 2 },
  shiftAvatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },

  // Payment breakdown
  breakBar: { flexDirection: 'row-reverse', height: 14, borderRadius: 7, overflow: 'hidden', backgroundColor: C.inset, marginTop: 6, marginBottom: 12, gap: 2 },
  breakLegend: { flexDirection: 'row-reverse', gap: 8, flexWrap: 'wrap' },
  breakItem: { flexGrow: 1, flexBasis: 100, borderRadius: 12, padding: 10, borderWidth: 1 },
  breakItemTop: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  breakLabel: { color: C.text, fontSize: 12, fontWeight: '700', flex: 1, textAlign: 'right' },
  breakPct: { fontSize: 13, fontWeight: '900' },
  breakAmount: { color: C.text, fontSize: 14, fontWeight: '800', textAlign: 'right', marginTop: 6 },
  breakCount: { color: C.subtle, fontSize: 11, textAlign: 'right', marginTop: 1 },

  // Sales list grouped by method
  methodGroup: { marginBottom: 12 },
  methodHeader: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 8, borderRadius: 12, padding: 8, paddingLeft: 12,
    borderWidth: 1, marginBottom: 4,
  },
  methodIcon: { width: 30, height: 30, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  methodTitle: { color: C.text, fontSize: 13, fontWeight: '800' },
  methodCount: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  methodCountText: { color: C.muted, fontSize: 11, fontWeight: '800' },
  methodSum: { fontSize: 13, fontWeight: '900', marginRight: 'auto' },
  saleRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, paddingVertical: 9, paddingRight: 6, borderBottomWidth: 1, borderColor: C.border + '99' },
  saleDot: { width: 6, height: 6, borderRadius: 3 },
  saleTime: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, minWidth: 58 },
  saleTimeText: { color: C.text, fontSize: 13, fontWeight: '700' },
  saleId: { color: C.subtle, fontSize: 11, fontWeight: '700', textAlign: 'right' },
  saleItems: { color: C.subtle, fontSize: 10, textAlign: 'right', marginTop: 1 },
  saleAmount: { color: C.text, fontSize: 14, fontWeight: '800' },
  saleSub: { color: C.muted, fontSize: 10, fontWeight: '700', marginTop: 1 },
})
