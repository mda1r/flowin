import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  TrendingUp,
  ShoppingCart,
  Users,
  DollarSign,
  Package,
  ArrowUpRight,
  AlertTriangle,
  Sun,
  Sunset,
  Moon,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { cn, formatCurrency } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { ordersApi } from '@/api/orders'
import type { OrderResponse } from '@/types/api'
import { customersApi } from '@/api/customers'
import { inventoryApi } from '@/api/inventory'

/* ────────────────────────────────────────────────────────────────
   animated number counter — eases toward the target on mount and
   whenever the target changes; honors prefers-reduced-motion.
   ──────────────────────────────────────────────────────────────── */

function useCountUp(target: number, duration = 1100): number {
  const [value, setValue] = useState(0)
  const fromRef = useRef(0)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      fromRef.current = target
      setValue(target)
      return
    }
    const from = fromRef.current
    if (from === target) {
      setValue(target)
      return
    }
    let raf = 0
    const t0 = performance.now()
    const tick = (t: number) => {
      const p = Math.min((t - t0) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(from + (target - from) * eased)
      if (p < 1) {
        raf = requestAnimationFrame(tick)
      } else {
        fromRef.current = target
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  return value
}

/* ────────────────────────────────────────────────────────────────
   pure-SVG sparkline with a draw-on stroke and soft area fill
   ──────────────────────────────────────────────────────────────── */

function Sparkline({ data, id, className }: { data: number[]; id: string; className?: string }) {
  const w = 120
  const h = 36
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * w,
    y: h - 3 - ((v - min) / range) * (h - 8),
  }))
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const area = `${line} L${w} ${h} L0 ${h} Z`

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        className="spark-draw"
      />
    </svg>
  )
}

/* ────────────────────────────────────────────────────────────────
   KPI stat card — count-up value, sparkline, lifted glass surface
   with an accent hairline across the top.
   ──────────────────────────────────────────────────────────────── */

interface StatCardProps {
  title: string
  value: number
  format?: (n: number) => string
  change?: number
  icon: React.ReactNode
  iconWrap: string
  sparkColor: string
  kpiColor: string
  spark: number[]
  sparkId: string
  entrance: string
}

function StatCard({
  title,
  value,
  format,
  change,
  icon,
  iconWrap,
  sparkColor,
  kpiColor,
  spark,
  sparkId,
  entrance,
}: StatCardProps) {
  const animated = useCountUp(value)
  const fmt = format ?? ((n: number) => String(Math.round(n)))

  return (
    <div
      className={cn('card-3d card-3d-lift relative overflow-hidden p-5', entrance)}
      style={{ '--kpi-color': kpiColor } as React.CSSProperties}
    >
      <span className="kpi-topbar" aria-hidden="true" />
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
            {fmt(animated)}
          </p>
          {change !== undefined && (
            <div className="mt-1 flex items-center gap-1 text-xs font-medium text-green-600">
              <ArrowUpRight className="h-3 w-3" />
              {Math.abs(change)}%
            </div>
          )}
        </div>
        <div className={cn('rounded-xl p-3', iconWrap)}>{icon}</div>
      </div>
      <div className={cn('mt-3 h-9', sparkColor)}>
        <Sparkline data={spark} id={sparkId} className="h-full w-full" />
      </div>
    </div>
  )
}

/* ambient background particles — deterministic layout, transform-only motion */
const PARTICLES = Array.from({ length: 14 }, (_, i) => ({
  start: `${(i * 7.3 + 3) % 100}%`,
  size: 3 + (i % 4),
  dur: 9 + ((i * 2.7) % 8),
  delay: -((i * 1.9) % 12),
  drift: ((i % 5) - 2) * 16,
  alpha: 0.22 + (i % 3) * 0.12,
}))

const FALLBACK_REVENUE = [4, 6, 5, 8, 7, 10, 9]
const FALLBACK_ORDERS = [2, 3, 2, 4, 3, 5, 4]
const FALLBACK_CUSTOMERS = [2, 3, 3, 4, 5, 5, 6]
const FALLBACK_AVG = [5, 4, 6, 5, 7, 6, 8]

export function DashboardPage() {
  const { user, branchId, tenantId } = useAuthStore()

  const { data: recentOrders } = useQuery({
    queryKey: ['orders', branchId, 'recent'],
    queryFn: () => ordersApi.listOrders(branchId!, { status: 'Completed', pageSize: 5 }),
    enabled: !!branchId,
  })

  const { data: customers } = useQuery({
    queryKey: ['customers', tenantId],
    queryFn: () => customersApi.list(tenantId!),
    enabled: !!tenantId,
  })

  const { data: alertsData } = useQuery({
    queryKey: ['inventory-alerts', branchId],
    queryFn: () => inventoryApi.getAlerts(branchId!),
    enabled: !!branchId,
    refetchInterval: 300_000,
  })

  const ordersRaw = recentOrders?.data
  const orders: OrderResponse[] = Array.isArray(ordersRaw) ? ordersRaw : ((ordersRaw as any)?.items ?? [])
  const todayRevenue = orders.reduce((s, o) => s + o.totalAmount, 0)
  const alerts = alertsData?.data

  const nearExpiryCount = (alerts?.expired.length ?? 0) + (alerts?.expiringSoon.length ?? 0)
  const lowStockCount = alerts?.lowStock.length ?? 0
  const hasAlerts = nearExpiryCount > 0 || lowStockCount > 0

  /* greeting changes with the time of day */
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'صباح الخير' : 'مساء الخير'
  const GreetIcon = hour < 12 ? Sun : hour < 18 ? Sunset : Moon
  const todayLabel = new Intl.DateTimeFormat('ar-SA-u-ca-gregory', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date())

  /* sparkline series derived from real orders, with graceful fallbacks */
  const chrono = [...orders].reverse()
  const revenueSpark = chrono.length >= 2 ? chrono.map((o) => o.totalAmount) : FALLBACK_REVENUE
  const ordersSpark = chrono.length >= 2 ? chrono.map((o) => o.lines.length) : FALLBACK_ORDERS
  const avgSpark =
    chrono.length >= 2
      ? chrono.map((_, i) => chrono.slice(0, i + 1).reduce((s, x) => s + x.totalAmount, 0) / (i + 1))
      : FALLBACK_AVG

  return (
    <div className="page-fade relative min-h-full">
      {/* ambient drifting particle field */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {PARTICLES.map((p, i) => (
          <span
            key={i}
            className="particle"
            style={{
              insetInlineStart: p.start,
              '--particle-size': `${p.size}px`,
              '--rise-dur': `${p.dur}s`,
              '--rise-delay': `${p.delay}s`,
              '--rise-x': `${p.drift}px`,
              '--particle-alpha': p.alpha,
              '--rise-h': '72vh',
            } as React.CSSProperties}
          />
        ))}
      </div>

      <div className="relative p-6">
        {/* ───── Today at a glance — hero ───── */}
        <section className="card-3d entrance-1 relative overflow-hidden p-6">
          <span className="kpi-topbar" aria-hidden="true" />

          {/* decorative orbital system */}
          <div className="pointer-events-none absolute -top-8 end-[-28px] hidden sm:block" aria-hidden="true">
            <div className="relative h-40 w-40">
              <div className="orbit-ring" style={{ inset: 0, '--orbit-dur': '18s' } as React.CSSProperties} />
              <div className="orbit-ring orbit-ring-reverse" style={{ inset: 18, '--orbit-dur': '26s' } as React.CSSProperties} />
              <div
                className="orbit-dot"
                style={{ top: '50%', insetInlineStart: '50%', margin: -3.5, '--orbit-radius': '80px', '--orbit-dur': '11s' } as React.CSSProperties}
              />
            </div>
          </div>

          <div className="relative flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <GreetIcon className="h-6 w-6" style={{ color: 'var(--accent)' }} />
                <h1 className="text-emboss text-2xl font-extrabold text-gray-900 dark:text-gray-100">
                  {greeting}
                  {user?.firstName ? `، ${user.firstName}` : ''}
                </h1>
              </div>
              <p className="mt-1.5 text-sm text-gray-500">
                {todayLabel} · إليك نظرة سريعة على أداء عملك اليوم
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="tab-3d tab-3d-idle !cursor-default">
                  إيرادات اليوم: <b className="tabular-nums">{formatCurrency(todayRevenue)}</b>
                </span>
                <span className="tab-3d tab-3d-idle !cursor-default">
                  الطلبات: <b className="tabular-nums">{orders.length}</b>
                </span>
                {hasAlerts && (
                  <span className="tab-3d tab-3d-idle !cursor-default !text-orange-600 dark:!text-orange-400">
                    تنبيهات: <b className="tabular-nums">{nearExpiryCount + lowStockCount}</b>
                  </span>
                )}
              </div>
            </div>
            <a href="/pos" className="shrink-0">
              <Button variant="glow" size="lg" className="btn-shimmer rounded-xl">
                <ShoppingCart className="h-5 w-5" />
                بيع جديد
              </Button>
            </a>
          </div>
        </section>

        {/* Persistent Alert Banner */}
        {hasAlerts && (
          <a
            href="/inventory"
            className="card-3d entrance-2 mt-6 flex items-center gap-3 border-orange-200 bg-orange-50 px-4 py-3 text-orange-800 transition-colors hover:bg-orange-100 dark:border-orange-800 dark:bg-orange-900/20 dark:text-orange-300 dark:hover:bg-orange-900/30"
          >
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span className="flex-1 text-sm font-medium">
              {nearExpiryCount > 0 && (
                <span>
                  ⚠️ {nearExpiryCount} {nearExpiryCount === 1 ? 'منتج ينتهي صلاحيته' : 'منتجات تنتهي صلاحيتها'} خلال 7 أيام
                </span>
              )}
              {nearExpiryCount > 0 && lowStockCount > 0 && <span className="mx-2">—</span>}
              {lowStockCount > 0 && (
                <span>
                  {lowStockCount} {lowStockCount === 1 ? 'منتج مخزون منخفض' : 'منتجات مخزون منخفض'}
                </span>
              )}
            </span>
            <span className="shrink-0 text-xs underline">عرض المخزون ←</span>
          </a>
        )}

        {/* ───── KPI grid — count-up + sparklines ───── */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="إيرادات اليوم"
            value={todayRevenue}
            format={(n) => formatCurrency(n)}
            change={12.5}
            icon={<DollarSign className="h-5 w-5 text-blue-600" />}
            iconWrap="bg-blue-50 dark:bg-blue-900/30"
            sparkColor="text-blue-500"
            kpiColor="#3b82f6"
            spark={revenueSpark}
            sparkId="spark-revenue"
            entrance="entrance-2"
          />
          <StatCard
            title="طلبات اليوم"
            value={orders.length}
            change={8.2}
            icon={<ShoppingCart className="h-5 w-5 text-purple-600" />}
            iconWrap="bg-purple-50 dark:bg-purple-900/30"
            sparkColor="text-purple-500"
            kpiColor="#a855f7"
            spark={ordersSpark}
            sparkId="spark-orders"
            entrance="entrance-3"
          />
          <StatCard
            title="إجمالي العملاء"
            value={customers?.data?.length ?? 0}
            change={3.1}
            icon={<Users className="h-5 w-5 text-green-600" />}
            iconWrap="bg-green-50 dark:bg-green-900/30"
            sparkColor="text-green-500"
            kpiColor="#22c55e"
            spark={FALLBACK_CUSTOMERS}
            sparkId="spark-customers"
            entrance="entrance-4"
          />
          <StatCard
            title="متوسط قيمة الطلب"
            value={orders.length > 0 ? todayRevenue / orders.length : 0}
            format={(n) => formatCurrency(n)}
            icon={<TrendingUp className="h-5 w-5 text-orange-600" />}
            iconWrap="bg-orange-50 dark:bg-orange-900/30"
            sparkColor="text-orange-500"
            kpiColor="#f97316"
            spark={avgSpark}
            sparkId="spark-avg"
            entrance="entrance-5"
          />
        </div>

        {/* Inventory Alerts Widget */}
        {hasAlerts && (
          <div className="entrance-4 mt-6">
            <Card>
              <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: 'var(--card-border)' }}>
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  تنبيهات المخزون
                </h2>
                <a href="/inventory" className="text-xs text-blue-600 hover:underline dark:text-blue-400">
                  عرض الكل
                </a>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {alerts?.expired.slice(0, 3).map((a) => (
                  <a
                    key={a.stockItemId}
                    href="/inventory"
                    className="flex items-center justify-between px-6 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/40">
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {a.variantId}
                        </p>
                        <p className="text-xs text-gray-500">منتهية الصلاحية · الكمية: {a.quantity}</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
                      منتهية
                    </span>
                  </a>
                ))}
                {alerts?.expiringSoon.slice(0, 3).map((a) => (
                  <a
                    key={a.stockItemId}
                    href="/inventory"
                    className="flex items-center justify-between px-6 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/40">
                        <AlertTriangle className="h-4 w-4 text-orange-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {a.variantId}
                        </p>
                        <p className="text-xs text-gray-500">
                          تنتهي خلال {a.daysUntilExpiry} أيام · الكمية: {a.quantity}
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
                      قريبًا
                    </span>
                  </a>
                ))}
                {alerts?.lowStock.slice(0, 3).map((a) => (
                  <a
                    key={a.stockItemId}
                    href="/inventory"
                    className="flex items-center justify-between px-6 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/40">
                        <Package className="h-4 w-4 text-yellow-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {a.variantId}
                        </p>
                        <p className="text-xs text-gray-500">
                          الكمية: {a.quantity} · حد الطلب: {a.reorderPoint}
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300">
                      منخفض
                    </span>
                  </a>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* Recent completed orders — holographic showcase card */}
        <div className="entrance-5 mt-6">
          <Card variant="holographic">
            <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: 'var(--card-border)' }}>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                آخر الطلبات المكتملة
              </h2>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {orders.length === 0 ? (
                <p className="px-6 py-10 text-center text-sm text-gray-400">لا توجد طلبات</p>
              ) : (
                orders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between px-6 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {order.id.slice(0, 8).toUpperCase()}
                      </p>
                      <p className="text-xs text-gray-500">{order.lines.length} منتج</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                        {formatCurrency(order.totalAmount)}
                      </p>
                      <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
                        مكتمل
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Quick actions — tilting glass tiles */}
        <div className="entrance-5 mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: 'بيع جديد', icon: <ShoppingCart className="h-6 w-6" />, to: '/pos', color: 'text-blue-600', wrap: 'bg-blue-50 dark:bg-blue-900/30' },
            { label: 'إضافة منتج', icon: <Package className="h-6 w-6" />, to: '/products', color: 'text-purple-600', wrap: 'bg-purple-50 dark:bg-purple-900/30' },
            { label: 'إضافة عميل', icon: <Users className="h-6 w-6" />, to: '/customers', color: 'text-green-600', wrap: 'bg-green-50 dark:bg-green-900/30' },
            { label: 'تسجيل مصروف', icon: <DollarSign className="h-6 w-6" />, to: '/finance', color: 'text-orange-600', wrap: 'bg-orange-50 dark:bg-orange-900/30' },
          ].map((action) => (
            <a
              key={action.label}
              href={action.to}
              className="tilt-card card-3d flex flex-col items-center gap-3 p-5 text-center"
            >
              <div className={cn('rounded-xl p-3', action.wrap, action.color)}>{action.icon}</div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {action.label}
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
