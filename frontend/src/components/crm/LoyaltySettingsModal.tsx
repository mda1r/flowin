import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { toast } from '@/components/ui/Toast'
import { customersApi } from '@/api/customers'
import { useAuthStore } from '@/stores/authStore'
import { apiErrorMessage } from '@/lib/apiError'
import { pointsEarned, pointsValue, useLoyaltyRules } from '@/lib/loyalty'
import { formatCurrency } from '@/lib/utils'
import type { LoyaltySettings } from '@/types/api'

type Draft = Record<Exclude<keyof LoyaltySettings, 'enabled'>, string> & { enabled: boolean }

const toDraft = (r: LoyaltySettings): Draft => ({
  enabled: r.enabled,
  pointsPerCurrencyUnit: String(r.pointsPerCurrencyUnit),
  redeemPoints: String(r.redeemPoints),
  redeemValue: String(r.redeemValue),
  minRedeemPoints: String(r.minRedeemPoints),
})

// Same limits as the server validator, so the owner sees the problem before saving.
function parse(d: Draft): { rules?: LoyaltySettings; error?: string } {
  const perRiyal = Number(d.pointsPerCurrencyUnit)
  const redeemPoints = Number(d.redeemPoints)
  const redeemValue = Number(d.redeemValue)
  const min = Number(d.minRedeemPoints || 0)
  if (!(perRiyal > 0 && perRiyal <= 1000)) return { error: 'النقاط لكل ريال يجب أن تكون أكبر من صفر' }
  if (!Number.isInteger(redeemPoints) || redeemPoints < 1) return { error: 'عدد النقاط في الاستبدال يجب أن يكون رقماً صحيحاً أكبر من صفر' }
  if (!(redeemValue > 0)) return { error: 'قيمة النقاط بالريال يجب أن تكون أكبر من صفر' }
  if (!Number.isInteger(min) || min < 0) return { error: 'الحد الأدنى للاستبدال يجب أن يكون رقماً صحيحاً' }
  return { rules: { enabled: d.enabled, pointsPerCurrencyUnit: perRiyal, redeemPoints, redeemValue, minRedeemPoints: min } }
}

export function LoyaltySettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { tenantId } = useAuthStore()
  const qc = useQueryClient()
  const current = useLoyaltyRules()
  const [draft, setDraft] = useState<Draft>(() => toDraft(current))

  useEffect(() => {
    if (open) setDraft(toDraft(current))
  }, [open, current])

  const { rules, error } = parse(draft)
  const set = (key: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement>) => setDraft((d) => ({ ...d, [key]: e.target.value }))

  const save = useMutation({
    mutationFn: (r: LoyaltySettings) => customersApi.updateLoyaltySettings(tenantId!, r),
    onSuccess: ({ data }) => {
      qc.setQueryData(['loyalty-settings', tenantId], data)
      toast.success('حُفظ برنامج النقاط', 'يطبَّق على المبيعات من الآن')
      onClose()
    },
    onError: (err) => toast.error('تعذّر حفظ برنامج النقاط', apiErrorMessage(err)),
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="برنامج نقاط الولاء"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>إلغاء</Button>
          <Button loading={save.isPending} disabled={!rules} onClick={() => rules && save.mutate(rules)}>
            حفظ
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border bg-surface-2/60 px-4 py-3">
          <span>
            <span className="block text-sm font-medium text-fg">تفعيل النقاط</span>
            <span className="block text-xs text-muted">عند الإيقاف لا يكسب العملاء نقاطاً ولا يستبدلونها، وتبقى أرصدتهم كما هي</span>
          </span>
          <input
            type="checkbox"
            role="switch"
            aria-label="تفعيل النقاط"
            checked={draft.enabled}
            onChange={(e) => setDraft((d) => ({ ...d, enabled: e.target.checked }))}
            className="h-5 w-9 shrink-0 cursor-pointer accent-[rgb(var(--brand))]"
          />
        </label>

        <fieldset disabled={!draft.enabled} className="space-y-4 disabled:opacity-50">
          <Input
            label="النقاط التي يكسبها العميل لكل 1 ريال"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.1"
            value={draft.pointsPerCurrencyUnit}
            onChange={set('pointsPerCurrencyUnit')}
            hint="مثال: 1 = نقطة لكل ريال، 0.5 = نقطة لكل ريالين"
          />

          <div>
            <p className="mb-1.5 text-sm font-medium text-fg">قيمة النقاط عند الاستبدال</p>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted">كل</span>
              <input className="input w-24 text-center tabular-nums" type="number" inputMode="numeric" min={1} step={1}
                value={draft.redeemPoints} onChange={set('redeemPoints')} aria-label="عدد النقاط" />
              <span className="text-sm text-muted">نقطة =</span>
              <input className="input w-24 text-center tabular-nums" type="number" inputMode="decimal" min={0} step="0.5"
                value={draft.redeemValue} onChange={set('redeemValue')} aria-label="القيمة بالريال" />
              <span className="text-sm text-muted">ريال خصم</span>
            </div>
          </div>

          <Input
            label="الحد الأدنى للاستبدال (نقطة)"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={draft.minRedeemPoints}
            onChange={set('minRedeemPoints')}
            hint="لا يقدر العميل يستبدل حتى يجمع هذا العدد. صفر = يستبدل أي رصيد"
          />
        </fieldset>

        {error ? (
          <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>
        ) : rules && rules.enabled ? (
          <div className="rounded-xl bg-brand-soft px-4 py-3 text-sm text-fg">
            <p className="mb-1 text-xs font-semibold text-brand">مثال</p>
            <p>
              عميل دفع {formatCurrency(100)} يكسب{' '}
              <span className="font-semibold tabular-nums">{pointsEarned(100, rules).toLocaleString('ar-SA')}</span> نقطة.
            </p>
            <p>
              {rules.redeemPoints.toLocaleString('ar-SA')} نقطة تخصم{' '}
              <span className="font-semibold tabular-nums">{formatCurrency(pointsValue(rules.redeemPoints, rules))}</span> من الفاتورة
              {rules.minRedeemPoints > 0
                ? `، ويبدأ الاستبدال بعد ${rules.minRedeemPoints.toLocaleString('ar-SA')} نقطة.`
                : '، ويقدر يستبدل أي رصيد.'}
            </p>
            <p className="mt-1 text-xs text-muted">
              يعني العميل يسترجع تقريباً {((pointsValue(pointsEarned(100, rules), rules) / 100) * 100).toLocaleString('ar-SA', { maximumFractionDigits: 1 })}% من مشترياته.
            </p>
          </div>
        ) : null}

        <p className="text-xs text-muted">التغيير لا يمس أرصدة العملاء الحالية، ويطبَّق على المبيعات الجديدة فقط.</p>
      </div>
    </Modal>
  )
}
