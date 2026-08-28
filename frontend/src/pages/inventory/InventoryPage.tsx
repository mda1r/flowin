import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Search, ArrowUpDown, Clock, XCircle, TrendingDown, Trash2 } from 'lucide-react'
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
import { useI18n } from '@/i18n'
import type { StockAlertItemResponse, StockItemResponse } from '@/types/api'

const adjustSchema = z.object({
  newQuantity: z.coerce.number().nonnegative('Quantity must be 0 or more'),
  expiryDate: z.string().optional(),
  reorderPoint: z.coerce.number().nonnegative().optional(),
  notifyDaysBeforeExpiry: z.coerce.number().int().positive().default(7),
  reference: z.string().optional(),
  notes: z.string().optional(),
})

type AdjustFormData = z.infer<typeof adjustSchema>

function AlertCard({
  icon,
  label,
  count,
  colorClass,
  alerts,
  variantMap,
}: {
  icon: React.ReactNode
  label: string
  count: number
  colorClass: string
  alerts: StockAlertItemResponse[]
  variantMap: Map<string, { productName: string; variantName: string; sku: string }>
}) {
  const [expanded, setExpanded] = useState(false)
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
          <span className="rounded-full bg-white/60 px-2 py-0.5 text-xs font-bold dark:bg-black/30">
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
                className="flex items-center justify-between rounded-lg bg-white/50 px-3 py-2 text-sm dark:bg-black/20"
              >
                <div>
                  <p className="font-medium">{info?.productName ?? a.variantId}</p>
                  <p className="text-xs opacity-70">
                    {info?.sku} · {t.inventory.quantity.replace('{n}', String(a.quantity))}
                    {a.expiryDate && ` · ${new Date(a.expiryDate).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US')}`}
                  </p>
                </div>
                {a.daysUntilExpiry !== undefined && a.daysUntilExpiry !== null && (
                  <span className="ml-4 shrink-0 text-xs font-bold">
                    {a.daysUntilExpiry < 0
                      ? 'منتهية'
                      : a.daysUntilExpiry === 0
                      ? 'اليوم'
                      : t.inventory.expiresIn.replace('{days}', String(a.daysUntilExpiry))}
                  </span>
                )}
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
  const { branchId, user, tenantId } = useAuthStore()
  const qc = useQueryClient()
  const { t, lang } = useI18n()

  const { data: stockData, isLoading } = useQuery({
    queryKey: ['stock', branchId],
    queryFn: () => inventoryApi.listItems(branchId!),
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

  const { register, handleSubmit, reset, formState: { errors } } = useForm<AdjustFormData>({
    resolver: zodResolver(adjustSchema),
  })

  const adjust = useMutation({
    mutationFn: (formData: AdjustFormData) =>
      inventoryApi.adjustStock(branchId!, adjustItem!.id, {
        newQuantity: formData.newQuantity,
        expiryDate: formData.expiryDate ? formData.expiryDate + 'T00:00:00Z' : null,
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
      qc.invalidateQueries({ queryKey: ['stock', branchId] })
      qc.invalidateQueries({ queryKey: ['inventory-alerts', branchId] })
      setAdjustItem(null)
      reset()
      toast.success(t.inventory.adjusted)
    },
    onError: () => toast.error(t.inventory.failed),
  })

  const deleteItem = useMutation({
    mutationFn: () => inventoryApi.deleteItem(branchId!, deleteTarget!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock', branchId] })
      qc.invalidateQueries({ queryKey: ['inventory-alerts', branchId] })
      setDeleteTarget(null)
      toast.success(t.inventory.itemDeleted)
    },
    onError: () => toast.error(t.inventory.deleteFailed),
  })

  // Build a map from variantId → product info
  const variantMap = new Map<string, { productName: string; variantName: string; sku: string }>()
  productsData?.data?.forEach((p) => {
    p.variants.forEach((v) => {
      variantMap.set(v.id, { productName: p.name, variantName: v.name, sku: v.sku })
    })
  })

  const items = stockData?.data ?? []
  const alerts = alertsData?.data

  const filtered = search
    ? items.filter((i) => {
        const info = variantMap.get(i.variantId)
        return info?.productName.toLowerCase().includes(search.toLowerCase()) ||
               info?.sku.toLowerCase().includes(search.toLowerCase())
      })
    : items

  const openAdjust = (item: StockItemResponse) => {
    setAdjustItem(item)
    const expiryStr = item.expiryDate
      ? (() => {
          const d = new Date(item.expiryDate!)
          const y = d.getUTCFullYear()
          const m = String(d.getUTCMonth() + 1).padStart(2, '0')
          const day = String(d.getUTCDate()).padStart(2, '0')
          return `${y}-${m}-${day}`
        })()
      : ''
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
            <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 dark:bg-red-900/30">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium text-red-700 dark:text-red-400">
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
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t.inventory.alerts}</h2>

            <AlertCard
              icon={<XCircle className="h-4 w-4 text-red-600" />}
              label={t.inventory.expiredLabel}
              count={alerts.expired.length}
              colorClass="border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
              alerts={alerts.expired}
              variantMap={variantMap}
            />

            <AlertCard
              icon={<Clock className="h-4 w-4 text-orange-600" />}
              label={t.inventory.expiringSoonLabel}
              count={alerts.expiringSoon.length}
              colorClass="border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-900/20 dark:text-orange-300"
              alerts={alerts.expiringSoon}
              variantMap={variantMap}
            />

            <AlertCard
              icon={<TrendingDown className="h-4 w-4 text-yellow-600" />}
              label={t.inventory.lowStockAlert}
              count={alerts.lowStock.length}
              colorClass="border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300"
              alerts={alerts.lowStock}
              variantMap={variantMap}
            />
          </div>
        )}

        {/* Stock Table */}
        <Card>
          <div className="flex items-center gap-3 border-b border-gray-200 p-4 dark:border-gray-800">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder={t.inventory.searchProducts}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input pl-9"
              />
            </div>
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
                  return (
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {info?.productName ?? '—'}
                      </p>
                      <p className="text-xs text-gray-400">
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
                  <span className="tabular-nums text-gray-500">{r.reorderPoint}</span>
                ),
              },
              {
                key: 'expiryDate',
                header: t.inventory.expiryDate,
                render: (r) => {
                  if (!r.expiryDate) return <span className="text-gray-400">—</span>
                  const d = new Date(r.expiryDate)
                  const now = new Date()
                  const daysLeft = Math.floor((d.getTime() - now.getTime()) / 86_400_000)
                  const colorClass = daysLeft < 0
                    ? 'text-red-600'
                    : daysLeft <= 7
                    ? 'text-orange-600'
                    : 'text-gray-700 dark:text-gray-300'
                  return (
                    <span className={`text-sm tabular-nums ${colorClass}`}>
                      {d.toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US')}
                      {daysLeft < 0
                        ? ` (${t.inventory.expiredLabel})`
                        : daysLeft <= 7
                        ? ` (${t.inventory.expiresIn.replace('{days}', String(daysLeft))})`
                        : ''}
                    </span>
                  )
                },
              },
              {
                key: 'status',
                header: t.inventory.status,
                render: (r) => (
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
                      onClick={(e) => { e.stopPropagation(); openAdjust(r) }}
                    >
                      <ArrowUpDown className="h-3.5 w-3.5" />
                      {t.inventory.adjust}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(r) }}
                      className="text-red-500 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
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
          <p className="text-sm text-gray-500">
            {t.inventory.current}: <strong className="text-gray-900 dark:text-gray-100">{adjustItem?.quantity}</strong>
          </p>
          <Input
            label={t.inventory.newQuantity}
            type="number"
            min="0"
            error={errors.newQuantity?.message}
            {...register('newQuantity')}
          />
          <Input
            label={t.inventory.expiryDate}
            type="date"
            {...register('expiryDate')}
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
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
    </div>
  )
}
