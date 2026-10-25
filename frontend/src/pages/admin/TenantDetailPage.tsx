import { useState } from 'react'
import { useParams, Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight,
  PauseCircle,
  PlayCircle,
  Plus,
  Calendar,
  Users,
  GitBranch,
  MapPin,
  Phone,
  Mail,
  CheckCircle2,
  XCircle,
  Star,
  Sparkles,
} from 'lucide-react'
import { superAdminApi } from '@/api/superadmin'
import type { SubscriptionStatus, BranchResponse } from '@/types/api'
import { toast } from '@/components/ui/Toast'
import { NewSubscriptionModal } from './NewSubscriptionModal'
import { useI18n } from '@/i18n'

function StatusBadge({ status, isActive }: { status?: SubscriptionStatus; isActive: boolean }) {
  const { t } = useI18n()

  if (!isActive)
    return (
      <span className="rounded-full bg-danger/15 px-3 py-1 text-sm font-semibold text-danger">
        {t.admin.tenantDetail.statuses.suspended}
      </span>
    )
  const map: Record<SubscriptionStatus, { bg: string; label: string }> = {
    Active:    { bg: 'bg-success/15 text-success', label: t.admin.tenantDetail.statuses.active },
    Trial:     { bg: 'bg-info/15 text-info',       label: 'تجريبي' },
    Expired:   { bg: 'bg-danger/15 text-danger',       label: t.admin.tenantDetail.statuses.expired },
    Suspended: { bg: 'bg-warning/15 text-warning',     label: t.admin.tenantDetail.statuses.suspended },
  }
  if (!status)
    return (
      <span className="rounded-full bg-border px-3 py-1 text-sm font-semibold text-muted">
        بدون اشتراك
      </span>
    )
  const { bg, label } = map[status]
  return <span className={`rounded-full px-3 py-1 text-sm font-semibold ${bg}`}>{label}</span>
}

export function TenantDetailPage() {
  const { id } = useParams({ from: '/admin/admin/tenants/$id' })
  const qc = useQueryClient()
  const { t, lang } = useI18n()
  const locale = lang === 'ar' ? 'ar-SA' : 'en-US'
  const [showSubscribeModal, setShowSubscribeModal] = useState(false)

  const { data: tenant, isLoading } = useQuery({
    queryKey: ['admin', 'tenant', id],
    queryFn: () => superAdminApi.getTenant(id).then((r) => r.data),
  })

  const { data: branches = [] } = useQuery({
    queryKey: ['admin', 'tenant', id, 'branches'],
    queryFn: () => superAdminApi.getTenantBranches(id).then((r) => r.data),
    enabled: !!tenant,
  })

  const suspendMut = useMutation({
    mutationFn: () => superAdminApi.suspendTenant(id, 'تعليق من صفحة تفاصيل المستأجر'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'tenant', id] })
      qc.invalidateQueries({ queryKey: ['admin', 'tenants'] })
      toast.success('تم تعليق الحساب', '')
    },
  })

  const activateMut = useMutation({
    mutationFn: () => superAdminApi.activateTenant(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'tenant', id] })
      qc.invalidateQueries({ queryKey: ['admin', 'tenants'] })
      toast.success('تم تفعيل الحساب', '')
    },
  })

  const aiToggleMut = useMutation({
    mutationFn: (enabled: boolean) => superAdminApi.setTenantAiAccess(id, enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'tenant', id] }),
  })

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-info border-t-transparent" />
      </div>
    )
  }

  if (!tenant) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-muted">
        <p>المستأجر غير موجود</p>
        <Link to="/admin/tenants" className="text-info hover:underline">
          {t.common.back}
        </Link>
      </div>
    )
  }

  const sub = tenant.activeSubscription

  return (
    <div className="p-8" dir="rtl">
      {/* Back */}
      <Link
        to="/admin/tenants"
        className="mb-6 flex items-center gap-2 text-sm text-muted hover:text-fg transition-colors"
      >
        <ArrowRight className="h-4 w-4" />
        {t.admin.tenantDetail.back}
      </Link>

      {/* Header */}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-fg">{tenant.name}</h1>
            <StatusBadge status={sub?.status} isActive={tenant.isActive} />
          </div>
          <p className="mt-1 text-muted">
            {tenant.subdomain} · {tenant.adminEmail}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            عضو منذ {new Date(tenant.createdAt).toLocaleDateString(locale)}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSubscribeModal(true)}
            className="flex items-center gap-2 rounded-lg bg-info px-4 py-2 text-sm font-semibold text-white hover:bg-info transition-colors"
          >
            <Plus className="h-4 w-4" />
            {t.admin.subscription.newSubscription}
          </button>
          {tenant.isActive ? (
            <button
              onClick={() => suspendMut.mutate()}
              disabled={suspendMut.isPending}
              className="flex items-center gap-2 rounded-lg border border-warning px-4 py-2 text-sm font-semibold text-warning hover:bg-warning/15 transition-colors"
            >
              <PauseCircle className="h-4 w-4" />
              {t.admin.tenants.suspend}
            </button>
          ) : (
            <button
              onClick={() => activateMut.mutate()}
              disabled={activateMut.isPending}
              className="flex items-center gap-2 rounded-lg border border-success px-4 py-2 text-sm font-semibold text-success hover:bg-success/15 transition-colors"
            >
              <PlayCircle className="h-4 w-4" />
              {t.admin.tenants.activate}
            </button>
          )}
        </div>
      </div>

      {/* Active subscription card */}
      {sub && (
        <div className="mb-8 rounded-xl border border-border bg-surface p-6">
          <h2 className="mb-4 text-base font-semibold text-fg">{t.admin.tenantDetail.subscription}</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <InfoBox
              icon={<Calendar className="h-4 w-4 text-info" />}
              label={t.admin.tenants.plan}
              value={sub.planName}
            />
            <InfoBox
              icon={<Calendar className="h-4 w-4 text-success" />}
              label={t.admin.tenantDetail.expires}
              value={new Date(sub.expiryDate).toLocaleDateString(locale)}
            />
            <InfoBox
              icon={<GitBranch className="h-4 w-4 text-warning" />}
              label={t.admin.plans.maxBranches}
              value={sub.maxBranches.toString()}
            />
            <InfoBox
              icon={<Users className="h-4 w-4 text-brand-ink" />}
              label={t.admin.plans.maxUsers}
              value={sub.maxUsers.toString()}
            />
          </div>
          {sub.notes && (
            <p className="mt-4 rounded-lg bg-surface-2 px-4 py-3 text-sm text-muted">
              {sub.notes}
            </p>
          )}
        </div>
      )}

      {/* AI Access Toggle */}
      <div className="mb-8 flex items-center justify-between rounded-xl border border-border bg-surface px-6 py-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${tenant.aiEnabled ? 'bg-brand/20' : 'bg-surface-2'}`}>
            <Sparkles className={`h-4 w-4 ${tenant.aiEnabled ? 'text-brand-ink' : 'text-muted'}`} />
          </div>
          <div>
            <p className="text-sm font-semibold text-fg">الذكاء الاصطناعي</p>
            <p className="text-xs text-muted">
              {tenant.aiEnabled
                ? 'مفعّل — يظهر كاشير AI ومساعد المبيعات ومستشار الضريبة'
                : 'معطّل — أزرار AI مخفية عن المستأجر'}
            </p>
          </div>
        </div>
        <button
          onClick={() => aiToggleMut.mutate(!tenant.aiEnabled)}
          disabled={aiToggleMut.isPending}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:opacity-50 ${
            tenant.aiEnabled ? 'bg-brand' : 'bg-border'
          }`}
          role="switch"
          aria-checked={tenant.aiEnabled}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              tenant.aiEnabled ? '-translate-x-5' : '-translate-x-0.5'
            }`}
          />
        </button>
      </div>

      {/* Subscription history */}
      <div className="rounded-xl border border-border bg-surface">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold text-fg">{t.admin.tenantDetail.history}</h2>
        </div>
        <div className="divide-y divide-border">
          {tenant.subscriptionHistory.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted">{t.common.noData}</p>
          ) : (
            tenant.subscriptionHistory.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className="text-sm font-medium text-fg">{s.planName}</p>
                  <p className="text-xs text-muted">
                    {new Date(s.startDate).toLocaleDateString(locale)} ←{' '}
                    {new Date(s.expiryDate).toLocaleDateString(locale)}
                  </p>
                  {s.notes && (
                    <p className="mt-1 text-xs italic text-muted">{s.notes}</p>
                  )}
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-fg">
                    {s.planPrice.toLocaleString(locale)} ر.س
                  </p>
                  <StatusBadgeMini status={s.status} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Branches */}
      <div className="mt-8 rounded-xl border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-muted" />
            <h2 className="text-base font-semibold text-fg">الفروع</h2>
            {branches.length > 0 && (
              <span className="rounded-full bg-border px-2 py-0.5 text-xs font-medium text-muted">
                {branches.length}
              </span>
            )}
          </div>
          {sub && (
            <span className="text-xs text-muted">
              الحد الأقصى: {sub.maxBranches} فرع
            </span>
          )}
        </div>

        {branches.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-muted">
            <GitBranch className="h-8 w-8 opacity-40" />
            <p className="text-sm">لم يُنشئ المستأجر أي فروع بعد</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {branches.map((branch) => (
              <BranchRow key={branch.id} branch={branch} />
            ))}
          </div>
        )}
      </div>

      {showSubscribeModal && (
        <NewSubscriptionModal
          tenantId={tenant.id}
          tenantName={tenant.name}
          tenantBusinessType={tenant.businessType}
          onClose={() => setShowSubscribeModal(false)}
        />
      )}
    </div>
  )
}

function InfoBox({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg bg-surface-2 p-4">
      <div className="mb-1.5">{icon}</div>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-fg">{value}</p>
    </div>
  )
}

function StatusBadgeMini({ status }: { status: SubscriptionStatus }) {
  const { t } = useI18n()
  const map: Record<SubscriptionStatus, { bg: string; label: string }> = {
    Active:    { bg: 'text-success', label: t.admin.tenantDetail.statuses.active },
    Trial:     { bg: 'text-info',    label: 'تجريبي' },
    Expired:   { bg: 'text-danger',    label: t.admin.tenantDetail.statuses.expired },
    Suspended: { bg: 'text-warning',   label: t.admin.tenantDetail.statuses.suspended },
  }
  const { bg, label } = map[status]
  return <span className={`text-xs ${bg}`}>{label}</span>
}

const BRANCH_TYPE_LABEL: Record<string, string> = {
  Retail: 'تجزئة', Restaurant: 'مطعم', Hotel: 'فندق',
  Gaming: 'ألعاب', Warehouse: 'مستودع', Office: 'مكتب', Cafe: 'كافيه',
}

function BranchRow({ branch }: { branch: BranchResponse }) {
  const location = [branch.city, branch.country].filter(Boolean).join('، ')

  return (
    <div className="flex items-center justify-between px-6 py-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-2">
          <GitBranch className="h-4 w-4 text-muted" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-fg">{branch.name}</p>
            {branch.isMainBranch && (
              <Star className="h-3.5 w-3.5 text-warning" aria-label="الفرع الرئيسي" />
            )}
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">
              {BRANCH_TYPE_LABEL[branch.type] ?? branch.type}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-3 text-xs text-muted">
            {location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {location}
              </span>
            )}
            {branch.phoneNumber && (
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {branch.phoneNumber}
              </span>
            )}
            {branch.email && (
              <span className="flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {branch.email}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {branch.isActive ? (
          <span className="flex items-center gap-1 text-xs text-success">
            <CheckCircle2 className="h-3.5 w-3.5" />
            نشط
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-muted">
            <XCircle className="h-3.5 w-3.5" />
            غير نشط
          </span>
        )}
      </div>
    </div>
  )
}
