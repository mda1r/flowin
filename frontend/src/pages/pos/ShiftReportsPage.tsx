import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Clock, ShoppingBag, Banknote, TrendingUp, CheckCircle,
  AlertTriangle, ChevronDown, Receipt, Printer,
} from 'lucide-react'
import { shiftsApi } from '@/api/shifts'
import { ordersApi } from '@/api/orders'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency } from '@/lib/utils'
import { useI18n } from '@/i18n'
import type { ShiftResponse, OrderResponse } from '@/types/api'

function printShift(shift: ShiftResponse) {
  const openedAt = new Date(shift.openedAt)
  const closedAt = shift.closedAt ? new Date(shift.closedAt) : null
  const ms = closedAt ? closedAt.getTime() - openedAt.getTime() : Date.now() - openedAt.getTime()
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)

  const cashVariance = shift.cashVariance ?? 0
  const cardVariance = shift.cardVariance ?? 0
  const expectedCash = shift.expectedCash ?? (shift.openingCash + shift.totalCashSales)
  const closingCash = shift.closingCash ?? 0
  const closingCard = shift.closingCardCount ?? 0

  const win = window.open('', '_blank', 'width=420,height=720')
  if (!win) return

  win.document.write(`
    <html dir="rtl"><head><meta charset="utf-8"/>
    <title>فاتورة الشفت — ${shift.cashierName}</title>
    <style>
      @media print { body { margin: 0 } }
      body { font-family: Arial, sans-serif; font-size: 13px; margin: 16px; color: #111 }
      h2 { text-align: center; font-size: 17px; margin-bottom: 4px; font-weight: bold }
      .sub { text-align: center; color: #555; font-size: 11px; margin-bottom: 12px; line-height: 1.7 }
      hr { border: none; border-top: 1px dashed #999; margin: 8px 0 }
      .row { display: flex; justify-content: space-between; margin: 5px 0 }
      .row .lbl { color: #555 }
      .row .val { font-weight: bold }
      .variance { padding: 5px 8px; border-radius: 4px; font-size: 12px; margin-top: 3px }
      .ok  { background: #d1fae5; color: #065f46 }
      .bad { background: #fee2e2; color: #991b1b }
      .total { font-size: 14px; font-weight: bold; text-align: center; margin-top: 10px;
               padding: 10px; border: 1px solid #ddd; border-radius: 6px; background: #f9f9f9 }
      .note { color: #666; font-size: 11px; margin-top: 8px }
    </style></head><body>
    <h2>فاتورة الشفت</h2>
    <div class="sub">
      ${shift.cashierName}<br/>
      الفتح: ${openedAt.toLocaleString('ar-SA')}<br/>
      ${closedAt ? `الإغلاق: ${closedAt.toLocaleString('ar-SA')}<br/>` : ''}
      المدة: ${h}س ${m}د
    </div>
    <hr/>
    <div class="row"><span class="lbl">رصيد الفتح</span><span class="val">${formatCurrency(shift.openingCash)}</span></div>
    <div class="row"><span class="lbl">عدد الطلبات</span><span class="val">${shift.totalOrders}</span></div>
    <div class="row"><span class="lbl">ضريبة القيمة المضافة 15%</span><span class="val">${formatCurrency(shift.totalTax)}</span></div>
    <hr/>
    <div class="row"><span class="lbl">مبيعات نقدية</span><span class="val">${formatCurrency(shift.totalCashSales)}</span></div>
    <div class="row"><span class="lbl">مبيعات بطاقة</span><span class="val">${formatCurrency(shift.totalCardSales)}</span></div>
    ${shift.closedAt ? `
    <hr/>
    <div class="row"><span class="lbl">النقد المتوقع في الصندوق</span><span class="val">${formatCurrency(expectedCash)}</span></div>
    <div class="row"><span class="lbl">النقد الفعلي</span><span class="val">${formatCurrency(closingCash)}</span></div>
    <div class="variance ${cashVariance >= 0 ? 'ok' : 'bad'}">
      ${cashVariance >= 0 ? 'فائض نقدي' : 'عجز نقدي'}: ${formatCurrency(Math.abs(cashVariance))}
    </div>
    <div class="row" style="margin-top:8px"><span class="lbl">إجمالي البطاقة المتوقع</span><span class="val">${formatCurrency(shift.totalCardSales)}</span></div>
    <div class="row"><span class="lbl">إجمالي البطاقة الفعلي</span><span class="val">${formatCurrency(closingCard)}</span></div>
    <div class="variance ${cardVariance >= 0 ? 'ok' : 'bad'}">
      ${cardVariance >= 0 ? 'فائض بطاقة' : 'عجز بطاقة'}: ${formatCurrency(Math.abs(cardVariance))}
    </div>
    ` : ''}
    <hr/>
    <div class="total">
      الإجمالي: ${formatCurrency(shift.totalSales)}<br/>
      <span style="font-size:12px;font-weight:normal;color:#555">
        ${formatCurrency(shift.totalCashSales)} نقد · ${formatCurrency(shift.totalCardSales)} بطاقة
      </span>
    </div>
    ${shift.notes ? `<div class="note">ملاحظة: ${shift.notes}</div>` : ''}
    </body></html>
  `)
  win.document.close()
  win.print()
}

export function ShiftReportsPage() {
  const { branchId } = useAuthStore()
  const { t } = useI18n()

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
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t.shiftReports.title}</h1>

      {/* Current open shift */}
      {currentShift && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[color:var(--accent)]">{t.shiftReports.currentShift}</p>
          <ShiftCard shift={currentShift} isCurrent />
        </div>
      )}

      {/* Closed shifts */}
      {closed.length > 0 && (
        <div>
          {currentShift && (
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">{t.shiftReports.pastShifts}</p>
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
          <p className="text-lg font-medium text-gray-500">{t.shiftReports.noShifts}</p>
        </div>
      )}
    </div>
  )
}

function ShiftCard({ shift, isCurrent = false }: { shift: ShiftResponse; isCurrent?: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const { branchId } = useAuthStore()
  const { t, lang } = useI18n()

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
      const from = shift.openedAt
      const to = shift.closedAt ?? new Date().toISOString()
      const { data } = await ordersApi.listOrders(branchId, {
        status: 'Completed',
        from,
        to,
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
              {openedAt.toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US')} · {openedAt.toLocaleTimeString(lang === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
              {closedAt && ` — ${closedAt.toLocaleTimeString(lang === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })}`}
              {' · '}{h}س {m}د
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isCurrent ? (
              <span className="flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                {t.shiftReports.status.open}
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                {t.shiftReports.status.closed}
              </span>
            )}
            <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </div>
        </div>

        {/* Income summary */}
        <div className="mt-3 rounded-lg bg-gray-50 p-2.5 text-center text-sm dark:bg-gray-800">
          <span className="text-gray-500">{t.shiftReports.income}: </span>
          <span className="font-semibold">{formatCurrency(shift.totalCashSales)} {t.shiftReports.cash}</span>
          <span className="text-gray-400"> {t.shiftReports.and} </span>
          <span className="font-semibold">{formatCurrency(shift.totalCardSales)} {t.shiftReports.card}</span>
          <span className="text-gray-400">، {t.shiftReports.total} </span>
          <span className="font-bold text-[color:var(--accent)]">{formatCurrency(shift.totalSales)}</span>
        </div>

        {/* Stats grid */}
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
          <StatCell icon={<ShoppingBag className="h-3.5 w-3.5" />} label={t.shiftReports.orders} value={String(shift.totalOrders)} />
          <StatCell icon={<Banknote className="h-3.5 w-3.5" />} label={t.shiftReports.opening} value={formatCurrency(shift.openingCash)} />
          <StatCell icon={<TrendingUp className="h-3.5 w-3.5" />} label={t.shiftReports.tax} value={formatCurrency(shift.totalTax)} />
        </div>

        {/* Variances */}
        {hasVariance && (
          <div className="mt-3 flex flex-wrap gap-2">
            {cashVariance !== 0 && <VarianceChip label={t.shiftReports.cash} variance={cashVariance} />}
            {cardVariance !== 0 && <VarianceChip label={t.shiftReports.card} variance={cardVariance} />}
          </div>
        )}

        {shift.notes && (
          <p className="mt-2 text-xs text-gray-400 text-right">ملاحظة: {shift.notes}</p>
        )}
      </button>

      {/* Print button — always visible */}
      <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2 dark:border-gray-800">
        <button
          onClick={(e) => { e.stopPropagation(); printShift(shift) }}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          <Printer className="h-3.5 w-3.5" />
          {t.shiftReports.printReport}
        </button>
        <span className="text-xs text-gray-400">
          {expanded ? t.shiftReports.hideInvoices + ' ▲' : t.shiftReports.showInvoices + ' ▼'}
        </span>
      </div>

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
            <p className="py-4 text-center text-xs text-gray-400">{t.shiftReports.noOrdersInShift}</p>
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
                      {new Date(order.completedAt ?? order.createdAt).toLocaleTimeString(lang === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className={`rounded-full px-1.5 py-0.5 font-medium ${
                      order.paymentMethod === 'Cash'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    }`}>
                      {order.paymentMethod === 'Cash' ? t.shiftReports.cash : t.shiftReports.card}
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
  const { t } = useI18n()
  const positive = variance >= 0
  return (
    <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
      positive
        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    }`}>
      {!positive && <AlertTriangle className="h-3 w-3" />}
      {positive ? `${t.shiftReports.surplus} ${label}` : `${t.shiftReports.deficit} ${label}`}: {formatCurrency(Math.abs(variance))}
    </span>
  )
}
