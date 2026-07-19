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
} from 'lucide-react'
import { superAdminApi } from '@/api/superadmin'
import type { SubscriptionStatus } from '@/types/api'
import { toast } from '@/components/ui/Toast'
import { NewSubscriptionModal } from './NewSubscriptionModal'

function StatusBadge({ status, isActive }: { status?: SubscriptionStatus; isActive: boolean }) {
  if (!isActive)
    return (
      <span className="rounded-full bg-rose-900/60 px-3 py-1 text-sm font-semibold text-rose-300">
        الحساب معلّق
      </span>
    )
  const map: Record<SubscriptionStatus, { bg: string; label: string }> = {
    Active: { bg: 'bg-emerald-900/60 text-emerald-300', label: 'نشط' },
    Trial: { bg: 'bg-blue-900/60 text-blue-300', label: 'تجريبي' },
    Expired: { bg: 'bg-rose-900/60 text-rose-300', label: 'منتهي الصلاحية' },
    Suspended: { bg: 'bg-amber-900/60 text-amber-300', label: 'معلّق' },
  }
  if (!status)
    return (
      <span className="rounded-full bg-slate-700 px-3 py-1 text-sm font-semibold text-slate-300">
        بدون اشتراك
      </span>
    )
  const { bg, label } = map[status]
  return <span className={`rounded-full px-3 py-1 text-sm font-semibold ${bg}`}>{label}</span>
}

export function TenantDetailPage() {
  const { id } = useParams({ from: '/admin/admin/tenants/$id' })
  const qc = useQueryClient()
  const [showSubscribeModal, setShowSubscribeModal] = useState(false)

  const { data: tenant, isLoading } = useQuery({
    queryKey: ['admin', 'tenant', id],
    queryFn: () => superAdminApi.getTenant(id).then((r) => r.data),
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

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    )
  }

  if (!tenant) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-slate-400">
        <p>المستأجر غير موجود</p>
        <Link to="/admin/tenants" className="text-blue-400 hover:underline">
          العودة للقائمة
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
        className="mb-6 flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
      >
        <ArrowRight className="h-4 w-4" />
        العودة للمستأجرين
      </Link>

      {/* Header */}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">{tenant.name}</h1>
            <StatusBadge status={sub?.status} isActive={tenant.isActive} />
          </div>
          <p className="mt-1 text-slate-400">
            {tenant.subdomain} · {tenant.adminEmail}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            عضو منذ {new Date(tenant.createdAt).toLocaleDateString('ar-SA')}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSubscribeModal(true)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            اشتراك جديد
          </button>
          {tenant.isActive ? (
            <button
              onClick={() => suspendMut.mutate()}
              disabled={suspendMut.isPending}
              className="flex items-center gap-2 rounded-lg border border-amber-700 px-4 py-2 text-sm font-semibold text-amber-400 hover:bg-amber-900/30 transition-colors"
            >
              <PauseCircle className="h-4 w-4" />
              تعليق
            </button>
          ) : (
            <button
              onClick={() => activateMut.mutate()}
              disabled={activateMut.isPending}
              className="flex items-center gap-2 rounded-lg border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-400 hover:bg-emerald-900/30 transition-colors"
            >
              <PlayCircle className="h-4 w-4" />
              تفعيل
            </button>
          )}
        </div>
      </div>

      {/* Active subscription card */}
      {sub && (
        <div className="mb-8 rounded-xl border border-slate-700 bg-slate-900 p-6">
          <h2 className="mb-4 text-base font-semibold text-white">الاشتراك الحالي</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <InfoBox
              icon={<Calendar className="h-4 w-4 text-blue-400" />}
              label="الخطة"
              value={sub.planName}
            />
            <InfoBox
              icon={<Calendar className="h-4 w-4 text-emerald-400" />}
              label="ينتهي في"
              value={new Date(sub.expiryDate).toLocaleDateString('ar-SA')}
            />
            <InfoBox
              icon={<GitBranch className="h-4 w-4 text-amber-400" />}
              label="أقصى فروع"
              value={sub.maxBranches.toString()}
            />
            <InfoBox
              icon={<Users className="h-4 w-4 text-purple-400" />}
              label="أقصى مستخدمين"
              value={sub.maxUsers.toString()}
            />
          </div>
          {sub.notes && (
            <p className="mt-4 rounded-lg bg-slate-800 px-4 py-3 text-sm text-slate-300">
              {sub.notes}
            </p>
          )}
        </div>
      )}

      {/* Subscription history */}
      <div className="rounded-xl border border-slate-800 bg-slate-900">
        <div className="border-b border-slate-800 px-6 py-4">
          <h2 className="text-base font-semibold text-white">تاريخ الاشتراكات</h2>
        </div>
        <div className="divide-y divide-slate-800">
          {tenant.subscriptionHistory.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-400">لا توجد اشتراكات سابقة</p>
          ) : (
            tenant.subscriptionHistory.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className="text-sm font-medium text-white">{s.planName}</p>
                  <p className="text-xs text-slate-400">
                    {new Date(s.startDate).toLocaleDateString('ar-SA')} ←{' '}
                    {new Date(s.expiryDate).toLocaleDateString('ar-SA')}
                  </p>
                  {s.notes && (
                    <p className="mt-1 text-xs italic text-slate-500">{s.notes}</p>
                  )}
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-white">
                    {s.planPrice.toLocaleString('ar-SA')} ر.س
                  </p>
                  <StatusBadgeMini status={s.status} />
                </div>
              </div>
            ))
          )}
        </div>
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
    <div className="rounded-lg bg-slate-800 p-4">
      <div className="mb-1.5">{icon}</div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-white">{value}</p>
    </div>
  )
}

function StatusBadgeMini({ status }: { status: SubscriptionStatus }) {
  const map: Record<SubscriptionStatus, { bg: string; label: string }> = {
    Active: { bg: 'text-emerald-400', label: 'نشط' },
    Trial: { bg: 'text-blue-400', label: 'تجريبي' },
    Expired: { bg: 'text-rose-400', label: 'منتهي' },
    Suspended: { bg: 'text-amber-400', label: 'معلّق' },
  }
  const { bg, label } = map[status]
  return <span className={`text-xs ${bg}`}>{label}</span>
}
