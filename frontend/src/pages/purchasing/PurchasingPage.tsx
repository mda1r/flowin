import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, FlaskConical, PackageCheck, Send, AlertTriangle, CheckCircle2, RotateCw, PackageSearch } from 'lucide-react'
import { ReorderModal } from './ReorderModal'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Table } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { Modal, ConfirmModal } from '@/components/ui/Modal'
import { Card } from '@/components/ui/Card'
import { purchasingApi } from '@/api/purchasing'
import { stockMaterialApi } from '@/api/stockMaterial'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/i18n'
import { toast } from '@/components/ui/Toast'
import { apiErrorMessage } from '@/lib/apiError'
import { cn, formatCurrency, formatDate } from '@/lib/utils'
import type { PurchaseOrderResponse, PurchaseOrderStatus, SupplierResponse } from '@/types/api'
import type { StockMaterialResponse } from '@/types/stockMaterial'

const statusVariant: Record<PurchaseOrderStatus, 'gray' | 'blue' | 'green' | 'red' | 'yellow'> = {
  Draft: 'gray',
  Sent: 'blue',
  PartiallyReceived: 'yellow',
  Received: 'green',
  Cancelled: 'red',
}

const statusLabel: Record<PurchaseOrderStatus, string> = {
  Draft: 'مسودة',
  Sent: 'مُرسل للمورد',
  PartiallyReceived: 'مستلم جزئياً',
  Received: 'مستلم',
  Cancelled: 'ملغي',
}

const orderSchema = z.object({
  supplierId: z.string().min(1, 'اختر المورد'),
  notes: z.string().optional(),
})

const supplierSchema = z.object({
  name: z.string().min(1, 'الاسم مطلوب'),
  contactEmail: z.string().email('بريد إلكتروني غير صالح').optional().or(z.literal('')),
  contactPhone: z.string().optional(),
  address: z.string().optional(),
})

type OrderFormData = z.infer<typeof orderSchema>
type SupplierFormData = z.infer<typeof supplierSchema>

function asList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[]
  return ((data as { items?: T[] } | undefined)?.items ?? []) as T[]
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
  const { branchId, tenantId } = useAuthStore()
  const qc = useQueryClient()
  const [materialId, setMaterialId] = useState('')
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
    enabled: !!tenantId,
  })
  const materials: StockMaterialResponse[] = matResp?.data ?? []
  const materialById = new Map(materials.map((m) => [m.id, m]))
  const selected = materialById.get(materialId)

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['purchase-order', branchId, orderId] })
    void qc.invalidateQueries({ queryKey: ['purchase-orders', branchId] })
  }

  const addLine = useMutation({
    mutationFn: () =>
      purchasingApi.addLine(branchId!, orderId, {
        stockMaterialId: materialId,
        description: selected ? `${selected.nameAr} (${selected.storageUnit})` : 'مادة',
        quantity: parseFloat(qty),
        unitCost: parseFloat(unitCost),
      }),
    onSuccess: () => {
      refresh()
      setMaterialId('')
      setQty('')
      setUnitCost('')
      setLineError(null)
    },
    onError: (err) => setLineError(apiErrorMessage(err)),
  })

  const removeLine = useMutation({
    mutationFn: (lineId: string) => purchasingApi.removeLine(branchId!, orderId, lineId),
    onSuccess: refresh,
    onError: (err) => toast.error('تعذّر حذف السطر', apiErrorMessage(err)),
  })

  const send = useMutation({
    mutationFn: () => purchasingApi.send(branchId!, orderId),
    onSuccess: () => {
      refresh()
      toast.success('تم إرسال أمر الشراء')
    },
    onError: (err) => toast.error('تعذّر الإرسال', apiErrorMessage(err)),
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
      toast.success('تم استلام أمر الشراء')
    },
    onError: (err) => {
      setConfirmReceive(false)
      toast.error('تعذّر الاستلام', apiErrorMessage(err))
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
        hasProductLines && !receipt.productsApplied ? 'المنتجات' : null,
        hasMaterialLines && !receipt.applied ? 'المواد الخام' : null,
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
    onError: (err) => toast.error('تعذّرت إعادة المحاولة', apiErrorMessage(err)),
  })

  const q = parseFloat(qty)
  const c = parseFloat(unitCost)
  const canAdd = !!materialId && q > 0 && c >= 0 && !isNaN(c)
  const isDraft = order?.status === 'Draft'
  const canReceive = order?.status === 'Sent' || order?.status === 'PartiallyReceived'

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={order ? `أمر شراء #${order.id.slice(-8).toUpperCase()} · ${supplierName}` : 'أمر شراء'}
        size="2xl"
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              إغلاق
            </Button>
            {isDraft && (
              <Button onClick={() => send.mutate()} loading={send.isPending} disabled={!order?.lines.length}>
                <Send className="h-4 w-4" />
                إرسال للمورد
              </Button>
            )}
            {canReceive && (
              <Button onClick={() => setConfirmReceive(true)}>
                <PackageCheck className="h-4 w-4" />
                استلام الطلب
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
              <Badge variant={statusVariant[order.status]}>{statusLabel[order.status]}</Badge>
              <span className="text-muted">أُنشئ {formatDate(order.createdAt)}</span>
              {order.notes && <span className="text-muted">· {order.notes}</span>}
            </div>

            {order.status === 'Received' && !receiptLoading && receipt && (
              pending.length === 0 ? (
                <div className="flex items-center gap-2 rounded-xl bg-success/10 px-4 py-3 text-sm text-success">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  أُضيفت كميات الطلب إلى المخزون
                </div>
              ) : (
                <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span className="flex-1">الطلب مستلم، لكن لم تُضف {pending.join(' و')} إلى المخزون بعد.</span>
                  <Button size="sm" variant="secondary" onClick={() => retryMaterials.mutate()} loading={retryMaterials.isPending}>
                    <RotateCw className="h-4 w-4" />
                    إعادة المحاولة
                  </Button>
                </div>
              )
            )}

            {order.lines.length === 0 ? (
              <p className="rounded-xl bg-surface-2 px-4 py-6 text-center text-sm text-muted">
                لا توجد أصناف بعد. أضف المواد التي تريد شراءها من الأسفل.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface-2/60 text-xs text-muted">
                      <th className="px-4 py-2.5 text-start font-semibold">الصنف</th>
                      <th className="px-4 py-2.5 text-start font-semibold">الكمية</th>
                      <th className="px-4 py-2.5 text-start font-semibold">سعر الوحدة</th>
                      <th className="px-4 py-2.5 text-start font-semibold">الإجمالي</th>
                      {isDraft && (
                        <th className="px-4 py-2.5">
                          <span className="sr-only">حذف</span>
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {order.lines.map((l) => (
                      <tr key={l.id}>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            {l.stockMaterialId && <FlaskConical className="h-4 w-4 shrink-0 text-brand-ink" aria-label="مادة مخزون" />}
                            <span className="text-fg">{l.description}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 tabular-nums text-fg">{l.orderedQuantity.toLocaleString('ar-SA')}</td>
                        <td className="px-4 py-2.5 tabular-nums text-fg">{formatCurrency(l.unitCost)}</td>
                        <td className="px-4 py-2.5 font-semibold tabular-nums text-fg">{formatCurrency(l.lineTotal)}</td>
                        {isDraft && (
                          <td className="px-4 py-2.5 text-end">
                            <button
                              type="button"
                              className="rounded-lg p-1.5 text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                              onClick={() => removeLine.mutate(l.id)}
                              aria-label={`حذف ${l.description}`}
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
                        الإجمالي
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
                <h3 className="text-sm font-semibold text-fg">إضافة مادة مخزون</h3>
                {materials.length === 0 ? (
                  <p className="text-sm text-muted">لا توجد مواد مخزون بعد. أضفها أولاً من صفحة مواد المخزون.</p>
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-medium text-muted">المادة</span>
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
                          <option value="">اختر مادة…</option>
                          {materials.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.nameAr} — {m.code}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-medium text-muted">
                          الكمية {selected ? `(${selected.storageUnit})` : ''}
                        </span>
                        <input type="number" className="input" value={qty} onChange={(e) => setQty(e.target.value)} min="0" step="0.001" />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-medium text-muted">
                          سعر {selected ? `ال${selected.storageUnit}` : 'الوحدة'} (ر.س)
                        </span>
                        <input type="number" className="input" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} min="0" step="0.01" />
                      </label>
                      <Button type="submit" loading={addLine.isPending} disabled={!canAdd}>
                        <Plus className="h-4 w-4" />
                        إضافة
                      </Button>
                    </div>
                    {canAdd && (
                      <p className="text-xs text-muted">
                        إجمالي السطر: <span className="tabular-nums text-fg">{formatCurrency(q * c)}</span>
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
        title="تأكيد الاستلام"
        message="سيتم تسجيل استلام كامل الكميات، وستُضاف مواد المخزون تلقائياً مع تحديث تكلفتها حسب طريقة كل مادة."
        confirmLabel="استلام"
        loading={receive.isPending}
      />
    </>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────

export function PurchasingPage() {
  const [view, setView] = useState<'orders' | 'suppliers'>('orders')
  const [showNewOrder, setShowNewOrder] = useState(false)
  const [showNewSupplier, setShowNewSupplier] = useState(false)
  const [openOrderId, setOpenOrderId] = useState<string | null>(null)
  const [showReorder, setShowReorder] = useState(() => new URLSearchParams(window.location.search).get('reorder') === '1')
  const { branchId, tenantId } = useAuthStore()
  const { t } = useI18n()
  const qc = useQueryClient()

  const { data: orders, isLoading } = useQuery({
    queryKey: ['purchase-orders', branchId],
    queryFn: () => purchasingApi.listPurchaseOrders(branchId!),
    enabled: !!branchId && view === 'orders',
  })

  const { data: suppliersResp } = useQuery({
    queryKey: ['suppliers', tenantId],
    queryFn: () => purchasingApi.listSuppliers(tenantId!),
    enabled: !!tenantId,
  })
  const suppliers = asList<SupplierResponse>(suppliersResp?.data)
  const supplierName = (id: string) => suppliers.find((s) => s.id === id)?.name ?? '—'

  const { register, handleSubmit, reset, formState: { errors } } = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
  })

  const supplierForm = useForm<SupplierFormData>({
    resolver: zodResolver(supplierSchema),
  })

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

  const createSupplier = useMutation({
    mutationFn: (data: SupplierFormData) =>
      purchasingApi.createSupplier(tenantId!, {
        name: data.name,
        contactEmail: data.contactEmail || undefined,
        contactPhone: data.contactPhone || undefined,
        address: data.address || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['suppliers', tenantId] })
      setShowNewSupplier(false)
      supplierForm.reset()
      toast.success(t.purchasing.created)
    },
    onError: (err) => toast.error(t.purchasing.failed, apiErrorMessage(err)),
  })

  const cancelOrder = useMutation({
    mutationFn: (orderId: string) => purchasingApi.cancel(branchId!, orderId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['purchase-orders', branchId] }),
    onError: (err) => toast.error(t.purchasing.failed, apiErrorMessage(err)),
  })

  const viewLabels: Record<'orders' | 'suppliers', string> = {
    orders: 'أوامر الشراء',
    suppliers: 'الموردون',
  }

  const openOrder = openOrderId ? asList<PurchaseOrderResponse>(orders?.data).find((o) => o.id === openOrderId) : undefined

  return (
    <div>
      <PageHeader
        title={t.purchasing.title}
        description={t.purchasing.description}
        action={
          view === 'suppliers' ? (
            <Button onClick={() => setShowNewSupplier(true)}>
              <Plus className="h-4 w-4" />
              {t.purchasing.newSupplier}
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setShowReorder(true)}>
                <PackageSearch className="h-4 w-4" />
                طلب من النواقص
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
          <div className="flex items-center gap-3 border-b border-border p-4">
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
          </div>

          {view === 'orders' ? (
            <Table
              loading={isLoading}
              data={asList<PurchaseOrderResponse>(orders?.data)}
              keyExtractor={(r) => r.id}
              emptyMessage={t.purchasing.noOrders}
              columns={[
                {
                  key: 'id',
                  header: '#',
                  render: (r) => <span className="font-mono text-sm font-medium">{r.id.slice(-8).toUpperCase()}</span>,
                },
                { key: 'supplierName', header: t.purchasing.supplier, render: (r) => supplierName(r.supplierId) },
                {
                  key: 'lines',
                  header: 'الأصناف',
                  render: (r) => <span className="tabular-nums text-muted">{r.lines.length.toLocaleString('ar-SA')}</span>,
                },
                {
                  key: 'totalAmount',
                  header: t.purchasing.total,
                  render: (r) => <span className="font-semibold tabular-nums">{formatCurrency(r.totalAmount)}</span>,
                },
                {
                  key: 'status',
                  header: t.purchasing.status,
                  render: (r) => <Badge variant={statusVariant[r.status]}>{statusLabel[r.status]}</Badge>,
                },
                { key: 'createdAt', header: t.purchasing.date, render: (r) => formatDate(r.createdAt) },
                {
                  key: 'actions',
                  header: '',
                  render: (r) => (
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="secondary" onClick={() => setOpenOrderId(r.id)}>
                        {r.status === 'Draft' ? 'إضافة أصناف' : 'التفاصيل'}
                      </Button>
                      {(r.status === 'Draft' || r.status === 'Sent') && (
                        <Button size="sm" variant="ghost" onClick={() => cancelOrder.mutate(r.id)}>
                          إلغاء الطلب
                        </Button>
                      )}
                    </div>
                  ),
                },
              ]}
            />
          ) : (
            <Table
              data={suppliers}
              keyExtractor={(r) => r.id}
              emptyMessage={t.common.noData}
              columns={[
                {
                  key: 'name',
                  header: t.purchasing.supplier,
                  render: (r) => (
                    <div>
                      <p className="font-medium">{r.name}</p>
                      <p className="text-xs text-muted">{r.contactEmail ?? '—'}</p>
                    </div>
                  ),
                },
                { key: 'contactEmail', header: t.customers.email, render: (r) => r.contactEmail ?? '—' },
                { key: 'contactPhone', header: t.customers.phone, render: (r) => r.contactPhone ?? '—' },
                {
                  key: 'isActive',
                  header: t.products.status,
                  render: (r) => (
                    <Badge variant={r.isActive ? 'green' : 'gray'}>{r.isActive ? t.common.active : t.common.inactive}</Badge>
                  ),
                },
              ]}
            />
          )}
        </Card>
      </div>

      <Modal
        open={showNewSupplier}
        onClose={() => {
          setShowNewSupplier(false)
          supplierForm.reset()
        }}
        title={t.purchasing.newSupplier}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setShowNewSupplier(false)
                supplierForm.reset()
              }}
            >
              {t.common.cancel}
            </Button>
            <Button loading={createSupplier.isPending} onClick={supplierForm.handleSubmit((d) => createSupplier.mutate(d))}>
              {t.common.create}
            </Button>
          </>
        }
      >
        <form className="space-y-4">
          <Input label={t.purchasing.supplierName} error={supplierForm.formState.errors.name?.message} {...supplierForm.register('name')} />
          <Input
            label={t.purchasing.supplierEmail}
            type="email"
            error={supplierForm.formState.errors.contactEmail?.message}
            {...supplierForm.register('contactEmail')}
          />
          <Input label={t.purchasing.supplierPhone} {...supplierForm.register('contactPhone')} />
          <Input label={t.purchasing.supplierAddress} {...supplierForm.register('address')} />
        </form>
      </Modal>

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
              إنشاء ثم إضافة الأصناف
            </Button>
          </>
        }
      >
        {suppliers.length === 0 ? (
          <p className="text-sm text-muted">
            لا يوجد موردون بعد. أضف مورداً من تبويب «الموردون» أولاً.
          </p>
        ) : (
          <form className="space-y-4">
            <Select label={t.purchasing.supplier} error={errors.supplierId?.message} {...register('supplierId')}>
              <option value="">اختر المورد…</option>
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
          onAddSupplier={() => {
            setShowReorder(false)
            setView('suppliers')
            setShowNewSupplier(true)
          }}
        />
      )}

      {openOrderId && (
        <OrderDetailModal
          key={openOrderId}
          orderId={openOrderId}
          supplierName={openOrder ? supplierName(openOrder.supplierId) : ''}
          onClose={() => setOpenOrderId(null)}
        />
      )}
    </div>
  )
}
