import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  Search,
  Eye,
  PauseCircle,
  PlayCircle,
  Plus,
  UserPlus,
  Trash2,
} from 'lucide-react'
import { superAdminApi } from '@/api/superadmin'
import type { TenantWithSubscriptionResponse, SubscriptionStatus, BusinessType } from '@/types/api'
import { toast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { NewSubscriptionModal } from './NewSubscriptionModal'
import { CreateTenantModal } from './CreateTenantModal'
import { useI18n } from '@/i18n'
import type { Translations } from '@/i18n/en'

type T = Translations

function statusBadge(status: SubscriptionStatus | undefined, isActive: boolean, t: T) {
  if (!isActive) {
    return (
      <span className="rounded-full bg-danger/15 px-2.5 py-0.5 text-xs font-semibold text-danger">
        {t.admin.tenants.statuses.suspended}
      </span>
    )
  }
  if (!status) {
    return (
      <span className="rounded-full bg-border px-2.5 py-0.5 text-xs font-semibold text-muted">
        بدون اشتراك
      </span>
    )
  }
  const map: Record<SubscriptionStatus, { bg: string; label: string }> = {
    Active:    { bg: 'bg-success/15 text-success', label: t.admin.tenants.statuses.active },
    Trial:     { bg: 'bg-info/15 text-info',       label: 'تجريبي' },
    Expired:   { bg: 'bg-danger/15 text-danger',       label: t.admin.tenants.statuses.expired },
    Suspended: { bg: 'bg-warning/15 text-warning',     label: t.admin.tenants.statuses.suspended },
  }
  const { bg, label } = map[status]
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${bg}`}>
      {label}
    </span>
  )
}

function businessTypeBadge(bt: BusinessType | undefined, labels: Record<BusinessType, string>) {
  if (!bt) return null
  const colors: Record<BusinessType, string> = {
    Retail:       'bg-border text-muted',
    Supermarket:  'bg-success/15 text-success',
    Restaurant:   'bg-warning/15 text-warning',
    Hotel:        'bg-info/15 text-info',
    Gaming:       'bg-brand/20 text-brand-ink',
    Cafe:         'bg-warning/15 text-warning',
  }
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${colors[bt]}`}>
      {labels[bt]}
    </span>
  )
}

function daysChip(days: number | undefined, t: T) {
  if (days === undefined) return null
  if (days < 0) return <span className="text-xs text-danger">{t.admin.tenants.statuses.expired}</span>
  if (days <= 7)
    return (
      <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
        {days} أيام
      </span>
    )
  return <span className="text-xs text-muted">{days} يوم</span>
}

export function TenantsPage() {
  const qc = useQueryClient()
  const { t, lang } = useI18n()
  const locale = lang === 'ar' ? 'ar-SA' : 'en-US'
  const [search, setSearch] = useState('')
  const [showCreateTenant, setShowCreateTenant] = useState(false)
  const [subscribeTarget, setSubscribeTarget] = useState<TenantWithSubscriptionResponse | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TenantWithSubscriptionResponse | null>(null)

  const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
    Retail:      t.admin.dashboard.business.retail,
    Supermarket: 'سوبرماركت',
    Restaurant:  t.admin.dashboard.business.restaurant,
    Hotel:       t.admin.dashboard.business.hotel,
    Gaming:      t.admin.dashboard.business.gaming,
    Cafe:        t.admin.dashboard.business.cafe,
  }

  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ['admin', 'tenants'],
    queryFn: () => superAdminApi.listTenants().then((r) => r.data),
  })

  const suspendMut = useMutation({
    mutationFn: (ten: TenantWithSubscriptionResponse) =>
      superAdminApi.suspendTenant(ten.id, 'تعليق يدوي من لوحة المدير العام'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'tenants'] })
      toast.success('تم تعليق الحساب', '')
    },
    onError: () => toast.error('فشلت العملية', ''),
  })

  const activateMut = useMutation({
    mutationFn: (ten: TenantWithSubscriptionResponse) =>
      superAdminApi.activateTenant(ten.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'tenants'] })
      toast.success('تم تفعيل الحساب', '')
    },
    onError: () => toast.error('فشلت العملية', ''),
  })

  const deleteMut = useMutation({
    mutationFn: (ten: TenantWithSubscriptionResponse) =>
      superAdminApi.deleteTenant(ten.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'tenants'] })
      toast.success('تم حذف المستأجر', '')
      setDeleteTarget(null)
    },
    onError: () => { toast.error('فشلت العملية', ''); setDeleteTarget(null) },
  })

  const filtered = tenants.filter(
    (ten) =>
      ten.name.includes(search) ||
      ten.adminEmail.toLowerCase().includes(search.toLowerCase()) ||
      ten.subdomain.includes(search),
  )

  return (
    <div className="p-8" dir="rtl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-fg">{t.admin.tenants.title}</h1>
          <p className="mt-1 text-muted">
            {tenants.length} مستأجر مسجل
          </p>
        </div>
        <button
          onClick={() => setShowCreateTenant(true)}
          className="flex items-center gap-2 rounded-xl bg-info px-4 py-2 text-sm font-semibold text-white hover:bg-info transition-colors"
        >
          <UserPlus className="h-4 w-4" />
          إضافة مستأجر
        </button>
      </div>

      {/* Search */}
      <div className="mb-5 relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث باسم المستأجر أو البريد أو النطاق..."
          className="w-full rounded-xl border border-border bg-surface py-2.5 pr-10 pl-4 text-sm text-fg placeholder-muted focus:border-info focus:outline-none"
        />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-surface">
            <tr>
              {[
                t.admin.tenants.name,
                'النطاق',
                t.admin.tenants.businessType,
                t.admin.tenants.plan,
                t.admin.tenants.status,
                t.admin.tenants.expires,
                'المتبقي',
                'الإجراءات',
                '',
              ].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-right text-xs font-semibold text-muted uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-surface/60">
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="px-4 py-4">
                        <div className="h-4 rounded bg-surface-2 animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              : filtered.map((ten) => {
                  const sub = ten.activeSubscription
                  const rowBg = !ten.isActive
                    ? 'opacity-60'
                    : sub?.daysRemaining !== undefined && sub.daysRemaining <= 7 && sub.daysRemaining >= 0
                    ? 'bg-warning/15'
                    : ''
                  return (
                    <tr key={ten.id} className={`hover:bg-surface-2/50 transition-colors ${rowBg}`}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-fg">{ten.name}</p>
                        <p className="text-xs text-muted">{ten.adminEmail}</p>
                      </td>
                      <td className="px-4 py-3 text-muted">{ten.subdomain}</td>
                      <td className="px-4 py-3">{businessTypeBadge(ten.businessType, BUSINESS_TYPE_LABELS)}</td>
                      <td className="px-4 py-3 text-muted">{sub?.planName ?? '—'}</td>
                      <td className="px-4 py-3">
                        {statusBadge(sub?.status, ten.isActive, t)}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {sub?.expiryDate
                          ? new Date(sub.expiryDate).toLocaleDateString(locale)
                          : '—'}
                      </td>
                      <td className="px-4 py-3">{daysChip(sub?.daysRemaining, t)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Link
                            to="/admin/tenants/$id"
                            params={{ id: ten.id }}
                            className="rounded-lg p-1.5 text-muted hover:bg-border hover:text-fg transition-colors"
                            title={t.admin.tenants.viewDetails}
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                          <button
                            onClick={() => setSubscribeTarget(ten)}
                            className="rounded-lg p-1.5 text-muted hover:bg-border hover:text-info transition-colors"
                            title={t.admin.subscription.newSubscription}
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                          {ten.isActive ? (
                            <button
                              onClick={() => suspendMut.mutate(ten)}
                              className="rounded-lg p-1.5 text-muted hover:bg-border hover:text-warning transition-colors"
                              title={t.admin.tenants.suspend}
                            >
                              <PauseCircle className="h-4 w-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => activateMut.mutate(ten)}
                              className="rounded-lg p-1.5 text-muted hover:bg-border hover:text-success transition-colors"
                              title={t.admin.tenants.activate}
                            >
                              <PlayCircle className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setDeleteTarget(ten)}
                          className="rounded-lg p-1.5 text-muted hover:bg-border hover:text-danger transition-colors"
                          title={t.admin.tenants.delete}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
          </tbody>
        </table>
        {!isLoading && filtered.length === 0 && (
          <div className="py-16 text-center text-muted">{t.common.noData}</div>
        )}
      </div>

      {subscribeTarget && (
        <NewSubscriptionModal
          tenantId={subscribeTarget.id}
          tenantName={subscribeTarget.name}
          onClose={() => setSubscribeTarget(null)}
        />
      )}

      {showCreateTenant && (
        <CreateTenantModal onClose={() => setShowCreateTenant(false)} />
      )}

      {deleteTarget && (
        <Modal
          open
          onClose={() => setDeleteTarget(null)}
          title="تأكيد حذف المستأجر"
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
          <div dir="rtl" className="space-y-2 text-sm">
            <p className="text-muted">
              هل أنت متأكد من حذف المستأجر <span className="font-bold text-fg">{deleteTarget.name}</span>؟
            </p>
            <p className="text-muted">{deleteTarget.adminEmail}</p>
            <p className="rounded-lg bg-danger/15 border border-danger/40 px-3 py-2 text-danger text-xs">
              سيتم حذف المستأجر وجميع فروعه واشتراكاته بشكل نهائي لا يمكن التراجع عنه.
            </p>
          </div>
        </Modal>
      )}
    </div>
  )
}
