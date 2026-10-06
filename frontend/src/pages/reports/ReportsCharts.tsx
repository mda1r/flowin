import { useMemo } from 'react'
import {
  Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ComposedChart,
} from 'recharts'
import { Card } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/utils'
import type { OrderResponse } from '@/types/api'

// ── Data builders ─────────────────────────────────────────────────────────────

interface DailyPoint {
  date: string
  label: string
  revenue: number
  net: number
  orders: number
}

function buildDailyData(orders: OrderResponse[]): DailyPoint[] {
  const map = new Map<string, DailyPoint>()
  for (const o of orders) {
    const d = new Date(o.completedAt ?? o.createdAt)
    const date = d.toLocaleDateString('en-CA')
    const label = `${d.getDate()}/${d.getMonth() + 1}`
    const cogs = o.lines.reduce((s, l) => s + (l.costPrice ?? 0) * l.quantity, 0)
    const prev = map.get(date) ?? { date, label, revenue: 0, net: 0, orders: 0 }
    map.set(date, {
      date, label,
      revenue: +(prev.revenue + o.subtotalAmount).toFixed(2),
      net: +(prev.net + Math.max(0, o.subtotalAmount - cogs)).toFixed(2),
      orders: prev.orders + 1,
    })
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date))
}

interface HourlyPoint { hour: number; label: string; orders: number; revenue: number }

function buildHourlyData(orders: OrderResponse[]): HourlyPoint[] {
  const counts = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    label: h === 0 ? '12ص' : h < 12 ? `${h}ص` : h === 12 ? '12م' : `${h - 12}م`,
    orders: 0,
    revenue: 0,
  }))
  for (const o of orders) {
    const h = new Date(o.completedAt ?? o.createdAt).getHours()
    counts[h].orders += 1
    counts[h].revenue += o.subtotalAmount
  }
  return counts
}

// ── Donut SVG ─────────────────────────────────────────────────────────────────

interface DonutSeg { value: number; color: string; label: string }

function Donut({ segs, centerPct }: { segs: DonutSeg[]; centerPct: number }) {
  const R = 52
  const CX = 68
  const CY = 68
  const SW = 17
  const C = 2 * Math.PI * R
  const total = segs.reduce((s, g) => s + Math.max(g.value, 0), 0)
  if (total === 0) return null

  let acc = 0
  const arcs = segs.map(g => {
    const dash = (Math.max(g.value, 0) / total) * C
    const arc = { ...g, dash, gap: C - dash, offset: C * 0.25 - acc }
    acc += dash
    return arc
  })

  return (
    <svg viewBox="0 0 136 136" className="w-full max-w-[136px] mx-auto">
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth={SW} />
      {arcs.map((a, i) => (
        <circle key={i} cx={CX} cy={CY} r={R} fill="none"
          stroke={a.color} strokeWidth={SW}
          strokeDasharray={`${a.dash} ${a.gap}`}
          strokeDashoffset={a.offset}
        />
      ))}
      <text x={CX} y={CY - 4} textAnchor="middle"
        style={{ fontSize: '17px', fontWeight: 700, fill: 'currentColor' }}>
        {centerPct.toFixed(0)}%
      </text>
      <text x={CX} y={CY + 13} textAnchor="middle"
        style={{ fontSize: '9px', fill: '#9ca3af' }}>
        هامش الربح
      </text>
    </svg>
  )
}

// ── Tooltip style ─────────────────────────────────────────────────────────────

const TT_STYLE: React.CSSProperties = {
  backgroundColor: 'var(--card-bg, #ffffff)',
  border: '1px solid var(--card-border, #e5e7eb)',
  borderRadius: '10px',
  fontSize: '12px',
  direction: 'rtl',
  padding: '8px 12px',
}

// ── Main export ───────────────────────────────────────────────────────────────

interface Props {
  orders: OrderResponse[]
  stats: { totalSubtotal: number; totalTax: number; totalCogs: number }
  returnTotal: number
}

export function ReportsCharts({ orders, stats, returnTotal }: Props) {
  const daily   = useMemo(() => buildDailyData(orders),  [orders])
  const hourly  = useMemo(() => buildHourlyData(orders), [orders])
  const maxOrd  = Math.max(...hourly.map(h => h.orders), 1)
  const netRev  = Math.max(0, stats.totalSubtotal - stats.totalCogs - returnTotal)
  const margin  = stats.totalSubtotal > 0 ? (netRev / stats.totalSubtotal) * 100 : 0

  const donutSegs: DonutSeg[] = [
    { value: netRev,           color: '#22c55e', label: 'الصافي'     },
    { value: stats.totalCogs,  color: '#f97316', label: 'التكلفة'    },
    { value: stats.totalTax,   color: '#f59e0b', label: 'الضريبة'    },
    { value: returnTotal,      color: '#ef4444', label: 'المرتجعات'  },
  ]

  if (orders.length === 0) return null

  return (
    <div className="space-y-4">

      {/* ── Row 1: Trend + Peak Hours ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

        {/* Revenue trend */}
        <Card className="lg:col-span-2">
          <div className="border-b px-5 py-4" style={{ borderColor: 'var(--card-border)' }}>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">تطور المبيعات</h2>
            <p className="mt-0.5 text-xs text-gray-400">الإيرادات وعدد الطلبات يومياً</p>
          </div>
          <div className="p-4">
            {daily.length < 2 ? (
              <div className="flex h-44 items-center justify-center text-sm text-gray-400">
                اختر فترة أطول لعرض الاتجاه
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={190}>
                <ComposedChart data={daily} margin={{ top: 4, right: 4, bottom: 0, left: -4 }}>
                  <defs>
                    <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gNet" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="r" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={40}
                    tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                  <YAxis yAxisId="o" orientation="right" tick={{ fontSize: 10, fill: '#9ca3af' }}
                    axisLine={false} tickLine={false} width={22} allowDecimals={false} />
                  <Tooltip contentStyle={TT_STYLE}
                    formatter={(v, name) => [
                      name === 'orders' ? `${v} طلب` : formatCurrency(Number(v)),
                      name === 'revenue' ? 'إجمالي' : name === 'net' ? 'الصافي' : 'الطلبات',
                    ]} />
                  <Area yAxisId="r" type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2}
                    fill="url(#gRev)" dot={false} activeDot={{ r: 4 }} />
                  <Area yAxisId="r" type="monotone" dataKey="net" stroke="#22c55e" strokeWidth={2}
                    fill="url(#gNet)" strokeDasharray="5 3" dot={false} activeDot={{ r: 4 }} />
                  <Bar yAxisId="o" dataKey="orders" fill="rgba(168,85,247,0.13)" radius={[3,3,0,0]} maxBarSize={26} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
            <div className="mt-2 flex items-center gap-5 px-1">
              {[
                { color: '#3b82f6', label: 'الإيرادات' },
                { color: '#22c55e', label: 'الصافي'    },
                { color: 'rgba(168,85,247,0.4)', label: 'الطلبات' },
              ].map(l => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: l.color }} />
                  <span className="text-xs text-gray-400">{l.label}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Peak hours */}
        <Card>
          <div className="border-b px-5 py-4" style={{ borderColor: 'var(--card-border)' }}>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">ساعات الذروة</h2>
            <p className="mt-0.5 text-xs text-gray-400">عدد الطلبات حسب الساعة</p>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={hourly} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} interval={3} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={TT_STYLE}
                  formatter={(v) => [`${v} طلب`, 'الطلبات']}
                  labelFormatter={l => `الساعة ${l}`} />
                <Bar dataKey="orders" radius={[3,3,0,0]} maxBarSize={16}>
                  {hourly.map((entry, i) => (
                    <Cell key={i}
                      fill={`rgba(59,130,246,${entry.orders === 0 ? 0.05 : 0.18 + 0.72 * (entry.orders / maxOrd)})`}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="mt-1 text-center text-xs text-gray-400">
              الذروة: {hourly.reduce((a, b) => b.orders > a.orders ? b : a).label}
            </p>
          </div>
        </Card>
      </div>

      {/* ── Row 2: Revenue Donut + Top Products bars ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

        {/* Revenue composition */}
        <Card>
          <div className="border-b px-5 py-4" style={{ borderColor: 'var(--card-border)' }}>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">توزيع الإيرادات</h2>
            <p className="mt-0.5 text-xs text-gray-400">تفصيل ما يذهب لكل بند</p>
          </div>
          <div className="flex items-center gap-5 p-5">
            <div className="shrink-0 w-32">
              <Donut segs={donutSegs} centerPct={margin} />
            </div>
            <div className="flex-1 space-y-3">
              {donutSegs.filter(s => s.value > 0).map(s => (
                <div key={s.label}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                      <span className="text-xs text-gray-500">{s.label}</span>
                    </div>
                    <span className="text-xs font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                      {formatCurrency(s.value)}
                    </span>
                  </div>
                  <div className="h-1 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${(s.value / stats.totalSubtotal) * 100}%`, background: s.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Product revenue bars */}
        <Card className="lg:col-span-2">
          <div className="border-b px-5 py-4" style={{ borderColor: 'var(--card-border)' }}>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">إيرادات المنتجات</h2>
            <p className="mt-0.5 text-xs text-gray-400">المبيعات بالريال لكل منتج</p>
          </div>
          <div className="p-4">
            <ProductRevenueChart orders={orders} />
          </div>
        </Card>
      </div>
    </div>
  )
}

// ── Product Revenue Chart ─────────────────────────────────────────────────────

function ProductRevenueChart({ orders }: { orders: OrderResponse[] }) {
  const data = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; qty: number }>()
    for (const o of orders) {
      for (const l of o.lines) {
        const key = l.productName
        const prev = map.get(key) ?? { name: l.productName, revenue: 0, qty: 0 }
        map.set(key, { name: prev.name, revenue: prev.revenue + l.lineTotal, qty: prev.qty + l.quantity })
      }
    }
    return Array.from(map.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8)
  }, [orders])

  if (data.length === 0) {
    return <div className="flex h-44 items-center justify-center text-sm text-gray-400">لا توجد بيانات</div>
  }

  const COLORS = ['#3b82f6','#22c55e','#f59e0b','#a855f7','#ef4444','#06b6d4','#f97316','#6366f1']

  return (
    <ResponsiveContainer width="100%" height={210}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 48, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false}
          tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
        <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11, fill: '#6b7280' }}
          axisLine={false} tickLine={false} />
        <Tooltip contentStyle={TT_STYLE}
          formatter={(v, _n, p) => [
            `${formatCurrency(Number(v))} (${(p as any).payload?.qty ?? 0} وحدة)`,
            'الإيرادات',
          ]} />
        <Bar dataKey="revenue" radius={[0,4,4,0]} maxBarSize={22}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
