import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode, RefObject } from 'react'
import { Card } from '@/components/ui/Card'
import { cn, formatCurrency } from '@/lib/utils'
import type { OrderResponse } from '@/types/api'

/* ═══════════════════════════════════════════════════════════════════════════
   flowin analytics — pure SVG + CSS charts
   1. Revenue Wave      (daily revenue / net, flowing water)
   2. Hour Wheel        (24 radial bars, sonar-style pulse ring)
   3. Revenue DNA       (triple concentric rings, Apple-Fitness style)
   4. Product Bars      (gradient pills with glowing leading edge)
   ═══════════════════════════════════════════════════════════════════════════ */

// ── Palette ──────────────────────────────────────────────────────────────────

const TEAL = '#13D9A0'
const TEAL_RGB = '19,217,160'
const ORANGE = '#f97316'
const AMBER = '#f59e0b'
const PRODUCT_COLORS = [TEAL, '#22c55e', '#f59e0b', '#a855f7', '#64748b'] as const
const MUTED = 'var(--color-text-muted, #9ca3af)'
const INK = 'var(--color-text, currentColor)'
/** teal that stays legible as *text* on white cards */
const TEAL_INK = `color-mix(in srgb, ${TEAL} 72%, var(--color-text, #111))`

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  orders: OrderResponse[]
  stats: { totalSubtotal: number; totalTax: number; totalCogs: number }
  returnTotal: number
}

// ── Data builders ────────────────────────────────────────────────────────────

interface DailyPoint {
  date: string
  label: string
  fullLabel: string
  revenue: number
  net: number
  orders: number
}

interface HourlyPoint { hour: number; label: string; orders: number; revenue: number }

interface ProductPoint { name: string; revenue: number; qty: number; color: string }

const DAY_FMT = new Intl.DateTimeFormat('ar-u-ca-gregory-nu-latn', {
  weekday: 'short', day: 'numeric', month: 'short',
})

function dayKey(d: Date): string {
  return d.toLocaleDateString('en-CA')
}

function makeDay(d: Date): DailyPoint {
  return {
    date: dayKey(d),
    label: `${d.getDate()}/${d.getMonth() + 1}`,
    fullLabel: DAY_FMT.format(d),
    revenue: 0, net: 0, orders: 0,
  }
}

/** Group orders by calendar day. Days without sales between the first and last
 *  order are filled with zeros so the wave shows real dips (closed days). */
function buildDailyData(orders: OrderResponse[]): DailyPoint[] {
  const map = new Map<string, DailyPoint>()
  for (const o of orders) {
    const d = new Date(o.completedAt ?? o.createdAt)
    const key = dayKey(d)
    const cogs = o.lines.reduce((s, l) => s + (l.costPrice ?? 0) * l.quantity, 0)
    const p = map.get(key) ?? makeDay(d)
    p.revenue = +(p.revenue + o.subtotalAmount).toFixed(2)
    p.net = +(p.net + Math.max(0, o.subtotalAmount - cogs)).toFixed(2)
    p.orders += 1
    map.set(key, p)
  }
  const sorted = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date))
  if (sorted.length < 2) return sorted

  // fill the gaps (bounded, so a bad date can never explode the array)
  const out: DailyPoint[] = []
  const cursor = new Date(`${sorted[0].date}T12:00:00`)
  const last = sorted[sorted.length - 1].date
  let i = 0
  let guard = 0
  while (guard++ < 400) {
    const key = dayKey(cursor)
    if (sorted[i]?.date === key) out.push(sorted[i++])
    else out.push(makeDay(cursor))
    if (key === last) break
    cursor.setDate(cursor.getDate() + 1)
  }
  return out
}

function hourLabel(h: number): string {
  return h === 0 ? '12ص' : h < 12 ? `${h}ص` : h === 12 ? '12م' : `${h - 12}م`
}

function buildHourlyData(orders: OrderResponse[]): HourlyPoint[] {
  const counts: HourlyPoint[] = Array.from({ length: 24 }, (_, h) => ({
    hour: h, label: hourLabel(h), orders: 0, revenue: 0,
  }))
  for (const o of orders) {
    const h = new Date(o.completedAt ?? o.createdAt).getHours()
    counts[h].orders += 1
    counts[h].revenue += o.subtotalAmount
  }
  return counts
}

function buildProductData(orders: OrderResponse[], limit = 8): ProductPoint[] {
  const map = new Map<string, { name: string; revenue: number; qty: number }>()
  for (const o of orders) {
    for (const l of o.lines) {
      const prev = map.get(l.productName) ?? { name: l.productName, revenue: 0, qty: 0 }
      prev.revenue += l.lineTotal
      prev.qty += l.quantity
      map.set(l.productName, prev)
    }
  }
  return Array.from(map.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit)
    .map((p, i) => ({ ...p, color: PRODUCT_COLORS[Math.min(i, PRODUCT_COLORS.length - 1)] }))
}

// ── Formatting / math helpers ────────────────────────────────────────────────

function fmtCompact(v: number): string {
  const a = Math.abs(v)
  if (a >= 1e6) return `${(v / 1e6).toFixed(1)}M`
  if (a >= 1e4) return `${(v / 1e3).toFixed(0)}k`
  if (a >= 1e3) return `${(v / 1e3).toFixed(1)}k`
  return String(Math.round(v))
}

function pct(part: number, whole: number): number {
  return whole > 0 ? (part / whole) * 100 : 0
}

/** Round a maximum up to a "nice" axis ceiling (1 / 2 / 2.5 / 5 × 10ⁿ). */
function niceCeil(v: number): number {
  if (!(v > 0)) return 1
  const base = Math.pow(10, Math.floor(Math.log10(v)))
  const f = v / base
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10
  return nf * base
}

const r2 = (v: number) => Math.round(v * 100) / 100

interface Pt { x: number; y: number }

/** Monotone cubic interpolation (Fritsch–Carlson): silky curve, never overshoots. */
function monotonePath(pts: Pt[]): string {
  const n = pts.length
  if (n === 0) return ''
  if (n === 1) return `M${r2(pts[0].x)},${r2(pts[0].y)}`
  if (n === 2) return `M${r2(pts[0].x)},${r2(pts[0].y)}L${r2(pts[1].x)},${r2(pts[1].y)}`

  const dx: number[] = [], m: number[] = []
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1].x - pts[i].x || 1e-6
    m[i] = (pts[i + 1].y - pts[i].y) / dx[i]
  }
  const t: number[] = new Array<number>(n)
  t[0] = m[0]
  t[n - 1] = m[n - 2]
  for (let i = 1; i < n - 1; i++) {
    if (m[i - 1] * m[i] <= 0) { t[i] = 0; continue }
    const w1 = 2 * dx[i] + dx[i - 1]
    const w2 = dx[i] + 2 * dx[i - 1]
    t[i] = (w1 + w2) / (w1 / m[i - 1] + w2 / m[i])
  }
  let d = `M${r2(pts[0].x)},${r2(pts[0].y)}`
  for (let i = 0; i < n - 1; i++) {
    const c1x = pts[i].x + dx[i] / 3, c1y = pts[i].y + (t[i] * dx[i]) / 3
    const c2x = pts[i + 1].x - dx[i] / 3, c2y = pts[i + 1].y - (t[i + 1] * dx[i]) / 3
    d += `C${r2(c1x)},${r2(c1y)} ${r2(c2x)},${r2(c2y)} ${r2(pts[i + 1].x)},${r2(pts[i + 1].y)}`
  }
  return d
}

function polar(cx: number, cy: number, r: number, hour: number): Pt {
  const a = (hour / 24) * Math.PI * 2 - Math.PI / 2
  return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }
}

// ── Hooks ────────────────────────────────────────────────────────────────────

const REDUCED_MQ = '(prefers-reduced-motion: reduce)'

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(REDUCED_MQ).matches
      : false,
  )
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(REDUCED_MQ)
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

/**
 * Mount-animation driver. Flips to `true` one frame after mount so every
 * CSS transition runs from its "hidden" initial state to the real value.
 * With reduced motion it is `true` immediately (no sweep).
 */
function useEntered(reduced: boolean): boolean {
  const [entered, setEntered] = useState(reduced)
  const raf = useRef<number>(0)
  useEffect(() => {
    if (reduced) { setEntered(true); return }
    raf.current = requestAnimationFrame(() => {
      raf.current = requestAnimationFrame(() => setEntered(true))
    })
    return () => cancelAnimationFrame(raf.current)
  }, [reduced])
  return entered
}

interface Box { width: number; height: number; rtl: boolean }

/** ResizeObserver-backed measurement of a wrapper element (+ its text direction). */
function useMeasure<T extends HTMLElement>(): [RefObject<T | null>, Box] {
  const ref = useRef<T>(null)
  const [box, setBox] = useState<Box>({ width: 0, height: 0, rtl: true })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const rect = el.getBoundingClientRect()
      const rtl = getComputedStyle(el).direction === 'rtl'
      setBox(prev =>
        prev.width === rect.width && prev.height === rect.height && prev.rtl === rtl
          ? prev
          : { width: rect.width, height: rect.height, rtl },
      )
    }
    update()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update)
      return () => window.removeEventListener('resize', update)
    }
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, box]
}

/** Pointer position relative to the chart wrapper (the `relative` div). */
function localPoint(e: ReactPointerEvent<Element>, wrapper: HTMLElement | null): Pt {
  const rect = (wrapper ?? e.currentTarget).getBoundingClientRect()
  return { x: e.clientX - rect.left, y: e.clientY - rect.top }
}

// ── Tooltip ──────────────────────────────────────────────────────────────────

const TT_STYLE: CSSProperties = {
  position: 'absolute',
  background: 'rgba(17,19,24,0.92)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: '1px solid rgba(19,217,160,0.25)',
  borderRadius: '10px',
  padding: '8px 12px',
  fontSize: '12px',
  color: 'white',
  pointerEvents: 'none',
  direction: 'rtl',
  whiteSpace: 'nowrap',
  zIndex: 50,
  boxShadow: '0 10px 30px rgba(0,0,0,0.35), 0 0 0 1px rgba(19,217,160,0.06)',
  lineHeight: 1.45,
}

/** Floating tooltip clamped inside its `relative` parent. */
function FloatingTip({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    const parent = el?.parentElement
    if (!el || !parent) return
    const w = el.offsetWidth, h = el.offsetHeight
    const pw = parent.clientWidth, ph = parent.clientHeight
    let left = x - w / 2
    let top = y - h - 14
    if (left < 4) left = 4
    if (left + w > pw - 4) left = Math.max(4, pw - w - 4)
    if (top < 2) top = Math.min(y + 18, ph - h - 2)
    el.style.left = `${left}px`
    el.style.top = `${top}px`
  }, [x, y, children])
  return <div ref={ref} style={{ ...TT_STYLE, left: x, top: y }}>{children}</div>
}

function TipTitle({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginBottom: 4 }}>{children}</div>
}

function TipRow({ color, label, value, dashed }: { color: string; label: string; value: string; dashed?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.75)' }}>
        <span style={{
          width: 8, height: 8, borderRadius: 99, flexShrink: 0,
          background: dashed ? 'transparent' : color,
          border: dashed ? `2px dashed ${color}` : 'none',
          boxShadow: dashed ? 'none' : `0 0 8px ${color}`,
        }} />
        {label}
      </span>
      <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  )
}

// ── Card header ──────────────────────────────────────────────────────────────

function ChartHeader({ title, subtitle, aside }: { title: string; subtitle: string; aside?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b px-5 py-4" style={{ borderColor: 'var(--card-border)' }}>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
        <p className="mt-0.5 text-xs text-gray-400">{subtitle}</p>
      </div>
      {aside && <div className="shrink-0 text-xs text-gray-400 tabular-nums">{aside}</div>}
    </div>
  )
}

/** Small stat chip used in card headers (teal-tinted). */
function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1"
      style={{ background: `rgba(${TEAL_RGB},0.10)`, border: `1px solid rgba(${TEAL_RGB},0.22)` }}
    >
      <span style={{ color: MUTED }}>{label}</span>
      <span className="font-semibold" style={{ color: TEAL_INK }}>{value}</span>
    </span>
  )
}

// ── Keyframes (scoped by the fw- prefix) ─────────────────────────────────────

const KEYFRAMES = `
@keyframes fw-drift-a { from { transform: translateX(-7px) } to { transform: translateX(7px) } }
@keyframes fw-drift-b { from { transform: translateX(6px) }  to { transform: translateX(-6px) } }
@keyframes fw-sweep   { to { transform: rotate(360deg) } }
@keyframes fw-pulse   { 0%,100% { transform: scale(0.94); opacity: .28 } 50% { transform: scale(1.06); opacity: .55 } }
@keyframes fw-calm    { to { transform: translateX(-400px) } }
@keyframes fw-rise    { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
.fw-drift-a { animation: fw-drift-a 7s ease-in-out infinite alternate; }
.fw-drift-b { animation: fw-drift-b 9s ease-in-out infinite alternate; }
.fw-sweep   { animation: fw-sweep 9s linear infinite; }
.fw-pulse   { animation: fw-pulse 3.2s ease-in-out infinite; }
.fw-calm    { animation: fw-calm 14s linear infinite; }
.fw-calm-slow { animation: fw-calm 22s linear infinite; }
.fw-rise    { animation: fw-rise .5s cubic-bezier(.22,1,.36,1) both; }
@media (prefers-reduced-motion: reduce) {
  .fw-drift-a, .fw-drift-b, .fw-sweep, .fw-pulse, .fw-calm, .fw-calm-slow, .fw-rise { animation: none !important; }
}
`

/** Sanitised useId → safe inside url(#…) references. */
function useSvgId(prefix: string): string {
  return `${prefix}${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
}

/** `true` once `active` has been true for `ms` (used to drop dash tricks after a sweep). */
function useDelayedFlag(active: boolean, ms: number): boolean {
  const [flag, setFlag] = useState(false)
  useEffect(() => {
    if (!active) { setFlag(false); return }
    const t = window.setTimeout(() => setFlag(true), ms)
    return () => window.clearTimeout(t)
  }, [active, ms])
  return flag
}

// ── Calm waves (empty-state illustration) ────────────────────────────────────

/** Periodic wave path: one period = 400 user units, drawn twice so a -400px
 *  translation loops seamlessly. */
function waveCurve(amp: number, y: number): string {
  let d = `M0,${y}`
  for (let k = 0; k < 2; k++) {
    const o = k * 400
    d += ` C${o + 60},${y - amp} ${o + 140},${y - amp} ${o + 200},${y}`
    d += ` C${o + 260},${y + amp} ${o + 340},${y + amp} ${o + 400},${y}`
  }
  return d
}

function wavePath(amp: number, y: number, floor: number): string {
  return `${waveCurve(amp, y)} L800,${floor} L0,${floor} Z`
}

function CalmWaves({ reduced, message, hint, height = 190 }: {
  reduced: boolean; message: string; hint?: string; height?: number
}) {
  const id = useSvgId('fwcalm')
  const anim = (cls: string) => (reduced ? undefined : cls)
  return (
    <div className="relative overflow-hidden" style={{ height }}>
      <svg
        viewBox="0 0 400 140"
        preserveAspectRatio="none"
        className="absolute inset-x-0 bottom-0 h-[62%] w-full"
        style={{ direction: 'ltr' }}
        aria-hidden
      >
        <defs>
          <linearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={TEAL} stopOpacity={0.55} />
            <stop offset="100%" stopColor={TEAL} stopOpacity={0} />
          </linearGradient>
        </defs>
        <g className={anim('fw-calm-slow')} style={{ opacity: 0.22 }}>
          <path d={wavePath(9, 44, 140)} fill={`url(#${id}-g)`} />
        </g>
        <g className={anim('fw-calm')} style={{ opacity: 0.35 }}>
          <path d={wavePath(12, 64, 140)} fill={`url(#${id}-g)`} />
          <path d={waveCurve(12, 64)} fill="none" stroke={TEAL} strokeWidth={1.4}
            strokeOpacity={0.9} vectorEffect="non-scaling-stroke"
            style={{ filter: `drop-shadow(0 0 5px rgba(${TEAL_RGB},0.8))` }} />
        </g>
        <g className={anim('fw-calm-slow')} style={{ opacity: 0.5, animationDirection: 'reverse' }}>
          <path d={wavePath(7, 92, 140)} fill={`url(#${id}-g)`} />
        </g>
      </svg>
      <div className="absolute inset-x-0 top-0 flex flex-col items-center gap-1 pt-7 text-center">
        <span
          className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-full"
          style={{ background: `rgba(${TEAL_RGB},0.10)`, border: `1px solid rgba(${TEAL_RGB},0.25)` }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth="1.8" strokeLinecap="round">
            <path d="M3 12c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 3 2" />
            <path d="M3 17c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 3 2" opacity=".5" />
          </svg>
        </span>
        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{message}</p>
        {hint && <p className="text-xs text-gray-400">{hint}</p>}
      </div>
    </div>
  )
}

// ── 1 · Revenue Wave ─────────────────────────────────────────────────────────

const WAVE_H = 236
const WAVE_PAD = { top: 20, right: 54, bottom: 28, left: 12 } as const

interface WaveHover { i: number; px: number; py: number }

function RevenueWave({ data, reduced }: { data: DailyPoint[]; reduced: boolean }) {
  const id = useSvgId('fwwave')
  const [wrapRef, box] = useMeasure<HTMLDivElement>()
  const entered = useEntered(reduced)
  const settled = useDelayedFlag(entered, 1800)
  const [hover, setHover] = useState<WaveHover | null>(null)

  const W = Math.max(box.width, 320)
  const scale = box.width > 0 ? Math.min(1, box.width / W) : 1
  const plotW = W - WAVE_PAD.left - WAVE_PAD.right
  const plotH = WAVE_H - WAVE_PAD.top - WAVE_PAD.bottom
  const yBase = WAVE_PAD.top + plotH

  const geo = useMemo(() => {
    const n = data.length
    const yMax = niceCeil(Math.max(0, ...data.map(d => d.revenue)))
    const xAt = (i: number) => WAVE_PAD.left + (n > 1 ? (i / (n - 1)) * plotW : plotW / 2)
    const yAt = (v: number) => WAVE_PAD.top + (1 - v / yMax) * plotH
    const revPts = data.map((d, i) => ({ x: xAt(i), y: yAt(d.revenue) }))
    const netPts = data.map((d, i) => ({ x: xAt(i), y: yAt(d.net) }))
    const line = monotonePath(revPts)
    const area = n > 0
      ? `${line}L${r2(revPts[n - 1].x)},${yBase}L${r2(revPts[0].x)},${yBase}Z`
      : ''
    const netLine = monotonePath(netPts)
    const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => ({ v: yMax * f, y: yAt(yMax * f) }))

    // x labels: evenly thinned, always ending with the last day
    const step = Math.max(1, Math.ceil(n / Math.max(3, Math.floor(plotW / 58))))
    const shown = new Set<number>()
    for (let i = 0; i < n; i += step) shown.add(i)
    if (!shown.has(n - 1)) {
      const prev = Math.floor((n - 1) / step) * step
      if ((n - 1) - prev < step / 2) shown.delete(prev)
      shown.add(n - 1)
    }
    const xLabels = data.map((d, i) => ({ x: xAt(i), label: d.label, show: shown.has(i) }))
    return { revPts, netPts, line, area, netLine, ticks, xLabels }
  }, [data, plotW, plotH, yBase])

  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const n = data.length
    if (n === 0) return
    const { x } = localPoint(e, wrapRef.current)
    const ux = x / scale
    const i = Math.max(0, Math.min(n - 1, Math.round(((ux - WAVE_PAD.left) / plotW) * (n - 1))))
    const p = geo.revPts[i]
    setHover(prev => (prev?.i === i ? prev : { i, px: p.x * scale, py: p.y * scale }))
  }

  const glow = `drop-shadow(0 0 6px rgba(${TEAL_RGB},0.75))`
  const hp = hover ? data[hover.i] : null

  return (
    <div
      ref={wrapRef}
      className="relative select-none"
      style={{ height: WAVE_H, touchAction: 'pan-y' }}
      onPointerMove={onMove}
      onPointerLeave={() => setHover(null)}
    >
      <svg
        width="100%"
        height={WAVE_H}
        viewBox={`0 0 ${W} ${WAVE_H}`}
        style={{ direction: 'ltr', display: 'block', overflow: 'visible' }}
        role="img"
        aria-label="موجة الإيرادات اليومية"
      >
        <defs>
          <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={TEAL} stopOpacity={0.40} />
            <stop offset="55%" stopColor={TEAL} stopOpacity={0.13} />
            <stop offset="100%" stopColor={TEAL} stopOpacity={0} />
          </linearGradient>
          <linearGradient id={`${id}-ghost`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={TEAL} stopOpacity={0.18} />
            <stop offset="100%" stopColor={TEAL} stopOpacity={0} />
          </linearGradient>
          <clipPath id={`${id}-clip`}>
            <rect x={WAVE_PAD.left - 10} y={0} width={plotW + 20} height={yBase} />
          </clipPath>
        </defs>

        {/* grid + y axis (right side, terminal style) */}
        {geo.ticks.map((t, k) => (
          <g key={k}>
            <line
              x1={WAVE_PAD.left} x2={W - WAVE_PAD.right + 6} y1={t.y} y2={t.y}
              stroke="currentColor" strokeOpacity={k === 0 ? 0.16 : 0.07} strokeDasharray={k === 0 ? undefined : '3 5'}
            />
            <text x={W - WAVE_PAD.right + 12} y={t.y + 3.5} fontSize={10} fill={MUTED} textAnchor="start">
              {fmtCompact(t.v)}
            </text>
          </g>
        ))}

        {/* water body: two drifting ghost waves under the real fill */}
        <g clipPath={`url(#${id}-clip)`} style={{ opacity: entered ? 1 : 0, transition: 'opacity 1.2s ease .4s' }}>
          <g className={reduced ? undefined : 'fw-drift-a'}>
            <path d={geo.area} fill={`url(#${id}-ghost)`} transform="translate(0 7)" />
          </g>
          <g className={reduced ? undefined : 'fw-drift-b'}>
            <path d={geo.area} fill={`url(#${id}-ghost)`} transform="translate(0 14)" />
          </g>
          <path d={geo.area} fill={`url(#${id}-fill)`} />
        </g>

        {/* net (dashed) */}
        <path
          d={geo.netLine} fill="none" stroke={INK} strokeOpacity={0.55} strokeWidth={1.5}
          strokeDasharray="5 4" strokeLinecap="round"
          style={{ opacity: entered ? 1 : 0, transition: 'opacity .9s ease 1s' }}
        />

        {/* revenue line — draws itself in, then glows */}
        <path
          d={geo.line} fill="none" stroke={TEAL} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
          pathLength={settled ? undefined : 1}
          strokeDasharray={settled ? undefined : '1 2'}
          style={{
            strokeDashoffset: settled ? undefined : entered ? 0 : 1,
            transition: 'stroke-dashoffset 1.6s cubic-bezier(.22,1,.36,1)',
            filter: glow,
          }}
        />

        {/* x labels */}
        {geo.xLabels.filter(l => l.show).map(l => (
          <text key={l.x} x={l.x} y={WAVE_H - 8} fontSize={10.5} fill={MUTED} textAnchor="middle">{l.label}</text>
        ))}

        {/* crosshair */}
        {hover && (
          <g>
            <line
              x1={geo.revPts[hover.i].x} x2={geo.revPts[hover.i].x} y1={WAVE_PAD.top - 6} y2={yBase}
              stroke={TEAL} strokeOpacity={0.6} strokeDasharray="2 3"
            />
            <circle cx={geo.netPts[hover.i].x} cy={geo.netPts[hover.i].y} r={3.5}
              fill="var(--color-surface, #fff)" stroke={INK} strokeOpacity={0.75} strokeWidth={1.5} />
            <circle cx={geo.revPts[hover.i].x} cy={geo.revPts[hover.i].y} r={10} fill={TEAL} fillOpacity={0.16} />
            <circle cx={geo.revPts[hover.i].x} cy={geo.revPts[hover.i].y} r={4.5}
              fill={TEAL} stroke="var(--color-surface, #fff)" strokeWidth={2} style={{ filter: glow }} />
          </g>
        )}
      </svg>

      {hover && hp && (
        <FloatingTip x={hover.px} y={hover.py}>
          <TipTitle>{hp.fullLabel}</TipTitle>
          <TipRow color={TEAL} label="الإيرادات" value={formatCurrency(hp.revenue)} />
          <TipRow color="#e5e7eb" label="الصافي" value={formatCurrency(hp.net)} dashed />
          <div style={{ marginTop: 4, fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
            {hp.orders} طلب
          </div>
        </FloatingTip>
      )}
    </div>
  )
}

// ── 2 · Hour Wheel (pulse ring) ──────────────────────────────────────────────

const WHEEL = { size: 280, cx: 140, cy: 140, rOut: 104, maxLen: 60, minLen: 5 } as const
const WHEEL_LABEL_HOURS = [0, 3, 6, 9, 12, 15, 18, 21]

interface WheelHover { h: number; px: number; py: number }

function HourWheel({ data, reduced }: { data: HourlyPoint[]; reduced: boolean }) {
  const id = useSvgId('fwwheel')
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const entered = useEntered(reduced)
  const settled = useDelayedFlag(entered, 2200)
  const [hover, setHover] = useState<WheelHover | null>(null)

  const { size, cx, cy, rOut, maxLen, minLen } = WHEEL
  const rCore = rOut - maxLen - 8

  const { bars, peak, maxOrders, active } = useMemo(() => {
    const maxOrders = Math.max(1, ...data.map(d => d.orders))
    const peak = data.reduce((a, b) => (b.orders > a.orders ? b : a), data[0])
    const active = data.filter(d => d.orders > 0).length
    const bars = data.map(d => {
      const t = d.orders / maxOrders
      const len = d.orders === 0 ? minLen : minLen + Math.pow(t, 0.85) * (maxLen - minLen)
      const a = polar(cx, cy, rOut, d.hour)
      const b = polar(cx, cy, rOut - len, d.hour)
      const ha = polar(cx, cy, rOut + 8, d.hour)
      const hb = polar(cx, cy, rCore + 2, d.hour)
      return {
        ...d, t, len,
        d: `M${r2(a.x)},${r2(a.y)}L${r2(b.x)},${r2(b.y)}`,
        hit: `M${r2(ha.x)},${r2(ha.y)}L${r2(hb.x)},${r2(hb.y)}`,
        glow: d.orders > 0 && t >= 0.66,
      }
    })
    return { bars, peak, maxOrders, active }
  }, [data, cx, cy, rOut, maxLen, minLen, rCore])

  /** Anchor the tooltip to the middle of the hovered bar (SVG units → px). */
  const place = (hour: number, len: number) => {
    const svg = svgRef.current, wrap = wrapRef.current
    if (!svg || !wrap) return
    const sr = svg.getBoundingClientRect(), wr = wrap.getBoundingClientRect()
    const s = sr.width / size
    const mid = polar(cx, cy, rOut - len / 2, hour)
    setHover({ h: hour, px: sr.left - wr.left + mid.x * s, py: sr.top - wr.top + mid.y * s })
  }

  const hp = hover ? data[hover.h] : null
  const hasData = peak.orders > 0

  return (
    <div className="flex flex-col items-center">
      <div ref={wrapRef} className="relative w-full max-w-[290px] select-none">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${size} ${size}`}
          className="block w-full"
          style={{ direction: 'ltr', overflow: 'visible' }}
          role="img"
          aria-label="توزيع الطلبات حسب ساعات اليوم"
        >
          <defs>
            <linearGradient id={`${id}-sweep`} gradientUnits="userSpaceOnUse" x1={cx} y1={cy} x2={cx} y2={cy - rOut}>
              <stop offset="0" stopColor={TEAL} stopOpacity={0} />
              <stop offset="1" stopColor={TEAL} stopOpacity={0.9} />
            </linearGradient>
            <radialGradient id={`${id}-core`}>
              <stop offset="0%" stopColor={TEAL} stopOpacity={0.26} />
              <stop offset="100%" stopColor={TEAL} stopOpacity={0} />
            </radialGradient>
          </defs>

          {/* dial */}
          <circle cx={cx} cy={cy} r={rOut + 5} fill="none" stroke="currentColor" strokeOpacity={0.10} />
          <circle cx={cx} cy={cy} r={rCore} fill="none" stroke="currentColor" strokeOpacity={0.07} strokeDasharray="2 4" />
          {data.map(d => {
            const p = polar(cx, cy, rOut + 5, d.hour)
            const major = d.hour % 3 === 0
            return (
              <circle key={d.hour} cx={r2(p.x)} cy={r2(p.y)} r={major ? 1.7 : 0.9}
                fill="currentColor" fillOpacity={major ? 0.35 : 0.16} />
            )
          })}

          {/* breathing core + slow radar sweep */}
          <circle
            cx={cx} cy={cy} r={rCore} fill={`url(#${id}-core)`}
            className={reduced || !hasData ? undefined : 'fw-pulse'}
            style={{ transformOrigin: `${cx}px ${cy}px`, opacity: hasData ? undefined : 0.25 }}
          />
          {!reduced && hasData && (
            <g className="fw-sweep" style={{ transformOrigin: `${cx}px ${cy}px` }}>
              <line x1={cx} y1={cy - rCore} x2={cx} y2={cy - rOut - 2}
                stroke={`url(#${id}-sweep)`} strokeWidth={1.3} strokeOpacity={0.4} />
            </g>
          )}

          {/* 24 radial bars, growing inward, sweeping in clockwise */}
          {bars.map((b, i) => {
            const isHover = hover?.h === b.hour
            const baseOpacity = b.orders === 0 ? 0.10 : 0.30 + 0.70 * b.t
            const glowing = isHover || b.glow
            return (
              <g key={b.hour}>
                <path
                  d={b.d} fill="none" stroke={TEAL} strokeLinecap="round"
                  strokeWidth={isHover ? 9 : 7}
                  pathLength={settled ? undefined : 1}
                  strokeDasharray={settled ? undefined : '1 2'}
                  style={{
                    strokeDashoffset: settled ? undefined : entered ? 0 : 1,
                    strokeOpacity: isHover ? 1 : baseOpacity,
                    transition: `stroke-dashoffset .7s cubic-bezier(.22,1,.36,1) ${i * 45}ms, stroke-opacity .25s ease, stroke-width .2s ease`,
                    filter: glowing
                      ? `drop-shadow(0 0 ${isHover ? 8 : 5}px rgba(${TEAL_RGB},${isHover ? 0.95 : 0.75}))`
                      : undefined,
                  }}
                />
                <path
                  d={b.hit} fill="none" stroke="transparent" strokeWidth={15}
                  style={{ cursor: 'default' }}
                  onPointerEnter={() => place(b.hour, b.len)}
                  onPointerLeave={() => setHover(null)}
                />
              </g>
            )
          })}

          {/* hour labels */}
          {WHEEL_LABEL_HOURS.map(h => {
            const p = polar(cx, cy, rOut + 19, h)
            const isPeak = hasData && h === peak.hour
            return (
              <text key={h} x={r2(p.x)} y={r2(p.y) + 3.5} textAnchor="middle" fontSize={10}
                fill={isPeak ? TEAL_INK : MUTED} fontWeight={isPeak ? 700 : 400}>
                {hourLabel(h)}
              </text>
            )
          })}

          {/* centre: peak hour */}
          <text x={cx} y={cy + 1} textAnchor="middle" fontSize={27} fontWeight={800} fill={INK}
            style={{ letterSpacing: '-0.5px' }}>
            {hasData ? peak.label : '—'}
          </text>
          <text x={cx} y={cy + 17} textAnchor="middle" fontSize={10.5} fontWeight={600} fill={TEAL_INK}>
            {hasData ? 'ذروة' : 'لا طلبات'}
          </text>
          {hasData && (
            <text x={cx} y={cy + 30} textAnchor="middle" fontSize={9.5} fill={MUTED}>
              {peak.orders} طلب
            </text>
          )}
        </svg>

        {hover && hp && (
          <FloatingTip x={hover.px} y={hover.py}>
            <TipTitle>الساعة {hp.label}</TipTitle>
            <TipRow color={TEAL} label="الطلبات" value={`${hp.orders} طلب`} />
            <TipRow color="#e5e7eb" label="الإيرادات" value={formatCurrency(hp.revenue)} />
            {hp.orders > 0 && (
              <div style={{ marginTop: 4, fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
                {Math.round((hp.orders / maxOrders) * 100)}% من الذروة
              </div>
            )}
          </FloatingTip>
        )}
      </div>

      <p className="mt-1 text-center text-xs text-gray-400 tabular-nums">
        {hasData
          ? <>{active} ساعة نشطة · إيراد الذروة <span className="font-semibold" style={{ color: TEAL_INK }}>{formatCurrency(peak.revenue)}</span></>
          : 'لا توجد طلبات في هذه الفترة'}
      </p>
    </div>
  )
}

// ── 3 · Revenue DNA (triple ring) ────────────────────────────────────────────

function rgba(hex: string, a: number): string {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  const n = parseInt(full, 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

/** Eased count-up from the current value to `target`, started when `run` is true. */
function useCountUp(target: number, run: boolean, ms: number, reduced: boolean): number {
  const [v, setV] = useState(reduced ? target : 0)
  const cur = useRef(reduced ? target : 0)
  useEffect(() => {
    if (!run) return
    if (reduced) { cur.current = target; setV(target); return }
    const from = cur.current
    const t0 = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / ms)
      const e = 1 - Math.pow(1 - p, 3)
      cur.current = from + (target - from) * e
      setV(cur.current)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, run, ms, reduced])
  return v
}

const RING_SIZE = 200
const RING_C = 100
const RING_W = 14
const RING_RADII = [82, 62, 42] as const

interface RingDatum { key: string; label: string; hint: string; color: string; value: number; frac: number }
interface RingHover { i: number; px?: number; py?: number }

function TripleRing({ rings, margin, gross, returnTotal, reduced }: {
  rings: RingDatum[]; margin: number; gross: number; returnTotal: number; reduced: boolean
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const entered = useEntered(reduced)
  const [hover, setHover] = useState<RingHover | null>(null)
  const shownMargin = useCountUp(margin, entered, 1400, reduced)

  const onRing = (i: number) => (e: ReactPointerEvent<SVGCircleElement>) => {
    const p = localPoint(e, wrapRef.current)
    setHover({ i, px: p.x, py: p.y })
  }
  const hp = hover ? rings[hover.i] : null

  return (
    <div className="flex flex-col items-center">
      <div ref={wrapRef} className="relative w-full max-w-[212px] select-none">
        <svg
          viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
          className="block w-full"
          style={{ direction: 'ltr', overflow: 'visible' }}
          role="img"
          aria-label="تركيبة الإيرادات: الصافي والتكلفة والضريبة"
        >
          {rings.map((rg, i) => {
            const r = RING_RADII[i] ?? 30
            const C = 2 * Math.PI * r
            const dimmed = hover !== null && hover.i !== i
            const lit = hover?.i === i
            const tipAngle = -Math.PI / 2 + rg.frac * Math.PI * 2
            const tip = { x: RING_C + Math.cos(tipAngle) * r, y: RING_C + Math.sin(tipAngle) * r }
            return (
              <g key={rg.key} style={{ opacity: dimmed ? 0.3 : 1, transition: 'opacity .25s ease' }}>
                <circle cx={RING_C} cy={RING_C} r={r} fill="none" stroke="currentColor" strokeOpacity={0.08} strokeWidth={RING_W} />
                <circle
                  cx={RING_C} cy={RING_C} r={r} fill="none"
                  stroke={rg.color} strokeWidth={lit ? RING_W + 2 : RING_W} strokeLinecap="round"
                  strokeDasharray={C}
                  transform={`rotate(-90 ${RING_C} ${RING_C})`}
                  style={{
                    strokeDashoffset: entered ? C * (1 - rg.frac) : C,
                    transition: `stroke-dashoffset 1.4s cubic-bezier(.22,1,.36,1) ${i * 160}ms, stroke-width .2s ease`,
                    filter: `drop-shadow(0 0 ${lit ? 7 : 4}px ${rgba(rg.color, lit ? 0.75 : 0.5)})`,
                  }}
                />
                {rg.frac > 0.02 && rg.frac < 0.995 && (
                  <circle
                    cx={r2(tip.x)} cy={r2(tip.y)} r={2.3} fill="#fff" fillOpacity={0.9}
                    style={{ opacity: entered ? 1 : 0, transition: `opacity .4s ease ${1.25 + i * 0.16}s` }}
                  />
                )}
                <circle
                  cx={RING_C} cy={RING_C} r={r} fill="none" stroke="transparent" strokeWidth={RING_W + 5}
                  onPointerEnter={onRing(i)} onPointerMove={onRing(i)} onPointerLeave={() => setHover(null)}
                />
              </g>
            )
          })}

          <text x={RING_C} y={RING_C + 2} textAnchor="middle" fontSize={24} fontWeight={800} fill={INK}
            style={{ letterSpacing: '-0.5px', fontVariantNumeric: 'tabular-nums' }}>
            {Math.round(shownMargin)}%
          </text>
          <text x={RING_C} y={RING_C + 16} textAnchor="middle" fontSize={9} fill={MUTED}>هامش الربح</text>
        </svg>

        {hover && hp && hover.px !== undefined && hover.py !== undefined && (
          <FloatingTip x={hover.px} y={hover.py}>
            <TipTitle>{hp.hint}</TipTitle>
            <TipRow color={hp.color} label={hp.label} value={formatCurrency(hp.value)} />
            <div style={{ marginTop: 4, fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
              {pct(hp.value, gross).toFixed(1)}% من الإيرادات
            </div>
          </FloatingTip>
        )}
      </div>

      <ul className="mt-3 w-full space-y-1">
        {rings.map((rg, i) => (
          <li
            key={rg.key}
            className={cn(
              'flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 transition-colors',
              hover?.i === i && 'bg-black/[0.04] dark:bg-white/[0.05]',
            )}
            onPointerEnter={() => setHover({ i })}
            onPointerLeave={() => setHover(null)}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: rg.color, boxShadow: `0 0 8px ${rgba(rg.color, 0.6)}` }} />
              <span className="truncate text-xs text-gray-600 dark:text-gray-300">{rg.label}</span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="text-xs font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                {formatCurrency(rg.value)}
              </span>
              <span className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums"
                style={{ color: rg.color, background: rgba(rg.color, 0.12) }}>
                {pct(rg.value, gross).toFixed(0)}%
              </span>
            </span>
          </li>
        ))}
        {returnTotal > 0 && (
          <li className="flex items-center justify-between gap-3 px-2 py-1.5">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: '#ef4444', opacity: 0.8 }} />
              <span className="text-xs text-gray-400">المرتجعات</span>
            </span>
            <span className="text-xs font-semibold tabular-nums text-gray-400">− {formatCurrency(returnTotal)}</span>
          </li>
        )}
      </ul>
    </div>
  )
}

// ── 4 · Product revenue bars ─────────────────────────────────────────────────

const BAR_ROW_H = 38
const BAR_RANK_W = 24
const BAR_GAP = 10
const BAR_STROKE = 10
const BAR_INSET = BAR_STROKE / 2

interface BarHover { i: number; px: number; py: number }

function ProductBars({ data, gross, reduced }: { data: ProductPoint[]; gross: number; reduced: boolean }) {
  const id = useSvgId('fwbar')
  const [listRef, box] = useMeasure<HTMLUListElement>()
  const entered = useEntered(reduced)
  const settled = useDelayedFlag(entered, 1200 + data.length * 60)
  const [hover, setHover] = useState<BarHover | null>(null)

  const rtl = box.rtl
  const listW = box.width > 0 ? box.width : 560
  const nameW = Math.round(Math.min(190, Math.max(84, listW * 0.3)))
  const areaW = Math.max(60, listW - BAR_RANK_W - BAR_GAP - nameW - BAR_GAP)
  const compact = areaW < 380
  const reserve = compact ? 58 : 122
  const maxRev = Math.max(1e-9, ...data.map(d => d.revenue))
  const trackLen = Math.max(0, areaW - reserve - BAR_INSET * 2)

  const x0 = rtl ? areaW - BAR_INSET : BAR_INSET
  const dir = rtl ? -1 : 1
  const cy = BAR_ROW_H / 2

  const onRow = (i: number) => (e: ReactPointerEvent<HTMLLIElement>) => {
    const p = localPoint(e, listRef.current)
    setHover({ i, px: p.x, py: p.y })
  }
  const hp = hover ? data[hover.i] : null

  if (data.length === 0) {
    return <CalmWaves reduced={reduced} message="لا توجد منتجات مباعة في هذه الفترة" height={200} />
  }

  return (
    <div className="relative">
      <ul ref={listRef} className="relative m-0 list-none p-0" style={{ width: '100%' }}>
        {data.map((p, i) => {
          const L = (p.revenue / maxRev) * trackLen
          const xEnd = x0 + dir * L
          const lit = hover?.i === i
          const delay = i * 60
          const gid = `${id}-${i}`
          return (
            <li
              key={p.name}
              className={cn(
                'flex items-center rounded-lg transition-colors',
                lit && 'bg-black/[0.03] dark:bg-white/[0.04]',
              )}
              style={{ height: BAR_ROW_H, gap: BAR_GAP }}
              onPointerEnter={onRow(i)}
              onPointerMove={onRow(i)}
              onPointerLeave={() => setHover(null)}
            >
              <span
                className={cn('inline-flex shrink-0 items-center justify-center rounded-md text-[11px] font-bold tabular-nums', !reduced && 'fw-rise')}
                style={{
                  width: BAR_RANK_W, height: BAR_RANK_W, animationDelay: `${delay}ms`,
                  color: i === 0 ? '#07261c' : p.color,
                  background: i === 0 ? p.color : rgba(p.color, 0.14),
                  boxShadow: i === 0 ? `0 0 14px ${rgba(p.color, 0.45)}` : undefined,
                }}
              >
                {i + 1}
              </span>
              <span
                className={cn('shrink-0 truncate text-[12.5px] font-medium text-gray-700 dark:text-gray-200', !reduced && 'fw-rise')}
                style={{ width: nameW, animationDelay: `${delay + 40}ms` }}
                title={p.name}
              >
                {p.name}
              </span>

              <svg width={areaW} height={BAR_ROW_H} viewBox={`0 0 ${areaW} ${BAR_ROW_H}`}
                className="block shrink-0" style={{ direction: 'ltr', overflow: 'visible' }} aria-hidden>
                <defs>
                  <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1={x0} y1={0} x2={xEnd || x0 + dir} y2={0}>
                    <stop offset="0%" stopColor={p.color} stopOpacity={1} />
                    <stop offset="100%" stopColor={p.color} stopOpacity={0.4} />
                  </linearGradient>
                </defs>
                {/* track */}
                <path d={`M${r2(x0)},${cy}L${r2(x0 + dir * trackLen)},${cy}`} fill="none"
                  stroke="currentColor" strokeOpacity={0.06} strokeWidth={BAR_STROKE} strokeLinecap="round" />
                {/* bar (grows from the anchor, lifts on hover) */}
                <g style={{
                  transform: lit ? 'translateY(-1px)' : 'none',
                  transition: 'transform .2s ease, filter .2s ease',
                  filter: lit ? `drop-shadow(0 4px 12px ${rgba(p.color, 0.55)})` : 'none',
                }}>
                  {L > 0 && (
                    <path
                      d={`M${r2(x0)},${cy}L${r2(xEnd)},${cy}`} fill="none"
                      stroke={`url(#${gid})`} strokeWidth={BAR_STROKE} strokeLinecap="round"
                      pathLength={settled ? undefined : 1}
                      strokeDasharray={settled ? undefined : '1 2'}
                      style={{
                        strokeDashoffset: settled ? undefined : entered ? 0 : 1,
                        transition: `stroke-dashoffset .9s cubic-bezier(.22,1,.36,1) ${delay}ms`,
                      }}
                    />
                  )}
                </g>
                {/* leading-edge pearl + floating value: ride along with the bar */}
                <g style={{
                  transform: `translateX(${entered ? 0 : -dir * L}px)`,
                  transition: `transform .9s cubic-bezier(.22,1,.36,1) ${delay}ms`,
                }}>
                  {L > 0 && (
                    <>
                      <circle cx={r2(xEnd)} cy={cy} r={lit ? 5.5 : 4.6} fill={p.color}
                        style={{ filter: `drop-shadow(0 0 ${lit ? 9 : 6}px ${rgba(p.color, 0.9)})`, transition: 'r .2s ease' }} />
                      <circle cx={r2(xEnd - dir * 1.2)} cy={cy - 1.3} r={1.6} fill="#fff" fillOpacity={0.85} />
                    </>
                  )}
                  <text
                    x={r2(xEnd + dir * 13)} y={cy + 4}
                    textAnchor={rtl ? 'end' : 'start'}
                    fontSize={compact ? 11 : 11.5} fontWeight={700} fill={lit ? TEAL_INK : INK}
                    style={{ fontVariantNumeric: 'tabular-nums', opacity: entered ? 1 : 0, transition: `opacity .5s ease ${delay + 350}ms, fill .2s ease` }}
                  >
                    {compact ? fmtCompact(p.revenue) : formatCurrency(p.revenue)}
                  </text>
                </g>
              </svg>
            </li>
          )
        })}

        {hover && hp && (
          <FloatingTip x={hover.px} y={hover.py}>
            <TipTitle>{hp.name}</TipTitle>
            <TipRow color={hp.color} label="الإيرادات" value={formatCurrency(hp.revenue)} />
            <TipRow color="#e5e7eb" label="الكمية" value={`${hp.qty} وحدة`} />
            <div style={{ marginTop: 4, fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
              {pct(hp.revenue, gross).toFixed(1)}% من إجمالي الإيرادات
            </div>
          </FloatingTip>
        )}
      </ul>
    </div>
  )
}

// ── Wave legend ──────────────────────────────────────────────────────────────

function WaveLegend({ peakDay }: { peakDay: DailyPoint | null }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 px-1">
      <span className="inline-flex items-center gap-2 text-xs text-gray-400">
        <span className="inline-block h-[3px] w-5 rounded-full"
          style={{ background: TEAL, boxShadow: `0 0 8px rgba(${TEAL_RGB},0.8)` }} />
        الإيرادات
      </span>
      <span className="inline-flex items-center gap-2 text-xs text-gray-400">
        <span className="inline-block w-5 border-t-2 border-dashed" style={{ borderColor: 'var(--color-text-muted, #9ca3af)' }} />
        الصافي بعد التكلفة
      </span>
      {peakDay && peakDay.revenue > 0 && (
        <span className="ms-auto text-xs text-gray-400 tabular-nums">
          أعلى يوم <span className="font-semibold text-gray-700 dark:text-gray-200">{peakDay.fullLabel}</span>
          {' · '}
          <span className="font-semibold" style={{ color: TEAL_INK }}>{formatCurrency(peakDay.revenue)}</span>
        </span>
      )}
    </div>
  )
}

// ── Main export ──────────────────────────────────────────────────────────────

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0)

export function ReportsCharts({ orders, stats, returnTotal }: Props) {
  const reduced = usePrefersReducedMotion()
  const daily = useMemo(() => buildDailyData(orders), [orders])
  const hourly = useMemo(() => buildHourlyData(orders), [orders])
  const products = useMemo(() => buildProductData(orders), [orders])

  const gross = stats.totalSubtotal
  const netRev = Math.max(0, gross - stats.totalCogs - returnTotal)
  const margin = pct(netRev, gross)

  const rings = useMemo<RingDatum[]>(() => [
    { key: 'net',  label: 'الصافي',  hint: 'صافي الإيراد بعد التكلفة والمرتجعات', color: TEAL,   value: netRev,          frac: clamp01(netRev / gross) },
    { key: 'cogs', label: 'التكلفة', hint: 'تكلفة البضاعة المباعة',               color: ORANGE, value: stats.totalCogs, frac: clamp01(stats.totalCogs / gross) },
    { key: 'tax',  label: 'الضريبة', hint: 'ضريبة القيمة المضافة المحصّلة',       color: AMBER,  value: stats.totalTax,  frac: clamp01(stats.totalTax / gross) },
  ], [netRev, gross, stats.totalCogs, stats.totalTax])

  const activeDays = daily.filter(d => d.orders > 0).length
  const avgDaily = activeDays > 0 ? gross / activeDays : 0
  const peakDay = daily.length > 0 ? daily.reduce((a, b) => (b.revenue > a.revenue ? b : a), daily[0]) : null

  if (orders.length === 0) {
    return (
      <Card>
        <style>{KEYFRAMES}</style>
        <CalmWaves
          reduced={reduced}
          message="لا توجد بيانات للفترة المحددة"
          hint="جرّب تغيير الفترة الزمنية أو الفرع لعرض التحليلات"
          height={250}
        />
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <style>{KEYFRAMES}</style>

      {/* ── Row 1: Revenue wave (2/3) + Hour wheel (1/3) ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <ChartHeader
            title="موجة الإيرادات"
            subtitle="الإيرادات اليومية والصافي بعد التكلفة"
            aside={<Chip label="متوسط اليوم" value={formatCurrency(avgDaily)} />}
          />
          <div className="p-4 pb-3">
            {daily.length < 2 ? (
              <CalmWaves
                reduced={reduced}
                message="اختر فترة أطول لعرض موجة الإيرادات"
                hint="تظهر الموجة عند وجود مبيعات في يومين أو أكثر"
                height={WAVE_H}
              />
            ) : (
              <RevenueWave data={daily} reduced={reduced} />
            )}
            <WaveLegend peakDay={daily.length >= 2 ? peakDay : null} />
          </div>
        </Card>

        <Card>
          <ChartHeader title="عجلة الساعات" subtitle="نبض الطلبات على مدار اليوم" />
          <div className="p-4 pt-3">
            <HourWheel data={hourly} reduced={reduced} />
          </div>
        </Card>
      </div>

      {/* ── Row 2: Revenue DNA (1/3) + Product bars (2/3) ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <ChartHeader
            title="تركيبة الإيرادات"
            subtitle="الصافي والتكلفة والضريبة"
            aside={<Chip label="الإجمالي" value={formatCurrency(gross)} />}
          />
          <div className="p-5 pt-4">
            <TripleRing rings={rings} margin={margin} gross={gross} returnTotal={returnTotal} reduced={reduced} />
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <ChartHeader
            title="إيرادات المنتجات"
            subtitle="أعلى المنتجات مبيعاً بالقيمة"
            aside={products[0] && gross > 0
              ? <Chip label="حصة الأول" value={`${pct(products[0].revenue, gross).toFixed(0)}%`} />
              : undefined}
          />
          <div className="p-4">
            <ProductBars data={products} gross={gross} reduced={reduced} />
          </div>
        </Card>
      </div>
    </div>
  )
}
