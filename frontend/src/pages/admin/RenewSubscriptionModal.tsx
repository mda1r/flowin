import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { superAdminApi } from '@/api/superadmin'
import type { TenantSubscriptionResponse } from '@/types/api'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import { apiErrorMessage } from '@/lib/apiError'
import { formatCurrency, cn } from '@/lib/utils'
import { RENEW_MONTHS, monthsLabel, periodTotalWithVat } from '@/lib/subscriptionBilling'
import { useI18n } from '@/i18n'

interface Props {
  tenantId: string
  tenantName: string
  subscription: TenantSubscriptionResponse
  onClose: () => void
}

// One-click renewal: extends the current subscription on the same plan by the chosen months.
export function RenewSubscriptionModal({ tenantId, tenantName, subscription, onClose }: Props) {
  const qc = useQueryClient()
  const { t, lang } = useI18n()
  const locale = lang === 'ar' ? 'ar-SA' : 'en-US'
  const [months, setMonths] = useState<number>(1)

  // Mirrors the server: a running subscription is extended from its expiry, an ended one from today.
  const expiry = new Date(subscription.expiryDate)
  const from = expiry.getTime() > Date.now() ? expiry : new Date()
  const newExpiry = new Date(from)
  newExpiry.setMonth(newExpiry.getMonth() + months)
  const total = periodTotalWithVat(subscription.planPrice, months)

  const mutation = useMutation({
    mutationFn: () => superAdminApi.renewSubscription(tenantId, months),
    onSuccess: ({ data }) => {
      qc.invalidateQueries({ queryKey: ['admin', 'tenants'] })
      qc.invalidateQueries({ queryKey: ['admin', 'tenant', tenantId] })
      toast.success('تم التجديد', `حتى ${new Date(data.expiryDate).toLocaleDateString(locale)}`)
      onClose()
    },
    onError: (err) => toast.error('تعذّر التجديد', apiErrorMessage(err)),
  })

  return (
    <Modal
      open
      onClose={onClose}
      title={`تجديد اشتراك ${tenantName}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t.common.cancel}</Button>
          <Button loading={mutation.isPending} onClick={() => mutation.mutate()}>
            تجديد {monthsLabel(months)}
          </Button>
        </>
      }
    >
      <div dir="rtl" className="space-y-4 text-sm">
        <div className="flex items-center justify-between rounded-lg bg-surface-2 px-4 py-3">
          <span className="text-muted">{subscription.planName}</span>
          <span className="text-muted">
            ينتهي {expiry.toLocaleDateString(locale)}
          </span>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-muted">المدة</p>
          <div className="grid grid-cols-4 gap-2">
            {RENEW_MONTHS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMonths(m)}
                aria-pressed={months === m}
                className={cn(
                  'rounded-lg border px-2 py-2 text-xs font-semibold transition-colors',
                  months === m
                    ? 'border-brand bg-brand text-brand-fg'
                    : 'border-border bg-surface text-fg hover:bg-surface-2',
                )}
              >
                {monthsLabel(m)}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5 rounded-lg border border-border px-4 py-3">
          <div className="flex justify-between">
            <span className="text-muted">ينتهي بعد التجديد</span>
            <span className="font-medium text-fg">{newExpiry.toLocaleDateString(locale)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">المبلغ شامل الضريبة</span>
            <span className="font-bold text-fg tabular-nums">{formatCurrency(total, 'SAR', locale)}</span>
          </div>
        </div>
      </div>
    </Modal>
  )
}
