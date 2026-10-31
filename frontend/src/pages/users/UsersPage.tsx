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
import { useI18n } from '@/i18n'

const ROLE_LABELS: Record<string, string> = {
  Owner: 'مالك',
  Manager: 'مدير',
  Cashier: 'كاشير',
  Accountant: 'محاسب',
  Staff: 'موظف',
}

const ROLE_COLORS: Record<string, string> = {
  Owner:      'bg-brand-soft text-brand-ink dark:bg-brand/20',
  Manager:    'bg-info/10 text-info',
  Cashier:    'bg-success/10 text-success',
  Accountant: 'bg-warning/10 text-warning',
  Staff:      'bg-surface-2 text-muted',
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
  const { t } = useI18n()
  const roleLabels: Record<string, string> = {
    Owner:      t.users.roles.owner,
    Manager:    t.users.roles.admin,
    Cashier:    t.users.roles.cashier,
    Staff:      t.users.roles.viewer,
    Accountant: t.users.accountant,
  }
  const top = ['Owner', 'Manager', 'Cashier', 'Accountant', 'Staff'].find((r) => roles.includes(r)) ?? roles[0]
  if (!top) return null
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLE_COLORS[top] ?? 'bg-surface-2 text-muted'}`}>
      {roleLabels[top] ?? top}
    </span>
  )
}

// ── Permission Chip ────────────────────────────────────────────────────────────

function PermissionChip({ user: u, onClick }: { user: UserSummaryResponse; onClick: () => void }) {
  const { tenantId } = useAuthStore()
  const { t } = useI18n()
  const perms = getUserPermissions(tenantId ?? '', u.id)
  const hasCustom = perms !== null
  return (
    <button
      onClick={onClick}
      title="تعديل الصفحات المسموح بها"
      className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted hover:bg-surface-2 hover:text-fg transition-colors"
    >
      <ShieldCheck className={`h-3.5 w-3.5 ${hasCustom ? 'text-success' : 'text-muted/50'}`} />
      {hasCustom ? t.users.xPages.replace('{n}', String(perms!.length)) : t.users.allPages}
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
  const { user: currentUser, tenantId } = useAuthStore()
  const { t } = useI18n()

  // Filter available pages to only those relevant to this business type
  const allowedRoutes = currentUser?.businessType
    ? new Set(BUSINESS_TYPE_ROUTES[currentUser.businessType] ?? [])
    : new Set(ALL_PAGES.map((p) => p.route))
  const availablePages = ALL_PAGES.filter((p) => allowedRoutes.has(p.route))

  const existing = getUserPermissions(tenantId ?? '', target.id)
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
    saveUserPermissions(tenantId ?? '', target.id, routes)
    logActivity(tenantId ?? '', {
      userId: currentUser?.id ?? '',
      userName: `${currentUser?.firstName ?? ''} ${currentUser?.lastName ?? ''}`.trim(),
      userEmail: currentUser?.email,
      category: 'user',
      action: 'تعديل صلاحيات الصفحات',
      details: `${target.fullName} — ${routes.length} صفحة`,
    })
    toast.success(t.settings.saved)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`${t.users.permissionsFor} ${target.fullName}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t.common.cancel}</Button>
          <Button onClick={handleSave}>{t.common.save}</Button>
        </>
      }
    >
      <div dir="rtl" className="space-y-3">
        <p className="text-xs text-muted">{t.users.selectPages}</p>
        <div className="flex gap-2 text-xs">
          <button onClick={selectAll} className="text-brand-ink hover:underline">{t.users.selectAll}</button>
          <span className="text-muted/50">·</span>
          <button onClick={clearAll} className="text-muted hover:underline">إلغاء الكل</button>
        </div>
        <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
          {availablePages.map((p) => (
            <label
              key={p.route}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface-2 transition-colors"
            >
              <input
                type="checkbox"
                checked={selected.has(p.route)}
                onChange={() => toggle(p.route)}
                className="accent-[rgb(var(--brand-ink))]"
              />
              <span className="text-fg">{p.label}</span>
            </label>
          ))}
        </div>
      </div>
    </Modal>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export function UsersPage() {
  const { user: currentUser, tenantId } = useAuthStore()
  const { t, lang } = useI18n()
  const roleLabels: Record<string, string> = {
    Owner:      t.users.roles.owner,
    Manager:    t.users.roles.admin,
    Cashier:    t.users.roles.cashier,
    Staff:      t.users.roles.viewer,
    Accountant: t.users.accountant,
  }
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
      logActivity(tenantId ?? '', {
        userId: currentUser?.id ?? '',
        userName: `${currentUser?.firstName ?? ''} ${currentUser?.lastName ?? ''}`.trim(),
        userEmail: currentUser?.email,
        category: 'user',
        action: 'إضافة مستخدم',
        details: `${res.data.fullName} — ${ROLE_LABELS[res.data.roles[0]] ?? res.data.roles[0]}`,
      })
      toast.success(t.users.created, '')
      setShowCreate(false)
      reset()
      setNewlyCreated(res.data)
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      toast.error(t.users.failed, err?.response?.data?.detail ?? '')
    },
  })

  const deleteMut = useMutation({
    mutationFn: (u: UserSummaryResponse) => usersApi.delete(u.id),
    onSuccess: (_res, deleted) => {
      qc.invalidateQueries({ queryKey: ['users'] })
      logActivity(tenantId ?? '', {
        userId: currentUser?.id ?? '',
        userName: `${currentUser?.firstName ?? ''} ${currentUser?.lastName ?? ''}`.trim(),
        userEmail: currentUser?.email,
        category: 'user',
        action: 'حذف مستخدم',
        details: `${deleted.fullName} — ${deleted.email}`,
      })
      toast.success(t.users.updated, '')
      setDeleteTarget(null)
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      toast.error(t.users.failed, err?.response?.data?.detail ?? '')
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
          <h1 className="text-2xl font-bold text-fg flex items-center gap-2">
            <Users className="h-6 w-6" style={{ color: 'var(--accent)' }} />
            {t.users.title}
          </h1>
          <p className="mt-1 text-muted">{t.users.xUsers.replace('{n}', String(users.length))}</p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-brand-fg hover:bg-brand/90 transition-colors"
          >
            <UserPlus className="h-4 w-4" />
            {t.users.addUser}
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-surface-2">
            <tr>
              {[t.users.name, t.users.email, t.users.role, t.users.pages, t.users.lastLogin, canManage ? t.common.delete : ''].filter(Boolean).map((h) => (
                <th key={h} className="px-4 py-3 text-right text-xs font-semibold text-muted uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-4 py-4">
                        <div className="h-4 rounded bg-border animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              : users.map((u) => (
                  <tr key={u.id} className={`hover:bg-surface-2 transition-colors ${!u.isActive ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="bg-brand flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-brand-fg"
                        >
                          {u.firstName[0]}
                        </div>
                        <span className="font-medium text-fg">{u.fullName}</span>
                        {u.id === currentUser?.id && (
                          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">{t.users.you}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted">{u.email}</td>
                    <td className="px-4 py-3"><RoleBadge roles={u.roles} /></td>
                    <td className="px-4 py-3">
                      {canManage && u.id !== currentUser?.id ? (
                        <PermissionChip user={u} onClick={() => setPermTarget(u)} />
                      ) : (
                        <span className="text-xs text-muted/50">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted text-xs">
                      {u.lastLoginAt
                        ? new Date(u.lastLoginAt).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US')
                        : t.users.never}
                    </td>
                    {canManage && (
                      <td className="px-4 py-3">
                        {u.id !== currentUser?.id && (
                          <button
                            onClick={() => setDeleteTarget(u)}
                            className="rounded-lg p-1.5 text-muted hover:bg-danger/10 hover:text-danger transition-colors dark:hover:bg-danger/15"
                            title={t.common.delete}
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
          <div className="py-16 text-center text-muted">{t.users.noUsers}</div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <Modal
          open
          onClose={() => { setShowCreate(false); reset() }}
          title={t.users.newUser}
          footer={
            <>
              <Button variant="secondary" onClick={() => { setShowCreate(false); reset() }}>{t.common.cancel}</Button>
              <Button loading={createMut.isPending} onClick={handleSubmit((d) => createMut.mutate(d))}>
                {t.common.save}
              </Button>
            </>
          }
        >
          <form className="space-y-4" dir="rtl">
            <div className="grid grid-cols-2 gap-4">
              <Input label={t.settings.firstName} error={errors.firstName?.message} {...register('firstName')} />
              <Input label={t.settings.lastName} error={errors.lastName?.message} {...register('lastName')} />
            </div>
            <Input label={t.users.email} type="email" error={errors.email?.message} {...register('email')} />
            <Input label={t.users.password} type="password" error={errors.password?.message} {...register('password')} />
            <Select label={t.users.role} error={errors.role?.message} {...register('role')}>
              {Object.entries(roleLabels).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </Select>
            <p className="text-xs text-muted">{t.users.afterCreation}</p>
          </form>
        </Modal>
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <Modal
          open
          onClose={() => setDeleteTarget(null)}
          title={t.users.confirmDelete}
          footer={
            <>
              <Button variant="secondary" onClick={() => setDeleteTarget(null)}>{t.common.cancel}</Button>
              <Button
                loading={deleteMut.isPending}
                className="bg-danger hover:bg-danger"
                onClick={() => deleteMut.mutate(deleteTarget)}
              >
                {t.common.delete}
              </Button>
            </>
          }
        >
          <p className="text-muted text-sm text-right" dir="rtl">
            {t.users.confirmDeleteMessage} <span className="font-semibold text-fg">{deleteTarget.fullName}</span>؟
            <br />
            <span className="text-muted">{deleteTarget.email}</span>
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
