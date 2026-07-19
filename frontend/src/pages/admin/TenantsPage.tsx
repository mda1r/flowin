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

function statusBadge(status: SubscriptionStatus | undefined, isActive: boolean) {
  if (!isActive) {
    return (
      <span className="rounded-full bg-rose-900/60 px-2.5 py-0.5 text-xs font-semibold text-rose-300">
        معلّق
      </span>
    )
  }
  if (!status) {
    return (
      <span className="rounded-full bg-slate-700 px-2.5 py-0.5 text-xs font-semibold text-slate-300">
        بدون اشتراك
      </span>
    )
  }
  const map: Record<SubscriptionStatus, { bg: string; label: string }> = {
    Active: { bg: 'bg-emerald-900/60 text-emerald-300', label: 'نشط' },
    Trial: { bg: 'bg-blue-900/60 text-blue-300', label: 'تجريبي' },
    Expired: { bg: 'bg-rose-900/60 text-rose-300', label: 'منتهي' },
    Suspended: { bg: 'bg-amber-900/60 text-amber-300', label: 'معلّق' },
  }
  const { bg, label } = map[status]
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${bg}`}>
      {label}
    </span>
  )
}

const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  Retail: 'تجزئة',
  Supermarket: 'سوبرماركت',
  Restaurant: 'مطعم',
  Hotel: 'فندق',
  Gaming: 'ألعاب',
  Cafe: 'كافيه',
}

function businessTypeBadge(bt: BusinessType | undefined) {
  if (!bt) return null
  const colors: Record<BusinessType, string> = {
    Retail:       'bg-slate-700 text-slate-300',
    Supermarket:  'bg-emerald-900/60 text-emerald-300',
    Restaurant:   'bg-orange-900/60 text-orange-300',
    Hotel:        'bg-blue-900/60 text-blue-300',
    Gaming:       'bg-purple-900/60 text-purple-300',
    Cafe:         'bg-amber-900/60 text-amber-300',
  }
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${colors[bt]}`}>
      {BUSINESS_TYPE_LABELS[bt]}
    </span>
  )
}

function daysChip(days: number | undefined) {
  if (days === undefined) return null
  if (days < 0) return <span className="text-xs text-rose-400">منتهي</span>
  if (days <= 7)
    return (
      <span className="rounded-full bg-amber-900/40 px-2 py-0.5 text-xs font-medium text-amber-300">
        {days} أيام
      </span>
    )
  return <span className="text-xs text-slate-400">{days} يوم</span>
}

export function TenantsPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [showCreateTenant, setShowCreateTenant] = useState(false)
  const [subscribeTarget, setSubscribeTarget] = useState<TenantWithSubscriptionResponse | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TenantWithSubscriptionResponse | null>(null)

  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ['admin', 'tenants'],
    queryFn: () => superAdminApi.listTenants().then((r) => r.data),
  })

  const suspendMut = useMutation({
    mutationFn: (t: TenantWithSubscriptionResponse) =>
      superAdminApi.suspendTenant(t.id, 'تعليق يدوي من لوحة المدير العام'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'tenants'] })
      toast.success('تم تعليق الحساب', '')
    },
    onError: () => toast.error('فشلت العملية', ''),
  })

  const activateMut = useMutation({
    mutationFn: (t: TenantWithSubscriptionResponse) =>
      superAdminApi.activateTenant(t.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'tenants'] })
      toast.success('تم تفعيل الحساب', '')
    },
    onError: () => toast.error('فشلت العملية', ''),
  })

  const deleteMut = useMutation({
    mutationFn: (t: TenantWithSubscriptionResponse) =>
      superAdminApi.deleteTenant(t.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'tenants'] })
      toast.success('تم حذف المستأجر', '')
      setDeleteTarget(null)
    },
    onError: () => { toast.error('فشلت العملية', ''); setDeleteTarget(null) },
  })

  const filtered = tenants.filter(
    (t) =>
      t.name.includes(search) ||
      t.adminEmail.toLowerCase().includes(search.toLowerCase()) ||
      t.subdomain.includes(search),
  )

  return (
    <div className="p-8" dir="rtl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">المستأجرون</h1>
          <p className="mt-1 text-slate-400">
            {tenants.length} مستأجر مسجل
          </p>
        </div>
        <button
          onClick={() => setShowCreateTenant(true)}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
        >
          <UserPlus className="h-4 w-4" />
          إضافة مستأجر
        </button>
      </div>

      {/* Search */}
      <div className="mb-5 relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث باسم المستأجر أو البريد أو النطاق..."
          className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2.5 pr-10 pl-4 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-800 bg-slate-900">
            <tr>
              {['الاسم', 'النطاق', 'النشاط', 'الخطة', 'الحالة', 'تاريخ الانتهاء', 'المتبقي', 'الإجراءات', ''].map(
                (h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-900/60">
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="px-4 py-4">
                        <div className="h-4 rounded bg-slate-800 animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              : filtered.map((t) => {
                  const sub = t.activeSubscription
                  const rowBg = !t.isActive
                    ? 'opacity-60'
                    : sub?.daysRemaining !== undefined && sub.daysRemaining <= 7 && sub.daysRemaining >= 0
                    ? 'bg-amber-950/20'
                    : ''
                  return (
                    <tr key={t.id} className={`hover:bg-slate-800/50 transition-colors ${rowBg}`}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-white">{t.name}</p>
                        <p className="text-xs text-slate-400">{t.adminEmail}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{t.subdomain}</td>
                      <td className="px-4 py-3">{businessTypeBadge(t.businessType)}</td>
                      <td className="px-4 py-3 text-slate-300">{sub?.planName ?? '—'}</td>
                      <td className="px-4 py-3">
                        {statusBadge(sub?.status, t.isActive)}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {sub?.expiryDate
                          ? new Date(sub.expiryDate).toLocaleDateString('ar-SA')
                          : '—'}
                      </td>
                      <td className="px-4 py-3">{daysChip(sub?.daysRemaining)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Link
                            to="/admin/tenants/$id"
                            params={{ id: t.id }}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
                            title="عرض التفاصيل"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                          <button
                            onClick={() => setSubscribeTarget(t)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-700 hover:text-blue-400 transition-colors"
                            title="اشتراك جديد"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                          {t.isActive ? (
                            <button
                              onClick={() => suspendMut.mutate(t)}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-700 hover:text-amber-400 transition-colors"
                              title="تعليق الحساب"
                            >
                              <PauseCircle className="h-4 w-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => activateMut.mutate(t)}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-700 hover:text-emerald-400 transition-colors"
                              title="تفعيل الحساب"
                            >
                              <PlayCircle className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setDeleteTarget(t)}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-700 hover:text-rose-400 transition-colors"
                          title="حذف المستأجر"
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
          <div className="py-16 text-center text-slate-400">لا توجد نتائج</div>
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
              <Button variant="secondary" onClick={() => setDeleteTarget(null)}>إلغاء</Button>
              <Button
                loading={deleteMut.isPending}
                className="bg-rose-600 hover:bg-rose-500"
                onClick={() => deleteMut.mutate(deleteTarget)}
              >
                حذف نهائي
              </Button>
            </>
          }
        >
          <div dir="rtl" className="space-y-2 text-sm">
            <p className="text-slate-300">
              هل أنت متأكد من حذف المستأجر <span className="font-bold text-white">{deleteTarget.name}</span>؟
            </p>
            <p className="text-slate-400">{deleteTarget.adminEmail}</p>
            <p className="rounded-lg bg-rose-900/30 border border-rose-700/40 px-3 py-2 text-rose-300 text-xs">
              سيتم حذف المستأجر وجميع فروعه واشتراكاته بشكل نهائي لا يمكن التراجع عنه.
            </p>
          </div>
        </Modal>
      )}
    </div>
  )
}
