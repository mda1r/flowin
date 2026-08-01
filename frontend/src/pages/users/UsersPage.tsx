import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { UserPlus, Trash2, Users, ShieldCheck } from 'lucide-react'
import { usersApi } from '@/api/users'
import type { UserSummaryResponse } from '@/types/api'
import { toast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { useAuthStore } from '@/stores/authStore'
import { saveUserPermissions, getUserPermissions } from '@/lib/userPermissions'
import { logActivity } from '@/lib/activityLog'
import { BUSINESS_TYPE_ROUTES } from '@/lib/businessRoutes'

const ROLE_LABELS: Record<string, string> = {
  Owner: 'مالك',
  Manager: 'مدير',
  Cashier: 'كاشير',
  Accountant: 'محاسب',
  Staff: 'موظف',
}

const ROLE_COLORS: Record<string, string> = {
  Owner:      'bg-purple-100 text-purple-700',
  Manager:    'bg-blue-100 text-blue-700',
  Cashier:    'bg-emerald-100 text-emerald-700',
  Accountant: 'bg-amber-100 text-amber-700',
  Staff:      'bg-gray-100 text-gray-600',
}

// All possible pages with Arabic labels
const ALL_PAGES: { route: string; label: string }[] = [
  { route: '/',                label: 'لوحة التحكم' },
  { route: '/pos',             label: 'نقطة البيع' },
  { route: '/products',        label: 'المنتجات' },
  { route: '/inventory',       label: 'المخزون' },
  { route: '/stock-counts',    label: 'الجرد' },
  { route: '/customers',       label: 'العملاء' },
  { route: '/sales',           label: 'المبيعات' },
  { route: '/purchasing',      label: 'المشتريات' },
  { route: '/finance',         label: 'المالية' },
  { route: '/reports',         label: 'التقارير' },
  { route: '/restaurant',      label: 'المطعم' },
  { route: '/hotel',           label: 'الفندق' },
  { route: '/hotel/contracts', label: 'عقود الفندق' },
  { route: '/gaming',          label: 'الألعاب' },
  { route: '/settings/zatca',  label: 'زاتكا' },
  { route: '/users',           label: 'المستخدمون' },
  { route: '/branches',        label: 'الفروع' },
  { route: '/activity-logs',   label: 'سجل النشاطات' },
]

const createSchema = z.object({
  firstName: z.string().min(1, 'الاسم الأول مطلوب'),
  lastName: z.string().min(1, 'اسم العائلة مطلوب'),
  email: z.string().email('بريد إلكتروني غير صالح'),
  password: z.string().min(8, 'كلمة المرور 8 أحرف على الأقل'),
  role: z.enum(['Owner', 'Manager', 'Cashier', 'Accountant', 'Staff']),
})

type CreateForm = z.infer<typeof createSchema>

function RoleBadge({ roles }: { roles: string[] }) {
  const top = ['Owner', 'Manager', 'Cashier', 'Accountant', 'Staff'].find((r) => roles.includes(r)) ?? roles[0]
  if (!top) return null
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLE_COLORS[top] ?? 'bg-gray-100 text-gray-600'}`}>
      {ROLE_LABELS[top] ?? top}
    </span>
  )
}

// ── Permission Chip ────────────────────────────────────────────────────────────

function PermissionChip({ user: u, onClick }: { user: UserSummaryResponse; onClick: () => void }) {
  const perms = getUserPermissions(u.id)
  const hasCustom = perms !== null
  return (
    <button
      onClick={onClick}
      title="تعديل الصفحات المسموح بها"
      className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition-colors"
    >
      <ShieldCheck className={`h-3.5 w-3.5 ${hasCustom ? 'text-emerald-500' : 'text-gray-300'}`} />
      {hasCustom ? `${perms!.length} صفحة` : 'كل الصفحات'}
    </button>
  )
}

// ── Page Permission Modal ──────────────────────────────────────────────────────

function PagePermModal({
  target,
  onClose,
}: {
  target: UserSummaryResponse
  onClose: () => void
}) {
  const { user: currentUser } = useAuthStore()

  // Filter available pages to only those relevant to this business type
  const allowedRoutes = currentUser?.businessType
    ? new Set(BUSINESS_TYPE_ROUTES[currentUser.businessType] ?? [])
    : new Set(ALL_PAGES.map((p) => p.route))
  const availablePages = ALL_PAGES.filter((p) => allowedRoutes.has(p.route))

  const existing = getUserPermissions(target.id)
  const defaultSelected = existing
    ? existing.filter((r) => allowedRoutes.has(r))
    : availablePages.map((p) => p.route)
  const [selected, setSelected] = useState<Set<string>>(new Set(defaultSelected))

  const toggle = (route: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(route)) next.delete(route)
      else next.add(route)
      return next
    })
  }

  const selectAll = () => setSelected(new Set(availablePages.map((p) => p.route)))
  const clearAll = () => setSelected(new Set(['/']))

  const handleSave = () => {
    const routes = Array.from(selected)
    saveUserPermissions(target.id, routes)
    logActivity({
      userId: currentUser?.id ?? '',
      userName: `${currentUser?.firstName ?? ''} ${currentUser?.lastName ?? ''}`.trim(),
      userEmail: currentUser?.email,
      category: 'user',
      action: 'تعديل صلاحيات الصفحات',
      details: `${target.fullName} — ${routes.length} صفحة`,
    })
    toast.success('تم حفظ الصلاحيات')
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`صلاحيات ${target.fullName}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>إلغاء</Button>
          <Button onClick={handleSave}>حفظ</Button>
        </>
      }
    >
      <div dir="rtl" className="space-y-3">
        <p className="text-xs text-gray-500">اختر الصفحات التي يستطيع هذا المستخدم الوصول إليها.</p>
        <div className="flex gap-2 text-xs">
          <button onClick={selectAll} className="text-[var(--accent)] hover:underline">تحديد الكل</button>
          <span className="text-gray-200">·</span>
          <button onClick={clearAll} className="text-gray-400 hover:underline">إلغاء الكل</button>
        </div>
        <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
          {availablePages.map((p) => (
            <label
              key={p.route}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-100 px-3 py-2 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800 transition-colors"
            >
              <input
                type="checkbox"
                checked={selected.has(p.route)}
                onChange={() => toggle(p.route)}
                className="accent-[var(--accent)]"
              />
              <span className="text-gray-800 dark:text-gray-200">{p.label}</span>
            </label>
          ))}
        </div>
      </div>
    </Modal>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export function UsersPage() {
  const { user: currentUser } = useAuthStore()
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<UserSummaryResponse | null>(null)
  const [permTarget, setPermTarget] = useState<UserSummaryResponse | null>(null)
  // After creating a user, prompt to set permissions
  const [newlyCreated, setNewlyCreated] = useState<UserSummaryResponse | null>(null)

  const canManage = currentUser?.role === 'Owner' || currentUser?.role === 'Manager'

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list().then((r) => r.data),
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { role: 'Staff' },
  })

  const createMut = useMutation({
    mutationFn: (data: CreateForm) => usersApi.create(data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['users'] })
      logActivity({
        userId: currentUser?.id ?? '',
        userName: `${currentUser?.firstName ?? ''} ${currentUser?.lastName ?? ''}`.trim(),
      userEmail: currentUser?.email,
        category: 'user',
        action: 'إضافة مستخدم',
        details: `${res.data.fullName} — ${ROLE_LABELS[res.data.roles[0]] ?? res.data.roles[0]}`,
      })
      toast.success('تم إنشاء المستخدم', '')
      setShowCreate(false)
      reset()
      setNewlyCreated(res.data)
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      toast.error('فشل إنشاء المستخدم', err?.response?.data?.detail ?? '')
    },
  })

  const deleteMut = useMutation({
    mutationFn: (u: UserSummaryResponse) => usersApi.delete(u.id),
    onSuccess: (_res, deleted) => {
      qc.invalidateQueries({ queryKey: ['users'] })
      logActivity({
        userId: currentUser?.id ?? '',
        userName: `${currentUser?.firstName ?? ''} ${currentUser?.lastName ?? ''}`.trim(),
      userEmail: currentUser?.email,
        category: 'user',
        action: 'حذف مستخدم',
        details: `${deleted.fullName} — ${deleted.email}`,
      })
      toast.success('تم حذف المستخدم', '')
      setDeleteTarget(null)
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      toast.error('فشل الحذف', err?.response?.data?.detail ?? '')
      setDeleteTarget(null)
    },
  })

  // After newly creating a user, open the permissions modal automatically
  useEffect(() => {
    if (newlyCreated) {
      setPermTarget(newlyCreated)
      setNewlyCreated(null)
    }
  }, [newlyCreated])

  return (
    <div className="p-8" dir="rtl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Users className="h-6 w-6" style={{ color: 'var(--accent)' }} />
            المستخدمون
          </h1>
          <p className="mt-1 text-gray-500">{users.length} مستخدم</p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
          >
            <UserPlus className="h-4 w-4" />
            إضافة مستخدم
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
            <tr>
              {['الاسم', 'البريد الإلكتروني', 'الدور', 'الصفحات', 'آخر دخول', canManage ? 'حذف' : ''].filter(Boolean).map((h) => (
                <th key={h} className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider dark:text-gray-400">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {isLoading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-4 py-4">
                        <div className="h-4 rounded bg-gray-200 animate-pulse dark:bg-gray-700" />
                      </td>
                    ))}
                  </tr>
                ))
              : users.map((u) => (
                  <tr key={u.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors ${!u.isActive ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white"
                          style={{ background: 'var(--accent)' }}
                        >
                          {u.firstName[0]}
                        </div>
                        <span className="font-medium text-gray-900 dark:text-gray-100">{u.fullName}</span>
                        {u.id === currentUser?.id && (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-700">أنت</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{u.email}</td>
                    <td className="px-4 py-3"><RoleBadge roles={u.roles} /></td>
                    <td className="px-4 py-3">
                      {canManage && u.id !== currentUser?.id ? (
                        <PermissionChip user={u} onClick={() => setPermTarget(u)} />
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {u.lastLoginAt
                        ? new Date(u.lastLoginAt).toLocaleDateString('ar-SA')
                        : 'لم يسجل دخول'}
                    </td>
                    {canManage && (
                      <td className="px-4 py-3">
                        {u.id !== currentUser?.id && (
                          <button
                            onClick={() => setDeleteTarget(u)}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors dark:hover:bg-red-900/20"
                            title="حذف"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
          </tbody>
        </table>
        {!isLoading && users.length === 0 && (
          <div className="py-16 text-center text-gray-400">لا يوجد مستخدمون</div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <Modal
          open
          onClose={() => { setShowCreate(false); reset() }}
          title="إضافة مستخدم جديد"
          footer={
            <>
              <Button variant="secondary" onClick={() => { setShowCreate(false); reset() }}>إلغاء</Button>
              <Button loading={createMut.isPending} onClick={handleSubmit((d) => createMut.mutate(d))}>
                إنشاء
              </Button>
            </>
          }
        >
          <form className="space-y-4" dir="rtl">
            <div className="grid grid-cols-2 gap-4">
              <Input label="الاسم الأول" error={errors.firstName?.message} {...register('firstName')} />
              <Input label="اسم العائلة" error={errors.lastName?.message} {...register('lastName')} />
            </div>
            <Input label="البريد الإلكتروني" type="email" error={errors.email?.message} {...register('email')} />
            <Input label="كلمة المرور" type="password" error={errors.password?.message} {...register('password')} />
            <Select label="الدور" error={errors.role?.message} {...register('role')}>
              {Object.entries(ROLE_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </Select>
            <p className="text-xs text-gray-400">بعد الإنشاء ستتمكن من تحديد الصفحات المسموح بها لهذا المستخدم.</p>
          </form>
        </Modal>
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <Modal
          open
          onClose={() => setDeleteTarget(null)}
          title="تأكيد الحذف"
          footer={
            <>
              <Button variant="secondary" onClick={() => setDeleteTarget(null)}>إلغاء</Button>
              <Button
                loading={deleteMut.isPending}
                className="bg-rose-600 hover:bg-rose-500"
                onClick={() => deleteMut.mutate(deleteTarget)}
              >
                حذف
              </Button>
            </>
          }
        >
          <p className="text-gray-600 text-sm text-right" dir="rtl">
            هل أنت متأكد من حذف المستخدم <span className="font-semibold text-gray-900">{deleteTarget.fullName}</span>؟
            <br />
            <span className="text-gray-400">{deleteTarget.email}</span>
          </p>
        </Modal>
      )}

      {/* Page Permissions Modal */}
      {permTarget && (
        <PagePermModal target={permTarget} onClose={() => setPermTarget(null)} />
      )}
    </div>
  )
}
