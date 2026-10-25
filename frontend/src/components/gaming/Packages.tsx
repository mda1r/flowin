import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Package, Plus, Trash2 } from 'lucide-react'
import { Modal, ConfirmModal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import { gamingApi } from '@/api/gaming'
import { useAuthStore } from '@/stores/authStore'
import { apiErrorMessage } from '@/lib/apiError'
import { cn, formatCurrency } from '@/lib/utils'
import type { GameSessionBillResponse, GamingPackageResponse, StationType } from '@/types/api'

const TYPE_LABELS: Record<string, string> = { Console: 'بلايستيشن', PC: 'كمبيوتر', VR: 'واقع افتراضي', Arcade: 'أركيد', Board: 'ألعاب طاولة' }

export const formatMinutes = (m: number) =>
  m % 60 === 0 ? `${m / 60} ساعة` : m > 60 ? `${Math.floor(m / 60)}س ${m % 60}د` : `${m} دقيقة`

export function usePackages() {
  const { branchId } = useAuthStore()
  return useQuery({
    queryKey: ['gaming-packages', branchId],
    queryFn: () => gamingApi.listPackages(branchId!).then((r) => r.data),
    enabled: !!branchId,
  })
}

// "Hourly" plus every package that fits this station type.
export function PackagePicker({
  stationType,
  selectedId,
  onSelect,
}: {
  stationType: string
  selectedId: string | null
  onSelect: (pkg: GamingPackageResponse | null) => void
}) {
  const { data = [] } = usePackages()
  const options = data.filter((p) => !p.stationType || p.stationType === stationType)
  if (options.length === 0) return null

  const chip = (active: boolean) =>
    cn(
      'rounded-xl border px-3 py-2 text-start text-xs transition-colors',
      active ? 'border-brand bg-brand-soft text-brand-ink' : 'border-border text-fg hover:bg-surface-2',
    )

  return (
    <div>
      <p className="mb-1.5 text-sm font-semibold text-fg">نوع الجلسة</p>
      <div className="grid grid-cols-2 gap-1.5">
        <button type="button" className={chip(selectedId === null)} onClick={() => onSelect(null)}>
          <span className="block font-bold">بالساعة</span>
          <span className="text-muted">حسب الوقت الفعلي</span>
        </button>
        {options.map((p) => (
          <button key={p.id} type="button" className={chip(selectedId === p.id)} onClick={() => onSelect(p)}>
            <span className="block font-bold">{p.name}</span>
            <span className="tabular-nums">{formatCurrency(p.price)} · {formatMinutes(p.durationMinutes)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// Package and overtime lines for a session bill; nothing for hourly sessions.
export function PackageBillLines({ bill }: { bill: GameSessionBillResponse }) {
  if (!bill.packageName || bill.packagePrice == null) return null
  const overtime = bill.overtimeMinutes ?? 0
  return (
    <div className="space-y-1 rounded-lg bg-surface-2 px-3 py-2 text-sm">
      <div className="flex justify-between">
        <span className="text-muted">الباقة: {bill.packageName}</span>
        <span className="tabular-nums text-fg">{formatCurrency(bill.packagePrice)}</span>
      </div>
      {overtime > 0 && (
        <div className="flex justify-between text-warning">
          <span>وقت إضافي {Math.round(overtime)} د</span>
          <span className="tabular-nums">{formatCurrency(bill.totalAmount - bill.packagePrice)}</span>
        </div>
      )}
    </div>
  )
}

export function PackagesManager({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { branchId } = useAuthStore()
  const qc = useQueryClient()
  const { data: packages = [], isLoading } = usePackages()
  const [name, setName] = useState('')
  const [minutes, setMinutes] = useState(180)
  const [price, setPrice] = useState('')
  const [stationType, setStationType] = useState<StationType | ''>('')
  const [deleting, setDeleting] = useState<GamingPackageResponse | null>(null)
  const refresh = () => qc.invalidateQueries({ queryKey: ['gaming-packages', branchId] })

  const create = useMutation({
    mutationFn: () =>
      gamingApi.createPackage(branchId!, {
        name: name.trim(),
        durationMinutes: minutes,
        price: parseFloat(price),
        stationType: stationType || undefined,
      }),
    onSuccess: () => {
      void refresh()
      setName('')
      setPrice('')
      toast.success('تمت إضافة الباقة')
    },
    onError: (err) => toast.error('تعذّر إضافة الباقة', apiErrorMessage(err)),
  })
  const remove = useMutation({
    mutationFn: (id: string) => gamingApi.deletePackage(branchId!, id),
    onSuccess: () => {
      void refresh()
      setDeleting(null)
      toast.success('تم حذف الباقة')
    },
    onError: (err) => toast.error('تعذّر حذف الباقة', apiErrorMessage(err)),
  })
  const canCreate = name.trim().length > 0 && parseFloat(price) > 0 && minutes >= 15

  return (
    <>
      <Modal open={open && !deleting} onClose={onClose} title="باقات الألعاب" size="lg">
        <div className="space-y-5">
          <p className="text-sm text-muted">
            سعر ثابت لمدة محددة، شامل الضريبة. إذا لعب العميل أكثر من مدة الباقة يُحسب الوقت الإضافي بسعر الساعة للجهاز،
            وإذا أنهى مبكراً يدفع سعر الباقة.
          </p>

          {isLoading ? (
            <div className="skeleton h-16" />
          ) : packages.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted">لا توجد باقات بعد</p>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {packages.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <Package className="h-4 w-4 shrink-0 text-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-fg">{p.name}</span>
                    <span className="text-xs text-muted">
                      {formatMinutes(p.durationMinutes)} · {p.stationType ? TYPE_LABELS[p.stationType] ?? p.stationType : 'كل الأجهزة'}
                    </span>
                  </span>
                  <span className="font-semibold tabular-nums text-fg">{formatCurrency(p.price)}</span>
                  <button
                    type="button"
                    onClick={() => setDeleting(p)}
                    className="rounded-lg p-2 text-muted hover:bg-danger/10 hover:text-danger"
                    aria-label={`حذف باقة ${p.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form
            className="space-y-3 rounded-xl bg-surface-2 p-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (canCreate && !create.isPending) create.mutate()
            }}
          >
            <p className="text-sm font-semibold text-fg">باقة جديدة</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <input className="input" placeholder="الاسم، مثال: ٣ ساعات" value={name} onChange={(e) => setName(e.target.value)} aria-label="اسم الباقة" />
              <input
                className="input"
                type="number"
                min="0"
                step="0.5"
                placeholder="السعر شامل الضريبة"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                aria-label="سعر الباقة"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[60, 120, 180, 240, 360].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMinutes(m)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-bold',
                    minutes === m ? 'bg-brand text-brand-fg' : 'border border-border text-muted hover:bg-surface',
                  )}
                >
                  {formatMinutes(m)}
                </button>
              ))}
              <input
                className="input w-24 text-xs"
                type="number"
                min="15"
                value={minutes}
                onChange={(e) => setMinutes(Math.max(15, parseInt(e.target.value) || 15))}
                aria-label="المدة بالدقائق"
              />
            </div>
            <select className="input" value={stationType} onChange={(e) => setStationType(e.target.value as StationType | '')} aria-label="نوع الجهاز">
              <option value="">كل الأجهزة</option>
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <Button type="submit" loading={create.isPending} disabled={!canCreate}>
              <Plus className="h-4 w-4" />
              إضافة الباقة
            </Button>
          </form>
        </div>
      </Modal>
      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        title="حذف الباقة"
        message={deleting ? `لن تظهر "${deleting.name}" عند بدء جلسات جديدة. الجلسات الجارية عليها لا تتأثر.` : ''}
        confirmLabel="حذف"
        confirmVariant="danger"
        loading={remove.isPending}
      />
    </>
  )
}
