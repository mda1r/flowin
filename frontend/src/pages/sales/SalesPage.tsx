import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { TrendingUp, DollarSign, ShoppingCart, RotateCcw, PackageX, PackageCheck } from 'lucide-react'
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
import { useI18n } from '@/i18n'
import type { OrderLineResponse, OrderResponse, RefundMethod, ReturnOrderResponse, ReturnReason } from '@/types/api'

type DateRange = 'today' | 'week' | 'month' | 'year'

interface ReturnLineState {
  lineId: string
  selected: boolean
  quantity: number
  maxQuantity: number
  reason: ReturnReason
}

function ReturnModal({
  order,
  existingReturns,
  onClose,
}: {
  order: OrderResponse
  existingReturns: ReturnOrderResponse[]
  onClose: () => void
}) {
  const { branchId } = useAuthStore()
  const qc = useQueryClient()
  const { t } = useI18n()

  const RETURN_REASONS: { value: ReturnReason; label: string }[] = [
    { value: 'DefectiveProduct', label: t.sales.returnReasons.damaged },
    { value: 'CustomerRequest', label: t.sales.returnReasons.customerRequest },
    { value: 'OrderError', label: t.sales.returnReasons.wrongItem },
    { value: 'Other', label: t.sales.returnReasons.other },
  ]

  const REFUND_METHODS: { value: RefundMethod; label: string }[] = [
    { value: 'Cash', label: t.sales.refundMethods.cash },
    { value: 'Card', label: t.sales.refundMethods.card },
    { value: 'StoreCredit', label: t.sales.refundMethods.storeCredit },
  ]

  const [refundMethod, setRefundMethod] = useState<RefundMethod>('Cash')
  const [restockItems, setRestockItems] = useState(true)

  // Calculate already-returned quantity per original line id
  const returnedQtyMap = new Map<string, number>()
  for (const ret of existingReturns) {
    for (const l of ret.lines) {
      returnedQtyMap.set(l.originalLineId, (returnedQtyMap.get(l.originalLineId) ?? 0) + l.quantity)
    }
  }

  const [lineStates, setLineStates] = useState<ReturnLineState[]>(() =>
    order?.lines.map((l) => {
      const returned = returnedQtyMap.get(l.id) ?? 0
      const remaining = Math.max(0, l.quantity - returned)
      return {
        lineId: l.id,
        selected: false,
        quantity: remaining,
        maxQuantity: remaining,
        reason: 'CustomerRequest' as ReturnReason,
      }
    }) ?? []
  )

  const returnMutation = useMutation({
    mutationFn: () => {
      const lines = lineStates
        .filter((s) => s.selected)
        .map((s) => ({ lineId: s.lineId, quantity: s.quantity, reason: s.reason }))

      return ordersApi.returnOrder(branchId!, order.id, { refundMethod, lines, restockItems })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders', branchId] })
      qc.invalidateQueries({ queryKey: ['returns', branchId] })
      toast.success(t.sales.returnSuccess)
      onClose()
    },
    onError: () => toast.error(t.sales.returnFailed),
  })

  const selectedLines = lineStates.filter((s) => s.selected)
  const taxMultiplier = 1 + (order.taxRate ?? 0)
  const totalRefund = Math.round(
    selectedLines.reduce((sum, s) => {
      const line = order.lines.find((l) => l.id === s.lineId)
      return sum + (line ? line.unitPrice * s.quantity : 0)
    }, 0) * taxMultiplier * 100
  ) / 100

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
      title={`${t.sales.returnOrder} — ${order.id.slice(0, 8).toUpperCase()}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t.common.cancel}</Button>
          <Button
            loading={returnMutation.isPending}
            disabled={selectedLines.length === 0}
            onClick={() => returnMutation.mutate()}
          >
            {t.sales.processReturn} · {formatCurrency(totalRefund)}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Line Items */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t.sales.lineItems}</p>
          {order.lines.map((line: OrderLineResponse) => {
            const state = lineStates.find((s) => s.lineId === line.id)!
            const fullyReturned = state.maxQuantity === 0
            return (
              <div
                key={line.id}
                className={`rounded-xl border p-3 transition-colors ${
                  fullyReturned
                    ? 'border-gray-100 bg-gray-50 opacity-60 dark:border-gray-800 dark:bg-gray-900/30'
                    : state.selected
                    ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={state.selected}
                    onChange={() => toggleLine(line.id)}
                    disabled={fullyReturned}
                    className="mt-1 h-4 w-4 rounded border-gray-300 accent-blue-600 disabled:cursor-not-allowed"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                        {line.productName}
                      </p>
                      {fullyReturned && (
                        <span className="shrink-0 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                          {t.sales.returnSuccess}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {line.variantName} · {formatCurrency(line.unitPrice)} × {line.quantity}
                      {!fullyReturned && state.maxQuantity < line.quantity && (
                        <span className="mr-1 text-orange-500">({state.maxQuantity})</span>
                      )}
                    </p>

                    {state.selected && (
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                            {t.sales.amount}
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
                            {t.sales.returnReason}
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
          <p className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">{t.sales.refundMethod}</p>
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

        {/* Inventory disposition */}
        <div>
          <p className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">{t.sales.inventoryDisposition}</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setRestockItems(true)}
              className={`flex items-center gap-2 rounded-xl border p-3 text-sm font-medium transition-colors ${
                restockItems
                  ? 'border-green-500 bg-green-50 text-green-700 dark:border-green-600 dark:bg-green-900/20 dark:text-green-400'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400'
              }`}
            >
              <PackageCheck className="h-4 w-4 shrink-0" />
              <div className="text-right">
                <p className="font-medium">{t.sales.keepInStock}</p>
              </div>
            </button>
            <button
              onClick={() => setRestockItems(false)}
              className={`flex items-center gap-2 rounded-xl border p-3 text-sm font-medium transition-colors ${
                !restockItems
                  ? 'border-red-500 bg-red-50 text-red-700 dark:border-red-600 dark:bg-red-900/20 dark:text-red-400'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400'
              }`}
            >
              <PackageX className="h-4 w-4 shrink-0" />
              <div className="text-right">
                <p className="font-medium">{t.sales.removeFromStock}</p>
              </div>
            </button>
          </div>
        </div>

        {/* Summary */}
        {selectedLines.length > 0 && (
          <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {t.sales.netRevenue} ({selectedLines.length})
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
  const { t } = useI18n()

  const from = (() => {
    const now = new Date()
    if (range === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    if (range === 'week') {
      const d = new Date(now)
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
      d.setHours(0, 0, 0, 0)
      return d.toISOString()
    }
    if (range === 'month') return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    return new Date(now.getFullYear(), 0, 1).toISOString()
  })()

  const { data: orders, isLoading } = useQuery({
    queryKey: ['orders', branchId, 'sales', range],
    queryFn: () =>
      ordersApi.listOrders(branchId!, { status: 'Completed', pageSize: 200, from }),
    enabled: !!branchId,
  })

  const { data: returnsData } = useQuery({
    queryKey: ['returns', branchId],
    queryFn: () => ordersApi.listReturns(branchId!),
    enabled: !!branchId,
  })

  const items: OrderResponse[] = (() => {
    const raw = orders?.data
    return Array.isArray(raw) ? raw : ((raw as any)?.items ?? [])
  })()

  const returnsList: ReturnOrderResponse[] = (() => {
    const raw = returnsData?.data
    return Array.isArray(raw) ? raw : ((raw as any)?.items ?? [])
  })()

  // Build a map of orderId → total refund amount (only for orders in current period)
  const orderIds = new Set(items.map((o) => o.id))
  const returnsMap = new Map<string, number>()
  for (const r of returnsList) {
    if (orderIds.has(r.originalOrderId)) {
      returnsMap.set(r.originalOrderId, (returnsMap.get(r.originalOrderId) ?? 0) + r.refundAmount)
    }
  }

  const totalRevenue = items.reduce((s, o) => s + o.totalAmount, 0)
  const totalRefunds = Array.from(returnsMap.values()).reduce((s, v) => s + v, 0)
  const netRevenue = totalRevenue - totalRefunds
  const avgOrder = items.length > 0 ? totalRevenue / items.length : 0

  const ranges: { label: string; value: DateRange }[] = [
    { label: t.sales.today, value: 'today' },
    { label: t.sales.thisWeek, value: 'week' },
    { label: t.sales.thisMonth, value: 'month' },
    { label: t.reports.periods.thisYear, value: 'year' },
  ]

  return (
    <div>
      <PageHeader
        title={t.sales.title}
        description={t.sales.description}
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Card>
            <CardBody className="flex items-center gap-4">
              <div className="rounded-xl bg-blue-50 p-3 dark:bg-blue-900/30">
                <DollarSign className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">{t.sales.netRevenue}</p>
                <p className="text-xl font-bold tabular-nums">{formatCurrency(netRevenue)}</p>
                {totalRefunds > 0 && (
                  <p className="text-xs text-red-500 tabular-nums">−{formatCurrency(totalRefunds)} {t.sales.returns}</p>
                )}
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="flex items-center gap-4">
              <div className="rounded-xl bg-purple-50 p-3 dark:bg-purple-900/30">
                <ShoppingCart className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">{t.sales.totalOrders}</p>
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
                <p className="text-xs text-gray-500">{t.reports.avgOrderValue}</p>
                <p className="text-xl font-bold tabular-nums">{formatCurrency(avgOrder)}</p>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="flex items-center gap-4">
              <div className="rounded-xl bg-red-50 p-3 dark:bg-red-900/30">
                <RotateCcw className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-gray-500">{t.sales.returns}</p>
                <p className="text-xl font-bold tabular-nums text-red-600">{formatCurrency(totalRefunds)}</p>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Orders table */}
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {t.sales.title}
            </h2>
          </CardHeader>
          <Table
            loading={isLoading}
            data={items}
            keyExtractor={(r) => r.id}
            emptyMessage={t.sales.noSales}
            columns={[
              {
                key: 'id',
                header: t.sales.orderId,
                render: (r) => (
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium text-blue-600 dark:text-blue-400">
                      #{r.id.slice(-6).toUpperCase()}
                    </span>
                    {returnsMap.has(r.id) && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                        <RotateCcw className="h-3 w-3" />
                        {t.sales.returns}
                      </span>
                    )}
                  </div>
                ),
              },
              {
                key: 'lines',
                header: t.sales.lineItems,
                render: (r) => r.lines.length,
              },
              {
                key: 'totalAmount',
                header: t.sales.amount,
                render: (r) => {
                  const refund = returnsMap.get(r.id) ?? 0
                  const net = r.totalAmount - refund
                  return (
                    <div>
                      <span className="font-semibold tabular-nums">{formatCurrency(net)}</span>
                      {refund > 0 && (
                        <p className="text-xs text-gray-400 tabular-nums line-through">{formatCurrency(r.totalAmount)}</p>
                      )}
                    </div>
                  )
                },
              },
              {
                key: 'refund',
                header: t.sales.returns,
                render: (r) => {
                  const refund = returnsMap.get(r.id)
                  return refund
                    ? <span className="text-sm font-medium text-red-600 tabular-nums">−{formatCurrency(refund)}</span>
                    : <span className="text-gray-300 dark:text-gray-600">—</span>
                },
              },
              {
                key: 'status',
                header: t.sales.method,
                render: (r) => (
                  <Badge variant={r.status === 'Completed' ? 'green' : r.status === 'Cancelled' ? 'red' : 'yellow'}>
                    {r.status === 'Completed' ? t.sales.completed : r.status === 'Cancelled' ? t.finance.status.cancelled : t.finance.status.pending}
                  </Badge>
                ),
              },
              {
                key: 'completedAt',
                header: t.sales.date,
                className: 'whitespace-nowrap',
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
                      {t.sales.returnOrder}
                    </Button>
                  ) : null,
              },
            ]}
          />
        </Card>
      </div>

      {returnOrder && (
        <ReturnModal
          key={returnOrder.id}
          order={returnOrder}
          existingReturns={returnsList.filter((r) => r.originalOrderId === returnOrder.id)}
          onClose={() => setReturnOrder(null)}
        />
      )}
    </div>
  )
}
