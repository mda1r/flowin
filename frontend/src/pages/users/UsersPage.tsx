import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { UserPlus, Trash2, Users, ShieldCheck, Pencil, KeyRound, UserX, UserCheck } from 'lucide-react'
import { usersApi } from '@/api/users'
import type { BusinessType, UserSummaryResponse } from '@/types/api'
import { toast } from '@/components/ui/Toast'
import { apiErrorMessage } from '@/lib/apiError'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { useAuthStore } from '@/stores/authStore'
import { readLegacyPermissions, forgetLegacyPermission } from '@/lib/userPermissions'
import { ALL_NAV_ITEMS } from '@/components/layout/Sidebar'
import { BUSINESS_TYPE_ROUTES } from '@/lib/businessRoutes'
import { useI18n } from '@/i18n'
import { intlLocale } from '@/lib/locale'

const ROLE_COLORS: Record<string, string> = {
  Owner:      'bg-brand-soft text-brand-ink dark:bg-brand/20',
  Manager:    'bg-info/10 text-info',
  Cashier:    'bg-success/10 text-success',
  Accountant: 'bg-warning/10 text-warning',
  Staff:      'bg-surface-2 text-muted',
}

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
  const { t } = useI18n()
  const pages = u.allowedPages
  return (
    <button
      onClick={onClick}
      title={t.users.editPages}
      className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted hover:bg-surface-2 hover:text-fg transition-colors"
    >
      <ShieldCheck className={`h-3.5 w-3.5 ${pages ? 'text-success' : 'text-muted/50'}`} />
      {pages ? t.users.xPages.replace('{n}', String(pages.length)) : t.users.allPages}
    </button>
  )
}

// ── Page Permission Modal ──────────────────────────────────────────────────────

// The menu pages this user's role can reach in this kind of business: the same list the sidebar draws.
function pagesFor(target: UserSummaryResponse, businessType: BusinessType | undefined) {
  const forBusiness = businessType ? new Set(BUSINESS_TYPE_ROUTES[businessType] ?? []) : null
  const role = topRole(target.roles)
  return ALL_NAV_ITEMS.filter((item) =>
    (!forBusiness || forBusiness.has(item.to)) && (!item.roles || item.roles.includes(role)))
}

function PagePermModal({
  target,
  onClose,
}: {
  target: UserSummaryResponse
  onClose: () => void
}) {
  const { user: currentUser } = useAuthStore()
  const { t } = useI18n()
  const qc = useQueryClient()

  const availablePages = pagesFor(target, currentUser?.businessType)
  const available = new Set(availablePages.map((p) => p.to))
  const [selected, setSelected] = useState<Set<string>>(() => new Set(
    target.allowedPages ? target.allowedPages.filter((r) => available.has(r)) : [...available]))

  const toggle = (route: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(route)) next.delete(route)
      else next.add(route)
      return next
    })
  }

  const saveMut = useMutation({
    // Every page ticked means no limit, so pages added to flowin later open for this user too.
    mutationFn: () => usersApi.setPages(
      target.id,
      availablePages.every((p) => selected.has(p.to))
        ? null
        : availablePages.filter((p) => selected.has(p.to)).map((p) => p.to)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success(t.settings.saved)
      onClose()
    },
    onError: (err) => toast.error(t.users.failed, apiErrorMessage(err)),
  })

  return (
    <Modal
      open
      onClose={onClose}
      title={`${t.users.permissionsFor} ${target.fullName}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t.common.cancel}</Button>
          <Button onClick={() => saveMut.mutate()} loading={saveMut.isPending} disabled={selected.size === 0}>
            {t.common.save}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-xs text-muted">{t.users.selectPages}</p>
        <div className="flex gap-2 text-xs">
          <button type="button" onClick={() => setSelected(new Set(available))} className="text-brand-ink hover:underline">
            {t.users.selectAll}
          </button>
          <span className="text-muted/50">·</span>
          <button type="button" onClick={() => setSelected(new Set())} className="text-muted hover:underline">
            {t.users.clearAll}
          </button>
        </div>
        <div className="grid grid-cols-1 gap-2 max-h-80 overflow-y-auto pe-1 sm:grid-cols-2">
          {availablePages.map((p) => (
            <label
              key={p.to}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface-2 transition-colors"
            >
              <input
                type="checkbox"
                checked={selected.has(p.to)}
                onChange={() => toggle(p.to)}
                className="accent-[rgb(var(--brand-ink))]"
              />
              <span className="text-muted [&>svg]:h-4 [&>svg]:w-4">{p.icon}</span>
              <span className="text-fg">{t.nav[p.labelKey as keyof typeof t.nav]}</span>
            </label>
          ))}
        </div>
        {selected.size === 0 && <p className="text-xs text-danger">{t.users.pickOnePage}</p>}
      </div>
    </Modal>
  )
}

// ── Edit / Reset password modals ───────────────────────────────────────────────

const editSchema = z.object({
  firstName: z.string().trim().min(1, 'الاسم الأول مطلوب'),
  lastName: z.string().trim().min(1, 'اسم العائلة مطلوب'),
  role: z.enum(['Owner', 'Manager', 'Cashier', 'Accountant', 'Staff']),
})

type EditForm = z.infer<typeof editSchema>

function topRole(roles: string[]): string {
  return ['Owner', 'Manager', 'Cashier', 'Accountant', 'Staff'].find((r) => roles.includes(r)) ?? roles[0] ?? 'Staff'
}

function EditUserModal({
  target,
  roleOptions,
  onClose,
}: {
  target: UserSummaryResponse
  roleOptions: [string, string][]
  onClose: () => void
}) {
  const { t } = useI18n()
  const qc = useQueryClient()
  const currentRole = topRole(target.roles)

  const { register, handleSubmit, formState: { errors } } = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      firstName: target.firstName,
      lastName: target.lastName,
      role: currentRole as EditForm['role'],
    },
  })

  const mut = useMutation({
    mutationFn: (data: EditForm) => usersApi.update(target.id, data),
    // The server writes the activity-log entry for this and the other account changes below.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success(t.users.updated)
      onClose()
    },
    onError: (err) => toast.error(t.users.failed, apiErrorMessage(err)),
  })

  return (
    <Modal
      open
      onClose={onClose}
      title={`${t.users.editUser} — ${target.fullName}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t.common.cancel}</Button>
          <Button loading={mut.isPending} onClick={handleSubmit((d) => mut.mutate(d))}>{t.common.save}</Button>
        </>
      }
    >
      <form className="space-y-4" dir="rtl" onSubmit={handleSubmit((d) => mut.mutate(d))}>
        <div className="grid grid-cols-2 gap-4">
          <Input label={t.settings.firstName} error={errors.firstName?.message} {...register('firstName')} />
          <Input label={t.settings.lastName} error={errors.lastName?.message} {...register('lastName')} />
        </div>
        <Select label={t.users.role} error={errors.role?.message} {...register('role')}>
          {roleOptions.map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </Select>
        <p className="text-xs text-muted">{t.users.roleChangeHint}</p>
      </form>
    </Modal>
  )
}

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const bytes = new Uint32Array(10)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}

function ResetPasswordModal({ target, onClose }: { target: UserSummaryResponse; onClose: () => void }) {
  const { t } = useI18n()
  const [password, setPassword] = useState('')
  const tooShort = password.length > 0 && password.length < 8

  const mut = useMutation({
    mutationFn: () => usersApi.resetPassword(target.id, password),
    onSuccess: () => {
      toast.success(t.users.passwordReset)
      onClose()
    },
    onError: (err) => toast.error(t.users.failed, apiErrorMessage(err)),
  })

  return (
    <Modal
      open
      onClose={onClose}
      title={`${t.users.resetPassword} — ${target.fullName}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t.common.cancel}</Button>
          <Button loading={mut.isPending} disabled={password.length < 8} onClick={() => mut.mutate()}>
            {t.common.save}
          </Button>
        </>
      }
    >
      <div className="space-y-3" dir="rtl">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input
              label={t.users.newPassword}
              type="text"
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={tooShort ? t.users.passwordMin : undefined}
            />
          </div>
          <Button variant="secondary" onClick={() => setPassword(generatePassword())}>{t.users.generate}</Button>
        </div>
        <p className="text-xs text-muted">{t.users.resetPasswordHint}</p>
      </div>
    </Modal>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export function UsersPage() {
  const { user: currentUser } = useAuthStore()
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
  const [removeTarget, setRemoveTarget] = useState<UserSummaryResponse | null>(null)
  const [editTarget, setEditTarget] = useState<UserSummaryResponse | null>(null)
  const [resetTarget, setResetTarget] = useState<UserSummaryResponse | null>(null)
  const [permTarget, setPermTarget] = useState<UserSummaryResponse | null>(null)
  // After creating a user, prompt to set permissions
  const [newlyCreated, setNewlyCreated] = useState<UserSummaryResponse | null>(null)

  const canManage = currentUser?.role === 'Owner' || currentUser?.role === 'Manager'
  const isOwner = currentUser?.role === 'Owner'
  // Only an Owner may grant the Owner role (the API enforces this too)
  const roleOptions = Object.entries(roleLabels).filter(([val]) => isOwner || val !== 'Owner')
  // Managers can't touch Owner accounts, and nobody manages their own account from here
  const canActOn = (u: UserSummaryResponse) =>
    canManage && u.id !== currentUser?.id && (isOwner || !u.roles.includes('Owner'))

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list().then((r) => r.data),
  })

  // Limits an owner set before they were saved on the server lived only in this browser: move them over once.
  const tenantId = currentUser?.tenantId
  useEffect(() => {
    if (!canManage || !tenantId || users.length === 0) return
    const legacy = readLegacyPermissions(tenantId)
    users
      .filter((u) => legacy[u.id] && (u.allowedPages || !canActOn(u)))
      .forEach((u) => forgetLegacyPermission(tenantId, u.id))
    const moves = users.filter((u) => legacy[u.id] && !u.allowedPages && canActOn(u))
    if (moves.length === 0) return
    void Promise.allSettled(moves.map((u) =>
      usersApi.setPages(u.id, legacy[u.id]).then(() => forgetLegacyPermission(tenantId, u.id)),
    )).then(() => qc.invalidateQueries({ queryKey: ['users'] }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, tenantId, canManage])

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { role: 'Staff' },
  })

  const createMut = useMutation({
    mutationFn: (data: CreateForm) => usersApi.create(data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success(t.users.created, '')
      setShowCreate(false)
      reset()
      setNewlyCreated(res.data)
    },
    onError: (err) => {
      toast.error(t.users.failed, apiErrorMessage(err))
    },
  })

  const activeMut = useMutation({
    mutationFn: ({ u, active }: { u: UserSummaryResponse; active: boolean }) =>
      active ? usersApi.activate(u.id) : usersApi.deactivate(u.id),
    onSuccess: (_res, { active }) => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success(active ? t.users.activated : t.users.deactivated)
      setRemoveTarget(null)
    },
    onError: (err) => {
      toast.error(t.users.failed, apiErrorMessage(err))
    },
  })

  const deleteMut = useMutation({
    mutationFn: (u: UserSummaryResponse) => usersApi.delete(u.id, true),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      toast.success(t.users.deleted, '')
      setRemoveTarget(null)
    },
    onError: (err) => {
      toast.error(t.users.failed, apiErrorMessage(err))
    },
  })

  // After newly creating a user, open the permissions modal automatically
  useEffect(() => {
    if (newlyCreated) {
      setPermTarget(newlyCreated)
      setNewlyCreated(null)
    }
  }, [newlyCreated])

  const iconBtn = 'rounded-lg p-1.5 text-muted transition-colors disabled:opacity-40'

  return (
    <div className="p-8">
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
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-surface-2">
            <tr>
              {[t.users.name, t.users.email, t.users.role, t.users.pages, t.users.lastLogin, canManage ? t.users.actions : ''].filter(Boolean).map((h) => (
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
                  <tr key={u.id} className="hover:bg-surface-2 transition-colors">
                    <td className="px-4 py-3">
                      <div className={`flex items-center gap-2 ${!u.isActive ? 'opacity-50' : ''}`}>
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
                    <td className={`px-4 py-3 text-muted ${!u.isActive ? 'opacity-50' : ''}`}>{u.email}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <RoleBadge roles={u.roles} />
                        {!u.isActive && (
                          <span className="rounded-full bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger">{t.users.inactive}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {canManage && u.id !== currentUser?.id ? (
                        <PermissionChip user={u} onClick={() => setPermTarget(u)} />
                      ) : (
                        <span className="text-xs text-muted/50">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted text-xs">
                      {u.lastLoginAt
                        ? new Date(u.lastLoginAt).toLocaleDateString(intlLocale(lang))
                        : t.users.never}
                    </td>
                    {canManage && (
                      <td className="px-4 py-3">
                        {canActOn(u) && (
                          <div className="flex items-center gap-0.5">
                            <button
                              onClick={() => setEditTarget(u)}
                              className={`${iconBtn} hover:bg-surface-2 hover:text-fg`}
                              title={t.users.editUser}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setResetTarget(u)}
                              className={`${iconBtn} hover:bg-surface-2 hover:text-fg`}
                              title={t.users.resetPassword}
                            >
                              <KeyRound className="h-4 w-4" />
                            </button>
                            {u.isActive ? (
                              <button
                                onClick={() => setRemoveTarget(u)}
                                className={`${iconBtn} hover:bg-danger/10 hover:text-danger dark:hover:bg-danger/15`}
                                title={t.users.deactivate}
                              >
                                <UserX className="h-4 w-4" />
                              </button>
                            ) : (
                              <button
                                onClick={() => activeMut.mutate({ u, active: true })}
                                disabled={activeMut.isPending}
                                className={`${iconBtn} hover:bg-success/10 hover:text-success`}
                                title={t.users.activate}
                              >
                                <UserCheck className="h-4 w-4" />
                              </button>
                            )}
                            {!u.isActive && !u.lastLoginAt && (
                              <button
                                onClick={() => setRemoveTarget(u)}
                                className={`${iconBtn} hover:bg-danger/10 hover:text-danger dark:hover:bg-danger/15`}
                                title={t.users.deletePermanently}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
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
          <form className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label={t.settings.firstName} error={errors.firstName?.message} {...register('firstName')} />
              <Input label={t.settings.lastName} error={errors.lastName?.message} {...register('lastName')} />
            </div>
            <Input label={t.users.email} type="email" error={errors.email?.message} {...register('email')} />
            <Input label={t.users.password} type="password" error={errors.password?.message} {...register('password')} />
            <Select label={t.users.role} error={errors.role?.message} {...register('role')}>
              {roleOptions.map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </Select>
            <p className="text-xs text-muted">{t.users.afterCreation}</p>
          </form>
        </Modal>
      )}

      {/* Deactivate / delete confirm — suspending keeps the user's shifts and orders linked */}
      {removeTarget && (
        <Modal
          open
          onClose={() => setRemoveTarget(null)}
          title={removeTarget.isActive ? t.users.confirmDeactivate : t.users.deletePermanently}
          footer={
            <>
              <Button variant="secondary" onClick={() => setRemoveTarget(null)}>{t.common.cancel}</Button>
              {!removeTarget.lastLoginAt && (
                <Button
                  variant={removeTarget.isActive ? 'ghost' : 'danger'}
                  loading={deleteMut.isPending}
                  onClick={() => deleteMut.mutate(removeTarget)}
                >
                  {t.users.deletePermanently}
                </Button>
              )}
              {removeTarget.isActive && (
                <Button
                  variant="danger"
                  loading={activeMut.isPending}
                  onClick={() => activeMut.mutate({ u: removeTarget, active: false })}
                >
                  {t.users.deactivate}
                </Button>
              )}
            </>
          }
        >
          <div className="space-y-2 text-sm text-right" dir="rtl">
            <p className="text-fg">
              <span className="font-semibold">{removeTarget.fullName}</span>
              <span className="text-muted"> — {removeTarget.email}</span>
            </p>
            <p className="text-muted">
              {removeTarget.isActive ? t.users.deactivateMessage : t.users.deletePermanentlyMessage}
            </p>
            {/* Active but never signed in: the footer also offers deletion, so warn that it is final */}
            {removeTarget.isActive && !removeTarget.lastLoginAt && (
              <p className="text-xs text-muted">{t.users.deletePermanentlyMessage}</p>
            )}
          </div>
        </Modal>
      )}

      {editTarget && (
        <EditUserModal target={editTarget} roleOptions={roleOptions} onClose={() => setEditTarget(null)} />
      )}

      {resetTarget && (
        <ResetPasswordModal target={resetTarget} onClose={() => setResetTarget(null)} />
      )}

      {/* Page Permissions Modal */}
      {permTarget && (
        <PagePermModal target={permTarget} onClose={() => setPermTarget(null)} />
      )}
    </div>
  )
}
