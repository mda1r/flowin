import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { TrendingUp, DollarSign, ShoppingCart, RotateCcw } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Table } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ordersApi } from '@/api/orders'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { toast } from '@/components/ui/Toast'
import type { OrderLineResponse, OrderResponse, RefundMethod, ReturnReason } from '@/types/api'

type DateRange = 'today' | 'week' | 'month'

const RETURN_REASONS: { value: ReturnReason; label: string }[] = [
  { value: 'DefectiveProduct', label: 'عيب في المنتج' },
  { value: 'CustomerRequest', label: 'طلب العميل' },
  { value: 'OrderError', label: 'خطأ في الطلب' },
  { value: 'Other', label: 'أخرى' },
]

const REFUND_METHODS: { value: RefundMethod; label: string }[] = [
  { value: 'Cash', label: 'نقد' },
  { value: 'Card', label: 'بطاقة' },
  { value: 'StoreCredit', label: 'رصيد في الحساب' },
]

interface ReturnLineState {
  lineId: string
  selected: boolean
  quantity: number
  maxQuantity: number
  reason: ReturnReason
}

function ReturnModal({
  order,
  onClose,
}: {
  order: OrderResponse
  onClose: () => void
}) {
  const { branchId } = useAuthStore()
  const qc = useQueryClient()

  const [refundMethod, setRefundMethod] = useState<RefundMethod>('Cash')
  const [lineStates, setLineStates] = useState<ReturnLineState[]>(() =>
    order?.lines.map((l) => ({
      lineId: l.id,
      selected: false,
      quantity: l.quantity,
      maxQuantity: l.quantity,
      reason: 'CustomerRequest' as ReturnReason,
    })) ?? []
  )

  const returnMutation = useMutation({
    mutationFn: () => {
      const lines = lineStates
        .filter((s) => s.selected)
        .map((s) => ({ lineId: s.lineId, quantity: s.quantity, reason: s.reason }))

      return ordersApi.returnOrder(branchId!, order.id, { refundMethod, lines })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders', branchId] })
      toast.success('تمت عملية الإرجاع بنجاح')
      onClose()
    },
    onError: () => toast.error('فشلت عملية الإرجاع'),
  })

  const selectedLines = lineStates.filter((s) => s.selected)
  const totalRefund = selectedLines.reduce((sum, s) => {
    const line = order.lines.find((l) => l.id === s.lineId)
    return sum + (line ? line.unitPrice * s.quantity : 0)
  }, 0)

  const toggleLine = (lineId: string) => {
    setLineStates((prev) =>
      prev.map((s) => (s.lineId === lineId ? { ...s, selected: !s.selected } : s))
    )
  }

  const updateQty = (lineId: string, qty: number) => {
    setLineStates((prev) =>
      prev.map((s) => (s.lineId === lineId ? { ...s, quantity: Math.min(Math.max(1, qty), s.maxQuantity) } : s))
    )
  }

  const updateReason = (lineId: string, reason: ReturnReason) => {
    setLineStates((prev) =>
      prev.map((s) => (s.lineId === lineId ? { ...s, reason } : s))
    )
  }

  return (
    <Modal
      open={!!order}
      onClose={onClose}
      title={`إرجاع الطلب — ${order.id.slice(0, 8).toUpperCase()}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>إلغاء</Button>
          <Button
            loading={returnMutation.isPending}
            disabled={selectedLines.length === 0}
            onClick={() => returnMutation.mutate()}
          >
            تأكيد الإرجاع · {formatCurrency(totalRefund)}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Line Items */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">اختر المنتجات للإرجاع</p>
          {order.lines.map((line: OrderLineResponse) => {
            const state = lineStates.find((s) => s.lineId === line.id)!
            return (
              <div
                key={line.id}
                className={`rounded-xl border p-3 transition-colors ${
                  state.selected
                    ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={state.selected}
                    onChange={() => toggleLine(line.id)}
                    className="mt-1 h-4 w-4 rounded border-gray-300 accent-blue-600"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                      {line.productName}
                    </p>
                    <p className="text-xs text-gray-500">{line.variantName} · {formatCurrency(line.unitPrice)} × {line.quantity}</p>

                    {state.selected && (
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                            الكمية
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={state.maxQuantity}
                            value={state.quantity}
                            onChange={(e) => updateQty(line.id, Number(e.target.value))}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                            السبب
                          </label>
                          <select
                            value={state.reason}
                            onChange={(e) => updateReason(line.id, e.target.value as ReturnReason)}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800"
                          >
                            {RETURN_REASONS.map((r) => (
                              <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Refund Method */}
        <div>
          <p className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">طريقة الاسترداد</p>
          <div className="flex flex-wrap gap-2">
            {REFUND_METHODS.map((m) => (
              <button
                key={m.value}
                onClick={() => setRefundMethod(m.value)}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                  refundMethod === m.value
                    ? 'border-blue-500 bg-blue-600 text-white'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Summary */}
        {selectedLines.length > 0 && (
          <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                إجمالي المبلغ المسترد ({selectedLines.length} منتجات)
              </span>
              <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {formatCurrency(totalRefund)}
              </span>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

export function SalesPage() {
  const [range, setRange] = useState<DateRange>('today')
  const [returnOrder, setReturnOrder] = useState<OrderResponse | null>(null)
  const { branchId } = useAuthStore()

  const { data: orders, isLoading } = useQuery({
    queryKey: ['orders', branchId, 'sales', range],
    queryFn: () =>
      ordersApi.listOrders(branchId!, { status: 'Completed', pageSize: 100 }),
    enabled: !!branchId,
  })

  const items = orders?.data ?? []
  const totalRevenue = items.reduce((s, o) => s + o.totalAmount, 0)
  const avgOrder = items.length > 0 ? totalRevenue / items.length : 0

  const ranges: { label: string; value: DateRange }[] = [
    { label: 'اليوم', value: 'today' },
    { label: 'هذا الأسبوع', value: 'week' },
    { label: 'هذا الشهر', value: 'month' },
  ]

  return (
    <div>
      <PageHeader
        title="المبيعات"
        description="تقارير الإيرادات وسجل الطلبات"
        action={
          <div className="flex rounded-lg border border-gray-200 bg-white p-1 dark:border-gray-800 dark:bg-gray-900">
            {ranges.map((r) => (
              <button
                key={r.value}
                onClick={() => setRange(r.value)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  range === r.value
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        }
      />
      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardBody className="flex items-center gap-4">
              <div className="rounded-xl bg-blue-50 p-3 dark:bg-blue-900/30">
                <DollarSign className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">إجمالي الإيرادات</p>
                <p className="text-xl font-bold tabular-nums">{formatCurrency(totalRevenue)}</p>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="flex items-center gap-4">
              <div className="rounded-xl bg-purple-50 p-3 dark:bg-purple-900/30">
                <ShoppingCart className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">إجمالي الطلبات</p>
                <p className="text-xl font-bold tabular-nums">{items.length}</p>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="flex items-center gap-4">
              <div className="rounded-xl bg-green-50 p-3 dark:bg-green-900/30">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">متوسط قيمة الطلب</p>
                <p className="text-xl font-bold tabular-nums">{formatCurrency(avgOrder)}</p>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Orders table */}
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              الطلبات
            </h2>
          </CardHeader>
          <Table
            loading={isLoading}
            data={items}
            keyExtractor={(r) => r.id}
            emptyMessage="لا توجد طلبات لهذه الفترة"
            columns={[
              {
                key: 'id',
                header: 'رقم الطلب',
                render: (r) => (
                  <span className="font-mono text-sm font-medium">{r.id.slice(0, 8).toUpperCase()}</span>
                ),
              },
              {
                key: 'lines',
                header: 'المنتجات',
                render: (r) => `${r.lines.length} منتجات`,
              },
              {
                key: 'totalAmount',
                header: 'الإجمالي',
                render: (r) => (
                  <span className="font-semibold tabular-nums">{formatCurrency(r.totalAmount)}</span>
                ),
              },
              {
                key: 'status',
                header: 'الحالة',
                render: (r) => (
                  <Badge variant={r.status === 'Completed' ? 'green' : r.status === 'Cancelled' ? 'red' : 'yellow'}>
                    {r.status === 'Completed' ? 'مكتمل' : r.status === 'Cancelled' ? 'ملغى' : 'مفتوح'}
                  </Badge>
                ),
              },
              {
                key: 'completedAt',
                header: 'التاريخ',
                render: (r) => r.completedAt ? formatDateTime(r.completedAt) : '—',
              },
              {
                key: 'actions',
                header: '',
                render: (r) =>
                  r.status === 'Completed' ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); setReturnOrder(r) }}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      إرجاع
                    </Button>
                  ) : null,
              },
            ]}
          />
        </Card>
      </div>

      {returnOrder && (
        <ReturnModal key={returnOrder.id} order={returnOrder} onClose={() => setReturnOrder(null)} />
      )}
    </div>
  )
}
