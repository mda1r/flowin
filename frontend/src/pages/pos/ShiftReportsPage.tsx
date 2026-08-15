import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Clock, ShoppingBag, Banknote, TrendingUp, CheckCircle,
  AlertTriangle, ChevronDown, ChevronUp, Receipt,
} from 'lucide-react'
import { shiftsApi } from '@/api/shifts'
import { ordersApi } from '@/api/orders'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency } from '@/lib/utils'
import type { ShiftResponse, OrderResponse } from '@/types/api'

export function ShiftReportsPage() {
  const { branchId } = useAuthStore()

  const { data: currentShift, isLoading: loadingCurrent } = useQuery({
    queryKey: ['shift-current', branchId],
    queryFn: async () => {
      if (!branchId) return null
      const { data } = await shiftsApi.getCurrent(branchId)
      return data as ShiftResponse | null
    },
    enabled: !!branchId,
    refetchInterval: 30_000,
  })

  const { data: shifts = [], isLoading: loadingList } = useQuery({
    queryKey: ['shifts', branchId],
    queryFn: async () => {
      if (!branchId) return []
      const { data } = await shiftsApi.list(branchId, 1, 50)
      return (Array.isArray(data) ? data : []) as ShiftResponse[]
    },
    enabled: !!branchId,
  })

  const closed = shifts.filter((s) => s.status === 'Closed')

  if (loadingCurrent || loadingList) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-[color:var(--accent)]" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-5" dir="rtl">
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">تقارير الشفت</h1>

      {/* Current open shift */}
      {currentShift && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[color:var(--accent)]">الشفت الحالي</p>
          <ShiftCard shift={currentShift} isCurrent />
        </div>
      )}

      {/* Closed shifts */}
      {closed.length > 0 && (
        <div>
          {currentShift && (
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">الشفتات السابقة</p>
          )}
          <div className="space-y-3">
            {closed.map((s) => (
              <ShiftCard key={s.id} shift={s} />
            ))}
          </div>
        </div>
      )}

      {!currentShift && closed.length === 0 && (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
          <Clock className="h-12 w-12 text-gray-300" />
          <p className="text-lg font-medium text-gray-500">لا توجد شفتات بعد</p>
        </div>
      )}
    </div>
  )
}

function ShiftCard({ shift, isCurrent = false }: { shift: ShiftResponse; isCurrent?: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const { branchId } = useAuthStore()

  const openedAt = new Date(shift.openedAt)
  const closedAt = shift.closedAt ? new Date(shift.closedAt) : null
  const ms = closedAt ? closedAt.getTime() - openedAt.getTime() : Date.now() - openedAt.getTime()
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)

  const cashVariance = shift.cashVariance ?? 0
  const cardVariance = shift.cardVariance ?? 0
  const hasVariance = cashVariance !== 0 || cardVariance !== 0

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['shift-orders', branchId, shift.id],
    queryFn: async () => {
      if (!branchId) return []
      const dateFrom = shift.openedAt
      const dateTo = shift.closedAt ?? new Date().toISOString()
      const { data } = await ordersApi.listOrders(branchId, {
        status: 'Completed',
        dateFrom,
        dateTo,
        pageSize: 100,
      })
      return (Array.isArray(data) ? data : (data as any)?.items ?? []) as OrderResponse[]
    },
    enabled: expanded && !!branchId,
  })

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      {/* Card header (clickable) */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full p-4 text-right"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 dark:text-gray-100">{shift.cashierName}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {openedAt.toLocaleDateString('ar-SA')} · {openedAt.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
              {closedAt && ` — ${closedAt.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}`}
              {' · '}{h}س {m}د
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isCurrent ? (
              <span className="flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                مفتوح
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                مغلق
              </span>
            )}
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            )}
          </div>
        </div>

        {/* Income summary */}
        <div className="mt-3 rounded-lg bg-gray-50 p-2.5 text-center text-sm dark:bg-gray-800">
          <span className="text-gray-500">الدخل: </span>
          <span className="font-semibold">{formatCurrency(shift.totalCashSales)} كاش</span>
          <span className="text-gray-400"> و </span>
          <span className="font-semibold">{formatCurrency(shift.totalCardSales)} بطاقة</span>
          <span className="text-gray-400">، المجموع </span>
          <span className="font-bold text-[color:var(--accent)]">{formatCurrency(shift.totalSales)}</span>
        </div>

        {/* Stats grid */}
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
          <StatCell icon={<ShoppingBag className="h-3.5 w-3.5" />} label="طلبات" value={String(shift.totalOrders)} />
          <StatCell icon={<Banknote className="h-3.5 w-3.5" />} label="فتح" value={formatCurrency(shift.openingCash)} />
          <StatCell icon={<TrendingUp className="h-3.5 w-3.5" />} label="ضريبة" value={formatCurrency(shift.totalTax)} />
        </div>

        {/* Variances */}
        {hasVariance && (
          <div className="mt-3 flex flex-wrap gap-2">
            {cashVariance !== 0 && <VarianceChip label="نقد" variance={cashVariance} />}
            {cardVariance !== 0 && <VarianceChip label="بطاقة" variance={cardVariance} />}
          </div>
        )}

        {shift.notes && (
          <p className="mt-2 text-xs text-gray-400 text-right">ملاحظة: {shift.notes}</p>
        )}
      </button>

      {/* Expanded orders list */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 pb-4 dark:border-gray-800">
          <div className="mb-2 mt-3 flex items-center gap-1.5 text-xs font-semibold text-gray-500">
            <Receipt className="h-3.5 w-3.5" />
            الفواتير ({orders.length})
          </div>
          {ordersLoading ? (
            <div className="flex justify-center py-6">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-[color:var(--accent)]" />
            </div>
          ) : orders.length === 0 ? (
            <p className="py-4 text-center text-xs text-gray-400">لا توجد طلبات في هذا الشفت</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-xs dark:bg-gray-800"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono font-bold text-gray-500">#{order.id.slice(-4).toUpperCase()}</span>
                    <span className="text-gray-400">
                      {new Date(order.completedAt ?? order.createdAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className={`rounded-full px-1.5 py-0.5 font-medium ${
                      order.paymentMethod === 'Cash'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    }`}>
                      {order.paymentMethod === 'Cash' ? 'نقد' : 'بطاقة'}
                    </span>
                    <span className="text-gray-400 truncate">
                      {order.lines.length} منتج
                    </span>
                  </div>
                  <span className="font-bold tabular-nums text-gray-900 dark:text-gray-100 shrink-0">
                    {formatCurrency(order.totalAmount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
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
