import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, FlaskConical, Package, PackageCheck, Send, AlertTriangle, CheckCircle2, RotateCw, PackageSearch, Pencil, Search, X } from 'lucide-react'
import { ReorderModal } from './ReorderModal'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Table } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { Modal, ConfirmModal } from '@/components/ui/Modal'
import { Card } from '@/components/ui/Card'
import { purchasingApi } from '@/api/purchasing'
import { stockMaterialApi } from '@/api/stockMaterial'
import { catalogApi } from '@/api/catalog'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/i18n'
import type { Translations } from '@/i18n/en'
import { toast } from '@/components/ui/Toast'
import { apiErrorMessage } from '@/lib/apiError'
import { BUSINESS_TYPE_ROUTES } from '@/lib/businessRoutes'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import type { ProductResponse, PurchaseOrderResponse, PurchaseOrderStatus, SupplierResponse } from '@/types/api'
import type { StockMaterialResponse } from '@/types/stockMaterial'

const PAGE_SIZE = 20

const statusVariant: Record<PurchaseOrderStatus, 'gray' | 'blue' | 'green' | 'red' | 'yellow'> = {
  Draft: 'gray',
  Sent: 'blue',
  PartiallyReceived: 'yellow',
  Received: 'green',
  Cancelled: 'red',
}

const statusLabel = (t: Translations, s: PurchaseOrderStatus): string =>
  ({
    Draft: t.purchasing.draft,
    Sent: t.purchasing.sent,
    PartiallyReceived: t.purchasing.partiallyReceived,
    Received: t.purchasing.received,
    Cancelled: t.purchasing.cancelled,
  })[s]

const STATUS_FILTERS: (PurchaseOrderStatus | 'all')[] = ['all', 'Draft', 'Sent', 'PartiallyReceived', 'Received', 'Cancelled']

const orderSchema = (t: Translations) =>
  z.object({
    supplierId: z.string().min(1, t.purchasing.supplierRequired),
    notes: z.string().optional(),
  })

const supplierSchema = (t: Translations) =>
  z.object({
    name: z.string().trim().min(1, t.purchasing.nameRequired),
    contactEmail: z.string().email(t.purchasing.invalidEmail).optional().or(z.literal('')),
    contactPhone: z.string().optional(),
    address: z.string().optional(),
  })

type OrderFormData = z.infer<ReturnType<typeof orderSchema>>
type SupplierFormData = z.infer<ReturnType<typeof supplierSchema>>

function asList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[]
  return ((data as { items?: T[] } | undefined)?.items ?? []) as T[]
}

function useNumberFormat() {
  const { lang } = useI18n()
  return (n: number) => n.toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-US')
}

function useCanManage() {
  const role = useAuthStore((s) => s.user?.role)
  return role === 'Owner' || role === 'Manager'
}

// ─── Product picker ─────────────────────────────────────────────────────────

interface PickedVariant {
  id: string
  name: string
  costPrice: number
}

function ProductVariantPicker({
  value,
  onChange,
}: {
  value: PickedVariant | null
  onChange: (v: PickedVariant | null) => void
}) {
  const { t } = useI18n()
  const { tenantId } = useAuthStore()
  const [term, setTerm] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    const id = window.setTimeout(() => setSearch(term.trim()), 300)
    return () => window.clearTimeout(id)
  }, [term])

  const { data, isFetching } = useQuery({
    queryKey: ['products', tenantId, 'po-search', search],
    queryFn: () => catalogApi.listProducts(tenantId!, { search, pageSize: 20 }),
    enabled: !!tenantId && search.length >= 2 && !value,
  })

  const options: PickedVariant[] = asList<ProductResponse>(data?.data)
    .flatMap((p) =>
      p.variants
        .filter((v) => v.isActive)
        .map((v) => ({ id: v.id, name: p.variants.length > 1 ? `${p.name} - ${v.name}` : p.name, costPrice: v.costPrice })),
    )
    .slice(0, 8)

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm">
        <Package className="h-4 w-4 shrink-0 text-brand-strong" />
        <span className="min-w-0 flex-1 truncate text-fg">{value.name}</span>
        <button
          type="button"
          className="rounded-md px-2 py-0.5 text-xs text-muted transition-colors hover:bg-surface hover:text-fg"
          onClick={() => {
            onChange(null)
            setTerm('')
          }}
        >
          {t.purchasing.changeProduct}
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      <input
        className="input ps-9"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder={t.purchasing.productSearch}
        aria-label={t.purchasing.productSearch}
        autoComplete="off"
      />
      {search.length >= 2 && term.trim().length >= 2 && (
        <ul className="absolute inset-x-0 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded-lg border border-border bg-surface py-1 shadow-lg">
          {isFetching && options.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted">…</li>
          ) : options.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted">{t.purchasing.noProductsFound}</li>
          ) : (
            options.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-start text-sm text-fg transition-colors hover:bg-surface-2"
                  onClick={() => onChange(o)}
                >
                  <span className="min-w-0 truncate">{o.name}</span>
                  {o.costPrice > 0 && <span className="shrink-0 tabular-nums text-xs text-muted">{formatCurrency(o.costPrice)}</span>}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}

// ─── Order details ──────────────────────────────────────────────────────────

function OrderDetailModal({
  orderId,
  supplierName,
  onClose,
}: {
  orderId: string
  supplierName: string
  onClose: () => void
}) {
  const { branchId, tenantId, user } = useAuthStore()
  const { t } = useI18n()
  const fmtNum = useNumberFormat()
  const canManage = useCanManage()
  const qc = useQueryClient()

  // Offer only the kinds of items this business keeps stock of (same rule as ReorderModal).
  const routes = user?.businessType ? BUSINESS_TYPE_ROUTES[user.businessType] ?? [] : []
  const knownType = routes.length > 0
  const usesMaterials = !knownType || routes.includes('/stock-materials')
  const usesProducts = !knownType || routes.includes('/inventory')
  const [kind, setKind] = useState<'material' | 'product'>(
    usesProducts && (!usesMaterials || user?.businessType === 'Supermarket') ? 'product' : 'material',
  )

  const [materialId, setMaterialId] = useState('')
  const [variant, setVariant] = useState<PickedVariant | null>(null)
  const [qty, setQty] = useState('')
  const [unitCost, setUnitCost] = useState('')
  const [lineError, setLineError] = useState<string | null>(null)
  const [confirmReceive, setConfirmReceive] = useState(false)

  const { data: orderResp, isLoading } = useQuery({
    queryKey: ['purchase-order', branchId, orderId],
    queryFn: () => purchasingApi.getPurchaseOrder(branchId!, orderId),
    enabled: !!branchId,
  })
  const order: PurchaseOrderResponse | undefined = orderResp?.data

  const { data: matResp } = useQuery({
    queryKey: ['stock-materials', tenantId, null, false, ''],
    queryFn: () => stockMaterialApi.listMaterials(tenantId!, { lowStockOnly: false }),
    enabled: !!tenantId && usesMaterials,
  })
  const materials: StockMaterialResponse[] = matResp?.data ?? []
  const materialById = new Map(materials.map((m) => [m.id, m]))
  const selected = kind === 'material' ? materialById.get(materialId) : undefined

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['purchase-order', branchId, orderId] })
    void qc.invalidateQueries({ queryKey: ['purchase-orders', branchId] })
  }

  const resetLine = () => {
    setMaterialId('')
    setVariant(null)
    setQty('')
    setUnitCost('')
    setLineError(null)
  }

  const addLine = useMutation({
    mutationFn: () =>
      purchasingApi.addLine(branchId!, orderId, {
        ...(kind === 'material'
          ? {
              stockMaterialId: materialId,
              description: selected ? `${selected.nameAr} (${selected.storageUnit})` : t.purchasing.kindMaterial,
            }
          : { variantId: variant!.id, description: variant!.name }),
        quantity: parseFloat(qty),
        unitCost: parseFloat(unitCost),
      }),
    onSuccess: () => {
      refresh()
      resetLine()
    },
    onError: (err) => setLineError(apiErrorMessage(err)),
  })

  const removeLine = useMutation({
    mutationFn: (lineId: string) => purchasingApi.removeLine(branchId!, orderId, lineId),
    onSuccess: refresh,
    onError: (err) => toast.error(t.purchasing.removeLineFailed, apiErrorMessage(err)),
  })

  const send = useMutation({
    mutationFn: () => purchasingApi.send(branchId!, orderId),
    onSuccess: () => {
      refresh()
      toast.success(t.purchasing.orderSent)
    },
    onError: (err) => toast.error(t.purchasing.sendFailed, apiErrorMessage(err)),
  })

  const receive = useMutation({
    mutationFn: () => purchasingApi.receive(branchId!, orderId),
    onSuccess: () => {
      refresh()
      void qc.invalidateQueries({ queryKey: ['stock-materials', tenantId] })
      void qc.invalidateQueries({ queryKey: ['stock-material-movements', tenantId] })
      setConfirmReceive(false)
      void qc.invalidateQueries({ queryKey: ['po-materials-receipt', tenantId, orderId] })
      void qc.invalidateQueries({ queryKey: ['stock', branchId] })
      void qc.invalidateQueries({ queryKey: ['products'] })
      toast.success(t.purchasing.orderReceived)
    },
    onError: (err) => {
      setConfirmReceive(false)
      toast.error(t.purchasing.receiveFailed, apiErrorMessage(err))
    },
  })

  const hasMaterialLines = !!order?.lines.some((l) => l.stockMaterialId)
  const hasProductLines = !!order?.lines.some((l) => !l.stockMaterialId)
  const { data: receiptResp, isLoading: receiptLoading } = useQuery({
    queryKey: ['po-materials-receipt', tenantId, orderId],
    queryFn: () => stockMaterialApi.purchaseReceiptStatus(tenantId!, orderId),
    enabled: !!tenantId && order?.status === 'Received',
  })
  const receipt = receiptResp?.data
  const pending = receipt
    ? [
        hasProductLines && !receipt.productsApplied ? t.purchasing.pendingProducts : null,
        hasMaterialLines && !receipt.applied ? t.purchasing.pendingMaterials : null,
      ].filter(Boolean)
    : []

  const retryMaterials = useMutation({
    mutationFn: () => purchasingApi.retryReceipt(branchId!, orderId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['po-materials-receipt', tenantId, orderId] })
      void qc.invalidateQueries({ queryKey: ['stock-materials', tenantId] })
      void qc.invalidateQueries({ queryKey: ['stock', branchId] })
      void qc.invalidateQueries({ queryKey: ['products'] })
      void qc.invalidateQueries({ queryKey: ['stock-material-movements', tenantId] })
    },
    onError: (err) => toast.error(t.purchasing.retryFailed, apiErrorMessage(err)),
  })

  const q = parseFloat(qty)
  const c = parseFloat(unitCost)
  const hasItem = kind === 'material' ? !!materialId : !!variant
  const canAdd = hasItem && q > 0 && c >= 0 && !isNaN(c)
  const isDraft = order?.status === 'Draft'
  const canReceive = canManage && (order?.status === 'Sent' || order?.status === 'PartiallyReceived')
  const title = order ? `${t.purchasing.orderTitle} #${order.id.slice(-8).toUpperCase()} · ${order.supplierName ?? supplierName}` : t.purchasing.orderTitle

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={title}
        size="2xl"
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              {t.common.close}
            </Button>
            {isDraft && (
              <Button onClick={() => send.mutate()} loading={send.isPending} disabled={!order?.lines.length}>
                <Send className="h-4 w-4" />
                {t.purchasing.sendToSupplier}
              </Button>
            )}
            {canReceive && (
              <Button onClick={() => setConfirmReceive(true)}>
                <PackageCheck className="h-4 w-4" />
                {t.purchasing.receiveOrder}
              </Button>
            )}
          </>
        }
      >
        {isLoading || !order ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton h-10" />
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Badge variant={statusVariant[order.status]}>{statusLabel(t, order.status)}</Badge>
              <span className="text-muted">{t.purchasing.createdOn.replace('{date}', formatDate(order.createdAt))}</span>
              {order.notes && <span className="text-muted">· {order.notes}</span>}
            </div>

            {order.status === 'Received' && !receiptLoading && receipt && (
              pending.length === 0 ? (
                <div className="flex items-center gap-2 rounded-xl bg-success/10 px-4 py-3 text-sm text-success">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  {t.purchasing.receiptApplied}
                </div>
              ) : (
                <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{t.purchasing.receiptPending.replace('{items}', pending.join(t.purchasing.and))}</span>
                  {canManage && (
                    <Button size="sm" variant="secondary" onClick={() => retryMaterials.mutate()} loading={retryMaterials.isPending}>
                      <RotateCw className="h-4 w-4" />
                      {t.purchasing.retry}
                    </Button>
                  )}
                </div>
              )
            )}

            {order.lines.length === 0 ? (
              <p className="rounded-xl bg-surface-2 px-4 py-6 text-center text-sm text-muted">{t.purchasing.noLines}</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface-2/60 text-xs text-muted">
                      <th className="px-4 py-2.5 text-start font-semibold">{t.purchasing.item}</th>
                      <th className="px-4 py-2.5 text-start font-semibold">{t.purchasing.quantity}</th>
                      <th className="px-4 py-2.5 text-start font-semibold">{t.purchasing.unitPrice}</th>
                      <th className="px-4 py-2.5 text-start font-semibold">{t.purchasing.total}</th>
                      {isDraft && (
                        <th className="px-4 py-2.5">
                          <span className="sr-only">{t.common.delete}</span>
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {order.lines.map((l) => (
                      <tr key={l.id}>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            {l.stockMaterialId ? (
                              <FlaskConical className="h-4 w-4 shrink-0 text-brand-ink" aria-label={t.purchasing.stockMaterial} />
                            ) : (
                              <Package className="h-4 w-4 shrink-0 text-muted" aria-label={t.purchasing.kindProduct} />
                            )}
                            <span className="text-fg">{l.description}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 tabular-nums text-fg">{fmtNum(l.orderedQuantity)}</td>
                        <td className="px-4 py-2.5 tabular-nums text-fg">{formatCurrency(l.unitCost)}</td>
                        <td className="px-4 py-2.5 font-semibold tabular-nums text-fg">{formatCurrency(l.lineTotal)}</td>
                        {isDraft && (
                          <td className="px-4 py-2.5 text-end">
                            <button
                              type="button"
                              className="rounded-lg p-1.5 text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                              onClick={() => removeLine.mutate(l.id)}
                              aria-label={t.purchasing.removeItem.replace('{name}', l.description)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border bg-surface-2/40">
                      <td colSpan={3} className="px-4 py-2.5 text-end text-sm font-semibold text-muted">
                        {t.purchasing.total}
                      </td>
                      <td className="px-4 py-2.5 font-bold tabular-nums text-fg">{formatCurrency(order.totalAmount)}</td>
                      {isDraft && <td />}
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {isDraft && (
              <form
                className="space-y-3 rounded-xl border border-dashed border-border p-4"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (canAdd && !addLine.isPending) addLine.mutate()
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-fg">{t.purchasing.addItem}</h3>
                  {usesMaterials && usesProducts && (
                    <div className="flex rounded-lg border border-border bg-surface p-0.5" role="tablist">
                      {(['product', 'material'] as const).map((k) => (
                        <button
                          key={k}
                          type="button"
                          role="tab"
                          aria-selected={kind === k}
                          onClick={() => {
                            setKind(k)
                            resetLine()
                          }}
                          className={cn(
                            'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                            kind === k ? 'bg-brand text-brand-fg' : 'text-muted hover:bg-surface-2',
                          )}
                        >
                          {k === 'product' ? <Package className="h-3.5 w-3.5" /> : <FlaskConical className="h-3.5 w-3.5" />}
                          {k === 'product' ? t.purchasing.kindProduct : t.purchasing.kindMaterial}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {kind === 'material' && materials.length === 0 ? (
                  <p className="text-sm text-muted">{t.purchasing.noMaterials}</p>
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
                      {kind === 'material' ? (
                        <label className="block">
                          <span className="mb-1.5 block text-xs font-medium text-muted">{t.purchasing.material}</span>
                          <select
                            className="input"
                            value={materialId}
                            onChange={(e) => {
                              const id = e.target.value
                              setMaterialId(id)
                              setLineError(null)
                              const m = materialById.get(id)
                              if (m && !unitCost && m.currentCost > 0) setUnitCost(String(m.currentCost))
                            }}
                          >
                            <option value="">{t.purchasing.chooseMaterial}</option>
                            {materials.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.nameAr} — {m.code}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : (
                        <div className="block">
                          <span className="mb-1.5 block text-xs font-medium text-muted">{t.purchasing.product}</span>
                          <ProductVariantPicker
                            value={variant}
                            onChange={(v) => {
                              setVariant(v)
                              setLineError(null)
                              if (v && v.costPrice > 0) setUnitCost(String(v.costPrice))
                            }}
                          />
                        </div>
                      )}
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-medium text-muted">
                          {t.purchasing.quantity} {selected ? `(${selected.storageUnit})` : ''}
                        </span>
                        <input type="number" className="input" value={qty} onChange={(e) => setQty(e.target.value)} min="0" step="0.001" />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-medium text-muted">
                          {selected ? t.purchasing.unitCostOf.replace('{unit}', selected.storageUnit) : t.purchasing.unitCostSar}
                        </span>
                        <input type="number" className="input" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} min="0" step="0.01" />
                      </label>
                      <Button type="submit" loading={addLine.isPending} disabled={!canAdd}>
                        <Plus className="h-4 w-4" />
                        {t.common.add}
                      </Button>
                    </div>
                    {canAdd && (
                      <p className="text-xs text-muted">
                        {t.purchasing.lineTotal} <span className="tabular-nums text-fg">{formatCurrency(q * c)}</span>
                      </p>
                    )}
                  </>
                )}
                {lineError && (
                  <p role="alert" className="flex items-center gap-1.5 text-xs text-danger">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {lineError}
                  </p>
                )}
              </form>
            )}
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={confirmReceive}
        onClose={() => setConfirmReceive(false)}
        onConfirm={() => receive.mutate()}
        title={t.purchasing.confirmReceiveTitle}
        message={t.purchasing.confirmReceiveMessage}
        confirmLabel={t.purchasing.receive}
        loading={receive.isPending}
      />
    </>
  )
}

// ─── Cancel order ───────────────────────────────────────────────────────────

function CancelOrderModal({ order, onClose }: { order: PurchaseOrderResponse; onClose: () => void }) {
  const { branchId } = useAuthStore()
  const { t } = useI18n()
  const qc = useQueryClient()
  const [reason, setReason] = useState('')

  const cancel = useMutation({
    mutationFn: () => purchasingApi.cancel(branchId!, order.id, reason.trim()),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['purchase-orders', branchId] })
      void qc.invalidateQueries({ queryKey: ['purchase-order', branchId, order.id] })
      toast.success(t.purchasing.orderCancelled)
      onClose()
    },
    onError: (err) => toast.error(t.purchasing.cancelFailed, apiErrorMessage(err)),
  })

  return (
    <Modal
      open
      onClose={onClose}
      title={`${t.purchasing.cancelOrderTitle} #${order.id.slice(-8).toUpperCase()}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={cancel.isPending}>
            {t.purchasing.keepOrder}
          </Button>
          <Button variant="danger" onClick={() => cancel.mutate()} loading={cancel.isPending}>
            {t.purchasing.cancelOrder}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-muted">{t.purchasing.cancelOrderMessage}</p>
        <Textarea
          id="po-cancel-reason"
          label={t.purchasing.cancelReason}
          value={reason}
          maxLength={512}
          rows={2}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
    </Modal>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────

export function PurchasingPage() {
  const [view, setView] = useState<'orders' | 'suppliers'>('orders')
  const [showNewOrder, setShowNewOrder] = useState(false)
  const [supplierModal, setSupplierModal] = useState<SupplierResponse | 'new' | null>(null)
  const [deactivating, setDeactivating] = useState<SupplierResponse | null>(null)
  const [cancelling, setCancelling] = useState<PurchaseOrderResponse | null>(null)
  const [openOrderId, setOpenOrderId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<PurchaseOrderStatus | 'all'>('all')
  const [supplierFilter, setSupplierFilter] = useState('')
  const [page, setPage] = useState(1)
  const [showReorder, setShowReorder] = useState(() => new URLSearchParams(window.location.search).get('reorder') === '1')
  const { branchId, tenantId } = useAuthStore()
  const { t } = useI18n()
  const fmtNum = useNumberFormat()
  const canManage = useCanManage()
  const qc = useQueryClient()

  const { data: orders, isLoading } = useQuery({
    queryKey: ['purchase-orders', branchId, statusFilter, supplierFilter, page],
    queryFn: () =>
      purchasingApi.listPurchaseOrders(branchId!, {
        status: statusFilter === 'all' ? undefined : statusFilter,
        supplierId: supplierFilter || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    enabled: !!branchId && view === 'orders',
    placeholderData: (prev) => prev,
  })
  const orderRows = asList<PurchaseOrderResponse>(orders?.data)
  const hasNextPage = orderRows.length === PAGE_SIZE

  // Inactive suppliers are included so the suppliers tab can show them and past orders keep their names.
  const { data: suppliersResp, isLoading: suppliersLoading } = useQuery({
    queryKey: ['suppliers', tenantId, 'all'],
    queryFn: () => purchasingApi.listSuppliers(tenantId!, { includeInactive: true, pageSize: 200 }),
    enabled: !!tenantId,
  })
  const allSuppliers = asList<SupplierResponse>(suppliersResp?.data)
  const suppliers = allSuppliers.filter((s) => s.isActive)
  const supplierName = (o: PurchaseOrderResponse) =>
    o.supplierName ?? allSuppliers.find((s) => s.id === o.supplierId)?.name ?? '—'

  const { register, handleSubmit, reset, formState: { errors } } = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema(t)),
  })

  const supplierForm = useForm<SupplierFormData>({
    resolver: zodResolver(supplierSchema(t)),
  })

  const openSupplierModal = (s: SupplierResponse | 'new') => {
    supplierForm.reset(
      s === 'new'
        ? { name: '', contactEmail: '', contactPhone: '', address: '' }
        : { name: s.name, contactEmail: s.contactEmail ?? '', contactPhone: s.contactPhone ?? '', address: s.address ?? '' },
    )
    setSupplierModal(s)
  }
  const closeSupplierModal = () => {
    setSupplierModal(null)
    supplierForm.reset()
  }

  const createOrder = useMutation({
    mutationFn: (data: OrderFormData) =>
      purchasingApi.createPurchaseOrder(branchId!, { supplierId: data.supplierId, notes: data.notes || undefined }),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ['purchase-orders', branchId] })
      setShowNewOrder(false)
      reset()
      setOpenOrderId(res.data.id)
    },
    onError: (err) => toast.error(t.purchasing.failed, apiErrorMessage(err)),
  })

  const saveSupplier = useMutation({
    mutationFn: (data: SupplierFormData) => {
      const body = {
        name: data.name.trim(),
        contactEmail: data.contactEmail || undefined,
        contactPhone: data.contactPhone || undefined,
        address: data.address || undefined,
      }
      return supplierModal && supplierModal !== 'new'
        ? purchasingApi.updateSupplier(tenantId!, supplierModal.id, body)
        : purchasingApi.createSupplier(tenantId!, body)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['suppliers', tenantId] })
      void qc.invalidateQueries({ queryKey: ['purchase-orders', branchId] })
      toast.success(supplierModal === 'new' ? t.purchasing.supplierCreated : t.purchasing.supplierUpdated)
      closeSupplierModal()
    },
    onError: (err) => toast.error(t.purchasing.supplierFailed, apiErrorMessage(err)),
  })

  const deactivateSupplier = useMutation({
    mutationFn: (s: SupplierResponse) => purchasingApi.deactivateSupplier(tenantId!, s.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['suppliers', tenantId] })
      toast.success(t.purchasing.supplierDeactivated)
      setDeactivating(null)
    },
    onError: (err) => toast.error(t.purchasing.supplierFailed, apiErrorMessage(err)),
  })

  const reactivateSupplier = useMutation({
    mutationFn: (s: SupplierResponse) => purchasingApi.reactivateSupplier(tenantId!, s.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['suppliers', tenantId] })
      toast.success(t.purchasing.supplierReactivated)
    },
    onError: (err) => toast.error(t.purchasing.supplierFailed, apiErrorMessage(err)),
  })

  const viewLabels: Record<'orders' | 'suppliers', string> = {
    orders: t.purchasing.tabOrders,
    suppliers: t.purchasing.tabSuppliers,
  }

  const openOrder = openOrderId ? orderRows.find((o) => o.id === openOrderId) : undefined

  return (
    <div>
      <PageHeader
        title={t.purchasing.title}
        description={t.purchasing.description}
        action={
          view === 'suppliers' ? (
            canManage ? (
              <Button onClick={() => openSupplierModal('new')}>
                <Plus className="h-4 w-4" />
                {t.purchasing.newSupplier}
              </Button>
            ) : undefined
          ) : (
            <>
              <Button variant="secondary" onClick={() => setShowReorder(true)}>
                <PackageSearch className="h-4 w-4" />
                {t.purchasing.fromShortages}
              </Button>
              <Button onClick={() => setShowNewOrder(true)}>
                <Plus className="h-4 w-4" />
                {t.purchasing.newOrder}
              </Button>
            </>
          )
        }
      />
      <div className="p-4 sm:p-6">
        <Card>
          <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
            <div className="flex rounded-lg border border-border bg-surface p-1" role="tablist">
              {(['orders', 'suppliers'] as const).map((v) => (
                <button
                  key={v}
                  role="tab"
                  aria-selected={view === v}
                  onClick={() => setView(v)}
                  className={cn(
                    'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                    view === v ? 'bg-brand text-brand-fg' : 'text-muted hover:bg-surface-2',
                  )}
                >
                  {viewLabels[v]}
                </button>
              ))}
            </div>

            {view === 'orders' && (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {STATUS_FILTERS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={statusFilter === s}
                      onClick={() => {
                        setStatusFilter(s)
                        setPage(1)
                      }}
                      className={cn(
                        'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                        statusFilter === s
                          ? 'border-brand bg-brand-soft text-brand-ink'
                          : 'border-border text-muted hover:bg-surface-2',
                      )}
                    >
                      {s === 'all' ? t.purchasing.all : statusLabel(t, s)}
                    </button>
                  ))}
                </div>
                {allSuppliers.length > 0 && (
                  <select
                    className="input ms-auto w-full text-sm sm:w-56"
                    value={supplierFilter}
                    aria-label={t.purchasing.filterBySupplier}
                    onChange={(e) => {
                      setSupplierFilter(e.target.value)
                      setPage(1)
                    }}
                  >
                    <option value="">{t.purchasing.allSuppliers}</option>
                    {allSuppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.isActive ? s.name : `${s.name} (${t.common.inactive})`}
                      </option>
                    ))}
                  </select>
                )}
              </>
            )}
          </div>

          {view === 'orders' ? (
            <>
              <Table
                loading={isLoading}
                data={orderRows}
                keyExtractor={(r) => r.id}
                emptyMessage={t.purchasing.noOrders}
                columns={[
                  {
                    key: 'id',
                    header: '#',
                    render: (r) => <span className="font-mono text-sm font-medium">{r.id.slice(-8).toUpperCase()}</span>,
                  },
                  { key: 'supplierName', header: t.purchasing.supplier, render: (r) => supplierName(r) },
                  {
                    key: 'lines',
                    header: t.purchasing.items,
                    render: (r) => <span className="tabular-nums text-muted">{fmtNum(r.lines.length)}</span>,
                  },
                  {
                    key: 'totalAmount',
                    header: t.purchasing.total,
                    render: (r) => <span className="font-semibold tabular-nums">{formatCurrency(r.totalAmount)}</span>,
                  },
                  {
                    key: 'status',
                    header: t.purchasing.status,
                    render: (r) => <Badge variant={statusVariant[r.status]}>{statusLabel(t, r.status)}</Badge>,
                  },
                  { key: 'createdAt', header: t.purchasing.date, render: (r) => formatDate(r.createdAt) },
                  {
                    key: 'actions',
                    header: '',
                    render: (r) => (
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="secondary" onClick={() => setOpenOrderId(r.id)}>
                          {r.status === 'Draft' ? t.purchasing.addItems : t.purchasing.details}
                        </Button>
                        {canManage && (r.status === 'Draft' || r.status === 'Sent' || r.status === 'PartiallyReceived') && (
                          <Button size="sm" variant="ghost" onClick={() => setCancelling(r)}>
                            {t.purchasing.cancelOrder}
                          </Button>
                        )}
                      </div>
                    ),
                  },
                ]}
              />
              {(page > 1 || hasNextPage) && (
                <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
                  <Button size="sm" variant="secondary" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                    {t.purchasing.prevPage}
                  </Button>
                  <span className="text-xs tabular-nums text-muted">{t.purchasing.pageN.replace('{n}', fmtNum(page))}</span>
                  <Button size="sm" variant="secondary" disabled={!hasNextPage} onClick={() => setPage((p) => p + 1)}>
                    {t.purchasing.nextPage}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <Table
              data={allSuppliers}
              keyExtractor={(r) => r.id}
              loading={suppliersLoading}
              emptyMessage={t.purchasing.noSuppliers}
              columns={[
                {
                  key: 'name',
                  header: t.purchasing.supplier,
                  render: (r) => (
                    <div className={cn(!r.isActive && 'opacity-60')}>
                      <p className="font-medium">{r.name}</p>
                      {r.address && <p className="text-xs text-muted">{r.address}</p>}
                    </div>
                  ),
                },
                { key: 'contactEmail', header: t.customers.email, render: (r) => r.contactEmail ?? '—' },
                { key: 'contactPhone', header: t.customers.phone, render: (r) => <span dir="ltr">{r.contactPhone ?? '—'}</span> },
                {
                  key: 'isActive',
                  header: t.products.status,
                  render: (r) => (
                    <Badge variant={r.isActive ? 'green' : 'gray'}>{r.isActive ? t.common.active : t.common.inactive}</Badge>
                  ),
                },
                ...(canManage
                  ? [
                      {
                        key: 'actions',
                        header: '',
                        render: (r: SupplierResponse) => (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="secondary" onClick={() => openSupplierModal(r)}>
                              <Pencil className="h-3.5 w-3.5" />
                              {t.common.edit}
                            </Button>
                            {r.isActive ? (
                              <Button size="sm" variant="ghost" onClick={() => setDeactivating(r)}>
                                <X className="h-3.5 w-3.5" />
                                {t.purchasing.deactivate}
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                loading={reactivateSupplier.isPending && reactivateSupplier.variables?.id === r.id}
                                onClick={() => reactivateSupplier.mutate(r)}
                              >
                                <RotateCw className="h-3.5 w-3.5" />
                                {t.purchasing.reactivate}
                              </Button>
                            )}
                          </div>
                        ),
                      },
                    ]
                  : []),
              ]}
            />
          )}
        </Card>
      </div>

      <Modal
        open={supplierModal !== null}
        onClose={closeSupplierModal}
        title={supplierModal && supplierModal !== 'new' ? t.purchasing.editSupplier : t.purchasing.newSupplier}
        footer={
          <>
            <Button variant="secondary" onClick={closeSupplierModal}>
              {t.common.cancel}
            </Button>
            <Button loading={saveSupplier.isPending} onClick={supplierForm.handleSubmit((d) => saveSupplier.mutate(d))}>
              {supplierModal && supplierModal !== 'new' ? t.common.save : t.common.create}
            </Button>
          </>
        }
      >
        <form
          className="space-y-4"
          onSubmit={supplierForm.handleSubmit((d) => saveSupplier.mutate(d))}
        >
          <Input label={t.purchasing.supplierName} error={supplierForm.formState.errors.name?.message} {...supplierForm.register('name')} />
          <Input
            label={t.purchasing.supplierEmail}
            type="email"
            dir="ltr"
            error={supplierForm.formState.errors.contactEmail?.message}
            {...supplierForm.register('contactEmail')}
          />
          <Input label={t.purchasing.supplierPhone} type="tel" dir="ltr" {...supplierForm.register('contactPhone')} />
          <Input label={t.purchasing.supplierAddress} {...supplierForm.register('address')} />
          <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
        </form>
      </Modal>

      <ConfirmModal
        open={deactivating !== null}
        onClose={() => setDeactivating(null)}
        onConfirm={() => deactivating && deactivateSupplier.mutate(deactivating)}
        title={t.purchasing.deactivateTitle}
        message={t.purchasing.deactivateMessage.replace('{name}', deactivating?.name ?? '')}
        confirmLabel={t.purchasing.deactivate}
        confirmVariant="danger"
        loading={deactivateSupplier.isPending}
      />

      {cancelling && <CancelOrderModal order={cancelling} onClose={() => setCancelling(null)} />}

      <Modal
        open={showNewOrder}
        onClose={() => setShowNewOrder(false)}
        title={t.purchasing.newOrder}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowNewOrder(false)}>
              {t.common.cancel}
            </Button>
            <Button loading={createOrder.isPending} onClick={handleSubmit((d) => createOrder.mutate(d))} disabled={suppliers.length === 0}>
              {t.purchasing.createAndAddItems}
            </Button>
          </>
        }
      >
        {suppliers.length === 0 ? (
          <p className="text-sm text-muted">{t.purchasing.noSuppliersYet}</p>
        ) : (
          <form className="space-y-4">
            <Select label={t.purchasing.supplier} error={errors.supplierId?.message} {...register('supplierId')}>
              <option value="">{t.purchasing.chooseSupplier}</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Input label={t.inventory.notes} {...register('notes')} />
          </form>
        )}
      </Modal>

      {showReorder && (
        <ReorderModal
          suppliers={suppliers}
          onClose={() => setShowReorder(false)}
          onCreated={(orderId) => {
            setShowReorder(false)
            setView('orders')
            setOpenOrderId(orderId)
          }}
          onAddSupplier={
            canManage
              ? () => {
                  setShowReorder(false)
                  setView('suppliers')
                  openSupplierModal('new')
                }
              : undefined
          }
        />
      )}

      {openOrderId && (
        <OrderDetailModal
          key={openOrderId}
          orderId={openOrderId}
          supplierName={openOrder ? supplierName(openOrder) : ''}
          onClose={() => setOpenOrderId(null)}
        />
      )}
    </div>
  )
}
