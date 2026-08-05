import { useQuery } from '@tanstack/react-query'
import { Clock, ShoppingBag, Banknote, TrendingUp, CheckCircle, AlertTriangle } from 'lucide-react'
import { shiftsApi } from '@/api/shifts'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency } from '@/lib/utils'
import type { ShiftResponse } from '@/types/api'

export function ShiftReportsPage() {
  const { branchId } = useAuthStore()

  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ['shifts', branchId],
    queryFn: async () => {
      if (!branchId) return []
      const { data } = await shiftsApi.list(branchId, 1, 50)
      return (Array.isArray(data) ? data : []) as ShiftResponse[]
    },
    enabled: !!branchId,
  })

  const closed = shifts.filter((s) => s.status === 'Closed')

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-[color:var(--accent)]" />
      </div>
    )
  }

  if (closed.length === 0) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
        <Clock className="h-12 w-12 text-gray-300" />
        <p className="text-lg font-medium text-gray-500">لا توجد شفتات مغلقة بعد</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4" dir="rtl">
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">تقارير الشفت</h1>
      <div className="space-y-3">
        {closed.map((s) => (
          <ShiftCard key={s.id} shift={s} />
        ))}
      </div>
    </div>
  )
}

function ShiftCard({ shift }: { shift: ShiftResponse }) {
  const openedAt = new Date(shift.openedAt)
  const closedAt = shift.closedAt ? new Date(shift.closedAt) : null
  const ms = closedAt ? closedAt.getTime() - openedAt.getTime() : 0
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)

  const cashVariance = shift.cashVariance ?? 0
  const cardVariance = shift.cardVariance ?? 0
  const hasVariance = cashVariance !== 0 || cardVariance !== 0

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      {/* header */}
      <div className="mb-3 flex items-start justify-between">
        <div>
          <p className="font-semibold text-gray-900 dark:text-gray-100">{shift.cashierName}</p>
          <p className="text-xs text-gray-400">
            {openedAt.toLocaleDateString('ar-SA')} · {openedAt.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
            {closedAt && ` — ${closedAt.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}`}
            {' · '}{h}س {m}د
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
          <CheckCircle className="h-3.5 w-3.5 text-green-500" />
          مغلق
        </div>
      </div>

      {/* income summary */}
      <div className="mb-3 rounded-lg bg-gray-50 p-2.5 text-center text-sm dark:bg-gray-800">
        <span className="text-gray-500">الدخل: </span>
        <span className="font-semibold">{formatCurrency(shift.totalCashSales)} كاش</span>
        <span className="text-gray-400"> و </span>
        <span className="font-semibold">{formatCurrency(shift.totalCardSales)} بطاقة</span>
        <span className="text-gray-400">، المجموع </span>
        <span className="font-bold text-[color:var(--accent)]">{formatCurrency(shift.totalSales)}</span>
      </div>

      {/* stats grid */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <StatCell icon={<ShoppingBag className="h-3.5 w-3.5" />} label="طلبات" value={String(shift.totalOrders)} />
        <StatCell icon={<Banknote className="h-3.5 w-3.5" />} label="فتح" value={formatCurrency(shift.openingCash)} />
        <StatCell icon={<TrendingUp className="h-3.5 w-3.5" />} label="ضريبة" value={formatCurrency(shift.totalTax)} />
      </div>

      {/* variances */}
      {hasVariance && (
        <div className="mt-3 flex flex-wrap gap-2">
          {cashVariance !== 0 && (
            <VarianceChip label="نقد" variance={cashVariance} />
          )}
          {cardVariance !== 0 && (
            <VarianceChip label="بطاقة" variance={cardVariance} />
          )}
        </div>
      )}

      {shift.notes && (
        <p className="mt-2 text-xs text-gray-400">ملاحظة: {shift.notes}</p>
      )}
    </div>
  )
}

function StatCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 p-2 dark:bg-gray-800">
      <div className="mb-1 flex items-center justify-center gap-1 text-gray-400">{icon}</div>
      <p className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{value}</p>
      <p className="text-gray-400">{label}</p>
    </div>
  )
}

function VarianceChip({ label, variance }: { label: string; variance: number }) {
  const positive = variance >= 0
  return (
    <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
      positive
        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    }`}>
      {!positive && <AlertTriangle className="h-3 w-3" />}
      {positive ? `فائض ${label}` : `عجز ${label}`}: {formatCurrency(Math.abs(variance))}
    </span>
  )
}
