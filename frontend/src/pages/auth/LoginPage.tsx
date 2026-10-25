import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Receipt, ShieldCheck, Sparkles } from 'lucide-react'
import { isAxiosError } from 'axios'
import { useI18n } from '@/i18n'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { toast } from '@/components/ui/Toast'
import { BrandTagline, FlowWave, FlowinLogo } from '@/components/brand/Brand'
import { cn } from '@/lib/utils'

type FormData = { email: string; password: string }

/* On success the button confirms, the page fades, then we enter. Reduced motion skips straight in. */
const NAVIGATE_AT_MS = 420

export function LoginPage() {
  const navigate = useNavigate()
  const { setTokens, setUser } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [entering, setEntering] = useState(false)
  const timers = useRef<number[]>([])
  const { t, lang } = useI18n()

  const schema = useMemo(() => z.object({
    email: z.string().email(t.login.emailInvalid),
    password: z.string().min(6, t.login.passwordMin),
  }), [t])

  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), [])

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    if (loading || entering) return
    setLoading(true)
    try {
      const { data: tokens } = await authApi.login(data.email, data.password)
      setTokens(tokens.accessToken, tokens.refreshToken)
      const { data: user } = await authApi.me()
      setUser(user)
      const to = user.role === 'SuperAdmin' ? '/admin' : '/'

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        navigate({ to })
        return
      }
      setEntering(true)
      timers.current.push(window.setTimeout(() => navigate({ to }), NAVIGATE_AT_MS))
    } catch (err) {
      // No response or a 5xx means the server is down or unreachable, not that the password is wrong.
      const unreachable = isAxiosError(err) && (!err.response || err.response.status >= 500)
      if (unreachable) toast.error(t.login.serverUnreachable, t.login.serverUnreachableHint)
      else toast.error(t.login.loginFailed, t.login.invalidCredentials)
    } finally {
      setLoading(false)
    }
  }

  const ar = lang === 'ar'
  const highlights = ar
    ? [
        { icon: Sparkles, text: 'كاشير سريع يعمل حتى دون إنترنت' },
        { icon: Receipt, text: 'فواتير زاتكا وتقارير يومية جاهزة' },
        { icon: ShieldCheck, text: 'بيانات كل متجر معزولة وآمنة' },
      ]
    : [
        { icon: Sparkles, text: 'A fast till that keeps selling offline' },
        { icon: Receipt, text: 'ZATCA invoices and daily reports, ready' },
        { icon: ShieldCheck, text: "Every store's data isolated and secure" },
      ]

  return (
    <div className={cn('grid min-h-[100dvh] grid-rows-[auto_1fr] bg-bg lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:grid-rows-1', entering && 'login-exit')}>
      {/* ── Brand side: the identity's graphite world ── */}
      <aside className="scheme-dark relative flex flex-col overflow-hidden bg-surface px-6 py-6 text-fg sm:px-10 lg:py-10">
        <div className="pointer-events-none absolute -top-40 start-1/3 h-96 w-96 rounded-full bg-brand/15 blur-3xl" aria-hidden="true" />
        <div className="relative flex items-center justify-between">
          <FlowinLogo className="h-8 text-fg sm:h-9" />
          <BrandTagline className="hidden sm:block" />
        </div>

        <div className="relative my-auto hidden py-12 lg:block">
          <h1 className="max-w-md text-[2.6rem] font-semibold leading-[1.25] text-fg">
            {ar ? (
              <>غدٌ أذكى <span className="text-brand">يتدفّق</span></>
            ) : (
              <>A smarter tomorrow <span className="text-brand">flows</span></>
            )}
          </h1>
          <p className="mt-4 max-w-sm text-base leading-7 text-muted">
            {ar
              ? 'نظام واحد للكاشير والمخزون والعملاء والضرائب، لمقهاك ومطعمك ومتجرك.'
              : 'One system for the till, stock, customers and tax, for your café, restaurant and store.'}
          </p>
          <ul className="mt-8 space-y-3">
            {highlights.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-fg/90">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/15 text-brand">
                  <Icon className="h-4 w-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <FlowWave className="relative -mx-10 mt-6 h-16 lg:mt-0 lg:h-28" />
      </aside>

      {/* ── Sign-in ── */}
      <main className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-sm">
          <h2 className="font-display text-2xl font-semibold text-fg">{t.login.welcome}</h2>
          <p className="mt-1.5 text-sm text-muted">{t.login.subtitle}</p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4" noValidate>
            <Input
              label={t.login.email}
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              error={errors.email?.message}
              floating
              {...register('email')}
            />
            <div className="relative">
              <Input
                label={t.login.password}
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
                className="absolute end-3 top-4 text-muted transition-colors hover:text-fg"
                aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <Button type="submit" size="lg" loading={loading} disabled={entering} className="mt-2 w-full">
              {entering ? `${t.login.welcome} ✓` : t.login.signIn}
            </Button>
          </form>

          <p className="mt-10 text-center text-xs text-muted">© 2026 flowin · {ar ? 'الإصدار المؤسسي' : 'Enterprise edition'}</p>
        </div>
      </main>
    </div>
  )
}
