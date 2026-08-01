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
  Hotel as HotelIcon,
  FileText,
  UtensilsCrossed,
  Gamepad2,
  ChevronLeft,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { cn, formatCurrency } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { ordersApi } from '@/api/orders'
import type { OrderResponse, BusinessType } from '@/types/api'
import { customersApi } from '@/api/customers'
import { inventoryApi } from '@/api/inventory'

/* ────────────────────────────────────────────────────────────────
   animated number counter
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
    if (from === target) { setValue(target); return }
    let raf = 0
    const t0 = performance.now()
    const tick = (t: number) => {
      const p = Math.min((t - t0) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(from + (target - from) * eased)
      if (p < 1) { raf = requestAnimationFrame(tick) } else { fromRef.current = target }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  return value
}

/* ────────────────────────────────────────────────────────────────
   SVG sparkline — draw-on stroke + area fill
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
   KPI stat card
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

function StatCard({ title, value, format, change, icon, iconWrap, sparkColor, kpiColor, spark, sparkId, entrance }: StatCardProps) {
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
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
            {fmt(animated)}
          </p>
          {change !== undefined && (
            <div className="mt-1 flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
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

/* ────────────────────────────────────────────────────────────────
   business-type quick actions
   ──────────────────────────────────────────────────────────────── */

interface QuickAction {
  label: string
  icon: React.ReactNode
  to: string
  color: string
  wrap: string
}

const QUICK_ACTIONS: Partial<Record<BusinessType, QuickAction[]>> = {
  Hotel: [
    { label: 'واجهة الفندق',  icon: <HotelIcon className="h-5 w-5" />, to: '/hotel',           color: 'text-blue-600',   wrap: 'bg-blue-50 dark:bg-blue-900/30'   },
    { label: 'عقود الإيجار',  icon: <FileText  className="h-5 w-5" />, to: '/hotel/contracts', color: 'text-indigo-600', wrap: 'bg-indigo-50 dark:bg-indigo-900/30' },
    { label: 'العملاء',        icon: <Users     className="h-5 w-5" />, to: '/customers',       color: 'text-green-600',  wrap: 'bg-green-50 dark:bg-green-900/30'  },
    { label: 'المخزون',        icon: <Package   className="h-5 w-5" />, to: '/inventory',       color: 'text-orange-600', wrap: 'bg-orange-50 dark:bg-orange-900/30' },
  ],
  Restaurant: [
    { label: 'طلب جديد',  icon: <ShoppingCart    className="h-5 w-5" />, to: '/pos',        color: 'text-blue-600', wrap: 'bg-blue-50 dark:bg-blue-900/30'  },
    { label: 'المطعم',    icon: <UtensilsCrossed className="h-5 w-5" />, to: '/restaurant', color: 'text-red-600',  wrap: 'bg-red-50 dark:bg-red-900/30'    },
    { label: 'العملاء',   icon: <Users           className="h-5 w-5" />, to: '/customers',  color: 'text-green-600', wrap: 'bg-green-50 dark:bg-green-900/30' },
    { label: 'المخزون',   icon: <Package         className="h-5 w-5" />, to: '/inventory',  color: 'text-orange-600', wrap: 'bg-orange-50 dark:bg-orange-900/30' },
  ],
  Gaming: [
    { label: 'بيع جديد',  icon: <ShoppingCart className="h-5 w-5" />, to: '/pos',      color: 'text-blue-600',   wrap: 'bg-blue-50 dark:bg-blue-900/30'     },
    { label: 'الألعاب',   icon: <Gamepad2     className="h-5 w-5" />, to: '/gaming',   color: 'text-purple-600', wrap: 'bg-purple-50 dark:bg-purple-900/30' },
    { label: 'العملاء',   icon: <Users        className="h-5 w-5" />, to: '/customers', color: 'text-green-600', wrap: 'bg-green-50 dark:bg-green-900/30'   },
    { label: 'المصروفات', icon: <DollarSign   className="h-5 w-5" />, to: '/finance',  color: 'text-orange-600', wrap: 'bg-orange-50 dark:bg-orange-900/30' },
  ],
}

const DEFAULT_QUICK_ACTIONS: QuickAction[] = [
  { label: 'بيع جديد',      icon: <ShoppingCart className="h-5 w-5" />, to: '/pos',       color: 'text-blue-600',   wrap: 'bg-blue-50 dark:bg-blue-900/30'     },
  { label: 'إضافة منتج',   icon: <Package      className="h-5 w-5" />, to: '/products',  color: 'text-purple-600', wrap: 'bg-purple-50 dark:bg-purple-900/30' },
  { label: 'إضافة عميل',   icon: <Users        className="h-5 w-5" />, to: '/customers', color: 'text-green-600',  wrap: 'bg-green-50 dark:bg-green-900/30'   },
  { label: 'تسجيل مصروف', icon: <DollarSign   className="h-5 w-5" />, to: '/finance',   color: 'text-orange-600', wrap: 'bg-orange-50 dark:bg-orange-900/30' },
]

const FALLBACK_REVENUE   = [4, 6, 5, 8, 7, 10, 9]
const FALLBACK_ORDERS    = [2, 3, 2, 4, 3,  5, 4]
const FALLBACK_CUSTOMERS = [2, 3, 3, 4, 5,  5, 6]
const FALLBACK_AVG       = [5, 4, 6, 5, 7,  6, 8]

export function DashboardPage() {
  const { user, branchId, tenantId } = useAuthStore()
  const businessType = user?.businessType as BusinessType | undefined

  const { data: recentOrders } = useQuery({
    queryKey: ['orders', branchId, 'recent'],
    queryFn: () => ordersApi.listOrders(branchId!, { status: 'Completed', pageSize: 8 }),
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

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'صباح الخير' : 'مساء الخير'
  const GreetIcon = hour < 12 ? Sun : hour < 18 ? Sunset : Moon
  const todayLabel = new Intl.DateTimeFormat('ar-SA-u-ca-gregory', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date())

  const chrono = [...orders].reverse()
  const revenueSpark = chrono.length >= 2 ? chrono.map((o) => o.totalAmount) : FALLBACK_REVENUE
  const ordersSpark  = chrono.length >= 2 ? chrono.map((o) => o.lines.length) : FALLBACK_ORDERS
  const avgSpark     = chrono.length >= 2
    ? chrono.map((_, i) => chrono.slice(0, i + 1).reduce((s, x) => s + x.totalAmount, 0) / (i + 1))
    : FALLBACK_AVG

  const quickActions = (businessType ? QUICK_ACTIONS[businessType] : null) ?? DEFAULT_QUICK_ACTIONS

  return (
    <div className="page-fade min-h-full">
      <div className="space-y-6 p-6">

        {/* ── Hero ──────────────────────────────────────────────────── */}
        <section
          className="entrance-1 relative overflow-hidden rounded-2xl p-7"
          style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 55%, #1e3a8a 100%)' }}
        >
          {/* subtle grid overlay */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }}
            aria-hidden="true"
          />
          {/* radial glow */}
          <div
            className="pointer-events-none absolute -top-20 -end-20 h-64 w-64 rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, #93c5fd 0%, transparent 70%)' }}
            aria-hidden="true"
          />

          <div className="relative flex flex-wrap items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2.5">
                <GreetIcon className="h-6 w-6 text-blue-200" />
                <h1 className="text-2xl font-extrabold text-white">
                  {greeting}{user?.firstName ? `، ${user.firstName}` : ''}
                </h1>
              </div>
              <p className="mt-1.5 text-sm text-blue-200">{todayLabel}</p>

              <div className="mt-5 flex flex-wrap gap-3">
                <div className="rounded-xl bg-white/15 px-4 py-2.5 backdrop-blur-sm">
                  <p className="text-xs font-medium text-blue-200">إيرادات اليوم</p>
                  <p className="mt-0.5 text-lg font-bold tabular-nums text-white">{formatCurrency(todayRevenue)}</p>
                </div>
                <div className="rounded-xl bg-white/15 px-4 py-2.5 backdrop-blur-sm">
                  <p className="text-xs font-medium text-blue-200">الطلبات</p>
                  <p className="mt-0.5 text-lg font-bold tabular-nums text-white">{orders.length}</p>
                </div>
                <div className="rounded-xl bg-white/15 px-4 py-2.5 backdrop-blur-sm">
                  <p className="text-xs font-medium text-blue-200">العملاء</p>
                  <p className="mt-0.5 text-lg font-bold tabular-nums text-white">{customers?.data?.length ?? 0}</p>
                </div>
                {hasAlerts && (
                  <a
                    href="/inventory"
                    className="rounded-xl border border-orange-400/40 bg-orange-500/25 px-4 py-2.5 backdrop-blur-sm transition-colors hover:bg-orange-500/35"
                  >
                    <p className="text-xs font-medium text-orange-200">تنبيهات</p>
                    <p className="mt-0.5 text-lg font-bold tabular-nums text-orange-100">
                      {nearExpiryCount + lowStockCount}
                    </p>
                  </a>
                )}
              </div>
            </div>

            <a href="/pos" className="shrink-0">
              <button className="inline-flex items-center gap-2.5 rounded-xl bg-white px-5 py-3 text-sm font-bold text-blue-700 shadow-lg transition-all hover:bg-blue-50 hover:shadow-xl active:scale-95">
                <ShoppingCart className="h-5 w-5" />
                بيع جديد
              </button>
            </a>
          </div>
        </section>

        {/* ── KPI grid ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

        {/* ── Main content: orders (2/3) + quick actions (1/3) ──────── */}
        <div className="entrance-4 grid grid-cols-1 gap-6 lg:grid-cols-3">

          {/* Recent orders */}
          <div className="lg:col-span-2">
            <Card variant="holographic">
              <div
                className="flex items-center justify-between border-b px-6 py-4"
                style={{ borderColor: 'var(--card-border)' }}
              >
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  آخر الطلبات المكتملة
                </h2>
                <a
                  href="/sales"
                  className="flex items-center gap-0.5 text-xs text-blue-600 hover:underline dark:text-blue-400"
                >
                  عرض الكل
                  <ChevronLeft className="h-3 w-3" />
                </a>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {orders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-14 text-center">
                    <ShoppingCart className="mb-3 h-10 w-10 text-gray-200 dark:text-gray-700" />
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">لا توجد طلبات اليوم</p>
                    <a href="/pos" className="mt-2 text-xs text-blue-600 hover:underline dark:text-blue-400">
                      ابدأ أول بيع
                    </a>
                  </div>
                ) : (
                  orders.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between px-6 py-3.5 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-900/30">
                          <ShoppingCart className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            #{order.id.slice(0, 8).toUpperCase()}
                          </p>
                          <p className="text-xs text-gray-500">
                            {order.lines.length} {order.lines.length === 1 ? 'منتج' : 'منتجات'}
                          </p>
                        </div>
                      </div>
                      <div className="text-end">
                        <p className="text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">
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

          {/* Quick actions */}
          <div>
            <Card>
              <div
                className="border-b px-6 py-4"
                style={{ borderColor: 'var(--card-border)' }}
              >
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">إجراءات سريعة</h2>
              </div>
              <div className="grid grid-cols-2 gap-3 p-4">
                {quickActions.map((action) => (
                  <a
                    key={action.label}
                    href={action.to}
                    className="tilt-card card-3d flex flex-col items-center gap-2.5 rounded-xl p-4 text-center"
                  >
                    <div className={cn('rounded-xl p-2.5', action.wrap, action.color)}>
                      {action.icon}
                    </div>
                    <span className="text-xs font-medium leading-tight text-gray-700 dark:text-gray-300">
                      {action.label}
                    </span>
                  </a>
                ))}
              </div>
            </Card>
          </div>
        </div>

        {/* ── Inventory alerts ────────────────────────────────────────── */}
        {hasAlerts && (
          <div className="entrance-5">
            <Card>
              <div
                className="flex items-center justify-between border-b px-6 py-4"
                style={{ borderColor: 'var(--card-border)' }}
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">تنبيهات المخزون</h2>
                </div>
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
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{a.variantId}</p>
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
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{a.variantId}</p>
                        <p className="text-xs text-gray-500">تنتهي خلال {a.daysUntilExpiry} أيام · الكمية: {a.quantity}</p>
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
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{a.variantId}</p>
                        <p className="text-xs text-gray-500">الكمية: {a.quantity} · حد الطلب: {a.reorderPoint}</p>
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

      </div>
    </div>
  )
}
