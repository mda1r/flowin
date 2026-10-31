import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { superAdminApi } from '@/api/superadmin'
import { toast } from '@/components/ui/Toast'
import { apiErrorMessage } from '@/lib/apiError'
import { formatCurrency, cn } from '@/lib/utils'
import {
  RENEW_MONTHS,
  addMonthsIso,
  monthsLabel,
  periodTotalWithVat,
  subscriptionMonths,
} from '@/lib/subscriptionBilling'
import type { TenantSubscriptionResponse } from '@/types/api'
import { useI18n } from '@/i18n'
import { intlLocale } from '@/lib/locale'

interface Props {
  tenantId: string
  tenantName: string
  tenantBusinessType?: string
  currentSubscription?: TenantSubscriptionResponse
  onClose: () => void
}

export function NewSubscriptionModal({ tenantId, tenantName, tenantBusinessType, currentSubscription, onClose }: Props) {
  const qc = useQueryClient()
  const { t, lang } = useI18n()
  const locale = intlLocale(lang)
  const [planId, setPlanId] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  // Plan prices are monthly, so the default period is one month; the chips pick longer ones.
  const [months, setMonths] = useState<number | null>(1)
  const [expiryDate, setExpiryDate] = useState(() => addMonthsIso(new Date().toISOString().slice(0, 10), 1))
  const [notes, setNotes] = useState('')

  const pickMonths = (m: number) => {
    setMonths(m)
    if (startDate) setExpiryDate(addMonthsIso(startDate, m))
  }

  const changeStart = (value: string) => {
    setStartDate(value)
    if (value && months) setExpiryDate(addMonthsIso(value, months))
  }

  const { data: plans = [] } = useQuery({
    queryKey: ['admin', 'plans'],
    queryFn: () => superAdminApi.listPlans().then((r) => r.data),
  })

  const plan = plans.find((p) => p.id === planId)
  const validDates = !!startDate && !!expiryDate && expiryDate > startDate
  const periodMonths = validDates ? subscriptionMonths(startDate, expiryDate) : 0
  const total = plan && validDates ? periodTotalWithVat(plan.price, periodMonths) : null
  // The server ends an overlapping subscription where the new one starts.
  const replacesCurrent =
    !!currentSubscription &&
    ['Active', 'Trial', 'Suspended'].includes(currentSubscription.status) &&
    !!startDate &&
    new Date(currentSubscription.expiryDate) > new Date(startDate)

  const mutation = useMutation({
    mutationFn: () =>
      superAdminApi.createSubscription(tenantId, {
        planId,
        startDate: new Date(startDate).toISOString(),
        expiryDate: new Date(expiryDate).toISOString(),
        notes: notes || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'tenants'] })
      qc.invalidateQueries({ queryKey: ['admin', 'tenant', tenantId] })
      toast.success('تم إنشاء الاشتراك بنجاح', '')
      onClose()
    },
    onError: (err) => {
      toast.error('فشل في إنشاء الاشتراك', apiErrorMessage(err))
    },
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div className="w-full max-w-md rounded-2xl bg-surface border border-border shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-fg">{t.admin.subscription.newSubscription}</h2>
            <p className="text-xs text-muted mt-0.5">{tenantName}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-fg"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <div className="space-y-4 p-6">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">
              {t.admin.subscription.plan}
            </label>
            <select
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm text-fg focus:border-info focus:outline-none"
            >
              <option value="">-- اختر خطة --</option>
              {plans
                .filter((p) => p.isActive && (!tenantBusinessType || p.businessType === tenantBusinessType))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.price.toLocaleString(locale)} ر.س / شهر
                  </option>
                ))}
            </select>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-muted">المدة</p>
            <div className="grid grid-cols-4 gap-2">
              {RENEW_MONTHS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => pickMonths(m)}
                  aria-pressed={months === m}
                  className={cn(
                    'rounded-lg border px-2 py-2 text-xs font-semibold transition-colors',
                    months === m
                      ? 'border-brand bg-brand text-brand-fg'
                      : 'border-border bg-surface-2 text-fg hover:bg-surface',
                  )}
                >
                  {monthsLabel(m)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">
                {t.admin.subscription.startDate}
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => changeStart(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm text-fg focus:border-info focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">
                تاريخ الانتهاء
              </label>
              <input
                type="date"
                value={expiryDate}
                min={startDate}
                onChange={(e) => { setExpiryDate(e.target.value); setMonths(null) }}
                className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm text-fg focus:border-info focus:outline-none"
              />
            </div>
          </div>

          {total !== null && (
            <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm">
              <span className="text-muted">
                الإجمالي لـ{monthsLabel(periodMonths)} شامل الضريبة
              </span>
              <span className="font-bold tabular-nums text-fg">{formatCurrency(total, 'SAR', locale)}</span>
            </div>
          )}

          {replacesCurrent && (
            <p className="rounded-lg bg-warning/15 px-3 py-2 text-xs text-warning">
              الاشتراك الحالي ({currentSubscription.planName}) سينتهي في تاريخ بداية هذا الاشتراك.
              للتمديد على نفس الخطة استخدم «تجديد».
            </p>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">
              ملاحظات (اختياري)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="أي ملاحظات خاصة بهذا الاشتراك..."
              className="w-full resize-none rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm text-fg placeholder-muted focus:border-info focus:outline-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 border-t border-border px-6 py-4">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted hover:bg-surface-2 transition-colors"
          >
            {t.common.cancel}
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!planId || !validDates || mutation.isPending}
            className="flex-1 rounded-lg bg-info px-4 py-2.5 text-sm font-semibold text-white hover:bg-info disabled:opacity-50 transition-colors"
          >
            {mutation.isPending ? t.common.loading : t.admin.subscription.create}
          </button>
        </div>
      </div>
    </div>
  )
}
