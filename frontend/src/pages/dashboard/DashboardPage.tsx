import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
  Banknote,
  CreditCard,
  Landmark,
  Ticket,
  PartyPopper,
  Coffee,
  Store,
  ShoppingBag,
  BarChart2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { cn, formatCurrency } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { ordersApi } from '@/api/orders'
import type { OrderResponse, BusinessType, PaymentMethod } from '@/types/api'
import { customersApi } from '@/api/customers'
import { inventoryApi } from '@/api/inventory'
import { catalogApi } from '@/api/catalog'

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
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
            <span className={cn('inline-block', settled && 'count-pop')}>{fmt(animated)}</span>
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
  label: string
  badge: 'green' | 'blue' | 'purple' | 'orange'
  Icon: LucideIcon
  iconWrap: string
  iconColor: string
}> = {
  Cash:         { label: 'نقدًا',        badge: 'green',  Icon: Banknote,   iconWrap: 'bg-emerald-50 dark:bg-emerald-900/30', iconColor: 'text-emerald-600' },
  Card:         { label: 'بطاقة',       badge: 'blue',   Icon: CreditCard, iconWrap: 'bg-blue-50 dark:bg-blue-900/30',       iconColor: 'text-blue-600'    },
  BankTransfer: { label: 'تحويل بنكي', badge: 'purple', Icon: Landmark,   iconWrap: 'bg-violet-50 dark:bg-violet-900/30',   iconColor: 'text-violet-600'  },
  Voucher:      { label: 'قسيمة',       badge: 'orange', Icon: Ticket,     iconWrap: 'bg-amber-50 dark:bg-amber-900/30',     iconColor: 'text-amber-600'   },
}

function formatOrderTime(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('ar-SA', { hour: 'numeric', minute: '2-digit' }).format(d)
}

function productCountLabel(n: number): string {
  if (n === 1) return 'منتج واحد'
  if (n === 2) return 'منتجان'
  if (n >= 3 && n <= 10) return `${n} منتجات`
  return `${n} منتجًا`
}

function OrderRow({ order, index }: { order: OrderResponse; index: number }) {
  const pay = order.paymentMethod ? PAYMENT_META[order.paymentMethod] : undefined
  const Icon = pay?.Icon ?? ShoppingCart
  const time = formatOrderTime(order.completedAt ?? order.createdAt)

  return (
    <div
      className="row-enter row-hover flex items-center justify-between px-6 py-3.5"
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
            pay?.iconWrap ?? 'bg-blue-50 dark:bg-blue-900/30',
          )}
          title={pay?.label}
        >
          <Icon className={cn('h-4 w-4', pay?.iconColor ?? 'text-blue-600')} />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
            #{order.id.slice(0, 8).toUpperCase()}
          </p>
          <p className="text-xs text-gray-500">
            {productCountLabel(order.lines.length)}
            {time && <span> · {time}</span>}
          </p>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <p className="text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">
          {formatCurrency(order.totalAmount)}
        </p>
        {pay ? <Badge variant={pay.badge}>{pay.label}</Badge> : <Badge variant="green">مكتمل</Badge>}
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
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <EmptyOrdersIllustration />
      <p className="mt-5 text-sm font-bold text-gray-800 dark:text-gray-100">
        لا توجد طلبات بعد — يومك يبدأ الآن
      </p>
      <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-gray-500 dark:text-gray-400">
        بمجرد إتمام أول عملية بيع ستنبض هذه اللوحة بالأرقام، وفي انتظارك مفاجأة صغيرة 🎈
      </p>
      <a href="/pos" className="mt-5">
        <button className="btn-3d btn-shimmer inline-flex items-center gap-2 px-5 py-2.5 text-sm">
          <ShoppingCart className="h-4 w-4" />
          ابدأ أول بيع
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
    { label: 'التقارير',  icon: <BarChart2    className="h-5 w-5" />, to: '/reports',  color: 'text-orange-600', wrap: 'bg-orange-50 dark:bg-orange-900/30' },
  ],
  Cafe: [
    { label: 'طلب جديد',  icon: <ShoppingCart    className="h-5 w-5" />, to: '/pos',        color: 'text-blue-600',   wrap: 'bg-blue-50 dark:bg-blue-900/30'     },
    { label: 'المقهى',    icon: <Coffee          className="h-5 w-5" />, to: '/restaurant', color: 'text-amber-600',  wrap: 'bg-amber-50 dark:bg-amber-900/30'   },
    { label: 'العملاء',   icon: <Users           className="h-5 w-5" />, to: '/customers',  color: 'text-green-600',  wrap: 'bg-green-50 dark:bg-green-900/30'   },
    { label: 'التقارير',  icon: <BarChart2       className="h-5 w-5" />, to: '/reports',    color: 'text-purple-600', wrap: 'bg-purple-50 dark:bg-purple-900/30' },
  ],
  Retail: [
    { label: 'بيع جديد',  icon: <ShoppingCart className="h-5 w-5" />, to: '/pos',       color: 'text-blue-600',   wrap: 'bg-blue-50 dark:bg-blue-900/30'     },
    { label: 'المنتجات',  icon: <Store        className="h-5 w-5" />, to: '/products',  color: 'text-pink-600',   wrap: 'bg-pink-50 dark:bg-pink-900/30'     },
    { label: 'العملاء',   icon: <Users        className="h-5 w-5" />, to: '/customers', color: 'text-green-600',  wrap: 'bg-green-50 dark:bg-green-900/30'   },
    { label: 'التقارير',  icon: <BarChart2    className="h-5 w-5" />, to: '/reports',   color: 'text-purple-600', wrap: 'bg-purple-50 dark:bg-purple-900/30' },
  ],
  Supermarket: [
    { label: 'بيع جديد',  icon: <ShoppingCart className="h-5 w-5" />, to: '/pos',       color: 'text-blue-600',   wrap: 'bg-blue-50 dark:bg-blue-900/30'     },
    { label: 'المنتجات',  icon: <Package      className="h-5 w-5" />, to: '/products',  color: 'text-emerald-600',wrap: 'bg-emerald-50 dark:bg-emerald-900/30'},
    { label: 'المشتريات', icon: <ShoppingBag  className="h-5 w-5" />, to: '/purchasing',color: 'text-orange-600', wrap: 'bg-orange-50 dark:bg-orange-900/30' },
    { label: 'التقارير',  icon: <BarChart2    className="h-5 w-5" />, to: '/reports',   color: 'text-purple-600', wrap: 'bg-purple-50 dark:bg-purple-900/30' },
  ],
}

const DEFAULT_QUICK_ACTIONS: QuickAction[] = [
  { label: 'بيع جديد',     icon: <ShoppingCart className="h-5 w-5" />, to: '/pos',       color: 'text-blue-600',   wrap: 'bg-blue-50 dark:bg-blue-900/30'     },
  { label: 'إضافة منتج',  icon: <Package      className="h-5 w-5" />, to: '/products',  color: 'text-purple-600', wrap: 'bg-purple-50 dark:bg-purple-900/30' },
  { label: 'إضافة عميل',  icon: <Users        className="h-5 w-5" />, to: '/customers', color: 'text-green-600',  wrap: 'bg-green-50 dark:bg-green-900/30'   },
  { label: 'التقارير',     icon: <BarChart2    className="h-5 w-5" />, to: '/reports',   color: 'text-orange-600', wrap: 'bg-orange-50 dark:bg-orange-900/30' },
]

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
      className="group tilt-card card-3d ripple-host flex flex-col items-center gap-2.5 rounded-xl p-4 text-center"
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
          'rounded-xl p-2.5 transition-transform duration-300 group-hover:scale-110',
          action.wrap,
          action.color,
        )}
      >
        {action.icon}
      </div>
      <span className="text-xs font-medium leading-tight text-gray-700 dark:text-gray-300">
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

const CONFETTI_COLORS = ['#4F7EF7', '#62E6C7', '#F59E0B', '#F472B6', '#A78BFA', '#34D399']

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
              🎉 أول بيع اليوم!
            </span>
            <span className="block text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {amount > 0 ? `بداية موفقة — ${formatCurrency(amount)}. ` : 'بداية موفقة. '}
              يوم رائع بانتظارك
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
  { at: 10000, label: 'تجاوزت ١٠٬٠٠٠ ر.س', emoji: '🏆', color: '#f59e0b' },
  { at: 5000,  label: 'تجاوزت ٥٬٠٠٠ ر.س',  emoji: '🥇', color: '#a855f7' },
  { at: 1000,  label: 'تجاوزت ١٬٠٠٠ ر.س',  emoji: '⭐', color: '#3b82f6' },
] as const

/* ────────────────────────────────────────────────────────────────
   dashboard page
   ──────────────────────────────────────────────────────────────── */

const FALLBACK_REVENUE   = [4, 6, 5, 8, 7, 10, 9]
const FALLBACK_ORDERS    = [2, 3, 2, 4, 3,  5, 4]
const FALLBACK_CUSTOMERS = [2, 3, 3, 4, 5,  5, 6]
const FALLBACK_AVG       = [5, 4, 6, 5, 7,  6, 8]

export function DashboardPage() {
  const { user, branchId, tenantId } = useAuthStore()
  const businessType = user?.businessType as BusinessType | undefined

  const today = localToday()
  const ordersQuery = useQuery({
    queryKey: ['orders', branchId, 'today', today],
    queryFn: () => ordersApi.listOrders(branchId!, {
      status: 'Completed',
      pageSize: 50,
      dateFrom: today,
      dateTo: today,
    }),
    enabled: !!branchId,
    refetchInterval: 60_000,
  })
  const recentOrders = ordersQuery.data
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
    const raw = recentOrders?.data
    const all: OrderResponse[] = Array.isArray(raw) ? raw : ((raw as any)?.items ?? [])
    // Filter client-side by local date — backend may not support dateFrom/dateTo
    return all.filter(o => {
      const d = new Date(o.completedAt ?? o.createdAt)
      return d.toLocaleDateString('en-CA') === today
    })
  }, [recentOrders, today])

  const todayRevenue = orders.reduce((s, o) => s + o.totalAmount, 0)
  const alerts = alertsData?.data

  const nearExpiryCount = (alerts?.expired.length ?? 0) + (alerts?.expiringSoon.length ?? 0)
  const lowStockCount = alerts?.lowStock.length ?? 0
  const hasAlerts = nearExpiryCount > 0 || lowStockCount > 0

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

  const milestone = MILESTONES.find((m) => todayRevenue >= m.at)

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
  const statsLoading = ordersLoading || customersLoading

  return (
    <div className="page-fade min-h-full">
      {celebration && (
        <FirstSaleCelebration amount={celebration.amount} onDone={dismissCelebration} />
      )}

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
                  {ordersLoading ? (
                    <span className="mt-1.5 inline-block h-5 w-20 animate-pulse rounded-md bg-white/25" />
                  ) : (
                    <p className="mt-0.5 text-lg font-bold tabular-nums text-white">{formatCurrency(todayRevenue)}</p>
                  )}
                </div>
                <div className="rounded-xl bg-white/15 px-4 py-2.5 backdrop-blur-sm">
                  <p className="text-xs font-medium text-blue-200">الطلبات</p>
                  {ordersLoading ? (
                    <span className="mt-1.5 inline-block h-5 w-10 animate-pulse rounded-md bg-white/25" />
                  ) : (
                    <p className="mt-0.5 text-lg font-bold tabular-nums text-white">{orders.length}</p>
                  )}
                </div>
                <div className="rounded-xl bg-white/15 px-4 py-2.5 backdrop-blur-sm">
                  <p className="text-xs font-medium text-blue-200">العملاء</p>
                  {customersLoading ? (
                    <span className="mt-1.5 inline-block h-5 w-10 animate-pulse rounded-md bg-white/25" />
                  ) : (
                    <p className="mt-0.5 text-lg font-bold tabular-nums text-white">{customers?.data?.length ?? 0}</p>
                  )}
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
              <button className="btn-shimmer inline-flex items-center gap-2.5 rounded-xl bg-white px-5 py-3 text-sm font-bold text-blue-700 shadow-lg transition-all hover:bg-blue-50 hover:shadow-xl active:scale-95">
                <ShoppingCart className="h-5 w-5" />
                بيع جديد
              </button>
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
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    آخر الطلبات المكتملة
                  </h2>
                  <Badge variant="live">مباشر</Badge>
                </div>
                <a
                  href="/sales"
                  className="flex items-center gap-0.5 text-xs text-blue-600 hover:underline dark:text-blue-400"
                >
                  عرض الكل
                  <ChevronLeft className="h-3 w-3" />
                </a>
              </div>
              {ordersLoading ? (
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {Array.from({ length: 4 }, (_, i) => (
                    <OrderRowSkeleton key={i} />
                  ))}
                </div>
              ) : orders.length === 0 ? (
                <OrdersEmptyState />
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
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
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">إجراءات سريعة</h2>
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
                    className="row-hover flex items-center justify-between px-6 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/40">
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {variantNameMap.get(a.variantId) ?? a.variantId.slice(0, 8)}
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
                    className="row-hover flex items-center justify-between px-6 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/40">
                        <AlertTriangle className="h-4 w-4 text-orange-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {variantNameMap.get(a.variantId) ?? a.variantId.slice(0, 8)}
                        </p>
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
                    className="row-hover flex items-center justify-between px-6 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/40">
                        <Package className="h-4 w-4 text-yellow-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {variantNameMap.get(a.variantId) ?? a.variantId.slice(0, 8)}
                        </p>
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
