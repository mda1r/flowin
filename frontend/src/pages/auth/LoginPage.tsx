import { useState } from 'react'
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

/* floating geometric backdrop shapes — pure CSS 3D rotated divs */
const SHAPES: React.CSSProperties[] = [
  { width: 140, height: 140, top: '12%', insetInlineStart: '10%', borderRadius: '1.5rem', animationDelay: '0s' },
  { width: 90, height: 90, top: '68%', insetInlineStart: '16%', borderRadius: '9999px', animationDelay: '-4s' },
  { width: 180, height: 180, top: '18%', insetInlineEnd: '8%', borderRadius: '2rem', animationDelay: '-8s' },
  { width: 70, height: 70, top: '74%', insetInlineEnd: '18%', borderRadius: '1rem', animationDelay: '-11s' },
  { width: 46, height: 46, top: '42%', insetInlineStart: '4%', borderRadius: '0.75rem', animationDelay: '-6s' },
  { width: 58, height: 58, top: '8%', insetInlineEnd: '32%', borderRadius: '9999px', animationDelay: '-2s' },
]

export function LoginPage() {
  const navigate = useNavigate()
  const { setTokens, setUser } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

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

  return (
    <div dir="rtl" className="scene-3d relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      {/* floating 3D geometry behind the panel */}
      <div className="scene-3d absolute inset-0 transform-style-3d" aria-hidden="true">
        {SHAPES.map((style, i) => (
          <div key={i} className="float-shape" style={style} />
        ))}
      </div>

      <div className="relative w-full max-w-sm animate-float-up">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <div
            className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{
              background: 'linear-gradient(145deg, var(--accent), color-mix(in srgb, var(--accent) 55%, black))',
              boxShadow: '0 5px 0 rgba(0,0,0,0.3), 0 14px 34px var(--glow), inset 0 1px 0 rgba(255,255,255,0.25)',
            }}
          >
            <ShoppingCart className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-emboss text-4xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">
            flowin
          </h1>
          <p className="mt-2 text-sm text-gray-500">سجّل الدخول إلى مساحة عملك</p>
        </div>

        {/* Glass panel */}
        <div className="glass-panel p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="البريد الإلكتروني"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              error={errors.email?.message}
              className="input-3d"
              {...register('email')}
            />

            <div className="relative">
              <Input
                label="كلمة المرور"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                error={errors.password?.message}
                className="input-3d"
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute end-3 top-8 text-gray-400 transition-colors hover:text-gray-600"
                aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>

            <Button
              type="submit"
              variant="primary"
              loading={loading}
              className="btn-3d mt-3 w-full !bg-[color:var(--accent)] py-2.5 text-base hover:!bg-[color:var(--accent)]"
            >
              تسجيل الدخول
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          © 2026 flowin · الإصدار المؤسسي
        </p>
      </div>
    </div>
  )
}
