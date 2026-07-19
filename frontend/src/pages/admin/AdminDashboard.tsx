import { useQuery } from '@tanstack/react-query'
import { Building2, CheckCircle, XCircle, TrendingUp } from 'lucide-react'
import { superAdminApi } from '@/api/superadmin'
import type { TenantWithSubscriptionResponse } from '@/types/api'

function getStatusCounts(tenants: TenantWithSubscriptionResponse[]) {
  const total = tenants.length
  const active = tenants.filter((t) => t.isActive && t.activeSubscription?.status === 'Active').length
  const trial = tenants.filter((t) => t.activeSubscription?.status === 'Trial').length
  const expired = tenants.filter((t) => t.activeSubscription?.status === 'Expired' || !t.isActive).length

  const revenueThisMonth = tenants
    .filter((t) => t.activeSubscription?.status === 'Active')
    .reduce((sum, t) => sum + (t.activeSubscription?.planPrice ?? 0), 0)

  return { total, active, trial, expired, revenueThisMonth }
}

export function AdminDashboard() {
  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ['admin', 'tenants'],
    queryFn: () => superAdminApi.listTenants().then((r) => r.data),
  })

  const stats = getStatusCounts(tenants)

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
    <div className="p-8" dir="rtl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">لوحة التحكم</h1>
        <p className="mt-1 text-slate-400">نظرة عامة على المستأجرين والاشتراكات</p>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="إجمالي المستأجرين"
          value={stats.total}
          icon={<Building2 className="h-5 w-5 text-blue-400" />}
          color="blue"
        />
        <StatCard
          label="اشتراكات نشطة"
          value={stats.active}
          icon={<CheckCircle className="h-5 w-5 text-emerald-400" />}
          color="emerald"
        />
        <StatCard
          label="تجريبي / منتهي"
          value={stats.trial + stats.expired}
          icon={<XCircle className="h-5 w-5 text-rose-400" />}
          color="rose"
        />
        <StatCard
          label="إيرادات الشهر"
          value={`${stats.revenueThisMonth.toLocaleString('ar-SA')} ر.س`}
          icon={<TrendingUp className="h-5 w-5 text-amber-400" />}
          color="amber"
        />
      </div>

      {/* Expiring Soon */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="mb-4 text-base font-semibold text-white">اشتراكات تنتهي قريباً</h2>
        {expiringTenants.length === 0 ? (
          <p className="text-sm text-slate-400">لا توجد اشتراكات تنتهي خلال 7 أيام</p>
        ) : (
          <div className="space-y-3">
            {expiringTenants.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between rounded-lg bg-slate-800 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-white">{t.name}</p>
                  <p className="text-xs text-slate-400">{t.adminEmail}</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    (t.activeSubscription?.daysRemaining ?? 0) <= 3
                      ? 'bg-rose-900/60 text-rose-300'
                      : 'bg-amber-900/60 text-amber-300'
                  }`}
                >
                  {t.activeSubscription?.daysRemaining} يوم
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
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
  color: 'blue' | 'emerald' | 'rose' | 'amber'
}) {
  const bg = {
    blue: 'bg-blue-900/30 border-blue-800/40',
    emerald: 'bg-emerald-900/30 border-emerald-800/40',
    rose: 'bg-rose-900/30 border-rose-800/40',
    amber: 'bg-amber-900/30 border-amber-800/40',
  }[color]

  return (
    <div className={`rounded-xl border p-5 ${bg}`}>
      <div className="mb-3">{icon}</div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{label}</p>
    </div>
  )
}
