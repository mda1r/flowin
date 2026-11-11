import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Percent, Settings2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import { cn, formatCurrency } from '@/lib/utils'
import { apiErrorMessage } from '@/lib/apiError'
import { posSettingsApi, type PosBranchSettings } from '@/api/orders'
import type { CartDiscount } from '@/stores/cartStore'
import { useVat } from '@/lib/vat'

const QUICK_PERCENTS = [5, 10, 15]

const chip = (active: boolean) =>
  cn(
    'rounded-lg border px-2 py-2 text-xs font-semibold tabular-nums transition-colors',
    active ? 'border-brand bg-brand-soft text-brand-ink' : 'border-border bg-surface text-fg hover:bg-surface-2',
  )

interface DiscountModalProps {
  open: boolean
  onClose: () => void
  title: string
  // The amount the discount comes off, VAT included.
  base: number
  current: CartDiscount | null
  onApply: (discount: CartDiscount | null) => void
  // Cart mode: the fraction to knock off for a whole-riyal total.
  roundDown?: number
  // Shown under the preview; gets the discount as typed so far (null while nothing valid is typed).
  note?: (preview: CartDiscount | null) => React.ReactNode
  children?: React.ReactNode
}

export function DiscountModal({ open, onClose, title, base, current, onApply, roundDown, note, children }: DiscountModalProps) {
  const [type, setType] = useState<CartDiscount['type']>('Percentage')
  const [value, setValue] = useState('')
  const vatOn = useVat().enabled

  useEffect(() => {
    if (!open) return
    setType(current?.type ?? 'Percentage')
    setValue(current ? String(current.value) : '')
  }, [open, current])

  const num = parseFloat(value)
  const off = Number.isNaN(num) || num <= 0 ? 0 : type === 'Percentage' ? (base * Math.min(num, 100)) / 100 : Math.min(num, base)
  const error =
    value === '' || Number.isNaN(num) ? null
    : num <= 0 ? 'أدخل قيمة أكبر من صفر'
    : type === 'Percentage' && num > 100 ? 'النسبة لا تتجاوز 100%'
    : type === 'Fixed' && num > base + 0.001 ? 'الخصم أكبر من المبلغ'
    : null
  const canApply = value !== '' && !Number.isNaN(num) && !error
  const preview: CartDiscount | null = off > 0 && !error ? { type, value: num } : null

  const apply = () => {
    if (!canApply) return
    onApply({ type, value: Math.round(num * 100) / 100 })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          {current && (
            <Button variant="secondary" onClick={() => { onApply(null); onClose() }} className="me-auto text-danger">
              إزالة الخصم
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>إلغاء</Button>
          <Button onClick={apply} disabled={!canApply}>تطبيق</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="نوع الخصم">
          {([
            { t: 'Percentage', label: 'نسبة %' },
            { t: 'Fixed', label: 'مبلغ (ر.س)' },
          ] as const).map(({ t, label }) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={type === t}
              onClick={() => { setType(t); setValue('') }}
              className={chip(type === t)}
            >
              {label}
            </button>
          ))}
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-fg">
            {type === 'Percentage' ? 'نسبة الخصم' : vatOn ? 'مبلغ الخصم شامل الضريبة' : 'مبلغ الخصم'}
          </span>
          <div className="relative">
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step={type === 'Percentage' ? '1' : '0.01'}
              max={type === 'Percentage' ? 100 : base}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') apply() }}
              placeholder="0"
              className="input-3d w-full pe-10 tabular-nums"
              data-autofocus
            />
            <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-xs text-muted">
              {type === 'Percentage' ? '%' : 'ر.س'}
            </span>
          </div>
        </label>

        <div className="grid grid-cols-4 gap-1.5">
          {QUICK_PERCENTS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => { setType('Percentage'); setValue(String(p)) }}
              className={chip(type === 'Percentage' && num === p)}
            >
              {p}%
            </button>
          ))}
          {roundDown !== undefined && (
            <button
              type="button"
              disabled={roundDown <= 0}
              onClick={() => { setType('Fixed'); setValue(roundDown.toFixed(2)) }}
              className={cn(chip(type === 'Fixed' && num === roundDown), 'disabled:opacity-40')}
              title="خصم الكسور ليصبح المبلغ رقماً صحيحاً"
            >
              تقريب
            </button>
          )}
        </div>

        {error ? (
          <p role="alert" className="text-xs font-medium text-danger">{error}</p>
        ) : (
          <div className="flex items-baseline justify-between rounded-xl bg-surface-2 px-4 py-2.5 text-sm">
            <span className="text-muted">بعد الخصم</span>
            <span className="font-bold tabular-nums text-fg">
              {formatCurrency(Math.max(base - off, 0))}
              {off > 0 && <span className="ms-2 text-xs font-medium text-success">−{formatCurrency(off)}</span>}
            </span>
          </div>
        )}

        {note?.(preview)}
        {children}
      </div>
    </Modal>
  )
}

/* Owner/Manager panel inside the cart discount dialog: the cashier cap and the approval PIN for this branch. */
export function DiscountRulesPanel({ branchId, settings }: { branchId: string; settings: PosBranchSettings }) {
  const queryClient = useQueryClient()
  const [openPanel, setOpenPanel] = useState(false)
  const [cap, setCap] = useState(String(settings.maxCashierDiscountPercent))
  const [pin, setPin] = useState('')
  const [clearPin, setClearPin] = useState(false)

  useEffect(() => setCap(String(settings.maxCashierDiscountPercent)), [settings.maxCashierDiscountPercent])

  const capNum = parseFloat(cap)
  const pinOk = pin === '' || /^[0-9]{4,8}$/.test(pin)
  const valid = !Number.isNaN(capNum) && capNum >= 0 && capNum <= 100 && pinOk

  const save = useMutation({
    mutationFn: () =>
      posSettingsApi.save(branchId, {
        maxCashierDiscountPercent: capNum,
        approvalPin: clearPin || pin === '' ? undefined : pin,
        clearApprovalPin: clearPin,
      }),
    onSuccess: ({ data }) => {
      queryClient.setQueryData(['pos-settings', branchId], { data })
      setPin('')
      setClearPin(false)
      toast.success('حُفظت قواعد الخصم')
    },
    onError: (err) => toast.error('تعذّر الحفظ', apiErrorMessage(err)),
  })

  return (
    <div className="rounded-xl border border-border">
      <button
        type="button"
        onClick={() => setOpenPanel((v) => !v)}
        aria-expanded={openPanel}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-start text-sm font-medium text-fg"
      >
        <Settings2 className="h-4 w-4 text-brand-strong" />
        <span className="flex-1">قواعد الخصم للكاشير</span>
        <span className="text-xs text-muted">
          حتى {settings.maxCashierDiscountPercent}% · {settings.hasApprovalPin ? 'رمز المدير مفعّل' : 'بدون رمز'}
        </span>
      </button>
      {openPanel && (
        <div className="space-y-3 border-t border-border p-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">أقصى خصم يمنحه الكاشير وحده</span>
            <div className="relative">
              <input
                type="number"
                inputMode="decimal"
                min="0"
                max="100"
                value={cap}
                onChange={(e) => setCap(e.target.value)}
                className="input-3d w-full pe-10 tabular-nums"
              />
              <Percent className="pointer-events-none absolute end-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            </div>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">
              {settings.hasApprovalPin ? 'رمز مدير جديد (اتركه فارغاً للإبقاء على الحالي)' : 'رمز المدير للموافقة على خصم أكبر'}
            </span>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={8}
              value={pin}
              disabled={clearPin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="4 إلى 8 أرقام"
              className="input-3d w-full tabular-nums"
            />
            {!pinOk && <span className="mt-1 block text-xs text-danger">الرمز من 4 إلى 8 أرقام</span>}
          </label>
          {settings.hasApprovalPin && (
            <label className="flex items-center gap-2 text-xs text-fg">
              <input type="checkbox" checked={clearPin} onChange={(e) => setClearPin(e.target.checked)} />
              إلغاء رمز المدير
            </label>
          )}
          <Button size="sm" onClick={() => save.mutate()} loading={save.isPending} disabled={!valid} className="w-full">
            حفظ القواعد
          </Button>
        </div>
      )}
    </div>
  )
}
