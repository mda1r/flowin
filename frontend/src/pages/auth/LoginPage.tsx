import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ShoppingCart, Eye, EyeOff } from 'lucide-react'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { toast } from '@/components/ui/Toast'

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
   Floating-element layout — 18 curated slots hugging the edges so
   the glass card stays readable. layer 1 = far (small, faint, low
   parallax) … layer 3 = near (large, bold, strong parallax).
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

const SHAPE_RADII = ['9999px', '1.25rem', '0.75rem']

function slotPosition(slot: FloatSlot): React.CSSProperties {
  return {
    top: slot.top,
    ...(slot.start ? { insetInlineStart: slot.start } : {}),
    ...(slot.end ? { insetInlineEnd: slot.end } : {}),
  }
}

export function LoginPage() {
  const navigate = useNavigate()
  const { setTokens, setUser } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  /* theme resolved once from the URL (?type=restaurant|cafe|…) */
  const theme = useMemo<LoginTheme | null>(() => {
    const type = new URLSearchParams(window.location.search).get('type')?.toLowerCase()
    return type ? LOGIN_THEMES[type] ?? null : null
  }, [])

  /* mouse-driven parallax: writes CSS vars on the scene, layers consume them */
  const sceneRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef(0)

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

  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      const { data: tokens } = await authApi.login(data.email, data.password)
      setTokens(tokens.accessToken, tokens.refreshToken)
      const { data: user } = await authApi.me()
      setUser(user)
      if (user.role === 'SuperAdmin') {
        navigate({ to: '/admin' })
      } else {
        navigate({ to: '/' })
      }
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
      className="scene-3d relative flex min-h-screen items-center justify-center overflow-hidden p-4"
    >
      {/* ───── cinematic floating backdrop (parallax depth layers) ───── */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
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

        {/* floating particles: themed emoji, or abstract geometry by default */}
        {([1, 2, 3] as const).map((layer) => (
          <div
            key={layer}
            className="parallax-layer"
            style={{ '--par-depth': LAYER_DEPTH[layer] } as React.CSSProperties}
          >
            {FLOAT_SLOTS.map((slot, i) =>
              slot.layer !== layer ? null : theme ? (
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
              ) : (
                <div
                  key={i}
                  className="float-shape"
                  style={{
                    ...slotPosition(slot),
                    width: Math.round(slot.size * 2.8),
                    height: Math.round(slot.size * 2.8),
                    borderRadius: SHAPE_RADII[i % SHAPE_RADII.length],
                    opacity: Math.min(slot.alpha + 0.2, 0.9),
                    animationDelay: `${slot.delay}s`,
                    '--drift-dur': `${slot.dur}s`,
                  } as React.CSSProperties}
                />
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
              className="logo-breathe flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{
                background: 'linear-gradient(145deg, var(--accent), color-mix(in srgb, var(--accent) 55%, black))',
                boxShadow: '0 5px 0 rgba(0,0,0,0.3), 0 14px 34px var(--glow), inset 0 1px 0 rgba(255,255,255,0.25)',
              }}
            >
              {theme ? (
                <span className="text-2xl leading-none" aria-hidden="true">{theme.emojis[0]}</span>
              ) : (
                <ShoppingCart className="h-7 w-7 text-white" />
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
        <div className="glass-panel entrance-3 p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="entrance-4">
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

            <div className="entrance-4 relative">
              <Input
                label="كلمة المرور"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                error={errors.password?.message}
                floating
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute end-3 top-4 text-gray-400 transition-colors hover:text-gray-600"
                aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>

            <div className="entrance-5">
              <Button
                type="submit"
                variant="primary"
                loading={loading}
                className="btn-3d btn-shimmer mt-3 w-full !bg-[color:var(--accent)] py-2.5 text-base hover:!bg-[color:var(--accent)]"
              >
                تسجيل الدخول
              </Button>
            </div>
          </form>
        </div>

        <p className="entrance-5 mt-6 text-center text-xs text-gray-400">
          © 2026 flowin · الإصدار المؤسسي
        </p>
      </div>
    </div>
  )
}
