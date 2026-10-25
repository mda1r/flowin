import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { stockMaterialApi } from '@/api/stockMaterial'
import { BUSINESS_TYPE_ROUTES } from '@/lib/businessRoutes'
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
  Banknote,
  CreditCard,
  Landmark,
  Ticket,
  PartyPopper,
  Coffee,
  Store,
  ShoppingBag,
  BarChart2,
  Receipt,
  FlaskConical,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { FlowWave } from '@/components/brand/Brand'
import { Badge } from '@/components/ui/Badge'
import { cn, formatCurrency } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { ordersApi } from '@/api/orders'
import type { OrderResponse, BusinessType, PaymentMethod, ReturnOrderResponse } from '@/types/api'
import { customersApi } from '@/api/customers'
import { inventoryApi } from '@/api/inventory'
import { catalogApi } from '@/api/catalog'
import { salesApi } from '@/api/sales'
import { useI18n } from '@/i18n'

/* ────────────────────────────────────────────────────────────────
   animated number counter — snappy ease-out + elastic settle pop.
   The value itself never overshoots (money must stay truthful);
   the "bounce" lives on the element via the .count-pop class.
   ──────────────────────────────────────────────────────────────── */

function useCountUp(target: number, duration = 1100): { value: number; settled: boolean } {
  const [value, setValue] = useState(0)
  const [settled, setSettled] = useState(false)
  const fromRef = useRef(0)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      fromRef.current = target
      setValue(target)
      setSettled(true)
      return
    }
    const from = fromRef.current
    if (from === target) { setValue(target); return }
    setSettled(false)
    let raf = 0
    const t0 = performance.now()
    const tick = (t: number) => {
      const p = Math.min((t - t0) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 4)
      setValue(from + (target - from) * eased)
      if (p < 1) {
        raf = requestAnimationFrame(tick)
      } else {
        fromRef.current = target
        setSettled(true)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  return { value, settled }
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
   KPI stat card (+ optional floating badge, e.g. revenue milestone)
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
  badge?: React.ReactNode
}

function StatCard({ title, value, format, change, icon, iconWrap, sparkColor, kpiColor, spark, sparkId, entrance, badge }: StatCardProps) {
  const { value: animated, settled } = useCountUp(value)
  const fmt = format ?? ((n: number) => String(Math.round(n)))

  return (
    <div
      className={cn('card-3d card-3d-lift relative overflow-hidden p-5', entrance)}
      style={{ '--kpi-color': kpiColor } as React.CSSProperties}
    >
      <span className="kpi-topbar" aria-hidden="true" />
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted">{title}</p>
          <p className="mt-2 font-display text-2xl font-semibold tabular-nums text-fg">
            <span className={cn('inline-block', settled && 'count-pop')}>{fmt(animated)}</span>
          </p>
          {change !== undefined && (
            <div className="mt-1 flex items-center gap-1 text-xs font-medium text-success">
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
      {badge && (
        <div className="pointer-events-none absolute bottom-3 end-3">{badge}</div>
      )}
    </div>
  )
}

function StatCardSkeleton({ entrance }: { entrance: string }) {
  return (
    <div className={cn('card-3d relative overflow-hidden p-5', entrance)} aria-hidden="true">
      <div className="flex items-start justify-between">
        <div>
          <div className="skeleton h-3 w-20" />
          <div className="skeleton mt-3 h-7 w-28" />
          <div className="skeleton mt-2 h-3 w-12" />
        </div>
        <div className="skeleton h-11 w-11 !rounded-xl" />
      </div>
      <div className="skeleton mt-3 h-9 w-full" />
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────
   orders list — payment metadata, time, skeleton, empty state
   ──────────────────────────────────────────────────────────────── */

const PAYMENT_META: Record<PaymentMethod, {
  badge: 'green' | 'blue' | 'purple' | 'orange'
  Icon: LucideIcon
  iconWrap: string
  iconColor: string
}> = {
  Cash:         { badge: 'green',  Icon: Banknote,   iconWrap: 'bg-success/10 dark:bg-success/15', iconColor: 'text-success' },
  Card:         { badge: 'blue',   Icon: CreditCard, iconWrap: 'bg-info/10',       iconColor: 'text-info'    },
  BankTransfer: { badge: 'purple', Icon: Landmark,   iconWrap: 'bg-brand-soft dark:bg-brand/20',   iconColor: 'text-brand-ink'  },
  Voucher:      { badge: 'orange', Icon: Ticket,     iconWrap: 'bg-warning/10 dark:bg-warning/15',     iconColor: 'text-warning'   },
  Split:        { badge: 'orange', Icon: Banknote,   iconWrap: 'bg-warning/10 dark:bg-warning/15',   iconColor: 'text-warning'  },
}

function formatOrderTime(iso?: string, lang?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA' : 'en-US', { hour: 'numeric', minute: '2-digit' }).format(d)
}

function OrderRow({ order, index }: { order: OrderResponse; index: number }) {
  const { t, lang } = useI18n()
  function productCountLabel(n: number) {
    if (n === 1) return t.dashboard.oneProduct
    return t.dashboard.nProducts.replace('{n}', String(n))
  }
  const payLabels: Record<PaymentMethod, string> = {
    Cash: t.dashboard.cash,
    Card: t.dashboard.card,
    BankTransfer: t.dashboard.bankTransfer,
    Voucher: t.dashboard.voucher,
    Split: t.dashboard.split,
  }
  const pay = order.paymentMethod ? PAYMENT_META[order.paymentMethod] : undefined
  const payLabel = order.paymentMethod ? payLabels[order.paymentMethod] : undefined
  const Icon = pay?.Icon ?? ShoppingCart
  const time = formatOrderTime(order.completedAt ?? order.createdAt, lang)

  return (
    <div
      className="row-enter row-hover flex items-center justify-between px-6 py-3.5"
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
            pay?.iconWrap ?? 'bg-info/10',
          )}
          title={payLabel}
        >
          <Icon className={cn('h-4 w-4', pay?.iconColor ?? 'text-info')} />
        </div>
        <div>
          <p className="text-sm font-medium text-fg">
            #{order.id.slice(0, 8).toUpperCase()}
          </p>
          <p className="text-xs text-muted">
            {productCountLabel(order.lines.length)}
            {time && <span> · {time}</span>}
          </p>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <p className="text-sm font-bold tabular-nums text-fg">
          {formatCurrency(order.totalAmount)}
        </p>
        {pay ? <Badge variant={pay.badge}>{payLabel}</Badge> : <Badge variant="green">{t.dashboard.completed}</Badge>}
      </div>
    </div>
  )
}

function OrderRowSkeleton() {
  return (
    <div className="flex items-center justify-between px-6 py-3.5" aria-hidden="true">
      <div className="flex items-center gap-3">
        <div className="skeleton h-9 w-9 !rounded-full" />
        <div>
          <div className="skeleton h-3 w-24" />
          <div className="skeleton mt-2 h-2.5 w-16" />
        </div>
      </div>
      <div className="flex flex-col items-end">
        <div className="skeleton h-3 w-16" />
        <div className="skeleton mt-2 h-4 w-12 !rounded-full" />
      </div>
    </div>
  )
}

/* encouraging empty state with a hand-drawn receipt illustration */
function EmptyOrdersIllustration() {
  return (
    <div className="empty-float relative">
      <svg viewBox="0 0 170 130" className="h-32 w-40" aria-hidden="true">
        {/* ground shadow */}
        <ellipse cx="85" cy="116" rx="56" ry="9" fill="var(--accent)" opacity="0.07" />
        {/* receipt body with zigzag bottom */}
        <path
          d="M55 16 h60 a4 4 0 0 1 4 4 v78 l-8.5-6 -8.5 6 -8.5-6 -8.5 6 -8.5-6 -8.5 6 -8.5-6 -8.5 6 V20 a4 4 0 0 1 4-4 z"
          fill="var(--color-surface)"
          stroke="color-mix(in srgb, var(--accent) 55%, transparent)"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {/* receipt text lines */}
        <line x1="66" y1="34" x2="104" y2="34" stroke="color-mix(in srgb, var(--accent) 32%, transparent)" strokeWidth="3" strokeLinecap="round" />
        <line x1="66" y1="46" x2="96"  y2="46" stroke="color-mix(in srgb, var(--accent) 20%, transparent)" strokeWidth="3" strokeLinecap="round" />
        <line x1="66" y1="58" x2="104" y2="58" stroke="color-mix(in srgb, var(--accent) 20%, transparent)" strokeWidth="3" strokeLinecap="round" />
        {/* highlighted total row */}
        <line x1="66" y1="74" x2="82"  y2="74" stroke="#62E6C7" strokeWidth="3.5" strokeLinecap="round" />
        <line x1="92" y1="74" x2="104" y2="74" stroke="#62E6C7" strokeWidth="3.5" strokeLinecap="round" />
        {/* star coin */}
        <circle cx="124" cy="90" r="17" fill="#62E6C7" opacity="0.92" />
        <path
          d="M124 81l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z"
          fill="#23262D"
          opacity="0.78"
        />
        {/* sparkles */}
        <path d="M40 30 l1.8 4.6 4.6 1.8 -4.6 1.8 -1.8 4.6 -1.8 -4.6 -4.6 -1.8 4.6 -1.8 z" fill="var(--accent)" opacity="0.5" />
        <circle cx="140" cy="28" r="3"   fill="var(--accent)" opacity="0.35" />
        <circle cx="34"  cy="80" r="2.5" fill="#62E6C7"       opacity="0.55" />
      </svg>
    </div>
  )
}

function OrdersEmptyState() {
  const { t } = useI18n()
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <EmptyOrdersIllustration />
      <p className="mt-5 text-sm font-bold text-fg">
        {t.dashboard.noRecentOrders}
      </p>
      <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-muted">
        {t.dashboard.noRecentOrdersSub}
      </p>
      <a href="/pos" className="mt-5">
        <button className="btn-3d btn-shimmer inline-flex items-center gap-2 px-5 py-2.5 text-sm">
          <ShoppingCart className="h-4 w-4" />
          {t.dashboard.startFirstSale}
        </button>
      </a>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────
   business-type quick actions (+ pointer ripple tiles)
   ──────────────────────────────────────────────────────────────── */

interface QuickAction {
  label: string
  icon: React.ReactNode
  to: string
  color: string
  wrap: string
}


function QuickActionTile({ action }: { action: QuickAction }) {
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number }>>([])
  const idRef = useRef(0)

  const spawnRipple = (e: React.PointerEvent<HTMLAnchorElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    idRef.current += 1
    setRipples((prev) => [
      ...prev.slice(-3),
      { id: idRef.current, x: e.clientX - rect.left, y: e.clientY - rect.top },
    ])
  }

  return (
    <a
      href={action.to}
      onPointerDown={spawnRipple}
      className="group tilt-card card-3d ripple-host flex flex-col items-center gap-2.5 rounded-xl p-4 text-center transition-colors hover:border-brand/50"
    >
      {ripples.map((r) => (
        <span
          key={r.id}
          className="ripple-ink"
          style={{ left: r.x, top: r.y }}
          onAnimationEnd={() => setRipples((prev) => prev.filter((p) => p.id !== r.id))}
          aria-hidden="true"
        />
      ))}
      <div
        className={cn(
          // one brand colour for every shortcut; colour is kept for status, not for decoration
          'rounded-xl bg-brand-soft p-2.5 text-brand-ink transition-transform duration-300 group-hover:scale-110',
        )}
      >
        {action.icon}
      </div>
      <span className="text-xs font-medium leading-tight text-fg">
        {action.label}
      </span>
    </a>
  )
}

/* ────────────────────────────────────────────────────────────────
   the moment — first sale of the day 🎉
   Fires only when the dashboard *witnesses* today's order count go
   0 → 1+ (baseline persisted per-day in localStorage, so it also
   survives a round-trip to the POS screen). At most once per day.
   ──────────────────────────────────────────────────────────────── */

const DAY_PULSE_KEY = 'flowin-day-pulse'

interface DayPulse {
  date: string
  baseline: number
  celebrated: boolean
}

function localToday(): string {
  return new Date().toLocaleDateString('en-CA') // YYYY-MM-DD, local time
}

function readDayPulse(): DayPulse | null {
  try {
    const raw = localStorage.getItem(DAY_PULSE_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as DayPulse
    return typeof p?.date === 'string' && typeof p?.baseline === 'number' ? p : null
  } catch {
    return null
  }
}

function writeDayPulse(p: DayPulse) {
  try {
    localStorage.setItem(DAY_PULSE_KEY, JSON.stringify(p))
  } catch {
    /* storage unavailable — celebration simply won't persist */
  }
}

// celebration in the identity's colours: mint, deep mint, soft white and a warm spark
const CONFETTI_COLORS = ['#62E6C7', '#0A7C62', '#F7F7F5', '#62E6C7', '#FBBF24', '#23262D']

interface ConfettiPiece {
  left: number
  delay: number
  dur: number
  drift: number
  rot: number
  size: number
  color: string
  round: boolean
}

function FirstSaleCelebration({ amount, onDone }: { amount: number; onDone: () => void }) {
  const { t } = useI18n()
  const reducedMotion = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  const pieces = useMemo<ConfettiPiece[]>(
    () =>
      reducedMotion
        ? []
        : Array.from({ length: 38 }, (_, i) => ({
            left: Math.random() * 100,
            delay: Math.random() * 1.1,
            dur: 2.7 + Math.random() * 1.9,
            drift: (Math.random() - 0.5) * 170,
            rot: 260 + Math.random() * 480,
            size: 6 + Math.random() * 6,
            color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            round: i % 3 === 2,
          })),
    [reducedMotion],
  )

  useEffect(() => {
    const t = window.setTimeout(onDone, 7200)
    return () => window.clearTimeout(t)
  }, [onDone])

  return createPortal(
    <>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          aria-hidden="true"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.round ? p.size : p.size * 1.6,
            backgroundColor: p.color,
            borderRadius: p.round ? '9999px' : '2px',
            '--confetti-drift': `${p.drift}px`,
            '--confetti-rot': `${p.rot}deg`,
            '--confetti-dur': `${p.dur}s`,
            '--confetti-delay': `${p.delay}s`,
          } as React.CSSProperties}
        />
      ))}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-6 z-[70] flex justify-center px-4"
      >
        <button
          type="button"
          onClick={onDone}
          aria-label="إغلاق التهنئة"
          className="celebrate-banner pointer-events-auto flex items-center gap-3 rounded-2xl px-5 py-3.5 text-start"
        >
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'color-mix(in srgb, var(--accent) 14%, transparent)' }}
          >
            <PartyPopper className="h-5 w-5" style={{ color: 'var(--accent)' }} />
          </span>
          <span>
            <span className="block text-sm font-extrabold" style={{ color: 'var(--color-text)' }}>
              {t.dashboard.firstSaleTitle}
            </span>
            <span className="block text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {amount > 0 ? `${t.dashboard.firstSaleGreat} — ${formatCurrency(amount)}. ` : `${t.dashboard.firstSaleGreat}. `}
              {t.dashboard.firstSaleGreatDay}
            </span>
          </span>
        </button>
      </div>
    </>,
    document.body,
  )
}

/* revenue milestones — pulsing badge on the revenue KPI card */
const MILESTONES = [
  { at: 10000, label: 'تجاوزت ١٠٬٠٠٠ ر.س', emoji: '🏆', color: '#FBBF24' },
  { at: 5000,  label: 'تجاوزت ٥٬٠٠٠ ر.س',  emoji: '🥇', color: '#62E6C7' },
  { at: 1000,  label: 'تجاوزت ١٬٠٠٠ ر.س',  emoji: '⭐', color: '#0A7C62' },
] as const

/* ────────────────────────────────────────────────────────────────
   dashboard page
   ──────────────────────────────────────────────────────────────── */

function computeStats(orders: OrderResponse[]) {
  const totalRevenue = orders.reduce((s, o) => s + o.totalAmount, 0)
  const totalSubtotal = orders.reduce((s, o) => s + o.subtotalAmount, 0)
  const totalTax = orders.reduce((s, o) => s + o.taxAmount, 0)
  const totalCogs = orders.reduce((s, o) => s + o.lines.reduce((ls, l) => ls + (l.costPrice ?? 0) * l.quantity, 0), 0)
  const totalOrders = orders.length
  const avgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0
  return { totalRevenue, totalSubtotal, totalTax, totalCogs, totalOrders, avgOrder }
}

const FALLBACK_REVENUE   = [4, 6, 5, 8, 7, 10, 9]
const FALLBACK_ORDERS    = [2, 3, 2, 4, 3,  5, 4]
const FALLBACK_AVG       = [5, 4, 6, 5, 7,  6, 8]

export function DashboardPage() {
  const { t, lang } = useI18n()
  const { user, branchId, tenantId } = useAuthStore()
  const businessType = user?.businessType as BusinessType | undefined

  const today = localToday()
  const ordersQuery = useQuery({
    queryKey: ['dashboard-orders', branchId, today],
    queryFn: () => salesApi.listAllCompletedOrders(branchId!, today, today).then((data) => ({ data })),
    enabled: !!branchId,
    refetchInterval: 60_000,
  })
  const returnsQuery = useQuery({
    queryKey: ['dashboard-returns', branchId, today],
    queryFn: () => ordersApi.listReturns(branchId!),
    enabled: !!branchId,
    refetchInterval: 60_000,
  })
  const ordersLoading = ordersQuery.isLoading && ordersQuery.fetchStatus !== 'idle'
  const ordersFetched = ordersQuery.isSuccess

  const customersQuery = useQuery({
    queryKey: ['customers', tenantId],
    queryFn: () => customersApi.list(tenantId!),
    enabled: !!tenantId,
  })
  const customers = customersQuery.data
  const customersLoading = customersQuery.isLoading && customersQuery.fetchStatus !== 'idle'

  const { data: alertsData } = useQuery({
    queryKey: ['inventory-alerts', branchId],
    queryFn: () => inventoryApi.getAlerts(branchId!),
    enabled: !!branchId,
    refetchInterval: 300_000,
  })

  const usesMaterials = !!businessType && (BUSINESS_TYPE_ROUTES[businessType] ?? []).includes('/stock-materials')
  const { data: lowMaterialsData } = useQuery({
    queryKey: ['stock-materials', tenantId, 'dashboard-low'],
    queryFn: () => stockMaterialApi.listMaterials(tenantId!, { lowStockOnly: true }),
    enabled: !!tenantId && usesMaterials,
    refetchInterval: 300_000,
  })
  const lowMaterials = lowMaterialsData?.data ?? []

  const { data: productsData } = useQuery({
    queryKey: ['products-map', tenantId],
    queryFn: () => catalogApi.listProducts(tenantId!, { pageSize: 500 }),
    enabled: !!tenantId,
    staleTime: 10 * 60_000,
  })

  const variantNameMap = useMemo(() => {
    const map = new Map<string, string>()
    const raw = productsData?.data
    const list = Array.isArray(raw) ? raw : ((raw as any)?.items ?? [])
    for (const p of list) {
      for (const v of p.variants ?? []) {
        const label = p.variants.length > 1 ? `${p.name} — ${v.name}` : p.name
        map.set(v.id, label)
      }
    }
    return map
  }, [productsData])

  const orders = useMemo<OrderResponse[]>(() => {
    const raw = ordersQuery.data?.data
    const all: OrderResponse[] = Array.isArray(raw) ? raw : ((raw as any)?.items ?? [])
    return all.filter(o => {
      const d = new Date(o.completedAt ?? o.createdAt)
      return d.toLocaleDateString('en-CA') === today
    })
  }, [ordersQuery.data, today])

  const todayReturns = useMemo<ReturnOrderResponse[]>(() => {
    const raw = returnsQuery.data?.data
    const all: ReturnOrderResponse[] = Array.isArray(raw) ? raw : ((raw as any)?.items ?? [])
    return all.filter(r => new Date(r.createdAt).toLocaleDateString('en-CA') === today)
  }, [returnsQuery.data, today])

  const stats = useMemo(() => computeStats(orders), [orders])
  const returnTotal = todayReturns.reduce((s, r) => s + r.refundAmount, 0)
  const netRevenue = stats.totalSubtotal - stats.totalCogs - returnTotal
  const alerts = alertsData?.data

  const nearExpiryCount = (alerts?.expired.length ?? 0) + (alerts?.expiringSoon.length ?? 0)
  const lowStockCount = alerts?.lowStock.length ?? 0
  const lowMaterialsCount = lowMaterials.length
  const hasAlerts = nearExpiryCount > 0 || lowStockCount > 0 || lowMaterialsCount > 0
  const alertsHref = nearExpiryCount + lowStockCount === 0 && lowMaterialsCount > 0 ? '/stock-materials?lowStock=1' : '/inventory'

  /* ── the moment: witnessed 0 → 1+ transition, once per day ── */
  const [celebration, setCelebration] = useState<{ amount: number } | null>(null)
  const dismissCelebration = useCallback(() => setCelebration(null), [])

  useEffect(() => {
    if (!ordersFetched) return
    const today = localToday()
    const pulse = readDayPulse()

    if (!pulse || pulse.date !== today) {
      // first sighting of today — record a baseline without celebrating
      writeDayPulse({ date: today, baseline: orders.length, celebrated: orders.length > 0 })
      return
    }
    if (!pulse.celebrated && pulse.baseline === 0 && orders.length > 0) {
      writeDayPulse({ date: today, baseline: orders.length, celebrated: true })
      setCelebration({ amount: orders[0]?.totalAmount ?? 0 })
      return
    }
    if (pulse.baseline !== orders.length) {
      writeDayPulse({ ...pulse, baseline: orders.length })
    }
  }, [ordersFetched, orders])

  const milestone = MILESTONES.find((m) => netRevenue >= m.at)

  const hour = new Date().getHours()
  const greeting = hour < 12 ? t.dashboard.goodMorning : t.dashboard.goodEvening
  const GreetIcon = hour < 12 ? Sun : hour < 18 ? Sunset : Moon
  const todayLabel = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-ca-gregory' : 'en-US-u-ca-gregory', {
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

  const quickActions = useMemo<QuickAction[]>(() => {
    const byType: Partial<Record<BusinessType, QuickAction[]>> = {
      Hotel: [
        { label: t.dashboard.hotel,     icon: <HotelIcon className="h-5 w-5" />, to: '/hotel',           color: 'text-info',   wrap: 'bg-info/10'    },
        { label: t.dashboard.contracts, icon: <FileText  className="h-5 w-5" />, to: '/hotel/contracts', color: 'text-info', wrap: 'bg-info/10 dark:bg-info/15' },
        { label: t.dashboard.customers, icon: <Users     className="h-5 w-5" />, to: '/customers',       color: 'text-success',  wrap: 'bg-success/10 dark:bg-success/15'   },
        { label: t.dashboard.inventory, icon: <Package   className="h-5 w-5" />, to: '/inventory',       color: 'text-warning', wrap: 'bg-warning/10 dark:bg-warning/15' },
      ],
      Restaurant: [
        { label: t.dashboard.newOrder,   icon: <ShoppingCart    className="h-5 w-5" />, to: '/pos',        color: 'text-info',   wrap: 'bg-info/10'    },
        { label: t.dashboard.restaurant, icon: <UtensilsCrossed className="h-5 w-5" />, to: '/restaurant', color: 'text-danger',    wrap: 'bg-danger/10 dark:bg-danger/15'      },
        { label: t.dashboard.customers,  icon: <Users           className="h-5 w-5" />, to: '/customers',  color: 'text-success',  wrap: 'bg-success/10 dark:bg-success/15'  },
        { label: t.dashboard.inventory,  icon: <Package         className="h-5 w-5" />, to: '/inventory',  color: 'text-warning', wrap: 'bg-warning/10 dark:bg-warning/15' },
      ],
      Gaming: [
        { label: t.dashboard.newSale,   icon: <ShoppingCart className="h-5 w-5" />, to: '/pos',       color: 'text-info',   wrap: 'bg-info/10'     },
        { label: t.dashboard.gaming,    icon: <Gamepad2     className="h-5 w-5" />, to: '/gaming',    color: 'text-brand-ink', wrap: 'bg-brand-soft dark:bg-brand/20' },
        { label: t.dashboard.customers, icon: <Users        className="h-5 w-5" />, to: '/customers', color: 'text-success',  wrap: 'bg-success/10 dark:bg-success/15'   },
        { label: t.dashboard.reports,   icon: <BarChart2    className="h-5 w-5" />, to: '/reports',   color: 'text-warning', wrap: 'bg-warning/10 dark:bg-warning/15' },
      ],
      Cafe: [
        { label: t.dashboard.newOrder,  icon: <ShoppingCart className="h-5 w-5" />, to: '/pos',       color: 'text-info',   wrap: 'bg-info/10'     },
        { label: t.dashboard.products,  icon: <Coffee       className="h-5 w-5" />, to: '/products',  color: 'text-warning',  wrap: 'bg-warning/10 dark:bg-warning/15'   },
        { label: t.dashboard.customers, icon: <Users        className="h-5 w-5" />, to: '/customers', color: 'text-success',  wrap: 'bg-success/10 dark:bg-success/15'   },
        { label: t.dashboard.reports,   icon: <BarChart2    className="h-5 w-5" />, to: '/reports',   color: 'text-brand-ink', wrap: 'bg-brand-soft dark:bg-brand/20' },
      ],
      Retail: [
        { label: t.dashboard.newSale,   icon: <ShoppingCart className="h-5 w-5" />, to: '/pos',       color: 'text-info',   wrap: 'bg-info/10'     },
        { label: t.dashboard.products,  icon: <Store        className="h-5 w-5" />, to: '/products',  color: 'text-brand-ink',   wrap: 'bg-brand-soft dark:bg-brand/20'     },
        { label: t.dashboard.customers, icon: <Users        className="h-5 w-5" />, to: '/customers', color: 'text-success',  wrap: 'bg-success/10 dark:bg-success/15'   },
        { label: t.dashboard.reports,   icon: <BarChart2    className="h-5 w-5" />, to: '/reports',   color: 'text-brand-ink', wrap: 'bg-brand-soft dark:bg-brand/20' },
      ],
      Supermarket: [
        { label: t.dashboard.newSale,   icon: <ShoppingCart className="h-5 w-5" />, to: '/pos',        color: 'text-info',    wrap: 'bg-info/10'      },
        { label: t.dashboard.products,  icon: <Package      className="h-5 w-5" />, to: '/products',   color: 'text-success', wrap: 'bg-success/10 dark:bg-success/15' },
        { label: t.dashboard.purchases, icon: <ShoppingBag  className="h-5 w-5" />, to: '/purchasing', color: 'text-warning',  wrap: 'bg-warning/10 dark:bg-warning/15'  },
        { label: t.dashboard.reports,   icon: <BarChart2    className="h-5 w-5" />, to: '/reports',    color: 'text-brand-ink',  wrap: 'bg-brand-soft dark:bg-brand/20'  },
      ],
    }
    return (businessType ? byType[businessType] : null) ?? [
      { label: t.dashboard.newSale,     icon: <ShoppingCart className="h-5 w-5" />, to: '/pos',       color: 'text-info',   wrap: 'bg-info/10'     },
      { label: t.dashboard.addProduct,  icon: <Package      className="h-5 w-5" />, to: '/products',  color: 'text-brand-ink', wrap: 'bg-brand-soft dark:bg-brand/20' },
      { label: t.dashboard.addCustomer, icon: <Users        className="h-5 w-5" />, to: '/customers', color: 'text-success',  wrap: 'bg-success/10 dark:bg-success/15'   },
      { label: t.dashboard.reports,     icon: <BarChart2    className="h-5 w-5" />, to: '/reports',   color: 'text-warning', wrap: 'bg-warning/10 dark:bg-warning/15' },
    ]
  }, [t, businessType])

  const statsLoading = ordersLoading

  return (
    <div className="page-fade min-h-full">
      {celebration && (
        <FirstSaleCelebration amount={celebration.amount} onDone={dismissCelebration} />
      )}

      <div className="space-y-6 p-6">

        {/* ── Hero ──────────────────────────────────────────────────── */}
        <section className="scheme-dark entrance-1 relative overflow-hidden rounded-2xl bg-surface p-7 text-fg shadow-lg">
          <div className="pointer-events-none absolute -top-28 -end-16 h-72 w-72 rounded-full bg-brand/20 blur-3xl" aria-hidden="true" />
          <FlowWave className="absolute inset-x-0 -bottom-3 h-24 opacity-60" />

          <div className="relative flex flex-wrap items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2.5">
                <GreetIcon className="h-6 w-6 text-brand" />
                <h1 className="text-[1.65rem] font-semibold text-fg">
                  {greeting}{user?.firstName ? `، ${user.firstName}` : ''}
                </h1>
              </div>
              <p className="mt-1.5 text-sm text-muted">{todayLabel}</p>

              <div className="mt-5 flex flex-wrap gap-3">
                <div className="rounded-xl border border-border bg-surface-2/80 px-4 py-2.5 backdrop-blur-sm">
                  <p className="text-xs font-medium text-muted">{t.dashboard.netRevenue}</p>
                  {ordersLoading ? (
                    <span className="mt-1.5 inline-block h-5 w-20 animate-pulse rounded-md bg-border" />
                  ) : (
                    <p className="mt-0.5 font-display text-lg font-semibold tabular-nums text-fg">{formatCurrency(netRevenue)}</p>
                  )}
                </div>
                <div className="rounded-xl border border-border bg-surface-2/80 px-4 py-2.5 backdrop-blur-sm">
                  <p className="text-xs font-medium text-muted">{t.dashboard.ordersToday}</p>
                  {ordersLoading ? (
                    <span className="mt-1.5 inline-block h-5 w-10 animate-pulse rounded-md bg-border" />
                  ) : (
                    <p className="mt-0.5 font-display text-lg font-semibold tabular-nums text-fg">{stats.totalOrders}</p>
                  )}
                </div>
                <div className="rounded-xl border border-border bg-surface-2/80 px-4 py-2.5 backdrop-blur-sm">
                  <p className="text-xs font-medium text-muted">{t.dashboard.totalCustomers}</p>
                  {customersLoading ? (
                    <span className="mt-1.5 inline-block h-5 w-10 animate-pulse rounded-md bg-border" />
                  ) : (
                    <p className="mt-0.5 font-display text-lg font-semibold tabular-nums text-fg">{customers?.data?.length ?? 0}</p>
                  )}
                </div>
                {hasAlerts && (
                  <a
                    href={alertsHref}
                    className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-2.5 transition-colors hover:bg-warning/20"
                  >
                    <p className="text-xs font-medium text-warning">{t.dashboard.inventoryAlerts}</p>
                    <p className="mt-0.5 font-display text-lg font-semibold tabular-nums text-fg">
                      {nearExpiryCount + lowStockCount + lowMaterialsCount}
                    </p>
                  </a>
                )}
              </div>
            </div>

            <a
              href="/pos"
              className="inline-flex shrink-0 items-center gap-2.5 rounded-xl bg-brand px-5 py-3 text-sm font-bold text-brand-fg shadow-[0_8px_24px_-6px_rgb(var(--brand)/0.6)] transition-all hover:bg-brand/90 active:scale-95"
            >
              <ShoppingCart className="h-5 w-5" />
              {t.dashboard.newSale}
            </a>
          </div>

        </section>

        {/* ── KPI grid ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statsLoading ? (
            <>
              <StatCardSkeleton entrance="entrance-2" />
              <StatCardSkeleton entrance="entrance-3" />
              <StatCardSkeleton entrance="entrance-4" />
              <StatCardSkeleton entrance="entrance-5" />
            </>
          ) : (
            <>
              <StatCard
                title={t.dashboard.netRevenue}
                value={netRevenue}
                format={(n) => formatCurrency(n)}
                icon={<DollarSign className="h-5 w-5 text-brand-ink" />}
                iconWrap="bg-brand-soft"
                sparkColor="text-brand-ink"
                kpiColor="rgb(var(--brand))"
                spark={revenueSpark}
                sparkId="spark-revenue"
                entrance="entrance-2"
                badge={milestone && (
                  <span
                    key={milestone.at}
                    className="milestone-badge"
                    style={{ '--ring-color': milestone.color } as React.CSSProperties}
                  >
                    <span aria-hidden="true">{milestone.emoji}</span>
                    {milestone.label}
                  </span>
                )}
              />
              <StatCard
                title={t.dashboard.ordersToday}
                value={stats.totalOrders}
                icon={<ShoppingCart className="h-5 w-5 text-brand-ink" />}
                iconWrap="bg-brand-soft"
                sparkColor="text-brand-ink"
                kpiColor="rgb(var(--brand))"
                spark={ordersSpark}
                sparkId="spark-orders"
                entrance="entrance-3"
              />
              <StatCard
                title={t.dashboard.vatCollected}
                value={stats.totalTax}
                format={(n) => formatCurrency(n)}
                icon={<Receipt className="h-5 w-5 text-brand-ink" />}
                iconWrap="bg-brand-soft"
                sparkColor="text-brand-ink"
                kpiColor="rgb(var(--brand))"
                spark={FALLBACK_AVG}
                sparkId="spark-tax"
                entrance="entrance-4"
              />
              <StatCard
                title={t.dashboard.avgOrderValue}
                value={stats.avgOrder}
                format={(n) => formatCurrency(n)}
                icon={<TrendingUp className="h-5 w-5 text-brand-ink" />}
                iconWrap="bg-brand-soft"
                sparkColor="text-brand-ink"
                kpiColor="rgb(var(--brand))"
                spark={avgSpark}
                sparkId="spark-avg"
                entrance="entrance-5"
              />
            </>
          )}
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
                <div className="flex items-center gap-2.5">
                  <h2 className="text-sm font-semibold text-fg">
                    {t.dashboard.recentCompleted}
                  </h2>
                  <Badge variant="live">{t.dashboard.live}</Badge>
                </div>
                <a
                  href="/sales"
                  className="flex items-center gap-0.5 text-xs text-info hover:underline"
                >
                  {t.dashboard.viewAll}
                  <ChevronLeft className="h-3 w-3" />
                </a>
              </div>
              {ordersLoading ? (
                <div className="divide-y divide-border">
                  {Array.from({ length: 4 }, (_, i) => (
                    <OrderRowSkeleton key={i} />
                  ))}
                </div>
              ) : orders.length === 0 ? (
                <OrdersEmptyState />
              ) : (
                <div className="divide-y divide-border">
                  {orders.map((order, i) => (
                    <OrderRow key={order.id} order={order} index={i} />
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Quick actions */}
          <div>
            <Card>
              <div
                className="border-b px-6 py-4"
                style={{ borderColor: 'var(--card-border)' }}
              >
                <h2 className="text-sm font-semibold text-fg">{t.dashboard.quickActions}</h2>
              </div>
              <div className="grid grid-cols-2 gap-3 p-4">
                {quickActions.map((action) => (
                  <QuickActionTile key={action.label} action={action} />
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
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  <h2 className="text-sm font-semibold text-fg">{t.dashboard.inventoryAlerts}</h2>
                </div>
                <a href={alertsHref} className="text-xs text-info hover:underline">
                  {t.dashboard.viewAll}
                </a>
              </div>
              <div className="divide-y divide-border">
                {alerts?.expired.slice(0, 3).map((a) => (
                  <a
                    key={a.stockItemId}
                    href="/inventory"
                    className="row-hover flex items-center justify-between px-6 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-danger/10 dark:bg-danger/15">
                        <AlertTriangle className="h-4 w-4 text-danger" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-fg">
                          {variantNameMap.get(a.variantId) ?? a.variantId.slice(0, 8)}
                        </p>
                        <p className="text-xs text-muted">{t.inventory.expiredLabel} · {t.inventory.quantity.replace('{n}', String(a.quantity))}</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger dark:bg-danger/15">
                      {t.dashboard.expiredBadge}
                    </span>
                  </a>
                ))}
                {alerts?.expiringSoon.slice(0, 3).map((a) => (
                  <a
                    key={a.stockItemId}
                    href="/inventory"
                    className="row-hover flex items-center justify-between px-6 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-warning/10 dark:bg-warning/15">
                        <AlertTriangle className="h-4 w-4 text-warning" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-fg">
                          {variantNameMap.get(a.variantId) ?? a.variantId.slice(0, 8)}
                        </p>
                        <p className="text-xs text-muted">{t.inventory.expiresIn.replace('{days}', String(a.daysUntilExpiry))} · {t.inventory.quantity.replace('{n}', String(a.quantity))}</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning dark:bg-warning/15">
                      {t.dashboard.expiringSoon}
                    </span>
                  </a>
                ))}
                {alerts?.lowStock.slice(0, 3).map((a) => (
                  <a
                    key={a.stockItemId}
                    href="/inventory"
                    className="row-hover flex items-center justify-between px-6 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-warning/10 dark:bg-warning/15">
                        <Package className="h-4 w-4 text-warning" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-fg">
                          {variantNameMap.get(a.variantId) ?? a.variantId.slice(0, 8)}
                        </p>
                        <p className="text-xs text-muted">{t.inventory.quantity.replace('{n}', String(a.quantity))} · {t.inventory.reorderPoint.replace('{n}', String(a.reorderPoint))}</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning dark:bg-warning/15">
                      {t.dashboard.lowStockBadge}
                    </span>
                  </a>
                ))}
                {lowMaterials.slice(0, 3).map((m) => (
                  <a
                    key={m.id}
                    href="/stock-materials?lowStock=1"
                    className="row-hover flex items-center justify-between px-6 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-warning/15">
                        <FlaskConical className="h-4 w-4 text-warning" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-fg">{m.nameAr}</p>
                        <p className="text-xs text-muted">
                          <span className={m.currentQuantityInStorageUnits < 0 ? 'text-danger' : undefined}>
                            {m.currentQuantityInStorageUnits.toLocaleString('ar-SA')} {m.storageUnit}
                          </span>
                          {m.reorderLevel != null && ` · حد الطلب ${m.reorderLevel.toLocaleString('ar-SA')}`}
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
                      {m.currentQuantityInStorageUnits <= 0 ? 'نفدت المادة' : 'مادة خام منخفضة'}
                    </span>
                  </a>
                ))}
                {lowMaterialsCount > 3 && (
                  <a href="/stock-materials?lowStock=1" className="row-hover block px-6 py-2.5 text-center text-xs font-medium text-info">
                    و{(lowMaterialsCount - 3).toLocaleString('ar-SA')} مواد أخرى تحت حد الطلب
                  </a>
                )}
              </div>
            </Card>
          </div>
        )}

      </div>
    </div>
  )
}
