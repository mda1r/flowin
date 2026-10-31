import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, FlaskConical, Package, PackageSearch } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/components/ui/Toast'
import { purchasingApi } from '@/api/purchasing'
import { stockMaterialApi } from '@/api/stockMaterial'
import { inventoryApi } from '@/api/inventory'
import { catalogApi } from '@/api/catalog'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/i18n'
import { apiErrorMessage } from '@/lib/apiError'
import { BUSINESS_TYPE_ROUTES } from '@/lib/businessRoutes'
import { materialReorderQty, productReorderQty } from '@/lib/reorder'
import { cn, formatCurrency } from '@/lib/utils'
import type { ProductResponse, StockItemResponse, SupplierResponse } from '@/types/api'
import type { StockMaterialResponse } from '@/types/stockMaterial'

interface DraftLine {
  key: string
  kind: 'material' | 'product'
  id: string
  name: string
  stockLabel: string
  quantity: string
  unitCost: string
  selected: boolean
}

function asList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[]
  return ((data as { items?: T[] } | undefined)?.items ?? []) as T[]
}

interface ReorderModalProps {
  suppliers: SupplierResponse[]
  onClose: () => void
  onCreated: (orderId: string) => void
  // Omitted for roles that cannot create suppliers.
  onAddSupplier?: () => void
}

export function ReorderModal({ suppliers, onClose, onCreated, onAddSupplier }: ReorderModalProps) {
  const { tenantId, branchId, user } = useAuthStore()
  const qc = useQueryClient()
  const { t, lang } = useI18n()
  const fmtNum = (n: number) => n.toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-US')
  const routes = user?.businessType ? BUSINESS_TYPE_ROUTES[user.businessType] ?? [] : []
  const usesMaterials = routes.includes('/stock-materials')
  const usesProductStock = routes.includes('/inventory')

  const [supplierId, setSupplierId] = useState(suppliers.length === 1 ? suppliers[0].id : '')
  const [lines, setLines] = useState<DraftLine[] | null>(null)

  const materialsQuery = useQuery({
    queryKey: ['stock-materials', tenantId, 'reorder'],
    queryFn: () => stockMaterialApi.listMaterials(tenantId!, { lowStockOnly: true }),
    enabled: !!tenantId && usesMaterials,
  })
  const stockQuery = useQuery({
    queryKey: ['stock', branchId, 'reorder'],
    queryFn: () => inventoryApi.listItems(branchId!, { lowStock: true, pageSize: 500 }),
    enabled: !!branchId && usesProductStock,
  })
  const productsQuery = useQuery({
    queryKey: ['products', tenantId, 'reorder'],
    queryFn: () => catalogApi.listProducts(tenantId!, { pageSize: 500 }),
    enabled: !!tenantId && usesProductStock,
  })

  const loading =
    (usesMaterials && materialsQuery.isLoading) ||
    (usesProductStock && (stockQuery.isLoading || productsQuery.isLoading))

  const variantInfo = useMemo(() => {
    const map = new Map<string, { name: string; cost: number }>()
    for (const p of asList<ProductResponse>(productsQuery.data?.data)) {
      for (const v of p.variants) {
        map.set(v.id, { name: p.variants.length > 1 ? `${p.name} - ${v.name}` : p.name, cost: v.costPrice })
      }
    }
    return map
  }, [productsQuery.data])

  useEffect(() => {
    if (lines !== null || loading) return
    const materialLines: DraftLine[] = asList<StockMaterialResponse>(materialsQuery.data?.data).map((m) => ({
      key: `m-${m.id}`,
      kind: 'material',
      id: m.id,
      name: m.nameAr,
      stockLabel: `${fmtNum(m.currentQuantityInStorageUnits)} ${m.storageUnit} · ${t.purchasing.reorderLevel.replace('{n}', fmtNum(m.reorderLevel ?? 0))}`,
      quantity: String(materialReorderQty(m)),
      unitCost: m.currentCost > 0 ? String(m.currentCost) : '',
      selected: true,
    }))
    const productLines: DraftLine[] = asList<StockItemResponse>(stockQuery.data?.data)
      .filter((s) => s.isLowStock)
      .map((s) => {
        const info = variantInfo.get(s.variantId)
        return {
          key: `p-${s.variantId}`,
          kind: 'product' as const,
          id: s.variantId,
          name: info?.name ?? t.purchasing.kindProduct,
          stockLabel: `${fmtNum(s.quantity)} · ${t.purchasing.reorderLevel.replace('{n}', fmtNum(s.reorderPoint))}`,
          quantity: String(productReorderQty(s)),
          unitCost: info && info.cost > 0 ? String(info.cost) : '',
          selected: true,
        }
      })
    setLines([...materialLines, ...productLines])
  }, [lines, loading, materialsQuery.data, stockQuery.data, variantInfo])

  const draft = lines ?? []
  const chosen = draft.filter((l) => l.selected)
  const lineValid = (l: DraftLine) => parseFloat(l.quantity) > 0 && parseFloat(l.unitCost) >= 0 && l.unitCost !== ''
  const canCreate = !!supplierId && chosen.length > 0 && chosen.every(lineValid)
  const total = chosen.reduce((s, l) => s + (parseFloat(l.quantity) || 0) * (parseFloat(l.unitCost) || 0), 0)

  const update = (key: string, patch: Partial<DraftLine>) =>
    setLines((ls) => (ls ?? []).map((l) => (l.key === key ? { ...l, ...patch } : l)))

  const create = useMutation({
    mutationFn: async () => {
      const { data: order } = await purchasingApi.createPurchaseOrder(branchId!, {
        supplierId,
        notes: t.purchasing.reorderNote,
      })
      let added = 0
      try {
        for (const l of chosen) {
          await purchasingApi.addLine(branchId!, order.id, {
            ...(l.kind === 'material' ? { stockMaterialId: l.id } : { variantId: l.id }),
            description: l.name,
            quantity: parseFloat(l.quantity),
            unitCost: parseFloat(l.unitCost),
          })
          added++
        }
      } catch (err) {
        throw Object.assign(new Error(apiErrorMessage(err)), { orderId: order.id, added })
      }
      return order.id
    },
    onSuccess: (orderId) => {
      void qc.invalidateQueries({ queryKey: ['purchase-orders', branchId] })
      toast.success(t.purchasing.created, t.purchasing.reorderCreatedHint.replace('{n}', fmtNum(chosen.length)))
      onCreated(orderId)
    },
    onError: (err: Error & { orderId?: string; added?: number }) => {
      if (err.orderId) {
        void qc.invalidateQueries({ queryKey: ['purchase-orders', branchId] })
        toast.error(
          t.purchasing.reorderPartial,
          t.purchasing.reorderPartialDetail
            .replace('{added}', fmtNum(err.added ?? 0))
            .replace('{total}', fmtNum(chosen.length))
            .replace('{error}', err.message),
        )
        onCreated(err.orderId)
      } else {
        toast.error(t.purchasing.createFailed, err.message)
      }
    },
  })

  const section = (kind: DraftLine['kind'], title: string, icon: React.ReactNode) => {
    const rows = draft.filter((l) => l.kind === kind)
    if (rows.length === 0) return null
    return (
      <section className="space-y-2">
        <h3 className="flex items-center gap-2 text-13 font-semibold text-muted">
          {icon}
          {title}
          <span className="tabular-nums">({fmtNum(rows.length)})</span>
        </h3>
        <ul className="space-y-2">
          {rows.map((l) => (
            <li
              key={l.key}
              className={cn(
                'flex flex-wrap items-center gap-3 rounded-xl border p-3 sm:flex-nowrap',
                l.selected ? 'border-border bg-surface' : 'border-dashed border-border bg-surface-2/50 opacity-70',
              )}
            >
              <input
                type="checkbox"
                className="h-4 w-4 shrink-0 accent-[rgb(var(--brand-ink))]"
                checked={l.selected}
                onChange={(e) => update(l.key, { selected: e.target.checked })}
                aria-label={t.purchasing.includeItem.replace('{name}', l.name)}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-fg">{l.name}</p>
                <p className="text-xs text-warning tabular-nums">{l.stockLabel}</p>
              </div>
              <label className="w-24 shrink-0">
                <span className="sr-only">{t.purchasing.quantity}</span>
                <input
                  type="number"
                  className="input text-sm"
                  min="0"
                  step="1"
                  value={l.quantity}
                  disabled={!l.selected}
                  onChange={(e) => update(l.key, { quantity: e.target.value })}
                  placeholder={t.purchasing.quantity}
                />
              </label>
              <label className="w-28 shrink-0">
                <span className="sr-only">{t.purchasing.unitPrice}</span>
                <input
                  type="number"
                  className="input text-sm"
                  min="0"
                  step="0.01"
                  value={l.unitCost}
                  disabled={!l.selected}
                  onChange={(e) => update(l.key, { unitCost: e.target.value })}
                  placeholder={t.purchasing.unitPrice}
                />
              </label>
            </li>
          ))}
        </ul>
      </section>
    )
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t.purchasing.reorderTitle}
      size="2xl"
      footer={
        draft.length > 0 && suppliers.length > 0 ? (
          <>
            <span className="me-auto self-center text-sm tabular-nums text-muted">
              {t.purchasing.estimatedTotal} <span className="font-semibold text-fg">{formatCurrency(total)}</span>
            </span>
            <Button variant="secondary" onClick={onClose} disabled={create.isPending}>
              {t.common.cancel}
            </Button>
            <Button onClick={() => create.mutate()} loading={create.isPending} disabled={!canCreate}>
              {t.purchasing.createOrderN.replace('{n}', fmtNum(chosen.length))}
            </Button>
          </>
        ) : undefined
      }
    >
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-12" />
          ))}
        </div>
      ) : suppliers.length === 0 ? (
        <EmptyState
          icon={<PackageSearch />}
          title={t.purchasing.addSupplierFirst}
          description={t.purchasing.addSupplierFirstHint}
          action={onAddSupplier ? <Button onClick={onAddSupplier}>{t.purchasing.addSupplier}</Button> : undefined}
        />
      ) : draft.length === 0 ? (
        <EmptyState
          icon={<PackageSearch />}
          title={t.purchasing.noShortages}
          description={t.purchasing.noShortagesHint}
        />
      ) : (
        <div className="space-y-5">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-fg">
              {t.purchasing.supplier} <span className="text-danger">*</span>
            </span>
            <select className="input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">{t.purchasing.chooseSupplier}</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          <p className="text-xs text-muted">{t.purchasing.reorderHint}</p>

          {section('material', t.purchasing.rawMaterials, <FlaskConical className="h-4 w-4" />)}
          {section('product', t.purchasing.products, <Package className="h-4 w-4" />)}

          {chosen.some((l) => l.unitCost === '') && (
            <p className="flex items-center gap-2 text-xs text-warning">
              <AlertTriangle className="h-3.5 w-3.5" />
              {t.purchasing.missingCost}
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}
