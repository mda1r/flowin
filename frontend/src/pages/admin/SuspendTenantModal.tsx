import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { superAdminApi } from '@/api/superadmin'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import { apiErrorMessage } from '@/lib/apiError'
import { useI18n } from '@/i18n'

const QUICK_REASONS = ['عدم السداد', 'بطلب من العميل', 'مخالفة شروط الاستخدام']

interface Props {
  tenantId: string
  tenantName: string
  onClose: () => void
}

// Suspending blocks the tenant's sign-in and token refresh; the reason is shown on the tenant page.
export function SuspendTenantModal({ tenantId, tenantName, onClose }: Props) {
  const qc = useQueryClient()
  const { t } = useI18n()
  const [reason, setReason] = useState('')
  const trimmed = reason.trim()

  const mutation = useMutation({
    mutationFn: () => superAdminApi.suspendTenant(tenantId, trimmed),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'tenants'] })
      qc.invalidateQueries({ queryKey: ['admin', 'tenant', tenantId] })
      toast.success('تم تعليق الحساب', tenantName)
      onClose()
    },
    onError: (err) => toast.error('تعذّر تعليق الحساب', apiErrorMessage(err)),
  })

  return (
    <Modal
      open
      onClose={onClose}
      title={`تعليق ${tenantName}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t.common.cancel}</Button>
          <Button
            variant="danger"
            loading={mutation.isPending}
            disabled={!trimmed}
            onClick={() => mutation.mutate()}
          >
            {t.admin.tenants.suspend}
          </Button>
        </>
      }
    >
      <div dir="rtl" className="space-y-3 text-sm">
        <p className="text-muted">
          لن يتمكن موظفو هذا الحساب من الدخول، وتخرج الأجهزة المفتوحة خلال دقائق.
        </p>
        <div className="flex flex-wrap gap-2">
          {QUICK_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs text-fg hover:bg-surface"
            >
              {r}
            </button>
          ))}
        </div>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={512}
          placeholder="سبب التعليق"
          className="w-full resize-none rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-sm text-fg placeholder-muted focus:border-brand focus:outline-none"
        />
      </div>
    </Modal>
  )
}
