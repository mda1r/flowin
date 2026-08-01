import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff } from 'lucide-react'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { toast } from '@/components/ui/Toast'
import {
  BarcodeIllus,
  CashierIllus,
  CoinStackIllus,
  CreditCardIllus,
  PosTerminalIllus,
  ProductBoxIllus,
  ReceiptIllus,
  ShoppingBagIllus,
} from './loginIllustrations'

const schema = z.object({
  email: z.string().email('يرجى إدخال بريد إلكتروني صحيح'),
  password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
})

type FormData = z.infer<typeof schema>

/* ────────────────────────────────────────────────────────────────
   Business-type login themes — resolved from ?type= in the URL.
   Falls back to the generic "flowin" geometric theme.
   ──────────────────────────────────────────────────────────────── */

interface LoginTheme {
  accent: string
  glow: string
  emojis: string[]
  labelAr: string
}

const LOGIN_THEMES: Record<string, LoginTheme> = {
  restaurant:  { accent: '#FF6B35', glow: 'rgba(255, 107, 53, 0.38)',  emojis: ['🍕', '🍔', '🥗', '🍜'], labelAr: 'مطاعم' },
  cafe:        { accent: '#92400E', glow: 'rgba(194, 112, 31, 0.42)',  emojis: ['☕', '🧋', '🥐', '🫖'], labelAr: 'مقاهي' },
  supermarket: { accent: '#4F46E5', glow: 'rgba(79, 70, 229, 0.4)',   emojis: ['🛒', '🥦', '🧃', '🥛'], labelAr: 'سوبر ماركت' },
  sports:      { accent: '#0284C7', glow: 'rgba(56, 189, 248, 0.4)',   emojis: ['⚽', '🏀', '🎾', '🏋️'], labelAr: 'متاجر رياضية' },
  retail:      { accent: '#BE185D', glow: 'rgba(236, 72, 153, 0.4)',   emojis: ['👗', '👠', '👜', '💍'], labelAr: 'متاجر أزياء' },
  hotel:       { accent: '#1E40AF', glow: 'rgba(59, 130, 246, 0.4)',   emojis: ['🏨', '🛏️', '🔑', '✨'], labelAr: 'فنادق' },
  gaming:      { accent: '#7C3AED', glow: 'rgba(167, 139, 250, 0.45)', emojis: ['🎮', '👾', '🕹️', '🎲'], labelAr: 'صالات ألعاب' },
}

/* ────────────────────────────────────────────────────────────────
   Floating-emoji layout (themed mode) — 18 curated slots hugging
   the edges so the glass card stays readable. layer 1 = far (small,
   faint, low parallax) … layer 3 = near (large, bold, strong).
   ──────────────────────────────────────────────────────────────── */

interface FloatSlot {
  top: string
  start?: string
  end?: string
  size: number
  delay: number
  dur: number
  alpha: number
  layer: 1 | 2 | 3
  tilt: number
}

const FLOAT_SLOTS: FloatSlot[] = [
  { top: '8%',  start: '6%',  size: 44, delay: 0,     dur: 13, alpha: 0.6,  layer: 3, tilt: -6 },
  { top: '16%', start: '22%', size: 26, delay: -3,    dur: 15, alpha: 0.38, layer: 2, tilt: 8 },
  { top: '34%', start: '4%',  size: 34, delay: -7,    dur: 17, alpha: 0.5,  layer: 2, tilt: -10 },
  { top: '52%', start: '12%', size: 22, delay: -11,   dur: 14, alpha: 0.3,  layer: 1, tilt: 5 },
  { top: '68%', start: '5%',  size: 40, delay: -5,    dur: 16, alpha: 0.55, layer: 3, tilt: 12 },
  { top: '84%', start: '18%', size: 28, delay: -9,    dur: 13, alpha: 0.42, layer: 2, tilt: -4 },
  { top: '90%', start: '38%', size: 20, delay: -2,    dur: 18, alpha: 0.28, layer: 1, tilt: 9 },
  { top: '6%',  start: '40%', size: 22, delay: -13,   dur: 16, alpha: 0.3,  layer: 1, tilt: -12 },
  { top: '10%', end: '8%',    size: 46, delay: -4,    dur: 14, alpha: 0.6,  layer: 3, tilt: 7 },
  { top: '24%', end: '20%',   size: 24, delay: -8,    dur: 17, alpha: 0.36, layer: 2, tilt: -9 },
  { top: '42%', end: '5%',    size: 36, delay: -1,    dur: 15, alpha: 0.52, layer: 2, tilt: 11 },
  { top: '58%', end: '14%',   size: 20, delay: -12,   dur: 13, alpha: 0.3,  layer: 1, tilt: -5 },
  { top: '72%', end: '6%',    size: 42, delay: -6,    dur: 16, alpha: 0.58, layer: 3, tilt: 4 },
  { top: '86%', end: '22%',   size: 26, delay: -10,   dur: 14, alpha: 0.4,  layer: 2, tilt: -11 },
  { top: '78%', end: '42%',   size: 18, delay: -14,   dur: 18, alpha: 0.26, layer: 1, tilt: 6 },
  { top: '30%', start: '32%', size: 18, delay: -15,   dur: 19, alpha: 0.22, layer: 1, tilt: -7 },
  { top: '48%', end: '30%',   size: 18, delay: -16,   dur: 17, alpha: 0.22, layer: 1, tilt: 10 },
  { top: '4%',  end: '34%',   size: 24, delay: -8.5,  dur: 15, alpha: 0.34, layer: 2, tilt: -3 },
]

/* parallax strength per depth layer (px of travel across the viewport) */
const LAYER_DEPTH: Record<1 | 2 | 3, string> = { 1: '10px', 2: '20px', 3: '34px' }

function slotPosition(slot: { top: string; start?: string; end?: string }): React.CSSProperties {
  return {
    top: slot.top,
    ...(slot.start ? { insetInlineStart: slot.start } : {}),
    ...(slot.end ? { insetInlineEnd: slot.end } : {}),
  }
}

/* ────────────────────────────────────────────────────────────────
   3D isometric POS scene (default mode) — a cashier ringing up a
   sale surrounded by the tools of the trade. Eight hand-placed
   illustrations flank the glass card; nearer layers are larger,
   more opaque, and get more parallax + drop-shadow presence.
   ──────────────────────────────────────────────────────────────── */

interface IllusSlot {
  Comp: () => React.ReactElement
  top: string
  start?: string
  end?: string
  width: number
  layer: 1 | 2 | 3
  alpha: number
  dur: number
  delay: number
  tilt: number
}

const ILLUS_SLOTS: IllusSlot[] = [
  /* start flank (logical inline-start) */
  { Comp: PosTerminalIllus, top: '30%', start: '3%', width: 230, layer: 3, alpha: 0.95, dur: 9,    delay: 0,    tilt: -2 },
  { Comp: CashierIllus,     top: '55%', start: '5%', width: 150, layer: 2, alpha: 0.8,  dur: 10,   delay: -3,   tilt: 2 },
  { Comp: CoinStackIllus,   top: '15%', start: '8%', width: 84,  layer: 2, alpha: 0.8,  dur: 8,    delay: -5,   tilt: -3 },
  { Comp: ReceiptIllus,     top: '78%', start: '2%', width: 72,  layer: 1, alpha: 0.62, dur: 11,   delay: -2,   tilt: 4 },
  /* end flank (logical inline-end) */
  { Comp: CreditCardIllus,  top: '12%', end: '4%',   width: 150, layer: 3, alpha: 0.95, dur: 8.5,  delay: -1.5, tilt: 3 },
  { Comp: ShoppingBagIllus, top: '45%', end: '3%',   width: 112, layer: 2, alpha: 0.8,  dur: 9.5,  delay: -6,   tilt: -2 },
  { Comp: BarcodeIllus,     top: '68%', end: '6%',   width: 118, layer: 2, alpha: 0.8,  dur: 10.5, delay: -4,   tilt: 2 },
  { Comp: ProductBoxIllus,  top: '85%', end: '5%',   width: 88,  layer: 1, alpha: 0.62, dur: 12,   delay: -7,   tilt: -3 },
]

/* ────────────────────────────────────────────────────────────────
   Constellation network — faint lines linking the float-slot anchor
   coordinates on either flank (viewBox 0-100, drawn via dash-draw).
   Authored in LTR coordinates; [dir='rtl'] .net-svg mirrors the SVG
   so the lines keep hugging the logically-positioned shapes.
   ──────────────────────────────────────────────────────────────── */

const NET_PATHS = [
  '6,8 22,16 4,34 5,68 18,84',
  '92,10 80,24 95,42 94,72 78,86',
  '22,16 50,5 80,24',
] as const

/* ────────────────────────────────────────────────────────────────
   Success burst — 16 radial particles fired from the logo center.
   Deterministic pseudo-variety (no Math.random → stable renders).
   ──────────────────────────────────────────────────────────────── */

const BURST_PARTICLES = Array.from({ length: 16 }, (_, i) => ({
  angle: i * 22.5,
  dist: 74 + (i % 4) * 20 + ((i * 7) % 13),
  size: 5 + ((i * 5) % 3) * 2,
  dur: 0.66 + ((i * 3) % 5) * 0.07,
}))

const BURST_COLORS = ['var(--accent)', 'color-mix(in srgb, var(--accent) 30%, white)', '#62E6C7']

/* login success sequence:
   t=0      flash + logo spin-lock + particle burst
   t=600ms  scene wipe begins (.login-exit)
   t=1200ms navigate() — wipe just finished */
type LoginPhase = 'idle' | 'success' | 'exit'

const EXIT_AT_MS = 600
const NAVIGATE_AT_MS = 1200

export function LoginPage() {
  const navigate = useNavigate()
  const { setTokens, setUser } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [phase, setPhase] = useState<LoginPhase>('idle')
  const [burst, setBurst] = useState<{ x: number; y: number } | null>(null)

  /* theme resolved once from the URL (?type=restaurant|cafe|…) */
  const theme = useMemo<LoginTheme | null>(() => {
    const type = new URLSearchParams(window.location.search).get('type')?.toLowerCase()
    return type ? LOGIN_THEMES[type] ?? null : null
  }, [])

  /* mouse-driven parallax: writes CSS vars on the scene, layers consume them */
  const sceneRef = useRef<HTMLDivElement>(null)
  const logoRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef(0)
  const timersRef = useRef<number[]>([])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = sceneRef.current
    if (!el) return
    const x = e.clientX / window.innerWidth - 0.5
    const y = e.clientY / window.innerHeight - 0.5
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      el.style.setProperty('--par-x', x.toFixed(3))
      el.style.setProperty('--par-y', y.toFixed(3))
    })
  }, [])

  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current)
      timersRef.current.forEach((t) => window.clearTimeout(t))
    },
    [],
  )

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    if (loading || phase !== 'idle') return
    setLoading(true)
    try {
      const { data: tokens } = await authApi.login(data.email, data.password)
      setTokens(tokens.accessToken, tokens.refreshToken)
      const { data: user } = await authApi.me()
      setUser(user)
      const to = user.role === 'SuperAdmin' ? '/admin' : '/'

      /* reduced motion: skip the ceremony, enter directly */
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        navigate({ to })
        return
      }

      /* ── the unlock moment: flash → spin → burst → wipe → enter ── */
      const rect = logoRef.current?.getBoundingClientRect()
      if (rect) setBurst({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
      setPhase('success')
      timersRef.current.push(window.setTimeout(() => setPhase('exit'), EXIT_AT_MS))
      timersRef.current.push(window.setTimeout(() => navigate({ to }), NAVIGATE_AT_MS))
    } catch {
      toast.error('فشل تسجيل الدخول', 'البريد الإلكتروني أو كلمة المرور غير صحيحة')
    } finally {
      setLoading(false)
    }
  }

  const themeVars = theme
    ? ({ '--accent': theme.accent, '--glow': theme.glow } as React.CSSProperties)
    : undefined

  return (
    <div
      ref={sceneRef}
      dir="rtl"
      onMouseMove={handleMouseMove}
      style={themeVars}
      className={`scene-3d relative flex min-h-screen items-center justify-center overflow-hidden p-4${
        phase === 'exit' ? ' login-exit' : ''
      }`}
    >
      {/* ───── cinematic floating backdrop (parallax depth layers) ───── */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        {/* living aurora — two counter-rotating conic veils, deepest layer */}
        <div className="parallax-layer" style={{ '--par-depth': '4px' } as React.CSSProperties}>
          <div className="aurora-bg" />
          <div className="aurora-bg aurora-bg-reverse" />
        </div>

        {/* deep ambient morphing blobs */}
        <div className="parallax-layer" style={{ '--par-depth': '6px' } as React.CSSProperties}>
          <div
            className="morph-blob"
            style={{ width: 440, height: 440, top: '-10%', insetInlineStart: '-8%', '--morph-dur': '21s' } as React.CSSProperties}
          />
          <div
            className="morph-blob"
            style={{ width: 400, height: 400, bottom: '-12%', insetInlineEnd: '-6%', opacity: 0.42, animationDelay: '-9s', '--morph-dur': '27s' } as React.CSSProperties}
          />
        </div>

        {/* constellation — subtle lines drawn between the flank shapes */}
        <div className="parallax-layer" style={{ '--par-depth': '15px' } as React.CSSProperties}>
          <svg className="net-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
            {NET_PATHS.map((points, i) => (
              <polyline
                key={i}
                className={`net-line net-line-${i + 1}`}
                points={points}
                pathLength={1}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
        </div>

        {/* floating cast: themed emoji, or the 3D isometric POS scene by default */}
        {([1, 2, 3] as const).map((layer) => (
          <div
            key={layer}
            className="parallax-layer"
            style={{ '--par-depth': LAYER_DEPTH[layer] } as React.CSSProperties}
          >
            {theme
              ? FLOAT_SLOTS.map((slot, i) =>
                  slot.layer !== layer ? null : (
                    <span
                      key={i}
                      className="float-emoji"
                      style={{
                        ...slotPosition(slot),
                        fontSize: slot.size,
                        '--emoji-alpha': slot.alpha,
                        '--drift-dur': `${slot.dur}s`,
                        '--drift-delay': `${slot.delay}s`,
                        '--bob-tilt': `${slot.tilt}deg`,
                      } as React.CSSProperties}
                    >
                      {theme.emojis[i % theme.emojis.length]}
                    </span>
                  ),
                )
              : ILLUS_SLOTS.map((slot, i) =>
                  slot.layer !== layer ? null : (
                    <div
                      key={i}
                      className="pos-illus"
                      style={{
                        ...slotPosition(slot),
                        width: slot.width,
                        opacity: slot.alpha,
                        '--illus-dur': `${slot.dur}s`,
                        '--illus-delay': `${slot.delay}s`,
                        '--illus-tilt': `${slot.tilt}deg`,
                      } as React.CSSProperties}
                    >
                      <slot.Comp />
                    </div>
                  ),
                )}
          </div>
        ))}
      </div>

      <div className="relative w-full max-w-sm">
        {/* ───── identity: logo mark with orbiting accents ───── */}
        <div className="mb-8 flex flex-col items-center">
          <div className="entrance-1 relative mb-5">
            <div className="orbit-ring" style={{ inset: -13, '--orbit-dur': '17s' } as React.CSSProperties} />
            <div className="orbit-ring orbit-ring-reverse" style={{ inset: -25, '--orbit-dur': '26s' } as React.CSSProperties} />
            <div
              className="orbit-dot"
              style={{ top: '50%', insetInlineStart: '50%', margin: -3.5, '--orbit-radius': '41px', '--orbit-dur': '9s' } as React.CSSProperties}
            />
            <div
              className="orbit-dot orbit-dot-2"
              style={{ top: '50%', insetInlineStart: '50%', margin: -2.5, '--orbit-radius': '55px', '--orbit-dur': '13s' } as React.CSSProperties}
            />
            <div className="logo-halo" />
            <div
              ref={logoRef}
              className={`${phase === 'idle' ? 'logo-breathe' : 'lock-spin'} flex h-14 w-14 items-center justify-center rounded-2xl`}
              style={{
                background:
                  'linear-gradient(140deg, color-mix(in srgb, var(--accent) 58%, white) 0%, var(--accent) 32%, color-mix(in srgb, var(--accent) 60%, black) 74%, color-mix(in srgb, var(--accent) 34%, black) 100%)',
                boxShadow:
                  '0 5px 0 rgba(0,0,0,0.3), 0 14px 34px var(--glow), 0 0 44px var(--glow), inset 0 1px 0 rgba(255,255,255,0.3)',
              }}
            >
              {theme ? (
                <span className="text-2xl leading-none" aria-hidden="true">{theme.emojis[0]}</span>
              ) : (
                <svg viewBox="0 0 28 28" fill="none" className="h-7 w-7" aria-hidden="true">
                    <circle cx="10" cy="14" r="5.5" stroke="white" strokeWidth="3.5" />
                    <rect x="18.5" y="6" width="4" height="16" rx="2" fill="white" />
                  </svg>
              )}
            </div>
          </div>

          <h1 className="logo-3d entrance-2 select-none text-4xl font-extrabold tracking-tight">
            flowin
          </h1>
          <p className="entrance-2 mt-2 text-sm text-gray-500">سجّل الدخول إلى مساحة عملك</p>

          {theme && (
            <span className="biz-badge entrance-3 mt-3">
              <span aria-hidden="true">{theme.emojis[0]}</span>
              منصة {theme.labelAr}
            </span>
          )}
        </div>

        {/* ───── glass panel ───── */}
        <div className="glass-panel entrance-3 relative p-8">
          {/* unlock flash — mounts on success, radiates from panel center */}
          {phase !== 'idle' && <div className="unlock-overlay" aria-hidden="true" />}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="entrance-4 field-aura">
              <Input
                label="البريد الإلكتروني"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                error={errors.email?.message}
                floating
                {...register('email')}
              />
            </div>

            <div className="entrance-4 field-aura relative">
              <Input
                label="كلمة المرور"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                error={errors.password?.message}
                floating
                {...register('password')}
              />
              {/* eye ↔ eye-off: smooth opacity + scale + tilt crossfade */}
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute end-3 top-4 h-4 w-4 text-gray-400 transition-colors hover:text-gray-600"
                aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              >
                <Eye
                  className={`absolute inset-0 h-4 w-4 transition-all duration-300 ease-out ${
                    showPassword ? 'rotate-45 scale-50 opacity-0' : 'rotate-0 scale-100 opacity-100'
                  }`}
                />
                <EyeOff
                  className={`absolute inset-0 h-4 w-4 transition-all duration-300 ease-out ${
                    showPassword ? 'rotate-0 scale-100 opacity-100' : '-rotate-45 scale-50 opacity-0'
                  }`}
                />
              </button>
            </div>

            <div className="entrance-5">
              <Button
                type="submit"
                variant="primary"
                loading={loading}
                disabled={phase !== 'idle'}
                className={`btn-3d btn-shimmer mt-3 w-full !bg-[color:var(--accent)] py-2.5 text-base hover:!bg-[color:var(--accent)]${
                  loading ? ' btn-shimmer-loading' : ''
                }`}
              >
                {phase === 'idle' ? 'تسجيل الدخول' : 'أهلاً بك ✓'}
              </Button>
            </div>
          </form>
        </div>

        <p className="entrance-5 mt-6 text-center text-xs text-gray-400">
          © 2026 flowin · الإصدار المؤسسي
        </p>
      </div>

      {/* ───── success particle burst (portal → body, above everything) ───── */}
      {burst &&
        createPortal(
          <div
            className="login-burst"
            aria-hidden="true"
            /* measured viewport coords are physical, so left/top is correct
               in RTL too; themeVars re-applied since body is outside the scene */
            style={{ left: burst.x, top: burst.y, ...themeVars }}
          >
            {BURST_PARTICLES.map((p, i) => (
              <span
                key={i}
                className="login-particle"
                style={
                  {
                    width: p.size,
                    height: p.size,
                    '--burst-angle': `${p.angle}deg`,
                    '--burst-dist': `${p.dist}px`,
                    '--burst-dur': `${p.dur}s`,
                    '--burst-color': BURST_COLORS[i % BURST_COLORS.length],
                  } as React.CSSProperties
                }
              />
            ))}
          </div>,
          document.body,
        )}
    </div>
  )
}
