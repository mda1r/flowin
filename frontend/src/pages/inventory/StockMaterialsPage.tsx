import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FlaskConical, Plus, Pencil, Archive, ArchiveRestore, AlertTriangle, Search, X, PackagePlus, History, Scale, Trash2 } from 'lucide-react'
import { stockMaterialApi } from '@/api/stockMaterial'
import { useAuthStore } from '@/stores/authStore'
import { useCanManageMaterials } from '@/hooks/useCanManageMaterials'
import { Modal, ConfirmModal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/layout/PageHeader'
import { toast } from '@/components/ui/Toast'
import { apiErrorMessage } from '@/lib/apiError'
import { cn } from '@/lib/utils'
import type {
  StockMaterialCategoryResponse,
  StockMaterialResponse,
  CreateStockMaterialPayload,
  UpdateStockMaterialPayload,
  StockMaterialMovementResponse,
} from '@/types/stockMaterial'
import { intlLocale } from '@/lib/locale'

const COST_METHOD_LABELS: Record<string, string> = {
  LastPurchase: 'آخر شراء',
  WeightedAverage: 'متوسط مرجّح',
}

function parseMaybeNum(s: string): number | undefined {
  const n = parseFloat(s)
  return isNaN(n) ? undefined : n
}

// ─── Material form ──────────────────────────────────────────────────────────

interface MaterialForm {
  code: string
  nameAr: string
  nameEn: string
  categoryId: string
  storageUnit: string
  componentUnit: string
  conversionFactor: string
  costMethod: string
  initialCost: string
  quantity: string
  minLevel: string
  maxLevel: string
  reorderLevel: string
}

const EMPTY_FORM: MaterialForm = {
  code: '',
  nameAr: '',
  nameEn: '',
  categoryId: '',
  storageUnit: '',
  componentUnit: '',
  conversionFactor: '1',
  costMethod: '1',
  initialCost: '0',
  quantity: '0',
  minLevel: '',
  maxLevel: '',
  reorderLevel: '',
}

function toPayload(f: MaterialForm): CreateStockMaterialPayload {
  return {
    code: f.code,
    nameAr: f.nameAr,
    nameEn: f.nameEn || undefined,
    categoryId: f.categoryId || undefined,
    storageUnit: f.storageUnit,
    componentUnit: f.componentUnit,
    conversionFactor: parseFloat(f.conversionFactor) || 1,
    costMethod: parseInt(f.costMethod),
    initialCost: parseFloat(f.initialCost) || 0,
    initialQuantity: parseFloat(f.quantity) || 0,
    minLevel: parseMaybeNum(f.minLevel),
    maxLevel: parseMaybeNum(f.maxLevel),
    reorderLevel: parseMaybeNum(f.reorderLevel),
  }
}

// Quantity changes go through the adjust action, and the cost is sent only when the user changed
// it, so saving a rename never rolls back stock or cost that moved while the form was open.
function toUpdatePayload(f: MaterialForm, initial: StockMaterialResponse): UpdateStockMaterialPayload {
  const { initialQuantity, initialCost, ...rest } = toPayload(f)
  const cost = parseMaybeNum(f.initialCost)
  return { ...rest, manualCost: cost !== undefined && cost !== initial.currentCost ? cost : undefined }
}

function fromMaterial(m: StockMaterialResponse): MaterialForm {
  return {
    code: m.code,
    nameAr: m.nameAr,
    nameEn: m.nameEn ?? '',
    categoryId: m.categoryId ?? '',
    storageUnit: m.storageUnit,
    componentUnit: m.componentUnit,
    conversionFactor: String(m.conversionFactor),
    costMethod: m.costMethod === 'WeightedAverage' ? '2' : '1',
    initialCost: String(m.currentCost),
    quantity: String(m.currentQuantityInStorageUnits),
    minLevel: m.minLevel != null ? String(m.minLevel) : '',
    maxLevel: m.maxLevel != null ? String(m.maxLevel) : '',
    reorderLevel: m.reorderLevel != null ? String(m.reorderLevel) : '',
  }
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-fg">
        {label}
        {required && <span className="ms-0.5 text-danger">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  )
}

interface MaterialModalProps {
  categories: StockMaterialCategoryResponse[]
  initial?: StockMaterialResponse
  onSave: (form: MaterialForm) => void
  onClose: () => void
  saving: boolean
  error: string | null
}

function MaterialModal({ categories, initial, onSave, onClose, saving, error }: MaterialModalProps) {
  const [f, setF] = useState<MaterialForm>(initial ? fromMaterial(initial) : EMPTY_FORM)
  const field = (k: keyof MaterialForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((v) => ({ ...v, [k]: e.target.value }))

  const canSave = !!f.code.trim() && !!f.nameAr.trim() && !!f.storageUnit.trim() && !!f.componentUnit.trim()
  const factor = parseFloat(f.conversionFactor) || 0
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (canSave && !saving) onSave(f)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? `تعديل: ${initial.nameAr}` : 'إضافة مادة جديدة'}
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            إلغاء
          </Button>
          <Button type="submit" form="material-form" loading={saving} disabled={!canSave}>
            حفظ
          </Button>
        </>
      }
    >
      <form id="material-form" onSubmit={submit} className="space-y-6">
        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm text-danger">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <section className="space-y-4">
          <h3 className="text-13 font-semibold text-muted">البيانات الأساسية</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="الاسم بالعربي" required>
              <input className="input" value={f.nameAr} onChange={field('nameAr')} placeholder="مثال: سكر" />
            </Field>
            <Field label="الكود" required>
              <input className="input font-mono" dir="ltr" value={f.code} onChange={field('code')} placeholder="SUGAR-KG" />
            </Field>
            <Field label="الاسم بالإنجليزي">
              <input className="input" dir="ltr" value={f.nameEn} onChange={field('nameEn')} placeholder="Sugar" />
            </Field>
            <Field label="التصنيف">
              <select className="input" value={f.categoryId} onChange={field('categoryId')}>
                <option value="">بدون تصنيف</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-13 font-semibold text-muted">الوحدات</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="وحدة التخزين" required>
              <input className="input" value={f.storageUnit} onChange={field('storageUnit')} placeholder="كرتون" />
            </Field>
            <Field label="وحدة المكوّن" required>
              <input className="input" value={f.componentUnit} onChange={field('componentUnit')} placeholder="جرام" />
            </Field>
            <Field label="معامل التحويل" required>
              <input type="number" className="input" value={f.conversionFactor} onChange={field('conversionFactor')} min="0.001" step="0.001" />
            </Field>
          </div>
          {f.storageUnit && f.componentUnit && factor > 0 && (
            <p className="rounded-lg bg-brand-soft px-3 py-2 text-sm text-brand-ink">
              1 {f.storageUnit} = {factor.toLocaleString(intlLocale())} {f.componentUnit}
            </p>
          )}
        </section>

        <section className="space-y-4">
          <h3 className="text-13 font-semibold text-muted">التكلفة والمخزون</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="طريقة احتساب التكلفة" required>
              <select className="input" value={f.costMethod} onChange={field('costMethod')}>
                <option value="1">آخر شراء</option>
                <option value="2">متوسط مرجّح</option>
              </select>
            </Field>
            <Field label={`تكلفة ${f.storageUnit || 'وحدة التخزين'} (ر.س)`} hint="تتحدث تلقائياً عند الاستلام">
              <input type="number" className="input" value={f.initialCost} onChange={field('initialCost')} min="0" step="0.01" />
            </Field>
            {initial ? (
              <Field label="الكمية الحالية" hint="لتغييرها استخدم زر «جرد الكمية»">
                <p className="input flex items-center bg-surface-2 tabular-nums text-muted">
                  {initial.currentQuantityInStorageUnits.toLocaleString('ar-SA')} {initial.storageUnit}
                </p>
              </Field>
            ) : (
              <Field label={`الكمية الحالية (${f.storageUnit || 'وحدة تخزين'})`}>
                <input type="number" className="input" value={f.quantity} onChange={field('quantity')} min="0" step="0.001" />
              </Field>
            )}
            <Field label="حد إعادة الطلب" hint="يظهر تنبيه عند الوصول له">
              <input type="number" className="input" value={f.reorderLevel} onChange={field('reorderLevel')} min="0" step="0.01" placeholder="اختياري" />
            </Field>
            <Field label="الحد الأدنى">
              <input type="number" className="input" value={f.minLevel} onChange={field('minLevel')} min="0" step="0.01" placeholder="اختياري" />
            </Field>
            <Field label="الحد الأقصى">
              <input type="number" className="input" value={f.maxLevel} onChange={field('maxLevel')} min="0" step="0.01" placeholder="اختياري" />
            </Field>
          </div>
        </section>
      </form>
    </Modal>
  )
}

// ─── Receive stock ──────────────────────────────────────────────────────────

function projectedCost(m: StockMaterialResponse, qty: number, unitCost: number): number {
  const onHand = Math.max(m.currentQuantityInStorageUnits, 0)
  if (m.costMethod === 'WeightedAverage' && onHand > 0) {
    return (onHand * m.currentCost + qty * unitCost) / (onHand + qty)
  }
  return unitCost
}

function ReceiveModal({ material, onClose }: { material: StockMaterialResponse; onClose: () => void }) {
  const { tenantId } = useAuthStore()
  const qc = useQueryClient()
  const [qty, setQty] = useState('')
  const [unitCost, setUnitCost] = useState(material.currentCost > 0 ? String(material.currentCost) : '')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const q = parseFloat(qty)
  const c = parseFloat(unitCost)
  const valid = q > 0 && c >= 0 && !isNaN(c)

  const mut = useMutation({
    mutationFn: () =>
      stockMaterialApi.receiveMaterial(tenantId!, material.id, {
        quantity: q,
        unitCost: c,
        note: note.trim() || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['stock-materials', tenantId] })
      void qc.invalidateQueries({ queryKey: ['stock-material-movements', tenantId, material.id] })
      toast.success(`تم استلام ${q.toLocaleString(intlLocale())} ${material.storageUnit} من ${material.nameAr}`)
      onClose()
    },
    onError: (err) => setError(apiErrorMessage(err)),
  })

  const newQty = material.currentQuantityInStorageUnits + (q > 0 ? q : 0)
  const newCost = valid ? projectedCost(material, q, c) : material.currentCost

  return (
    <Modal
      open
      onClose={onClose}
      title={`استلام كمية: ${material.nameAr}`}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mut.isPending}>
            إلغاء
          </Button>
          <Button type="submit" form="receive-form" loading={mut.isPending} disabled={!valid}>
            استلام
          </Button>
        </>
      }
    >
      <form
        id="receive-form"
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (valid && !mut.isPending) mut.mutate()
        }}
      >
        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm text-danger">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`الكمية المستلمة (${material.storageUnit})`} required>
            <input
              type="number"
              className="input"
              value={qty}
              onChange={(e) => {
                setQty(e.target.value)
                setError(null)
              }}
              min="0"
              step="0.001"
              data-autofocus
            />
          </Field>
          <Field label={`سعر الشراء لكل ${material.storageUnit} (ر.س)`} required>
            <input
              type="number"
              className="input"
              value={unitCost}
              onChange={(e) => {
                setUnitCost(e.target.value)
                setError(null)
              }}
              min="0"
              step="0.01"
            />
          </Field>
        </div>
        <Field label="ملاحظة" hint="مثال: رقم فاتورة المورد">
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="اختياري" />
        </Field>

        <dl className="grid grid-cols-2 gap-3 rounded-xl bg-surface-2 p-4 text-sm">
          <div>
            <dt className="text-xs text-muted">الكمية بعد الاستلام</dt>
            <dd className="mt-1 font-semibold tabular-nums text-fg">
              {newQty.toLocaleString(intlLocale())} {material.storageUnit}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">
              التكلفة الجديدة ({COST_METHOD_LABELS[material.costMethod] ?? material.costMethod})
            </dt>
            <dd className="mt-1 font-semibold tabular-nums text-fg">
              {newCost.toFixed(2)} ر.س / {material.storageUnit}
            </dd>
          </div>
        </dl>
        {valid && q > 0 && (
          <p className="text-xs text-muted">
            إجمالي الفاتورة: <span className="tabular-nums text-fg">{(q * c).toFixed(2)} ر.س</span>
          </p>
        )}
      </form>
    </Modal>
  )
}

// ─── Adjust (count) stock ───────────────────────────────────────────────────

const ADJUST_REASONS = ['جرد', 'تالف', 'هدر', 'تصحيح خطأ']

function AdjustModal({ material, onClose }: { material: StockMaterialResponse; onClose: () => void }) {
  const { tenantId } = useAuthStore()
  const qc = useQueryClient()
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState(ADJUST_REASONS[0])
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const q = qty.trim() === '' ? NaN : parseFloat(qty)
  const valid = !isNaN(q) && q >= 0
  const change = valid ? q - material.currentQuantityInStorageUnits : 0

  const mut = useMutation({
    mutationFn: () =>
      stockMaterialApi.adjustMaterial(tenantId!, material.id, {
        newQuantity: q,
        reason: note.trim() ? `${reason}: ${note.trim()}` : reason,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['stock-materials', tenantId] })
      void qc.invalidateQueries({ queryKey: ['stock-material-movements', tenantId, material.id] })
      toast.success(`تم تحديث كمية ${material.nameAr}`)
      onClose()
    },
    onError: (err) => setError(apiErrorMessage(err)),
  })

  return (
    <Modal
      open
      onClose={onClose}
      title={`جرد الكمية: ${material.nameAr}`}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mut.isPending}>
            إلغاء
          </Button>
          <Button type="submit" form="adjust-form" loading={mut.isPending} disabled={!valid || change === 0}>
            حفظ الكمية
          </Button>
        </>
      }
    >
      <form
        id="adjust-form"
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (valid && change !== 0 && !mut.isPending) mut.mutate()
        }}
      >
        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm text-danger">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        <Field label={`الكمية الفعلية (${material.storageUnit})`} hint="اكتب الكمية الموجودة فعلاً بعد العدّ" required>
          <input
            type="number"
            className="input"
            value={qty}
            onChange={(e) => {
              setQty(e.target.value)
              setError(null)
            }}
            min="0"
            step="0.001"
            data-autofocus
          />
        </Field>
        <div>
          <span className="mb-1.5 block text-sm font-medium text-fg">السبب</span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="السبب">
            {ADJUST_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={reason === r}
                onClick={() => setReason(r)}
                className={cn(
                  'rounded-full border px-3 py-1 text-sm transition-colors',
                  reason === r ? 'border-brand bg-brand text-brand-fg' : 'border-border text-muted hover:bg-surface-2 hover:text-fg',
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <Field label="ملاحظة">
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={400} placeholder="اختياري" />
        </Field>

        <dl className="grid grid-cols-2 gap-3 rounded-xl bg-surface-2 p-4 text-sm">
          <div>
            <dt className="text-xs text-muted">الكمية في النظام</dt>
            <dd className="mt-1 font-semibold tabular-nums text-fg">
              {material.currentQuantityInStorageUnits.toLocaleString('ar-SA')} {material.storageUnit}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">الفرق</dt>
            <dd
              className={cn('mt-1 font-semibold tabular-nums', change > 0 ? 'text-success' : change < 0 ? 'text-danger' : 'text-muted')}
              dir="ltr"
            >
              {change > 0 ? '+' : ''}
              {change.toLocaleString('ar-SA', { maximumFractionDigits: 4 })} {material.storageUnit}
            </dd>
          </div>
        </dl>
      </form>
    </Modal>
  )
}

const MOVEMENT_LABELS: Record<string, string> = {
  Receive: 'استلام',
  Adjustment: 'تعديل يدوي',
  Consumption: 'استهلاك بيع',
}

function MovementsModal({ material, onClose }: { material: StockMaterialResponse; onClose: () => void }) {
  const { tenantId } = useAuthStore()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['stock-material-movements', tenantId, material.id],
    queryFn: () => stockMaterialApi.listMovements(tenantId!, material.id),
    enabled: !!tenantId,
  })
  const rows: StockMaterialMovementResponse[] = data?.data ?? []

  return (
    <Modal open onClose={onClose} title={`سجل الحركة: ${material.nameAr}`} size="xl">
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-10" />
          ))}
        </div>
      ) : isError ? (
        <p className="text-sm text-danger">تعذّر تحميل السجل</p>
      ) : rows.length === 0 ? (
        <EmptyState icon={<History />} title="لا توجد حركات بعد" description="ستظهر هنا كل عمليات الاستلام والتعديل على الكمية." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="px-3 py-2 text-start font-semibold">التاريخ</th>
                <th className="px-3 py-2 text-start font-semibold">النوع</th>
                <th className="px-3 py-2 text-start font-semibold">الكمية</th>
                <th className="px-3 py-2 text-start font-semibold">السعر</th>
                <th className="px-3 py-2 text-start font-semibold">الرصيد بعدها</th>
                <th className="px-3 py-2 text-start font-semibold">التكلفة بعدها</th>
                <th className="px-3 py-2 text-start font-semibold">ملاحظة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap px-3 py-2.5 text-muted tabular-nums">
                    {new Date(r.createdAt.endsWith('Z') ? r.createdAt : `${r.createdAt}Z`).toLocaleString(intlLocale(), {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={r.type === 'Receive' ? 'badge-green' : r.type === 'Consumption' ? 'badge-blue' : 'badge-gray'}>{MOVEMENT_LABELS[r.type] ?? r.type}</span>
                  </td>
                  <td
                    className={cn(
                      'whitespace-nowrap px-3 py-2.5 font-semibold tabular-nums',
                      r.quantityChange >= 0 ? 'text-success' : 'text-danger',
                    )}
                    dir="ltr"
                  >
                    {r.quantityChange > 0 ? '+' : ''}
                    {r.quantityChange.toLocaleString(intlLocale())}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-fg">
                    {r.unitCost != null ? `${r.unitCost.toFixed(2)} ر.س` : '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-fg">
                    {r.quantityAfter.toLocaleString(intlLocale())} {material.storageUnit}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-fg">{r.costAfter.toFixed(2)} ر.س</td>
                  <td className="px-3 py-2.5 text-muted">{r.note ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────

export function StockMaterialsPage() {
  const { tenantId } = useAuthStore()
  const canManage = useCanManageMaterials()
  const qc = useQueryClient()
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [lowStockOnly, setLowStockOnly] = useState(() => new URLSearchParams(window.location.search).get('lowStock') === '1')
  const [showAddMat, setShowAddMat] = useState(false)
  const [editMat, setEditMat] = useState<StockMaterialResponse | null>(null)
  const [deleteMat, setDeleteMat] = useState<StockMaterialResponse | null>(null)
  const [receiveMat, setReceiveMat] = useState<StockMaterialResponse | null>(null)
  const [historyMat, setHistoryMat] = useState<StockMaterialResponse | null>(null)
  const [adjustMat, setAdjustMat] = useState<StockMaterialResponse | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [deleteCat, setDeleteCat] = useState<StockMaterialCategoryResponse | null>(null)
  const [showAddCat, setShowAddCat] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [catError, setCatError] = useState<string | null>(null)
  const [matError, setMatError] = useState<string | null>(null)

  const { data: catResp } = useQuery({
    queryKey: ['stock-material-categories', tenantId],
    queryFn: () => stockMaterialApi.listCategories(tenantId!),
    enabled: !!tenantId,
  })
  const categories: StockMaterialCategoryResponse[] = catResp?.data ?? []

  const { data: matResp, isLoading } = useQuery({
    queryKey: ['stock-materials', tenantId, selectedCatId, lowStockOnly, search, showArchived],
    queryFn: () =>
      stockMaterialApi.listMaterials(tenantId!, {
        categoryId: selectedCatId ?? undefined,
        lowStockOnly,
        search: search || undefined,
        archived: showArchived || undefined,
      }),
    enabled: !!tenantId,
  })
  const materials: StockMaterialResponse[] = matResp?.data ?? []

  // The server archives a material with movement history and deletes one that never moved,
  // so the confirm copy follows its history (neutral until the history has loaded).
  const { data: deleteMovResp } = useQuery({
    queryKey: ['stock-material-movements', tenantId, deleteMat?.id],
    queryFn: () => stockMaterialApi.listMovements(tenantId!, deleteMat!.id),
    enabled: !!tenantId && !!deleteMat,
    staleTime: 0,
  })
  const deleteHasMovements = deleteMovResp ? deleteMovResp.data.length > 0 : null

  const invalidateMaterials = () => qc.invalidateQueries({ queryKey: ['stock-materials', tenantId] })
  const invalidateCategories = () => qc.invalidateQueries({ queryKey: ['stock-material-categories', tenantId] })

  const createCatMut = useMutation({
    mutationFn: (name: string) => stockMaterialApi.createCategory(tenantId!, { name }),
    onSuccess: () => {
      void invalidateCategories()
      setShowAddCat(false)
      setNewCatName('')
      setCatError(null)
      toast.success('تمت إضافة التصنيف')
    },
    onError: (err) => setCatError(apiErrorMessage(err)),
  })

  const deleteCatMut = useMutation({
    mutationFn: (id: string) => stockMaterialApi.deleteCategory(tenantId!, id),
    onSuccess: (_, id) => {
      void invalidateCategories()
      if (selectedCatId === id) setSelectedCatId(null)
      setDeleteCat(null)
      toast.success('تم حذف التصنيف')
    },
    onError: (err) => {
      setDeleteCat(null)
      toast.error('تعذّر حذف التصنيف', apiErrorMessage(err))
    },
  })

  const createMatMut = useMutation({
    mutationFn: (payload: CreateStockMaterialPayload) => stockMaterialApi.createMaterial(tenantId!, payload),
    onSuccess: () => {
      void invalidateMaterials()
      setShowAddMat(false)
      setMatError(null)
      toast.success('تمت إضافة المادة')
    },
    onError: (err) => setMatError(apiErrorMessage(err)),
  })

  const updateMatMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateStockMaterialPayload }) =>
      stockMaterialApi.updateMaterial(tenantId!, id, payload),
    onSuccess: () => {
      void invalidateMaterials()
      setEditMat(null)
      setMatError(null)
      toast.success('تم حفظ التعديلات')
    },
    onError: (err) => setMatError(apiErrorMessage(err)),
  })

  const deleteMatMut = useMutation({
    mutationFn: (id: string) => stockMaterialApi.deleteMaterial(tenantId!, id),
    onSuccess: (res) => {
      void invalidateMaterials()
      setDeleteMat(null)
      toast.success(res.data?.archived ? 'تم نقل المادة إلى الأرشيف' : 'تم حذف المادة')
    },
    onError: (err) => {
      setDeleteMat(null)
      toast.error('تعذّرت أرشفة المادة', apiErrorMessage(err))
    },
  })

  const restoreMatMut = useMutation({
    mutationFn: (id: string) => stockMaterialApi.restoreMaterial(tenantId!, id),
    onSuccess: (res) => {
      void invalidateMaterials()
      toast.success(`تم استرجاع ${res.data.nameAr}`)
    },
    onError: (err) => toast.error('تعذّر استرجاع المادة', apiErrorMessage(err)),
  })

  const submitCategory = () => {
    const name = newCatName.trim()
    if (name && !createCatMut.isPending) createCatMut.mutate(name)
  }

  const lowCount = showArchived ? 0 : materials.filter((m) => m.isLowStock).length
  const hasFilters = !!search || lowStockOnly || selectedCatId !== null || showArchived

  const catButton = (id: string | null, label: string, withAction = false) => {
    const active = selectedCatId === id
    return (
      <button
        type="button"
        onClick={() => setSelectedCatId(id)}
        aria-pressed={active}
        className={cn(
          'w-full truncate rounded-lg px-3 py-2 text-start text-sm transition-colors',
          withAction && 'pe-8',
          active ? 'bg-brand-soft font-semibold text-brand-ink' : 'text-muted hover:bg-surface-2 hover:text-fg',
        )}
      >
        {label}
      </button>
    )
  }

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        icon={<FlaskConical className="h-5 w-5" />}
        title="مواد المخزون"
        description="المواد الخام والمكوّنات التي تدخل في منتجاتك"
        action={
          <>
            {lowCount > 0 && (
              <a
                href="/purchasing?reorder=1"
                className="inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-3 py-1 text-xs font-semibold text-warning hover:bg-warning/25"
                title="إنشاء أمر شراء للمواد تحت حد الطلب"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                {lowCount} تحت حد الطلب · اطلبها
              </a>
            )}
            {canManage && (
              <Button
                onClick={() => {
                  setMatError(null)
                  setShowAddMat(true)
                }}
              >
                <Plus className="h-4 w-4" />
                مادة جديدة
              </Button>
            )}
          </>
        }
      />

      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6 md:flex-row">
        {/* Categories */}
        <aside className="card-3d flex shrink-0 flex-col p-3 md:w-56">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-sm font-semibold text-fg">التصنيفات</span>
            {canManage && (
              <button
                type="button"
                className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-fg"
                onClick={() => {
                  setCatError(null)
                  setShowAddCat((v) => !v)
                }}
                aria-label="إضافة تصنيف"
                aria-expanded={showAddCat}
              >
                {showAddCat ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              </button>
            )}
          </div>

          {canManage && showAddCat && (
            <form
              className="mb-3 space-y-2"
              onSubmit={(e) => {
                e.preventDefault()
                submitCategory()
              }}
            >
              <input
                className="input"
                placeholder="اسم التصنيف"
                value={newCatName}
                onChange={(e) => {
                  setNewCatName(e.target.value)
                  setCatError(null)
                }}
                autoFocus
                aria-invalid={!!catError}
              />
              {catError && <p className="text-xs text-danger">{catError}</p>}
              <Button type="submit" size="sm" className="w-full" loading={createCatMut.isPending} disabled={!newCatName.trim()}>
                إضافة
              </Button>
            </form>
          )}

          <ul className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
            <li className="shrink-0 md:shrink">{catButton(null, 'الكل')}</li>
            {categories.map((cat) => (
              <li key={cat.id} className="group relative shrink-0 md:shrink">
                {catButton(cat.id, cat.name, canManage)}
                {canManage && (
                  <button
                    type="button"
                    onClick={() => setDeleteCat(cat)}
                    className="absolute end-1 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted opacity-70 transition hover:bg-danger/10 hover:text-danger hover:opacity-100 focus:opacity-100 md:opacity-0 md:group-hover:opacity-100"
                    aria-label={`حذف تصنيف ${cat.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </aside>

        {/* Materials */}
        <section className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                className="input ps-9"
                placeholder="ابحث بالاسم أو الكود"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="بحث"
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border accent-[rgb(var(--brand-ink))]"
                checked={lowStockOnly}
                onChange={(e) => setLowStockOnly(e.target.checked)}
              />
              تحت حد الطلب فقط
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border accent-[rgb(var(--brand-ink))]"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
              />
              المؤرشفة
            </label>
            <span className="ms-auto text-xs text-muted tabular-nums">{materials.length} مادة</span>
          </div>

          <div className="card-3d flex-1 overflow-hidden">
            {isLoading ? (
              <div className="space-y-3 p-5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="skeleton h-10" />
                ))}
              </div>
            ) : materials.length === 0 ? (
              showArchived && !search && !lowStockOnly && selectedCatId === null ? (
                <EmptyState icon={<Archive />} title="الأرشيف فارغ" description="المواد التي تؤرشفها تظهر هنا مع سجل حركتها." />
              ) : hasFilters ? (
                <EmptyState icon={<Search />} title="لا توجد نتائج" description="جرّب كلمة بحث أخرى أو أزل عوامل التصفية" />
              ) : (
                <EmptyState
                  icon={<FlaskConical />}
                  title="لا توجد مواد مخزون بعد"
                  description="أضف المواد الخام مثل البن والحليب والسكر، لتتبع الكميات والتكلفة."
                  action={
                    canManage && (
                      <Button
                        onClick={() => {
                          setMatError(null)
                          setShowAddMat(true)
                        }}
                      >
                        <Plus className="h-4 w-4" />
                        أضف أول مادة
                      </Button>
                    )
                  }
                />
              )
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface-2/60 text-xs text-muted">
                      <th className="px-4 py-3 text-start font-semibold">المادة</th>
                      <th className="px-4 py-3 text-start font-semibold">التصنيف</th>
                      <th className="px-4 py-3 text-start font-semibold">التحويل</th>
                      <th className="px-4 py-3 text-start font-semibold">الكمية</th>
                      <th className="px-4 py-3 text-start font-semibold">التكلفة</th>
                      <th className="px-4 py-3 text-start font-semibold">طريقة التكلفة</th>
                      <th className="px-4 py-3 text-end font-semibold">
                        <span className="sr-only">إجراءات</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {materials.map((m) => (
                      <tr key={m.id} className="row-hover">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {m.isLowStock && (
                              <AlertTriangle className="h-4 w-4 shrink-0 text-warning" aria-label="تحت حد الطلب" />
                            )}
                            <div className="min-w-0">
                              <p className="truncate font-medium text-fg">{m.nameAr}</p>
                              <p className="truncate font-mono text-xs text-muted" dir="ltr">
                                {m.code}
                                {m.nameEn ? ` · ${m.nameEn}` : ''}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted">{m.categoryName ?? '—'}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted">
                          1 {m.storageUnit} = {m.conversionFactor.toLocaleString(intlLocale())} {m.componentUnit}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className={cn('font-semibold', m.isLowStock ? 'text-warning' : 'text-fg')}>
                            {m.currentQuantityInStorageUnits.toLocaleString(intlLocale())} {m.storageUnit}
                          </span>
                          {m.reorderLevel != null && (
                            <span className="ms-1.5 text-xs text-muted">حد الطلب {m.reorderLevel.toLocaleString(intlLocale())}</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <p className="tabular-nums text-fg">
                            {m.currentCost.toFixed(2)} ر.س <span className="text-xs text-muted">/ {m.storageUnit}</span>
                          </p>
                          {m.conversionFactor !== 1 && m.costPerComponentUnit > 0 && (
                            <p className="text-xs tabular-nums text-muted">
                              {m.costPerComponentUnit.toFixed(4)} ر.س / {m.componentUnit}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="badge-gray">{COST_METHOD_LABELS[m.costMethod] ?? m.costMethod}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {showArchived ? (
                              canManage && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => restoreMatMut.mutate(m.id)}
                                  loading={restoreMatMut.isPending && restoreMatMut.variables === m.id}
                                  aria-label={`استرجاع ${m.nameAr}`}
                                >
                                  <ArchiveRestore className="h-4 w-4" />
                                  استرجاع
                                </Button>
                              )
                            ) : (
                              <Button size="sm" variant="secondary" onClick={() => setReceiveMat(m)} aria-label={`استلام كمية من ${m.nameAr}`}>
                                <PackagePlus className="h-4 w-4" />
                                استلام
                              </Button>
                            )}
                            <button
                              type="button"
                              className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-2 hover:text-fg"
                              onClick={() => setHistoryMat(m)}
                              aria-label={`سجل حركة ${m.nameAr}`}
                              title="سجل الحركة"
                            >
                              <History className="h-4 w-4" />
                            </button>
                            {canManage && !showArchived && (
                              <>
                                <button
                                  type="button"
                                  className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-2 hover:text-fg"
                                  onClick={() => setAdjustMat(m)}
                                  aria-label={`جرد كمية ${m.nameAr}`}
                                  title="جرد الكمية"
                                >
                                  <Scale className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-2 hover:text-fg"
                                  onClick={() => {
                                    setMatError(null)
                                    setEditMat(m)
                                  }}
                                  aria-label={`تعديل ${m.nameAr}`}
                                  title="تعديل"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  className="rounded-lg p-2 text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                                  onClick={() => setDeleteMat(m)}
                                  aria-label={`أرشفة ${m.nameAr}`}
                                  title="أرشفة"
                                >
                                  <Archive className="h-4 w-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>

      {showAddMat && (
        <MaterialModal
          categories={categories}
          onSave={(f) => createMatMut.mutate(toPayload(f))}
          onClose={() => setShowAddMat(false)}
          saving={createMatMut.isPending}
          error={matError}
        />
      )}

      {editMat && (
        <MaterialModal
          categories={categories}
          initial={editMat}
          onSave={(f) => updateMatMut.mutate({ id: editMat.id, payload: toUpdatePayload(f, editMat) })}
          onClose={() => setEditMat(null)}
          saving={updateMatMut.isPending}
          error={matError}
        />
      )}

      {receiveMat && <ReceiveModal material={receiveMat} onClose={() => setReceiveMat(null)} />}
      {historyMat && <MovementsModal material={historyMat} onClose={() => setHistoryMat(null)} />}
      {adjustMat && <AdjustModal material={adjustMat} onClose={() => setAdjustMat(null)} />}

      <ConfirmModal
        open={!!deleteMat}
        onClose={() => setDeleteMat(null)}
        onConfirm={() => deleteMat && deleteMatMut.mutate(deleteMat.id)}
        title={deleteHasMovements === false ? 'حذف المادة' : 'أرشفة المادة'}
        message={
          !deleteMat
            ? ''
            : deleteHasMovements === true
              ? `سيتم نقل "${deleteMat.nameAr}" إلى الأرشيف مع الاحتفاظ بسجل حركتها، ويمكنك استرجاعها لاحقاً.`
              : deleteHasMovements === false
                ? `سيتم حذف "${deleteMat.nameAr}" نهائياً لأنه لا توجد عليها أي حركة.`
                : `ستُؤرشف "${deleteMat.nameAr}" إن كان لها سجل حركة، وإلا ستُحذف نهائياً.`
        }
        confirmLabel={deleteHasMovements === false ? 'حذف' : 'أرشفة'}
        confirmVariant="danger"
        loading={deleteMatMut.isPending}
      />

      <ConfirmModal
        open={!!deleteCat}
        onClose={() => setDeleteCat(null)}
        onConfirm={() => deleteCat && deleteCatMut.mutate(deleteCat.id)}
        title="حذف التصنيف"
        message={deleteCat ? `سيتم حذف تصنيف "${deleteCat.name}". التصنيف يجب أن يكون فارغاً.` : ''}
        confirmLabel="حذف"
        confirmVariant="danger"
        loading={deleteCatMut.isPending}
      />
    </div>
  )
}
