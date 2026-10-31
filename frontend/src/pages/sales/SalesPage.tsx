import { useRef, useState } from 'react'
import { isAxiosError } from 'axios'
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
import { invoiceNo } from '@/lib/invoiceNumber'
import { apiErrorMessage } from '@/lib/apiError'
import { newClientReference } from '@/lib/offlineSales'
import { CreditNoteModal } from '@/components/pos/CreditNoteModal'

type DateRange = 'today' | 'week' | 'month' | 'year'

// What one unit gives back, VAT included: the server sends it; older servers get the same sum worked out here.
function refundUnitPrice(order: OrderResponse, line: OrderLineResponse) {
  if (line.refundUnitPrice != null) return line.refundUnitPrice
  if (line.quantity <= 0 || order.subtotalAmount <= 0) return 0
  const paidShare = Math.max(order.subtotalAmount - order.discountAmount, 0) / order.subtotalAmount
  return (line.lineTotal / line.quantity) * paidShare * (1 + (order.taxRate ?? 0))
}

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
  onReturned,
}: {
  order: OrderResponse
  existingReturns: ReturnOrderResponse[]
  onClose: () => void
  /** The return went through; the page then shows its credit note. */
  onReturned: (ret: ReturnOrderResponse) => void
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
  const [note, setNote] = useState('')
  // One reference per return: a retry after a dropped connection gives back the same return, never a second refund.
  const [clientReference] = useState(newClientReference)
  const submitting = useRef(false)

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

      return ordersApi.returnOrder(branchId!, order.id, {
        refundMethod,
        lines,
        restockItems,
        note: note.trim() || undefined,
        clientReference,
      })
    },
    onSuccess: ({ data }) => {
      qc.invalidateQueries({ queryKey: ['orders', branchId] })
      qc.invalidateQueries({ queryKey: ['returns', branchId] })
      toast.success(t.sales.returnSuccess)
      onReturned(data)
    },
    onError: (err) => {
      submitting.current = false
      toast.error(returnErrorText(err))
    },
  })

  const returnErrorText = (err: unknown) => {
    if (isAxiosError(err) && err.response?.status === 403) return t.sales.returnErrors.managerOnly
    const data = isAxiosError(err) ? (err.response?.data as { errors?: Record<string, string[]> } | undefined) : undefined
    const codes = Object.keys(data?.errors ?? {})
    if (codes.includes('ReturnOrder.QuantityExceeded')) return t.sales.returnErrors.quantityExceeded
    if (codes.includes('ReturnOrder.OrderNotCompleted')) return t.sales.returnErrors.notCompleted
    if (codes.includes('ReturnOrder.DuplicateLine')) return t.sales.returnErrors.duplicateLine
    return apiErrorMessage(err, t.sales.returnFailed)
  }

  const submit = () => {
    // A second click before the first answer must not send a second refund.
    if (submitting.current) return
    submitting.current = true
    returnMutation.mutate()
  }

  const selectedLines = lineStates.filter((s) => s.selected)
  // Same rules as the server: what each unit actually cost, never more than is still unrefunded on the bill,
  // and the last units back settle the bill exactly.
  const alreadyRefunded = existingReturns.reduce((sum, r) => sum + r.refundAmount, 0)
  const refundable = Math.max(order.totalAmount - alreadyRefunded, 0)
  const returnsEverything =
    selectedLines.length > 0 && lineStates.every((s) => s.maxQuantity === 0 || (s.selected && s.quantity >= s.maxQuantity))
  const linesRefund = selectedLines.reduce((sum, s) => {
    const line = order.lines.find((l) => l.id === s.lineId)
    return sum + (line ? refundUnitPrice(order, line) * s.quantity : 0)
  }, 0)
  const totalRefund = Math.round((returnsEverything ? refundable : Math.min(linesRefund, refundable)) * 100) / 100

  const refundMethodLabel = (m: RefundMethod) => REFUND_METHODS.find((x) => x.value === m)?.label ?? m

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
      title={`${t.sales.returnOrder} — #${invoiceNo(order)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t.common.cancel}</Button>
          <Button
            loading={returnMutation.isPending}
            disabled={selectedLines.length === 0 || returnMutation.isPending}
            onClick={submit}
          >
            {t.sales.processReturn} · {formatCurrency(totalRefund)}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Line Items */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-fg">{t.sales.lineItems}</p>
          {order.lines.map((line: OrderLineResponse) => {
            const state = lineStates.find((s) => s.lineId === line.id)!
            const fullyReturned = state.maxQuantity === 0
            return (
              <div
                key={line.id}
                className={`rounded-xl border p-3 transition-colors ${
                  fullyReturned
                    ? 'border-border bg-surface-2 opacity-60 '
                    : state.selected
                    ? 'border-info/30 bg-info/10'
                    : 'border-border '
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={state.selected}
                    onChange={() => toggleLine(line.id)}
                    disabled={fullyReturned}
                    className="mt-1 h-4 w-4 rounded border-border accent-[rgb(var(--brand-ink))] disabled:cursor-not-allowed"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-fg truncate">
                        {line.productName}
                      </p>
                      {fullyReturned && (
                        <span className="shrink-0 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning dark:bg-warning/15">
                          {t.sales.returned}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted">
                      {line.variantName && <>{line.variantName} · </>}
                      {formatCurrency(refundUnitPrice(order, line))} {t.sales.perUnit} × {line.quantity}
                      {!fullyReturned && state.maxQuantity < line.quantity && (
                        <span className="ms-1 text-warning">({state.maxQuantity})</span>
                      )}
                    </p>

                    {state.selected && (
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-muted">
                            {t.sales.amount}
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={state.maxQuantity}
                            value={state.quantity}
                            onChange={(e) => updateQty(line.id, Number(e.target.value))}
                            className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-muted">
                            {t.sales.returnReason}
                          </label>
                          <select
                            value={state.reason}
                            onChange={(e) => updateReason(line.id, e.target.value as ReturnReason)}
                            className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm"
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
          <p className="mb-2 text-sm font-semibold text-fg">{t.sales.refundMethod}</p>
          <div className="flex flex-wrap gap-2">
            {REFUND_METHODS.map((m) => (
              <button
                key={m.value}
                onClick={() => setRefundMethod(m.value)}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                  refundMethod === m.value
                    ? 'border-brand bg-brand text-brand-fg'
                    : 'border-border bg-surface text-fg hover:bg-surface-2 '
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Inventory disposition */}
        <div>
          <p className="mb-2 text-sm font-semibold text-fg">{t.sales.inventoryDisposition}</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setRestockItems(true)}
              className={`flex items-center gap-2 rounded-xl border p-3 text-sm font-medium transition-colors ${
                restockItems
                  ? 'border-success bg-success/10 text-success dark:border-success dark:bg-success/15 dark:text-success'
                  : 'border-border bg-surface text-muted hover:bg-surface-2 '
              }`}
            >
              <PackageCheck className="h-4 w-4 shrink-0" />
              <div className="text-start">
                <p className="font-medium">{t.sales.keepInStock}</p>
              </div>
            </button>
            <button
              onClick={() => setRestockItems(false)}
              className={`flex items-center gap-2 rounded-xl border p-3 text-sm font-medium transition-colors ${
                !restockItems
                  ? 'border-danger bg-danger/10 text-danger dark:border-danger dark:bg-danger/15 dark:text-danger'
                  : 'border-border bg-surface text-muted hover:bg-surface-2 '
              }`}
            >
              <PackageX className="h-4 w-4 shrink-0" />
              <div className="text-start">
                <p className="font-medium">{t.sales.removeFromStock}</p>
              </div>
            </button>
          </div>
        </div>

        {/* Note */}
        <div>
          <label htmlFor="return-note" className="mb-2 block text-sm font-semibold text-fg">{t.sales.returnNote}</label>
          <textarea
            id="return-note"
            rows={2}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t.sales.returnNotePlaceholder}
            className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-muted"
          />
        </div>

        {/* Earlier returns on this invoice */}
        {existingReturns.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-semibold text-fg">{t.sales.earlierReturns}</p>
            <ul className="divide-y divide-border rounded-xl border border-border">
              {existingReturns.map((r) => (
                <li key={r.id} className="flex items-start justify-between gap-3 px-3 py-2 text-xs">
                  <div className="min-w-0">
                    <p className="text-fg">
                      {formatDateTime(r.createdAt)} · {refundMethodLabel(r.refundMethod)}
                    </p>
                    <p className="text-muted">
                      {t.sales.processedBy} {r.createdByName ?? '—'}
                      {r.note && <> · {r.note}</>}
                    </p>
                  </div>
                  <span className="shrink-0 font-medium tabular-nums text-danger">−{formatCurrency(r.refundAmount)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Summary */}
        {selectedLines.length > 0 && (
          <div className="rounded-xl bg-surface-2 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">
                {t.sales.refundTotal} ({selectedLines.length})
              </span>
              <span className="text-lg font-bold text-fg">
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
  const [creditNote, setCreditNote] = useState<{ ret: ReturnOrderResponse; order: OrderResponse } | null>(null)
  const { branchId, user } = useAuthStore()
  const { t } = useI18n()
  // Refunds are for owners and managers; the server enforces the same rule.
  const canRefund = user?.role === 'Owner' || user?.role === 'Manager'

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
    queryKey: ['returns', branchId, 'sales', range],
    queryFn: () => ordersApi.listReturns(branchId!, { from }),
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

  // Every refund on this period's invoices, newest first, with who gave it.
  const ordersById = new Map(items.map((o) => [o.id, o]))
  const periodReturns = returnsList
    .filter((r) => orderIds.has(r.originalOrderId))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  const refundMethodLabels: Record<RefundMethod, string> = {
    Cash: t.sales.refundMethods.cash,
    Card: t.sales.refundMethods.card,
    StoreCredit: t.sales.refundMethods.storeCredit,
  }

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
          <div className="flex rounded-lg border border-border bg-surface p-1">
            {ranges.map((r) => (
              <button
                key={r.value}
                onClick={() => setRange(r.value)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  range === r.value
                    ? 'bg-brand text-brand-fg'
                    : 'text-muted hover:bg-surface-2 '
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
              <div className="rounded-xl bg-info/10 p-3">
                <DollarSign className="h-5 w-5 text-info" />
              </div>
              <div>
                <p className="text-xs text-muted">{t.sales.netRevenue}</p>
                <p className="text-xl font-bold tabular-nums">{formatCurrency(netRevenue)}</p>
                {totalRefunds > 0 && (
                  <p className="text-xs text-danger tabular-nums">−{formatCurrency(totalRefunds)} {t.sales.returns}</p>
                )}
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="flex items-center gap-4">
              <div className="rounded-xl bg-brand-soft p-3 dark:bg-brand/20">
                <ShoppingCart className="h-5 w-5 text-brand-ink" />
              </div>
              <div>
                <p className="text-xs text-muted">{t.sales.totalOrders}</p>
                <p className="text-xl font-bold tabular-nums">{items.length}</p>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="flex items-center gap-4">
              <div className="rounded-xl bg-success/10 p-3 dark:bg-success/15">
                <TrendingUp className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-xs text-muted">{t.reports.avgOrderValue}</p>
                <p className="text-xl font-bold tabular-nums">{formatCurrency(avgOrder)}</p>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="flex items-center gap-4">
              <div className="rounded-xl bg-danger/10 p-3 dark:bg-danger/15">
                <RotateCcw className="h-5 w-5 text-danger" />
              </div>
              <div>
                <p className="text-xs text-muted">{t.sales.returns}</p>
                <p className="text-xl font-bold tabular-nums text-danger">{formatCurrency(totalRefunds)}</p>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Orders table */}
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-fg">
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
                    <span className="font-display text-sm font-semibold tabular-nums text-fg">
                      <bdi dir="ltr">#{invoiceNo(r)}</bdi>
                    </span>
                    {returnsMap.has(r.id) && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning dark:bg-warning/15">
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
                        <p className="text-xs text-muted tabular-nums line-through">{formatCurrency(r.totalAmount)}</p>
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
                    ? <span className="text-sm font-medium text-danger tabular-nums">−{formatCurrency(refund)}</span>
                    : <span className="text-muted/50">—</span>
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
                  canRefund && r.status === 'Completed' && (returnsMap.get(r.id) ?? 0) < r.totalAmount - 0.005 ? (
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

        {/* Returns log */}
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-fg">{t.sales.returnsLog}</h2>
          </CardHeader>
          <Table
            data={periodReturns}
            keyExtractor={(r) => r.id}
            emptyMessage={t.sales.noReturns}
            columns={[
              {
                key: 'invoice',
                header: t.sales.orderId,
                render: (r) => {
                  const o = ordersById.get(r.originalOrderId)
                  return (
                    <span className="font-display text-sm font-semibold tabular-nums text-fg">
                      <bdi dir="ltr">#{o ? invoiceNo(o) : r.originalOrderId.slice(0, 8).toUpperCase()}</bdi>
                    </span>
                  )
                },
              },
              {
                key: 'amount',
                header: t.sales.amount,
                render: (r) => <span className="font-medium tabular-nums text-danger">−{formatCurrency(r.refundAmount)}</span>,
              },
              {
                key: 'method',
                header: t.sales.refundMethod,
                render: (r) => refundMethodLabels[r.refundMethod] ?? r.refundMethod,
              },
              {
                key: 'by',
                header: t.sales.processedBy,
                render: (r) => r.createdByName ?? <span className="text-muted/50">—</span>,
              },
              {
                key: 'note',
                header: t.sales.returnNote,
                render: (r) => r.note ? <span className="text-xs text-muted">{r.note}</span> : <span className="text-muted/50">—</span>,
              },
              {
                key: 'createdAt',
                header: t.sales.date,
                className: 'whitespace-nowrap',
                render: (r) => formatDateTime(r.createdAt),
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
          onReturned={(ret) => {
            setCreditNote({ ret, order: returnOrder })
            setReturnOrder(null)
          }}
        />
      )}

      {creditNote && <CreditNoteModal ret={creditNote.ret} order={creditNote.order} onClose={() => setCreditNote(null)} />}
    </div>
  )
}
