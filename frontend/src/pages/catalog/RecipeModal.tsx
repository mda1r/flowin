import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { AlertTriangle, Copy, FlaskConical, Plus, Trash2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/components/ui/Toast'
import { recipesApi } from '@/api/recipes'
import { stockMaterialApi } from '@/api/stockMaterial'
import { useAuthStore } from '@/stores/authStore'
import { useCanManageMaterials } from '@/hooks/useCanManageMaterials'
import { apiErrorMessage } from '@/lib/apiError'
import { marginPercent, marginTone, netOfVat } from '@/lib/pricing'
import { cn, formatCurrency } from '@/lib/utils'
import { useI18n } from '@/i18n'
import type { StockMaterialResponse } from '@/types/stockMaterial'

// Another size of the same product that already has a recipe, offered as a starting point.
export interface RecipeCopySource {
  id: string
  name: string
}

interface RecipeModalProps {
  variant: { id: string; name: string; salePrice: number; currency: string }
  copySources?: RecipeCopySource[]
  onClose: () => void
}

// A medium is usually a small ×1.25 or a large ×0.75 and so on; the owner fine-tunes before saving.
const COPY_MULTIPLIERS = [0.75, 1, 1.25, 1.5]

interface DraftLine {
  key: number
  materialId: string
  quantity: string
}

let nextKey = 1

export function RecipeModal({ variant, copySources = [], onClose }: RecipeModalProps) {
  const { tenantId } = useAuthStore()
  const { t } = useI18n()
  // Cashiers can look up a recipe and its cost; saving is Owner/Manager only on the server too.
  const canEdit = useCanManageMaterials()
  const qc = useQueryClient()
  const [lines, setLines] = useState<DraftLine[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copyFrom, setCopyFrom] = useState(copySources[0]?.id ?? '')
  const [copyMultiplier, setCopyMultiplier] = useState(1)
  const [copying, setCopying] = useState(false)

  const recipeQuery = useQuery({
    queryKey: ['recipe', tenantId, variant.id],
    queryFn: () => recipesApi.get(tenantId!, variant.id),
    enabled: !!tenantId,
  })
  const materialsQuery = useQuery({
    queryKey: ['stock-materials', tenantId, 'all-for-recipes'],
    queryFn: () => stockMaterialApi.listMaterials(tenantId!),
    enabled: !!tenantId,
  })
  const materials: StockMaterialResponse[] = materialsQuery.data?.data ?? []
  const byId = useMemo(() => new Map(materials.map((m) => [m.id, m])), [materials])
  // The materials list is active-only; a saved line whose material was archived keeps its name from the recipe.
  const savedLines = useMemo(
    () => new Map((recipeQuery.data?.data.lines ?? []).map((l) => [l.materialId, l])),
    [recipeQuery.data],
  )

  useEffect(() => {
    if (lines === null && recipeQuery.data) {
      setLines(
        recipeQuery.data.data.lines.map((l) => ({ key: nextKey++, materialId: l.materialId, quantity: String(l.quantity) })),
      )
    }
  }, [recipeQuery.data, lines])

  const draft = lines ?? []
  const used = new Set(draft.map((l) => l.materialId))
  const lineCost = (l: DraftLine) =>
    (parseFloat(l.quantity) || 0) * ((byId.get(l.materialId) ?? savedLines.get(l.materialId))?.costPerComponentUnit ?? 0)
  const totalCost = draft.reduce((sum, l) => sum + lineCost(l), 0)
  const margin = marginPercent(variant.salePrice, totalCost)
  const valid = draft.every((l) => byId.has(l.materialId) && parseFloat(l.quantity) > 0)

  const update = (key: number, patch: Partial<DraftLine>) => {
    setError(null)
    setLines((ls) => (ls ?? []).map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }
  const addLine = () => {
    const first = materials.find((m) => !used.has(m.id))
    setLines((ls) => [...(ls ?? []), { key: nextKey++, materialId: first?.id ?? '', quantity: '' }])
  }

  // Pre-fills the lines from the chosen size, scaled; nothing is saved until the owner presses save.
  const copyRecipe = async () => {
    if (!copyFrom || !tenantId) return
    setCopying(true)
    setError(null)
    try {
      const source = await qc.fetchQuery({
        queryKey: ['recipe', tenantId, copyFrom],
        queryFn: () => recipesApi.get(tenantId, copyFrom),
      })
      const sourceLines = source.data.lines
      const usable = sourceLines.filter((l) => byId.has(l.materialId))
      setLines(
        usable.map((l) => ({
          key: nextKey++,
          materialId: l.materialId,
          quantity: String(Math.round(l.quantity * copyMultiplier * 1000) / 1000),
        })),
      )
      if (usable.length < sourceLines.length) toast.warning(t.products.copySkippedArchived)
      else toast.success(t.products.copied)
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setCopying(false)
    }
  }

  const save = useMutation({
    mutationFn: () =>
      recipesApi.set(
        tenantId!,
        variant.id,
        draft.map((l) => ({ materialId: l.materialId, quantity: parseFloat(l.quantity) })),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['recipe', tenantId, variant.id] })
      void qc.invalidateQueries({ queryKey: ['recipe-summaries', tenantId] })
      toast.success(draft.length ? `تم حفظ وصفة ${variant.name}` : `تم حذف وصفة ${variant.name}`)
      onClose()
    },
    onError: (err) => setError(apiErrorMessage(err)),
  })

  const loading = recipeQuery.isLoading || materialsQuery.isLoading

  return (
    <Modal
      open
      onClose={onClose}
      title={`وصفة: ${variant.name}`}
      size="xl"
      footer={
        materials.length > 0 &&
        (canEdit ? (
          <>
            <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
              إلغاء
            </Button>
            <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!valid || loading}>
              حفظ الوصفة
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={onClose}>
            إغلاق
          </Button>
        ))
      }
    >
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-10" />
          ))}
        </div>
      ) : materials.length === 0 ? (
        <EmptyState
          icon={<FlaskConical />}
          title="لا توجد مواد مخزون"
          description="أضف المواد الخام أولاً (مثل البن والحليب)، ثم ارجع لتحديد وصفة المنتج."
          action={
            <Link to="/stock-materials" className="text-sm font-semibold text-brand-ink hover:underline">
              الذهاب إلى مواد المخزون
            </Link>
          }
        />
      ) : (
        <div className="space-y-5">
          <p className="text-sm text-muted">
            {canEdit
              ? 'حدّد المواد الداخلة في صنع قطعة واحدة. عند بيع المنتج تُخصم الكميات من مواد المخزون تلقائياً.'
              : 'عرض فقط. تعديل الوصفة متاح للمالك والمدير.'}
          </p>

          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm text-danger">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {canEdit && copySources.length > 0 && (
            <div className="space-y-2 rounded-xl border border-border bg-surface-2 p-3">
              <p className="text-sm font-semibold text-fg">{t.products.copyFromSize}</p>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="input min-w-0 flex-1"
                  value={copyFrom}
                  onChange={(e) => setCopyFrom(e.target.value)}
                  aria-label={t.products.copySource}
                  disabled={copying}
                >
                  {copySources.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <select
                  className="input w-28 shrink-0"
                  value={copyMultiplier}
                  onChange={(e) => setCopyMultiplier(Number(e.target.value))}
                  aria-label={t.products.copyMultiplier}
                  disabled={copying}
                >
                  {COPY_MULTIPLIERS.map((m) => (
                    <option key={m} value={m}>
                      ×{m}
                    </option>
                  ))}
                </select>
                <Button variant="secondary" size="sm" onClick={() => void copyRecipe()} loading={copying} disabled={!copyFrom}>
                  <Copy className="h-4 w-4" />
                  {t.products.copyApply}
                </Button>
              </div>
              <p className="text-xs text-muted">{t.products.copyHint}</p>
            </div>
          )}

          {draft.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
              لا توجد مكوّنات بعد
            </div>
          ) : (
            <ul className="space-y-2">
              {draft.map((l) => {
                const m = byId.get(l.materialId)
                const archived = !m && l.materialId ? savedLines.get(l.materialId) : undefined
                return (
                  <li
                    key={l.key}
                    className={cn(
                      'flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-2.5',
                      !archived && 'sm:flex-nowrap',
                    )}
                  >
                    <select
                      className="input min-w-0 flex-1"
                      value={l.materialId}
                      onChange={(e) => update(l.key, { materialId: e.target.value })}
                      aria-label="المادة"
                      disabled={!canEdit}
                    >
                      {archived && (
                        <option value={l.materialId} disabled>
                          {archived.materialName} (مؤرشفة)
                        </option>
                      )}
                      {materials
                        .filter((mm) => mm.id === l.materialId || !used.has(mm.id))
                        .map((mm) => (
                          <option key={mm.id} value={mm.id}>
                            {mm.nameAr}
                          </option>
                        ))}
                    </select>
                    <div className="relative w-36 shrink-0">
                      <input
                        type="number"
                        className="input pe-14"
                        value={l.quantity}
                        min="0"
                        step="0.001"
                        placeholder="الكمية"
                        aria-label={`الكمية بـ${m?.componentUnit ?? archived?.componentUnit ?? ''}`}
                        onChange={(e) => update(l.key, { quantity: e.target.value })}
                        readOnly={!canEdit}
                      />
                      <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-xs text-muted">
                        {m?.componentUnit ?? archived?.componentUnit}
                      </span>
                    </div>
                    <span className="w-24 shrink-0 text-end text-sm tabular-nums text-fg">
                      {lineCost(l).toFixed(2)} ر.س
                    </span>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => setLines((ls) => (ls ?? []).filter((x) => x.key !== l.key))}
                        className="rounded-lg p-2 text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                        aria-label={`إزالة ${m?.nameAr ?? archived?.materialName ?? 'المكوّن'}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                    {archived && (
                      <p className="w-full text-xs text-warning">هذه المادة مؤرشفة؛ استرجعها أو احذف السطر.</p>
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          {canEdit && materials.some((mm) => !used.has(mm.id)) && (
            <Button variant="secondary" size="sm" onClick={addLine}>
              <Plus className="h-4 w-4" />
              إضافة مكوّن
            </Button>
          )}

          <dl className="grid grid-cols-3 gap-3 rounded-xl bg-surface-2 p-4 text-sm">
            <div>
              <dt className="text-xs text-muted">تكلفة القطعة</dt>
              <dd className="mt-1 font-semibold tabular-nums text-fg">{totalCost.toFixed(2)} ر.س</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">سعر البيع قبل الضريبة</dt>
              <dd className="mt-1 font-semibold tabular-nums text-fg">{formatCurrency(netOfVat(variant.salePrice), variant.currency)}</dd>
              <dd className="text-xs tabular-nums text-muted">{formatCurrency(variant.salePrice, variant.currency)} شامل الضريبة</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">هامش الربح</dt>
              <dd
                className={cn('mt-1 font-semibold tabular-nums', marginTone(margin))}
              >
                {margin === null ? '—' : `${margin.toFixed(0)}%`}
              </dd>
            </div>
          </dl>
          {draft.some((l) => byId.get(l.materialId)?.costPerComponentUnit === 0) && (
            <p className="text-xs text-warning">
              بعض المواد تكلفتها صفر. استلم كمية بسعر الشراء من صفحة مواد المخزون لتظهر التكلفة الحقيقية.
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}
