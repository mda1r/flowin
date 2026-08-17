import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Lock, Unlock, Clock, ShoppingBag, CreditCard, Banknote, TrendingUp, AlertTriangle, Printer } from 'lucide-react'
import { shiftsApi } from '@/api/shifts'
import { ordersApi } from '@/api/orders'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { toast } from '@/components/ui/Toast'
import { formatCurrency } from '@/lib/utils'
import { logActivity } from '@/lib/activityLog'
import type { ShiftResponse, OrderResponse } from '@/types/api'

// ── Open Shift Modal ──────────────────────────────────────────────────────────

export function OpenShiftModal({ onClose }: { onClose: () => void }) {
  const { branchId, user, tenantId } = useAuthStore()
  const qc = useQueryClient()
  const [openingCash, setOpeningCash] = useState('')
  const [loading, setLoading] = useState(false)

  const handleOpen = async () => {
    const amount = parseFloat(openingCash) || 0
    setLoading(true)
    try {
      await shiftsApi.open(branchId!, amount)
      qc.invalidateQueries({ queryKey: ['current-shift', branchId] })
      logActivity(tenantId ?? '', {
        userId: user?.id ?? '',
        userName: `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(),
        userEmail: user?.email,
        category: 'shift',
        action: 'فتح الشفت',
        details: `رصيد الفتح: ${amount} ر.س`,
        branchId: branchId ?? undefined,
      })
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
  const { branchId, user, tenantId } = useAuthStore()
  const qc = useQueryClient()
  const [closingCash, setClosingCash] = useState('')
  const [closingCard, setClosingCard] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const { data: shiftOrders } = useQuery({
    queryKey: ['shift-orders', branchId, shift.id, shift.openedAt],
    queryFn: async () => {
      const { data } = await ordersApi.listOrders(branchId!, { status: 'Completed', pageSize: 200 })
      const raw: OrderResponse[] = Array.isArray(data) ? data : ((data as any)?.items ?? [])
      const shiftStart = new Date(shift.openedAt)
      return raw.filter((o) => new Date(o.completedAt ?? o.createdAt) >= shiftStart)
    },
    enabled: !!branchId,
  })

  const computed = useMemo(() => {
    const orders = shiftOrders ?? []
    const cashSales = orders.filter((o) => o.paymentMethod === 'Cash').reduce((s, o) => s + o.totalAmount, 0)
    const cardSales = orders.filter((o) => o.paymentMethod === 'Card').reduce((s, o) => s + o.totalAmount, 0)
    const splitSales = orders.filter((o) => o.paymentMethod === 'Split').reduce((s, o) => s + o.totalAmount, 0)
    return { cashSales, cardSales, splitSales, totalSales: cashSales + cardSales + splitSales, totalOrders: orders.length }
  }, [shiftOrders])

  const cashAmount = parseFloat(closingCash) || 0
  const cardAmount = parseFloat(closingCard) || 0
  const expectedCash = shift.openingCash + computed.cashSales
  const cashVariance = cashAmount - expectedCash
  const cardVariance = cardAmount - computed.cardSales

  const duration = () => {
    const ms = Date.now() - new Date(shift.openedAt).getTime()
    const h = Math.floor(ms / 3_600_000)
    const m = Math.floor((ms % 3_600_000) / 60_000)
    return `${h}س ${m}د`
  }

  const handlePrint = () => {
    const now = new Date().toLocaleString('ar-SA')
    const cashierName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim()
    const win = window.open('', '_blank', 'width=400,height=600')
    if (!win) return
    win.document.write(`
      <html dir="rtl"><head><meta charset="utf-8"/><title>ملخص الشفت</title>
      <style>
        body{font-family:Arial,sans-serif;font-size:13px;margin:16px;color:#111}
        h2{text-align:center;font-size:16px;margin-bottom:4px}
        .sub{text-align:center;color:#555;font-size:11px;margin-bottom:12px}
        hr{border:none;border-top:1px dashed #999;margin:8px 0}
        .row{display:flex;justify-content:space-between;margin:4px 0}
        .row .lbl{color:#444}.row .val{font-weight:bold}
        .variance{padding:4px 8px;border-radius:4px;font-size:12px;margin-top:2px}
        .ok{background:#d1fae5;color:#065f46}.bad{background:#fee2e2;color:#991b1b}
        .total{font-size:15px;font-weight:bold;text-align:center;margin-top:8px}
      </style></head><body>
      <h2>ملخص الشفت</h2>
      <div class="sub">${cashierName} · ${now}</div>
      <hr/>
      <div class="row"><span class="lbl">رصيد الفتح</span><span class="val">${formatCurrency(shift.openingCash)}</span></div>
      <div class="row"><span class="lbl">مدة الشفت</span><span class="val">${duration()}</span></div>
      <div class="row"><span class="lbl">عدد الطلبات</span><span class="val">${computed.totalOrders}</span></div>
      <hr/>
      <div class="row"><span class="lbl">مبيعات نقدية</span><span class="val">${formatCurrency(computed.cashSales)}</span></div>
      <div class="row"><span class="lbl">مبيعات بطاقة</span><span class="val">${formatCurrency(computed.cardSales)}</span></div>
      ${computed.splitSales > 0 ? `<div class="row"><span class="lbl">مبيعات مختلطة (نقد+بطاقة)</span><span class="val">${formatCurrency(computed.splitSales)}</span></div>` : ''}
      <hr/>
      <div class="row"><span class="lbl">النقد المتوقع</span><span class="val">${formatCurrency(expectedCash)}</span></div>
      <div class="row"><span class="lbl">النقد الفعلي</span><span class="val">${formatCurrency(cashAmount)}</span></div>
      <div class="variance ${cashVariance >= 0 ? 'ok' : 'bad'}">${cashVariance >= 0 ? 'فائض نقدي' : 'عجز نقدي'}: ${formatCurrency(Math.abs(cashVariance))}</div>
      <div class="row" style="margin-top:8px"><span class="lbl">إجمالي البطاقة المتوقع</span><span class="val">${formatCurrency(computed.cardSales)}</span></div>
      <div class="row"><span class="lbl">إجمالي البطاقة الفعلي</span><span class="val">${formatCurrency(cardAmount)}</span></div>
      <div class="variance ${cardVariance >= 0 ? 'ok' : 'bad'}">${cardVariance >= 0 ? 'فائض بطاقة' : 'عجز بطاقة'}: ${formatCurrency(Math.abs(cardVariance))}</div>
      <hr/>
      <div class="total">الدخل اليوم: ${formatCurrency(computed.cashSales)} كاش و ${formatCurrency(computed.cardSales)} بطاقة${computed.splitSales > 0 ? ` و ${formatCurrency(computed.splitSales)} مختلط` : ''}، المجموع ${formatCurrency(computed.totalSales)}</div>
      ${notes ? `<hr/><div style="color:#555;font-size:11px">ملاحظة: ${notes}</div>` : ''}
      </body></html>
    `)
    win.document.close()
    win.print()
  }

  const handleClose = async () => {
    setLoading(true)
    try {
      await shiftsApi.close(branchId!, shift.id, cashAmount, cardAmount, notes || undefined)
      qc.invalidateQueries({ queryKey: ['current-shift', branchId] })
      qc.invalidateQueries({ queryKey: ['shifts', branchId] })
      logActivity(tenantId ?? '', {
        userId: user?.id ?? '',
        userName: `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(),
        userEmail: user?.email,
        category: 'shift',
        action: 'إغلاق الشفت',
        details: `الدخل اليوم: ${formatCurrency(computed.cashSales)} كاش و ${formatCurrency(computed.cardSales)} بطاقة، المجموع ${formatCurrency(computed.totalSales)}`,
        branchId: branchId ?? undefined,
      })
      if (cashVariance < 0) {
        logActivity(tenantId ?? '', {
          userId: user?.id ?? '',
          userName: `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(),
          userEmail: user?.email,
          category: 'shift',
          action: 'عجز في الصندوق',
          details: `عجز نقدي ${formatCurrency(Math.abs(cashVariance))} — متوقع ${formatCurrency(expectedCash)} · فعلي ${formatCurrency(cashAmount)}`,
          branchId: branchId ?? undefined,
        })
      }
      if (cardVariance < 0) {
        logActivity(tenantId ?? '', {
          userId: user?.id ?? '',
          userName: `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(),
          userEmail: user?.email,
          category: 'shift',
          action: 'عجز في البطاقة',
          details: `عجز بطاقة ${formatCurrency(Math.abs(cardVariance))} — متوقع ${formatCurrency(computed.cardSales)} · فعلي ${formatCurrency(cardAmount)}`,
          branchId: branchId ?? undefined,
        })
      }
      toast.success('تم إغلاق الشفت بنجاح')
      onClose()
    } catch {
      toast.error('فشل إغلاق الشفت')
    } finally {
      setLoading(false)
    }
  }

  const hasVariance = (closingCash && cashVariance !== 0) || (closingCard && cardVariance !== 0)

  return (
    <Modal
      open
      onClose={onClose}
      title="إغلاق الشفت"
      footer={
        <div className="flex w-full flex-col gap-2">
          {hasVariance && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>تحذير: يوجد فارق في الجرد — تأكد من المبلغ قبل الإغلاق</span>
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>إلغاء</Button>
            <Button variant="secondary" onClick={handlePrint} className="gap-1">
              <Printer className="h-4 w-4" />
              طباعة
            </Button>
            <Button variant="danger" loading={loading} onClick={handleClose}>
              <Lock className="h-4 w-4" />
              إغلاق الشفت
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4" dir="rtl">
        {/* summary cards */}
        <div className="grid grid-cols-2 gap-3">
          <SummaryCard icon={<ShoppingBag className="h-4 w-4" />} label="إجمالي الطلبات" value={String(computed.totalOrders)} />
          <SummaryCard icon={<TrendingUp className="h-4 w-4" />} label="إجمالي المبيعات" value={formatCurrency(computed.totalSales)} />
          <SummaryCard icon={<Banknote className="h-4 w-4" />} label="مبيعات نقدية" value={formatCurrency(computed.cashSales)} />
          <SummaryCard icon={<CreditCard className="h-4 w-4" />} label="مبيعات بطاقة" value={formatCurrency(computed.cardSales)} />
          <SummaryCard icon={<Clock className="h-4 w-4" />} label="مدة الشفت" value={duration()} />
          <SummaryCard icon={<Banknote className="h-4 w-4" />} label="رصيد الفتح" value={formatCurrency(shift.openingCash)} />
        </div>

        {/* daily income summary */}
        <div className="rounded-xl bg-gray-50 p-3 text-center text-sm dark:bg-gray-800">
          <span className="text-gray-500">الدخل اليوم: </span>
          <span className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(computed.cashSales)} كاش</span>
          <span className="text-gray-400"> و </span>
          <span className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(computed.cardSales)} بطاقة</span>
          {computed.splitSales > 0 && (
            <>
              <span className="text-gray-400"> و </span>
              <span className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(computed.splitSales)} مختلط</span>
            </>
          )}
          <span className="text-gray-400">، المجموع </span>
          <span className="font-bold text-[color:var(--accent)]">{formatCurrency(computed.totalSales)}</span>
        </div>

        {/* cash section */}
        <div className="space-y-2 rounded-xl border border-gray-200 p-3 dark:border-gray-700">
          <p className="text-xs font-medium text-gray-500">جرد النقد</p>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">المتوقع في الصندوق</span>
            <span className="font-bold tabular-nums">{formatCurrency(expectedCash)}</span>
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
            <VarianceBadge label="نقد" variance={cashVariance} />
          )}
        </div>

        {/* card section */}
        <div className="space-y-2 rounded-xl border border-gray-200 p-3 dark:border-gray-700">
          <p className="text-xs font-medium text-gray-500">جرد البطاقة</p>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">المتوقع من الجهاز</span>
            <span className="font-bold tabular-nums">{formatCurrency(computed.cardSales)}</span>
          </div>
          <Input
            label="إجمالي البطاقة من الجهاز (ر.س)"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={closingCard}
            onChange={(e) => setClosingCard(e.target.value)}
          />
          {closingCard && (
            <VarianceBadge label="بطاقة" variance={cardVariance} />
          )}
        </div>

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

function VarianceBadge({ label, variance }: { label: string; variance: number }) {
  const exact = variance === 0
  return (
    <div className={`flex items-center gap-2 rounded-lg p-2.5 text-sm font-medium ${
      exact
        ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
        : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
    }`}>
      {!exact && <AlertTriangle className="h-4 w-4 shrink-0" />}
      <span>
        {exact
          ? `${label} مطابق`
          : variance > 0
          ? `فائض ${label}: ${formatCurrency(variance)}`
          : `عجز ${label}: ${formatCurrency(Math.abs(variance))}`}
      </span>
    </div>
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
