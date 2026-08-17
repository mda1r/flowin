import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Save, KeyRound, User } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { authApi } from '@/api/auth'
import { toast } from '@/components/ui/Toast'
import { Button } from '@/components/ui/Button'
import { getInitials } from '@/lib/utils'
import { useI18n } from '@/i18n'

const profileSchema = z.object({
  firstName: z.string().min(1, 'الاسم الأول مطلوب').max(100),
  lastName: z.string().min(1, 'اسم العائلة مطلوب').max(100),
})

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'كلمة المرور الحالية مطلوبة'),
  newPassword: z
    .string()
    .min(8, 'يجب أن تكون 8 أحرف على الأقل')
    .regex(/[A-Z]/, 'يجب أن تحتوي على حرف كبير')
    .regex(/[a-z]/, 'يجب أن تحتوي على حرف صغير')
    .regex(/[0-9]/, 'يجب أن تحتوي على رقم')
    .regex(/[^a-zA-Z0-9]/, 'يجب أن تحتوي على رمز خاص'),
  confirmPassword: z.string(),
}).refine(d => d.newPassword === d.confirmPassword, {
  path: ['confirmPassword'],
  message: 'كلمتا المرور غير متطابقتين',
})

type ProfileForm = z.infer<typeof profileSchema>
type PasswordForm = z.infer<typeof passwordSchema>

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="mt-1 text-xs text-rose-500">{msg}</p>
}

function PasswordInput({ placeholder, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { placeholder?: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        {...props}
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pl-10 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 focus:border-blue-500 focus:outline-none"
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
}

export function SettingsPage() {
  const { user, setUser, tenantId, branchId } = useAuthStore()
  const { lang, setLang } = useI18n()

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { firstName: user?.firstName ?? '', lastName: user?.lastName ?? '' },
  })

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  const profileMut = useMutation({
    mutationFn: (d: ProfileForm) => authApi.updateProfile(d.firstName, d.lastName),
    onSuccess: (_, d) => {
      if (user) setUser({ ...user, firstName: d.firstName, lastName: d.lastName })
      toast.success('تم تحديث الملف الشخصي', '')
    },
    onError: () => toast.error('فشل التحديث', ''),
  })

  const passwordMut = useMutation({
    mutationFn: (d: PasswordForm) => authApi.changePassword(d.currentPassword, d.newPassword),
    onSuccess: () => {
      passwordForm.reset()
      toast.success('تم تغيير كلمة المرور', '')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      if (msg === 'User.WrongPassword') {
        passwordForm.setError('currentPassword', { message: 'كلمة المرور الحالية غير صحيحة' })
      } else {
        toast.error('فشل تغيير كلمة المرور', '')
      }
    },
  })

  const inputClass =
    'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 focus:border-blue-500 focus:outline-none'

  return (
    <div className="p-6 max-w-2xl space-y-6" dir="rtl">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">الإعدادات</h1>
        <p className="text-sm text-gray-500 mt-1">إدارة حسابك وتفضيلات النظام</p>
      </div>

      {/* Profile card */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3 dark:border-gray-800">
          <User className="h-4 w-4 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">الملف الشخصي</h2>
        </div>
        <div className="px-5 py-4">
          <div className="flex items-center gap-4 mb-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-600 text-lg font-bold text-white select-none">
              {getInitials(`${user?.firstName ?? ''} ${user?.lastName ?? ''}`)}
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-sm text-gray-500">{user?.email}</p>
              <span className="mt-1 inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                {user?.role === 'SuperAdmin' ? 'مدير النظام' : user?.role === 'Owner' ? 'المالك' : user?.role === 'Manager' ? 'مدير' : user?.role === 'Staff' ? 'موظف' : user?.role}
              </span>
            </div>
          </div>

          <form
            onSubmit={profileForm.handleSubmit(d => profileMut.mutate(d))}
            className="space-y-3"
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                  الاسم الأول
                </label>
                <input
                  {...profileForm.register('firstName')}
                  className={inputClass}
                  placeholder="الاسم الأول"
                />
                <FieldError msg={profileForm.formState.errors.firstName?.message} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                  اسم العائلة
                </label>
                <input
                  {...profileForm.register('lastName')}
                  className={inputClass}
                  placeholder="اسم العائلة"
                />
                <FieldError msg={profileForm.formState.errors.lastName?.message} />
              </div>
            </div>
            <div className="flex justify-start">
              <Button type="submit" loading={profileMut.isPending} className="gap-2">
                <Save className="h-4 w-4" />
                حفظ الاسم
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Change password card */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3 dark:border-gray-800">
          <KeyRound className="h-4 w-4 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">تغيير كلمة المرور</h2>
        </div>
        <form
          onSubmit={passwordForm.handleSubmit(d => passwordMut.mutate(d))}
          className="px-5 py-4 space-y-3"
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
              كلمة المرور الحالية
            </label>
            <PasswordInput
              {...passwordForm.register('currentPassword')}
              placeholder="••••••••"
            />
            <FieldError msg={passwordForm.formState.errors.currentPassword?.message} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
              كلمة المرور الجديدة
            </label>
            <PasswordInput
              {...passwordForm.register('newPassword')}
              placeholder="••••••••"
            />
            <FieldError msg={passwordForm.formState.errors.newPassword?.message} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
              تأكيد كلمة المرور الجديدة
            </label>
            <PasswordInput
              {...passwordForm.register('confirmPassword')}
              placeholder="••••••••"
            />
            <FieldError msg={passwordForm.formState.errors.confirmPassword?.message} />
          </div>
          <p className="text-xs text-gray-400">
            يجب أن تحتوي كلمة المرور على 8 أحرف على الأقل، وتشمل حرفاً كبيراً وصغيراً ورقماً ورمزاً خاصاً.
          </p>
          <div className="flex justify-start">
            <Button type="submit" loading={passwordMut.isPending} className="gap-2">
              <KeyRound className="h-4 w-4" />
              تغيير كلمة المرور
            </Button>
          </div>
        </form>
      </div>

      {/* Language */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-5 py-3 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">اللغة</h2>
        </div>
        <div className="flex gap-3 px-5 py-4">
          <button
            onClick={() => setLang('ar')}
            className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
              lang === 'ar'
                ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400'
            }`}
          >
            العربية
          </button>
          <button
            onClick={() => setLang('en')}
            className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
              lang === 'en'
                ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400'
            }`}
          >
            English
          </button>
        </div>
      </div>

      {/* Workspace info */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-5 py-3 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">معلومات المنشأة</h2>
        </div>
        <div className="space-y-3 px-5 py-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-500">معرّف المستأجر</span>
            <span className="font-mono text-xs text-gray-700 dark:text-gray-300 select-all">{tenantId ?? '—'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500">معرّف الفرع النشط</span>
            <span className="font-mono text-xs text-gray-700 dark:text-gray-300 select-all">{branchId ?? '—'}</span>
          </div>
        </div>
      </div>

      {/* About */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-5 py-3 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">عن التطبيق</h2>
        </div>
        <div className="space-y-2 px-5 py-4 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex justify-between">
            <span>flowin</span>
            <span className="font-medium">الإصدار المؤسسي v1.0.0</span>
          </div>
          <div className="flex justify-between">
            <span>الخادم</span>
            <span className="font-medium">.NET 9 / ASP.NET Core</span>
          </div>
          <div className="flex justify-between">
            <span>الواجهة</span>
            <span className="font-medium">React 19 + Vite + Tauri 2</span>
          </div>
        </div>
      </div>
    </div>
  )
}
