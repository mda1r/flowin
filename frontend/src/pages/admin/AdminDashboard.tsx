import { useQuery } from '@tanstack/react-query'
import {
  Building2,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  PauseCircle,
  BarChart3,
} from 'lucide-react'
import { superAdminApi } from '@/api/superadmin'
import type { TenantWithSubscriptionResponse, BusinessType } from '@/types/api'
import { useI18n } from '@/i18n'

const BIZ_COLOR: Record<BusinessType, string> = {
  Retail:      'bg-slate-500',
  Supermarket: 'bg-emerald-500',
  Restaurant:  'bg-orange-500',
  Hotel:       'bg-blue-500',
  Gaming:      'bg-purple-500',
  Cafe:        'bg-amber-500',
}

function computeStats(tenants: TenantWithSubscriptionResponse[]) {
  const total     = tenants.length
  const active    = tenants.filter((t) => t.isActive && t.activeSubscription?.status === 'Active').length
  const suspended = tenants.filter((t) => !t.isActive).length
  const trial     = tenants.filter((t) => t.activeSubscription?.status === 'Trial').length
  const expired   = tenants.filter((t) => t.activeSubscription?.status === 'Expired' || (!t.isActive && !t.activeSubscription)).length

  const mrr = tenants
    .filter((t) => t.isActive && t.activeSubscription?.status === 'Active')
    .reduce((sum, t) => sum + (t.activeSubscription?.planPrice ?? 0), 0)

  const arr = mrr * 12

  const byType = tenants.reduce<Partial<Record<BusinessType, number>>>((acc, t) => {
    if (!t.businessType) return acc
    acc[t.businessType] = (acc[t.businessType] ?? 0) + 1
    return acc
  }, {})

  return { total, active, suspended, trial, expired, mrr, arr, byType }
}

export function AdminDashboard() {
  const { t, lang } = useI18n()
  const locale = lang === 'ar' ? 'ar-SA' : 'en-US'

  const BIZ_LABEL: Record<BusinessType, string> = {
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

  const stats = computeStats(tenants)

  const expiringTenants = tenants
    .filter(
      (t) =>
        t.activeSubscription &&
        t.activeSubscription.daysRemaining >= 0 &&
        t.activeSubscription.daysRemaining <= 7,
    )
    .sort((a, b) => (a.activeSubscription?.daysRemaining ?? 0) - (b.activeSubscription?.daysRemaining ?? 0))
    .slice(0, 5)

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-8 p-8" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-white">{t.admin.dashboard.title}</h1>
        <p className="mt-1 text-slate-400">نظرة شاملة على الإيرادات والمستأجرين</p>
      </div>

      {/* Revenue KPIs */}
      <div>
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-500">
          <TrendingUp className="h-4 w-4" />
          {t.admin.dashboard.revenue}
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-2xl border border-emerald-800/40 bg-emerald-900/20 p-6">
            <p className="text-xs font-medium uppercase tracking-wider text-emerald-400">MRR — {t.admin.dashboard.mrr}</p>
            <p className="mt-3 text-4xl font-black tabular-nums text-white">
              {stats.mrr.toLocaleString(locale)}
              <span className="mr-1 text-lg font-medium text-slate-400">ر.س</span>
            </p>
            <p className="mt-1 text-xs text-slate-500">من {stats.active} {t.admin.dashboard.activeTenants}</p>
          </div>
          <div className="rounded-2xl border border-blue-800/40 bg-blue-900/20 p-6">
            <p className="text-xs font-medium uppercase tracking-wider text-blue-400">ARR — {t.admin.dashboard.arr}</p>
            <p className="mt-3 text-4xl font-black tabular-nums text-white">
              {stats.arr.toLocaleString(locale)}
              <span className="mr-1 text-lg font-medium text-slate-400">ر.س</span>
            </p>
            <p className="mt-1 text-xs text-slate-500">تقدير سنوي بناءً على MRR × 12</p>
          </div>
        </div>
      </div>

      {/* Tenant KPIs */}
      <div>
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-500">
          <Building2 className="h-4 w-4" />
          {t.admin.dashboard.tenants}
        </h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="إجمالي المستأجرين"
            value={stats.total}
            icon={<Building2 className="h-5 w-5 text-slate-400" />}
            color="slate"
          />
          <StatCard
            label={t.admin.dashboard.activeTenants}
            value={stats.active}
            icon={<CheckCircle className="h-5 w-5 text-emerald-400" />}
            color="emerald"
          />
          <StatCard
            label="تجريبي"
            value={stats.trial}
            icon={<BarChart3 className="h-5 w-5 text-amber-400" />}
            color="amber"
          />
          <StatCard
            label="معلّق / منتهي"
            value={stats.suspended + stats.expired}
            icon={<PauseCircle className="h-5 w-5 text-rose-400" />}
            color="rose"
          />
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Business type breakdown */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="mb-5 text-base font-semibold text-white">توزيع أنواع الأعمال</h2>
          {Object.keys(stats.byType).length === 0 ? (
            <p className="text-sm text-slate-400">{t.common.noData}</p>
          ) : (
            <div className="space-y-3">
              {(Object.entries(stats.byType) as [BusinessType, number][])
                .sort((a, b) => b[1] - a[1])
                .map(([type, count]) => {
                  const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0
                  return (
                    <div key={type}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-300">{BIZ_LABEL[type]}</span>
                        <span className="tabular-nums text-slate-400">
                          {count} ({pct}%)
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className={`h-full rounded-full ${BIZ_COLOR[type]}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </div>

        {/* Expiring soon */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="mb-5 text-base font-semibold text-white">اشتراكات تنتهي قريباً</h2>
          {expiringTenants.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-slate-500">
              <CheckCircle className="h-8 w-8 text-emerald-600" />
              <p className="text-sm">لا توجد اشتراكات تنتهي خلال 7 أيام</p>
            </div>
          ) : (
            <div className="space-y-3">
              {expiringTenants.map((ten) => (
                <div
                  key={ten.id}
                  className="flex items-center justify-between rounded-xl bg-slate-800 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-white">{ten.name}</p>
                    <p className="text-xs text-slate-400">{ten.adminEmail}</p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      (ten.activeSubscription?.daysRemaining ?? 0) <= 3
                        ? 'bg-rose-900/60 text-rose-300'
                        : 'bg-amber-900/60 text-amber-300'
                    }`}
                  >
                    {ten.activeSubscription?.daysRemaining} يوم
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* No-sub tenants */}
      {stats.expired > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-rose-800/40 bg-rose-900/10 px-4 py-3">
          <XCircle className="h-4 w-4 flex-shrink-0 text-rose-400" />
          <p className="text-sm text-rose-300">
            {stats.expired} مستأجر بدون اشتراك نشط — يحتاج متابعة
          </p>
          <TrendingDown className="mr-auto h-4 w-4 flex-shrink-0 text-rose-400" />
        </div>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string
  value: number | string
  icon: React.ReactNode
  color: 'slate' | 'emerald' | 'rose' | 'amber'
}) {
  const styles = {
    slate:   'bg-slate-800/60 border-slate-700/40',
    emerald: 'bg-emerald-900/30 border-emerald-800/40',
    rose:    'bg-rose-900/30 border-rose-800/40',
    amber:   'bg-amber-900/30 border-amber-800/40',
  }[color]

  return (
    <div className={`rounded-xl border p-5 ${styles}`}>
      <div className="mb-3">{icon}</div>
      <p className="text-2xl font-bold tabular-nums text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{label}</p>
    </div>
  )
}
