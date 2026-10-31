import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Search, ArrowUpDown, Clock, XCircle, TrendingDown, Trash2, History, ArchiveRestore, ShoppingCart, X } from 'lucide-react'
import { isAxiosError } from 'axios'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Table } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { Modal, ConfirmModal } from '@/components/ui/Modal'
import { Card } from '@/components/ui/Card'
import { inventoryApi } from '@/api/inventory'
import { catalogApi } from '@/api/catalog'
import { useAuthStore } from '@/stores/authStore'
import { toast } from '@/components/ui/Toast'
import { logActivity } from '@/lib/activityLog'
import { apiErrorMessage } from '@/lib/apiError'
import { expiryText } from '@/lib/expiry'
import { BUSINESS_TYPE_ROUTES } from '@/lib/businessRoutes'
import { useI18n } from '@/i18n'
import type { StockAlertItemResponse, StockItemResponse } from '@/types/api'
import { StockCardModal } from './StockCardModal'
import { daysUntilExpiry, expiryDay, formatExpiry } from './stockDates'

const adjustSchema = z.object({
  newQuantity: z.coerce.number().nonnegative('Quantity must be 0 or more'),
  expiryDate: z.string().optional(),
  reorderPoint: z.coerce.number().nonnegative().optional(),
  notifyDaysBeforeExpiry: z.coerce.number().int().positive().default(7),
  reference: z.string().optional(),
  notes: z.string().optional(),
})

type AdjustFormData = z.infer<typeof adjustSchema>

// Deep links from the dashboard: /inventory?filter=expired|expiring|lowStock
type AlertFilter = 'expired' | 'expiring' | 'lowStock'
const readAlertFilter = (): AlertFilter | null => {
  const f = new URLSearchParams(window.location.search).get('filter')
  return f === 'expired' || f === 'expiring' || f === 'lowStock' ? f : null
}

function AlertCard({
  icon,
  label,
  count,
  colorClass,
  alerts,
  variantMap,
  defaultExpanded = false,
  action,
}: {
  icon: React.ReactNode
  label: string
  count: number
  colorClass: string
  alerts: StockAlertItemResponse[]
  variantMap: Map<string, { productName: string; variantName: string; sku: string; unitType?: string }>
  defaultExpanded?: boolean
  action?: (alert: StockAlertItemResponse) => React.ReactNode
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const { t, lang } = useI18n()

  if (count === 0) return null

  return (
    <div className={`rounded-xl border p-4 ${colorClass}`}>
      <button
        className="flex w-full items-center justify-between"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-semibold">{label}</span>
          <span className="rounded-full bg-surface/70 px-2 py-0.5 text-xs font-bold tabular-nums">
            {count}
          </span>
        </div>
        <span className="text-xs opacity-70">{expanded ? `${t.inventory.hide} ▲` : `${t.inventory.show} ▼`}</span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          {alerts.map((a) => {
            const info = variantMap.get(a.variantId)
            return (
              <div
                key={a.stockItemId}
                className="flex items-center justify-between gap-3 rounded-lg bg-surface/60 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium">{info?.productName ?? t.inventory.unknownItem}</p>
                  <p className="text-xs opacity-70">
                    {info?.sku} · {t.inventory.quantity.replace('{n}', String(a.quantity))}
                    {a.expiryDate && ` · ${formatExpiry(a.expiryDate, lang)}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {a.daysUntilExpiry !== undefined && a.daysUntilExpiry !== null && (
                    <span className="ms-4 text-xs font-bold">{expiryText(t, a.daysUntilExpiry)}</span>
                  )}
                  {action?.(a)}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function InventoryPage() {
  const [search, setSearch] = useState('')
  const [adjustItem, setAdjustItem] = useState<StockItemResponse | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<StockItemResponse | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<StockItemResponse | null>(null)
  const [historyItem, setHistoryItem] = useState<StockItemResponse | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [alertFilter, setAlertFilter] = useState<AlertFilter | null>(readAlertFilter)
  const { branchId, user, tenantId } = useAuthStore()
  // Adjusting, deleting and archiving stock are limited to owners and managers on the server too.
  const canManage = user?.role === 'Owner' || user?.role === 'Manager'
  const qc = useQueryClient()
  const { t, lang } = useI18n()
  const canPurchase = !!user?.businessType && (BUSINESS_TYPE_ROUTES[user.businessType] ?? []).includes('/purchasing')

  const { data: stockData, isLoading } = useQuery({
    queryKey: ['stock', branchId, { showArchived }],
    queryFn: () => inventoryApi.listItems(branchId!, showArchived ? { includeArchived: true } : undefined),
    enabled: !!branchId,
  })

  const { data: alertsData } = useQuery({
    queryKey: ['inventory-alerts', branchId],
    queryFn: () => inventoryApi.getAlerts(branchId!),
    enabled: !!branchId,
    refetchInterval: 300_000, // every 5 minutes
  })

  const { data: productsData } = useQuery({
    queryKey: ['products'],
    queryFn: () => catalogApi.listProducts(tenantId!),
    enabled: !!tenantId,
  })

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<AdjustFormData>({
    resolver: zodResolver(adjustSchema),
  })

  const adjust = useMutation({
    mutationFn: (formData: AdjustFormData) =>
      inventoryApi.adjustStock(branchId!, adjustItem!.id, {
        newQuantity: formData.newQuantity,
        expiryDate: formData.expiryDate ? formData.expiryDate + 'T00:00:00Z' : null,
        clearExpiry: !formData.expiryDate && !!adjustItem?.expiryDate,
        reorderPoint: formData.reorderPoint !== undefined ? formData.reorderPoint : undefined,
        notifyDaysBeforeExpiry: formData.notifyDaysBeforeExpiry,
        reference: formData.reference,
        notes: formData.notes,
      }),
    onSuccess: (_res, formData) => {
      const info = variantMap.get(adjustItem?.variantId ?? '')
      logActivity(tenantId ?? '', {
        userId: user?.id ?? '',
        userName: `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(),
        userEmail: user?.email,
        category: 'inventory',
        action: 'تعديل المخزون',
        details: `${info?.productName ?? adjustItem?.variantId ?? ''} → كمية جديدة: ${formData.newQuantity}`,
        branchId: branchId ?? undefined,
      })
      refreshStock()
      setAdjustItem(null)
      reset()
      toast.success(t.inventory.adjusted)
    },
    onError: (err) => toast.error(apiErrorMessage(err, t.inventory.failed)),
  })

  const refreshStock = () => {
    qc.invalidateQueries({ queryKey: ['stock', branchId] })
    qc.invalidateQueries({ queryKey: ['inventory-alerts', branchId] })
    qc.invalidateQueries({ queryKey: ['stock-movements', branchId] })
  }

  const deleteItem = useMutation({
    mutationFn: () => inventoryApi.deleteItem(branchId!, deleteTarget!.id),
    onSuccess: () => {
      refreshStock()
      setDeleteTarget(null)
      toast.success(t.inventory.itemDeleted)
    },
    onError: (err) => {
      // Items with stock or history cannot be deleted; offer archiving instead.
      if (isAxiosError(err) && err.response?.status === 409) {
        setArchiveTarget(deleteTarget)
        setDeleteTarget(null)
        return
      }
      toast.error(apiErrorMessage(err, t.inventory.deleteFailed))
    },
  })

  const archiveItem = useMutation({
    mutationFn: () => inventoryApi.archiveItem(branchId!, archiveTarget!.id),
    onSuccess: () => {
      refreshStock()
      setArchiveTarget(null)
      toast.success(t.inventory.itemArchived)
    },
    onError: (err) => toast.error(apiErrorMessage(err, t.inventory.archiveFailed)),
  })

  const restoreItem = useMutation({
    mutationFn: (item: StockItemResponse) => inventoryApi.restoreItem(branchId!, item.id),
    onSuccess: () => {
      refreshStock()
      toast.success(t.inventory.itemRestored)
    },
    onError: (err) => toast.error(apiErrorMessage(err, t.inventory.failed)),
  })

  // Build a map from variantId → product info
  const variantMap = new Map<string, { productName: string; variantName: string; sku: string; unitType?: string }>()
  productsData?.data?.forEach((p) => {
    p.variants.forEach((v) => {
      variantMap.set(v.id, { productName: p.name, variantName: v.name, sku: v.sku, unitType: p.unitType })
    })
  })

  const items = stockData?.data ?? []
  const alerts = alertsData?.data

  const filterAlerts = !alertFilter || !alerts
    ? null
    : alertFilter === 'expired'
    ? alerts.expired
    : alertFilter === 'expiring'
    ? alerts.expiringSoon
    : alerts.lowStock
  const filterIds = filterAlerts ? new Set(filterAlerts.map((a) => a.stockItemId)) : null
  const filterLabel = alertFilter === 'expired'
    ? t.inventory.expiredLabel
    : alertFilter === 'expiring'
    ? t.inventory.expiringSoonLabel
    : t.inventory.lowStock

  const filtered = items.filter((i) => {
    if (filterIds && !filterIds.has(i.id)) return false
    if (!search) return true
    const info = variantMap.get(i.variantId)
    return info?.productName.toLowerCase().includes(search.toLowerCase()) ||
           info?.sku.toLowerCase().includes(search.toLowerCase())
  })

  // Expired stock is written off by adjusting it to zero with a waste reference, so it leaves the alerts.
  const openWriteOff = async (stockItemId: string) => {
    // The alerts can arrive before the stock list, so fall back to loading the single item.
    let item = items.find((i) => i.id === stockItemId)
    if (!item) {
      try {
        item = (await inventoryApi.getItem(branchId!, stockItemId)).data
      } catch (err) {
        toast.error(apiErrorMessage(err, t.inventory.failed))
        return
      }
    }
    openAdjust(item)
    reset({
      newQuantity: 0,
      expiryDate: item.expiryDate ? item.expiryDate.slice(0, 10) : '',
      reorderPoint: item.reorderPoint ?? 0,
      notifyDaysBeforeExpiry: item.notifyDaysBeforeExpiry ?? 7,
      reference: t.inventory.writeOffReference,
    })
  }

  const openAdjust = (item: StockItemResponse) => {
    setAdjustItem(item)
    const expiryStr = item.expiryDate ? expiryDay(item.expiryDate) : ''
    reset({
      newQuantity: item.quantity,
      expiryDate: expiryStr,
      reorderPoint: item.reorderPoint ?? 0,
      notifyDaysBeforeExpiry: item.notifyDaysBeforeExpiry ?? 7,
    })
  }

  const totalAlerts = alerts?.totalAlerts ?? 0

  return (
    <div>
      <PageHeader
        title={t.inventory.title}
        description={t.inventory.description}
        action={
          totalAlerts > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-danger/10 px-3 py-2 dark:bg-danger/15">
              <AlertTriangle className="h-4 w-4 text-danger" />
              <span className="text-sm font-medium text-danger">
                {totalAlerts} {t.inventory.alerts}
              </span>
            </div>
          )
        }
      />
      <div className="p-6 space-y-4">
        {/* Alerts Section */}
        {alerts && totalAlerts > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-fg">{t.inventory.alerts}</h2>

            <AlertCard
              icon={<XCircle className="h-4 w-4 text-danger" />}
              label={t.inventory.expiredLabel}
              count={alerts.expired.length}
              colorClass="border-danger/30 bg-danger/10 text-danger dark:border-danger/60 dark:bg-danger/15"
              alerts={alerts.expired}
              variantMap={variantMap}
              defaultExpanded={alertFilter === 'expired'}
              action={(a) => (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void openWriteOff(a.stockItemId)}
                  className="text-danger hover:bg-danger/10 hover:text-danger"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t.inventory.writeOff}
                </Button>
              )}
            />

            <AlertCard
              icon={<Clock className="h-4 w-4 text-warning" />}
              label={t.inventory.expiringSoonLabel}
              count={alerts.expiringSoon.length}
              colorClass="border-warning/30 bg-warning/10 text-warning dark:border-warning/60 dark:bg-warning/15"
              alerts={alerts.expiringSoon}
              variantMap={variantMap}
              defaultExpanded={alertFilter === 'expiring'}
            />

            <AlertCard
              icon={<TrendingDown className="h-4 w-4 text-warning" />}
              label={t.inventory.lowStockAlert}
              count={alerts.lowStock.length}
              colorClass="border-warning/30 bg-warning/10 text-warning dark:border-warning/60 dark:bg-warning/15"
              alerts={alerts.lowStock}
              variantMap={variantMap}
              defaultExpanded={alertFilter === 'lowStock'}
            />
            {canPurchase && alerts.lowStock.length > 0 && (
              <a
                href="/purchasing?reorder=1"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-brand-ink hover:bg-surface-2"
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                {t.dashboard.reorderShortages}
              </a>
            )}
          </div>
        )}

        {/* Stock Table */}
        <Card>
          <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute start-3 top-2.5 h-4 w-4 text-muted" />
              <input
                type="text"
                placeholder={t.inventory.searchProducts}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input ps-9"
              />
            </div>
            {alertFilter && (
              <button
                type="button"
                onClick={() => setAlertFilter(null)}
                className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-fg hover:bg-border"
                title={t.inventory.showAll}
              >
                {t.inventory.showingOnly.replace('{label}', filterLabel)}
                <X className="h-3.5 w-3.5 text-muted" />
              </button>
            )}
            {canManage ? (
              <label className="flex items-center gap-2 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(e) => setShowArchived(e.target.checked)}
                />
                {t.inventory.showArchived}
              </label>
            ) : (
              <p className="text-xs text-muted">{t.inventory.managersOnly}</p>
            )}
          </div>
          <Table
            loading={isLoading}
            data={filtered}
            keyExtractor={(r) => r.id}
            emptyMessage={t.common.noData}
            columns={[
              {
                key: 'product',
                header: t.inventory.product,
                render: (r) => {
                  const info = variantMap.get(r.variantId)
                  const unitLabel = info?.unitType && info.unitType !== 'Piece'
                    ? (t.inventory.units as Record<string, string>)[info.unitType] ?? info.unitType
                    : null
                  return (
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-fg">
                          {info?.productName ?? '—'}
                        </p>
                        {unitLabel && (
                          <span className="shrink-0 rounded-md bg-info/10 px-1.5 py-0.5 text-xs font-medium text-info">
                            {unitLabel}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted">
                        {info?.variantName} · {info?.sku}
                      </p>
                    </div>
                  )
                },
              },
              {
                key: 'quantity',
                header: t.inventory.quantityHeader,
                render: (r) => (
                  <span className="tabular-nums font-medium">{r.quantity}</span>
                ),
              },
              {
                key: 'reorderPoint',
                header: t.inventory.reorderPointHeader,
                render: (r) => (
                  <span className="tabular-nums text-muted">{r.reorderPoint}</span>
                ),
              },
              {
                key: 'expiryDate',
                header: t.inventory.expiryDate,
                render: (r) => {
                  if (!r.expiryDate) return <span className="text-muted">—</span>
                  const daysLeft = daysUntilExpiry(r.expiryDate)
                  const colorClass = daysLeft < 0
                    ? 'text-danger'
                    : daysLeft <= 7
                    ? 'text-warning'
                    : 'text-fg'
                  return (
                    <span className={`text-sm tabular-nums ${colorClass}`}>
                      {formatExpiry(r.expiryDate, lang)}
                      {daysLeft <= 7 ? ` (${expiryText(t, daysLeft)})` : ''}
                    </span>
                  )
                },
              },
              {
                key: 'status',
                header: t.inventory.status,
                render: (r) => r.isArchived ? (
                  <Badge variant="gray">{t.inventory.archived}</Badge>
                ) : (
                  <Badge variant={r.isLowStock ? 'yellow' : 'green'}>
                    {r.isLowStock ? t.inventory.lowStock : t.inventory.ok}
                  </Badge>
                ),
              },
              {
                key: 'actions',
                header: '',
                render: (r) => (
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); setHistoryItem(r) }}
                    >
                      <History className="h-3.5 w-3.5" />
                      {t.inventory.history}
                    </Button>
                    {canManage && (r.isArchived ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={restoreItem.isPending && restoreItem.variables?.id === r.id}
                        onClick={(e) => { e.stopPropagation(); restoreItem.mutate(r) }}
                      >
                        <ArchiveRestore className="h-3.5 w-3.5" />
                        {t.inventory.restore}
                      </Button>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => { e.stopPropagation(); openAdjust(r) }}
                        >
                          <ArrowUpDown className="h-3.5 w-3.5" />
                          {t.inventory.adjust}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={t.common.delete}
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(r) }}
                          className="text-danger hover:bg-danger/10 hover:text-danger"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ))}
                  </div>
                ),
              },
            ]}
          />
        </Card>
      </div>

      <Modal
        open={!!adjustItem}
        onClose={() => { setAdjustItem(null); reset() }}
        title={`${t.inventory.adjustStock} — ${variantMap.get(adjustItem?.variantId ?? '')?.productName ?? ''}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAdjustItem(null)}>{t.common.cancel}</Button>
            <Button loading={adjust.isPending} onClick={handleSubmit((d) => adjust.mutate(d))}>
              {t.inventory.apply}
            </Button>
          </>
        }
      >
        <form className="space-y-4">
          <p className="text-sm text-muted">
            {t.inventory.current}: <strong className="text-fg">{adjustItem?.quantity}</strong>
          </p>
          <Input
            label={t.inventory.newQuantity}
            type="number"
            min="0"
            error={errors.newQuantity?.message}
            {...register('newQuantity')}
          />
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Input
                label={t.inventory.expiryDate}
                type="date"
                {...register('expiryDate')}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setValue('expiryDate', '')}
            >
              {t.inventory.clearDate}
            </Button>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-fg">
              {t.inventory.notifyBefore}
            </label>
            <select
              {...register('notifyDaysBeforeExpiry')}
              className="input w-full"
            >
              {[
                { value: 2, label: t.inventory.days2 },
                { value: 3, label: t.inventory.days3 },
                { value: 7, label: t.inventory.days7 },
                { value: 14, label: t.inventory.days14 },
                { value: 30, label: t.inventory.days30 },
                { value: 60, label: t.inventory.days60 },
                { value: 90, label: t.inventory.days90 },
              ].map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <Input
            label={t.inventory.reorderPointHint}
            type="number"
            min="0"
            placeholder="0"
            {...register('reorderPoint')}
          />
          <Input
            label={t.inventory.reference}
            {...register('reference')}
          />
          <Input
            label={t.inventory.notes}
            {...register('notes')}
          />
        </form>
      </Modal>

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteItem.mutate()}
        loading={deleteItem.isPending}
        title={t.inventory.deleteItem}
        message={`${t.inventory.deleteItemConfirm}${deleteTarget ? ` — ${variantMap.get(deleteTarget.variantId)?.productName ?? ''}` : ''}`}
        confirmLabel={t.common.delete}
        confirmVariant="danger"
      />

      <ConfirmModal
        open={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        onConfirm={() => archiveItem.mutate()}
        loading={archiveItem.isPending}
        title={`${t.inventory.archiveItem}${archiveTarget ? ` — ${variantMap.get(archiveTarget.variantId)?.productName ?? ''}` : ''}`}
        message={t.inventory.archiveConfirm}
        confirmLabel={t.inventory.archive}
      />

      <StockCardModal
        item={historyItem}
        productName={variantMap.get(historyItem?.variantId ?? '')?.productName ?? ''}
        onClose={() => setHistoryItem(null)}
      />
    </div>
  )
}
