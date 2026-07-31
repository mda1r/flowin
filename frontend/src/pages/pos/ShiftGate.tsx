import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Lock, Unlock, Clock, ShoppingBag, CreditCard, Banknote, TrendingUp, AlertTriangle } from 'lucide-react'
import { shiftsApi } from '@/api/shifts'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { toast } from '@/components/ui/Toast'
import { formatCurrency } from '@/lib/utils'
import type { ShiftResponse } from '@/types/api'

// ── Open Shift Modal ──────────────────────────────────────────────────────────

export function OpenShiftModal({ onClose }: { onClose: () => void }) {
  const { branchId } = useAuthStore()
  const qc = useQueryClient()
  const [openingCash, setOpeningCash] = useState('')
  const [loading, setLoading] = useState(false)

  const handleOpen = async () => {
    const amount = parseFloat(openingCash) || 0
    setLoading(true)
    try {
      await shiftsApi.open(branchId!, amount)
      qc.invalidateQueries({ queryKey: ['current-shift', branchId] })
      toast.success('تم فتح الشفت')
      onClose()
    } catch {
      toast.error('فشل فتح الشفت')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="فتح شفت جديد"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>إلغاء</Button>
          <Button loading={loading} onClick={handleOpen}>فتح الشفت</Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-500">أدخل رصيد النقد الموجود في الصندوق عند بداية الشفت.</p>
        <Input
          label="رصيد الصندوق عند الفتح (ر.س)"
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          value={openingCash}
          onChange={(e) => setOpeningCash(e.target.value)}
          autoFocus
        />
      </div>
    </Modal>
  )
}

// ── Close Shift Modal ─────────────────────────────────────────────────────────

export function CloseShiftModal({ shift, onClose }: { shift: ShiftResponse; onClose: () => void }) {
  const { branchId } = useAuthStore()
  const qc = useQueryClient()
  const [closingCash, setClosingCash] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const handleClose = async () => {
    const amount = parseFloat(closingCash) || 0
    setLoading(true)
    try {
      await shiftsApi.close(branchId!, shift.id, amount, notes || undefined)
      qc.invalidateQueries({ queryKey: ['current-shift', branchId] })
      qc.invalidateQueries({ queryKey: ['shifts', branchId] })
      toast.success('تم إغلاق الشفت بنجاح')
      onClose()
    } catch {
      toast.error('فشل إغلاق الشفت')
    } finally {
      setLoading(false)
    }
  }

  const closing = parseFloat(closingCash) || 0
  const expected = shift.openingCash + shift.totalCashSales
  const variance = closing - expected

  const duration = () => {
    const ms = Date.now() - new Date(shift.openedAt).getTime()
    const h = Math.floor(ms / 3_600_000)
    const m = Math.floor((ms % 3_600_000) / 60_000)
    return `${h}س ${m}د`
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="إغلاق الشفت"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>إلغاء</Button>
          <Button variant="danger" loading={loading} onClick={handleClose}>
            <Lock className="h-4 w-4" />
            إغلاق الشفت
          </Button>
        </>
      }
    >
      <div className="space-y-4" dir="rtl">
        {/* shift summary */}
        <div className="grid grid-cols-2 gap-3">
          <SummaryCard icon={<ShoppingBag className="h-4 w-4" />} label="إجمالي الطلبات" value={String(shift.totalOrders)} />
          <SummaryCard icon={<TrendingUp className="h-4 w-4" />} label="إجمالي المبيعات" value={formatCurrency(shift.totalSales)} />
          <SummaryCard icon={<Banknote className="h-4 w-4" />} label="مبيعات نقدية" value={formatCurrency(shift.totalCashSales)} />
          <SummaryCard icon={<CreditCard className="h-4 w-4" />} label="مبيعات بطاقة" value={formatCurrency(shift.totalCardSales)} />
          <SummaryCard icon={<Clock className="h-4 w-4" />} label="مدة الشفت" value={duration()} />
          <SummaryCard icon={<Banknote className="h-4 w-4" />} label="رصيد الفتح" value={formatCurrency(shift.openingCash)} />
        </div>

        <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
          <p className="mb-1 text-xs text-gray-500">النقد المتوقع في الصندوق</p>
          <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatCurrency(expected)}</p>
          <p className="text-xs text-gray-400">= رصيد الفتح + مبيعات نقدية</p>
        </div>

        <Input
          label="النقد الفعلي في الصندوق (ر.س)"
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          value={closingCash}
          onChange={(e) => setClosingCash(e.target.value)}
          autoFocus
        />

        {closingCash && (
          <div className={`flex items-center gap-2 rounded-lg p-3 text-sm font-medium ${
            variance >= 0
              ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
              : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
          }`}>
            {variance < 0 && <AlertTriangle className="h-4 w-4 shrink-0" />}
            <span>
              {variance >= 0 ? 'فائض' : 'عجز'}: {formatCurrency(Math.abs(variance))}
            </span>
          </div>
        )}

        <Input
          label="ملاحظات (اختياري)"
          placeholder="أي ملاحظات على الشفت..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
    </Modal>
  )
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
      <div className="mb-1 flex items-center gap-1.5 text-gray-500">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="font-semibold text-gray-900 tabular-nums dark:text-gray-100">{value}</p>
    </div>
  )
}

// ── Shift Lock Screen ─────────────────────────────────────────────────────────

function ShiftLockScreen({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
        <Lock className="h-9 w-9 text-gray-400" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">لا يوجد شفت مفتوح</h2>
        <p className="mt-1 text-sm text-gray-500">يجب فتح شفت قبل بدء البيع</p>
      </div>
      <Button onClick={onOpen} className="gap-2">
        <Unlock className="h-4 w-4" />
        فتح شفت جديد
      </Button>
    </div>
  )
}

// ── Shift Badge (shown in POS header) ────────────────────────────────────────

export function ShiftBadge({ shift, onCloseShift }: { shift: ShiftResponse; onCloseShift: () => void }) {
  const openedAt = new Date(shift.openedAt)
  const timeStr = openedAt.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 rounded-lg bg-green-50 px-3 py-1.5 text-sm dark:bg-green-900/20">
        <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
        <span className="font-medium text-green-700 dark:text-green-400">شفت مفتوح</span>
        <span className="text-green-600/70 dark:text-green-500/70">منذ {timeStr}</span>
      </div>
      <Button size="sm" variant="danger" onClick={onCloseShift} className="gap-1">
        <Lock className="h-3.5 w-3.5" />
        إغلاق الشفت
      </Button>
    </div>
  )
}

// ── Main ShiftGate Export ─────────────────────────────────────────────────────

export function useShift() {
  const { branchId } = useAuthStore()

  const { data, isLoading } = useQuery({
    queryKey: ['current-shift', branchId],
    queryFn: async () => {
      if (!branchId) return null
      try {
        const res = await shiftsApi.getCurrent(branchId)
        return res.data
      } catch {
        return null
      }
    },
    enabled: !!branchId,
    staleTime: 30_000,
  })

  return { shift: data ?? null, isLoading }
}

/**
 * Wraps POS content: shows a lock screen when no shift is open.
 * Shift controls (badge + open/close modals) are managed externally via
 * useShift() + ShiftBadge + OpenShiftModal / CloseShiftModal exports.
 */
export function ShiftGate({
  children,
  onOpenShift,
}: {
  children: React.ReactNode
  onOpenShift: () => void
}) {
  const { shift, isLoading } = useShift()

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-[color:var(--accent)]" />
      </div>
    )
  }

  if (!shift) {
    return <ShiftLockScreen onOpen={onOpenShift} />
  }

  return <>{children}</>
}
