import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FlaskConical, Plus, Pencil, Trash2, AlertTriangle } from 'lucide-react'
import { stockMaterialApi } from '@/api/stockMaterial'
import { useAuthStore } from '@/stores/authStore'
import type {
  StockMaterialCategoryResponse,
  StockMaterialResponse,
  CreateStockMaterialPayload,
  UpdateStockMaterialPayload,
} from '@/types/stockMaterial'

const COST_METHOD_LABELS: Record<string, string> = {
  LastPurchase: 'آخر شراء',
  WeightedAverage: 'متوسط مرجح',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseMaybeNum(s: string): number | undefined {
  const n = parseFloat(s)
  return isNaN(n) ? undefined : n
}

// ─── Material Modal ───────────────────────────────────────────────────────────

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
    minLevel: parseMaybeNum(f.minLevel),
    maxLevel: parseMaybeNum(f.maxLevel),
    reorderLevel: parseMaybeNum(f.reorderLevel),
  }
}

interface MaterialModalProps {
  categories: StockMaterialCategoryResponse[]
  initial?: StockMaterialResponse
  onSave: (payload: CreateStockMaterialPayload) => void
  onClose: () => void
  saving: boolean
}

function MaterialModal({ categories, initial, onSave, onClose, saving }: MaterialModalProps) {
  const [f, setF] = useState<MaterialForm>(
    initial
      ? {
          code: initial.code,
          nameAr: initial.nameAr,
          nameEn: initial.nameEn ?? '',
          categoryId: initial.categoryId ?? '',
          storageUnit: initial.storageUnit,
          componentUnit: initial.componentUnit,
          conversionFactor: String(initial.conversionFactor),
          costMethod: initial.costMethod === 'WeightedAverage' ? '2' : '1',
          initialCost: String(initial.currentCost),
          minLevel: initial.minLevel != null ? String(initial.minLevel) : '',
          maxLevel: initial.maxLevel != null ? String(initial.maxLevel) : '',
          reorderLevel: initial.reorderLevel != null ? String(initial.reorderLevel) : '',
        }
      : EMPTY_FORM,
  )

  const field = (k: keyof MaterialForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF(v => ({ ...v, [k]: e.target.value }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="card-3d w-full max-w-2xl overflow-y-auto rounded-2xl p-6 max-h-[90vh]" style={{ background: 'var(--card-bg)' }}>
        <h2 className="mb-5 text-lg font-bold">{initial ? 'تعديل مادة' : 'إضافة مادة جديدة'}</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-400">الكود *</label>
            <input className="input w-full" value={f.code} onChange={field('code')} placeholder="مثال: SUGAR-KG" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-400">الاسم بالعربي *</label>
            <input className="input w-full" value={f.nameAr} onChange={field('nameAr')} placeholder="مثال: سكر" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-400">الاسم بالإنجليزي</label>
            <input className="input w-full" value={f.nameEn} onChange={field('nameEn')} placeholder="e.g. Sugar" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-400">الفئة</label>
            <select className="input w-full" value={f.categoryId} onChange={field('categoryId')}>
              <option value="">— بدون فئة —</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-400">وحدة التخزين *</label>
            <input className="input w-full" value={f.storageUnit} onChange={field('storageUnit')} placeholder="مثال: كرتون" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-400">وحدة المكون *</label>
            <input className="input w-full" value={f.componentUnit} onChange={field('componentUnit')} placeholder="مثال: قطعة" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-400">معامل التحويل *</label>
            <input type="number" className="input w-full" value={f.conversionFactor} onChange={field('conversionFactor')} min="0.001" step="0.001" />
            <p className="mt-1 text-xs text-gray-500">عدد المكونات في وحدة التخزين الواحدة</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-400">طريقة احتساب التكلفة *</label>
            <select className="input w-full" value={f.costMethod} onChange={field('costMethod')}>
              <option value="1">آخر شراء</option>
              <option value="2">متوسط مرجح</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-400">التكلفة الحالية (ريال)</label>
            <input type="number" className="input w-full" value={f.initialCost} onChange={field('initialCost')} min="0" step="0.01" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-400">الحد الأدنى للطلب</label>
            <input type="number" className="input w-full" value={f.reorderLevel} onChange={field('reorderLevel')} min="0" step="0.01" placeholder="اتركه فارغاً لتعطيل التنبيه" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-400">الحد الأدنى للمخزون</label>
            <input type="number" className="input w-full" value={f.minLevel} onChange={field('minLevel')} min="0" step="0.01" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-400">الحد الأقصى للمخزون</label>
            <input type="number" className="input w-full" value={f.maxLevel} onChange={field('maxLevel')} min="0" step="0.01" />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button className="btn-ghost px-4 py-2 rounded-lg" onClick={onClose} disabled={saving}>إلغاء</button>
          <button
            className="btn-primary px-5 py-2 rounded-lg disabled:opacity-50"
            onClick={() => onSave(toPayload(f))}
            disabled={saving || !f.code || !f.nameAr || !f.storageUnit || !f.componentUnit}
          >
            {saving ? 'جاري الحفظ…' : 'حفظ'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function StockMaterialsPage() {
  const { tenantId } = useAuthStore()
  const qc = useQueryClient()
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showAddMat, setShowAddMat] = useState(false)
  const [editMat, setEditMat] = useState<StockMaterialResponse | null>(null)
  const [showAddCat, setShowAddCat] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [lowStockOnly, setLowStockOnly] = useState(false)

  const { data: catResp } = useQuery({
    queryKey: ['stock-material-categories', tenantId],
    queryFn: () => stockMaterialApi.listCategories(tenantId!),
    enabled: !!tenantId,
  })
  const categories: StockMaterialCategoryResponse[] = catResp?.data ?? []

  const { data: matResp, isLoading } = useQuery({
    queryKey: ['stock-materials', tenantId, selectedCatId, lowStockOnly, search],
    queryFn: () =>
      stockMaterialApi.listMaterials(tenantId!, {
        categoryId: selectedCatId ?? undefined,
        lowStockOnly,
        search: search || undefined,
      }),
    enabled: !!tenantId,
  })
  const materials: StockMaterialResponse[] = matResp?.data ?? []

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['stock-materials', tenantId] })
  }

  const createCatMut = useMutation({
    mutationFn: (name: string) => stockMaterialApi.createCategory(tenantId!, { name }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['stock-material-categories', tenantId] })
      setShowAddCat(false)
      setNewCatName('')
    },
  })

  const createMatMut = useMutation({
    mutationFn: (payload: CreateStockMaterialPayload) =>
      stockMaterialApi.createMaterial(tenantId!, payload),
    onSuccess: () => {
      invalidate()
      setShowAddMat(false)
    },
  })

  const updateMatMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateStockMaterialPayload }) =>
      stockMaterialApi.updateMaterial(tenantId!, id, payload),
    onSuccess: () => {
      invalidate()
      setEditMat(null)
    },
  })

  const deleteMatMut = useMutation({
    mutationFn: (id: string) => stockMaterialApi.deleteMaterial(tenantId!, id),
    onSuccess: () => invalidate(),
  })

  const lowCount = materials.filter(m => m.isLowStock).length

  return (
    <div className="flex h-full flex-col gap-5 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <FlaskConical className="h-6 w-6" style={{ color: 'var(--accent)' }} />
          <div>
            <h1 className="text-xl font-bold">مواد المخزون</h1>
            <p className="text-sm text-gray-400">المواد الخام والمكونات</p>
          </div>
          {lowCount > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              {lowCount} تحت حد الطلب
            </span>
          )}
        </div>
        <button
          className="btn-primary flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium"
          onClick={() => setShowAddMat(true)}
        >
          <Plus className="h-4 w-4" />
          مادة جديدة
        </button>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* Sidebar — Categories */}
        <aside className="card-3d flex w-52 shrink-0 flex-col rounded-2xl p-4" style={{ background: 'var(--card-bg)' }}>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold">الفئات</span>
            <button
              className="rounded-lg p-1 hover:bg-white/10"
              onClick={() => setShowAddCat(v => !v)}
              title="إضافة فئة"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {showAddCat && (
            <div className="mb-3 flex flex-col gap-1">
              <input
                className="input text-sm"
                placeholder="اسم الفئة"
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                autoFocus
              />
              <button
                className="btn-primary rounded-lg py-1 text-xs"
                onClick={() => newCatName.trim() && createCatMut.mutate(newCatName.trim())}
                disabled={createCatMut.isPending}
              >
                {createCatMut.isPending ? '…' : 'إضافة'}
              </button>
            </div>
          )}

          <ul className="flex-1 space-y-1 overflow-y-auto">
            <li>
              <button
                className={`w-full rounded-lg px-3 py-2 text-start text-sm transition-colors ${selectedCatId === null ? 'text-white font-semibold' : 'text-gray-400 hover:text-white'}`}
                style={selectedCatId === null ? { background: 'color-mix(in srgb, var(--accent) 15%, transparent)' } : undefined}
                onClick={() => setSelectedCatId(null)}
              >
                الكل
              </button>
            </li>
            {categories.map(cat => (
              <li key={cat.id}>
                <button
                  className={`w-full rounded-lg px-3 py-2 text-start text-sm transition-colors ${selectedCatId === cat.id ? 'text-white font-semibold' : 'text-gray-400 hover:text-white'}`}
                  style={selectedCatId === cat.id ? { background: 'color-mix(in srgb, var(--accent) 15%, transparent)' } : undefined}
                  onClick={() => setSelectedCatId(cat.id)}
                >
                  {cat.name}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Main — Materials Table */}
        <div className="flex flex-1 flex-col gap-3 overflow-hidden">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <input
              className="input w-64 text-sm"
              placeholder="بحث بالاسم أو الكود…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="accent-amber-400"
                checked={lowStockOnly}
                onChange={e => setLowStockOnly(e.target.checked)}
              />
              <span className="text-gray-400">أقل من حد الطلب فقط</span>
            </label>
            <span className="text-xs text-gray-500">{materials.length} مادة</span>
          </div>

          {/* Table */}
          <div className="card-3d flex-1 overflow-auto rounded-2xl" style={{ background: 'var(--card-bg)' }}>
            {isLoading ? (
              <div className="flex h-full items-center justify-center text-gray-400">جاري التحميل…</div>
            ) : materials.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-gray-400">
                <FlaskConical className="h-12 w-12 opacity-25" />
                <p>لا توجد مواد مخزون بعد</p>
                <button
                  className="btn-primary rounded-xl px-5 py-2 text-sm"
                  onClick={() => setShowAddMat(true)}
                >
                  أضف أول مادة
                </button>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-start text-xs text-gray-500" style={{ borderColor: 'var(--card-border)' }}>
                    <th className="px-4 py-3 text-start font-medium">الكود</th>
                    <th className="px-4 py-3 text-start font-medium">الاسم</th>
                    <th className="px-4 py-3 text-start font-medium">الفئة</th>
                    <th className="px-4 py-3 text-start font-medium">الوحدة</th>
                    <th className="px-4 py-3 text-start font-medium">التحويل</th>
                    <th className="px-4 py-3 text-start font-medium">الكمية</th>
                    <th className="px-4 py-3 text-start font-medium">التكلفة</th>
                    <th className="px-4 py-3 text-start font-medium">الطريقة</th>
                    <th className="px-4 py-3 text-end font-medium">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {materials.map(m => (
                    <tr
                      key={m.id}
                      className={`border-b transition-colors ${m.isLowStock ? 'bg-amber-500/5' : ''}`}
                      style={{ borderColor: 'var(--card-border)' }}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-gray-300">{m.code}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {m.isLowStock && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />}
                          <div>
                            <p className="font-medium">{m.nameAr}</p>
                            {m.nameEn && <p className="text-xs text-gray-500">{m.nameEn}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-400">{m.categoryName ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-300">
                        <span>{m.storageUnit}</span>
                        <span className="mx-1 text-gray-600">/</span>
                        <span className="text-gray-400">{m.componentUnit}</span>
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {m.conversionFactor.toLocaleString()} {m.componentUnit} / {m.storageUnit}
                      </td>
                      <td className={`px-4 py-3 tabular-nums font-semibold ${m.isLowStock ? 'text-amber-400' : ''}`}>
                        {m.currentQuantityInStorageUnits.toLocaleString()} {m.storageUnit}
                        {m.reorderLevel != null && (
                          <span className="ms-1 text-xs text-gray-500">/ {m.reorderLevel}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {m.currentCost.toFixed(2)} ريال
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {COST_METHOD_LABELS[m.costMethod] ?? m.costMethod}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            className="rounded-lg p-1.5 text-gray-400 hover:text-white"
                            onClick={() => setEditMat(m)}
                            title="تعديل"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            className="rounded-lg p-1.5 text-gray-400 hover:text-red-400"
                            onClick={() => {
                              if (confirm(`حذف "${m.nameAr}"؟`)) {
                                deleteMatMut.mutate(m.id)
                              }
                            }}
                            title="حذف"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Add Material Modal */}
      {showAddMat && (
        <MaterialModal
          categories={categories}
          onSave={p => createMatMut.mutate(p)}
          onClose={() => setShowAddMat(false)}
          saving={createMatMut.isPending}
        />
      )}

      {/* Edit Material Modal */}
      {editMat && (
        <MaterialModal
          categories={categories}
          initial={editMat}
          onSave={p => updateMatMut.mutate({ id: editMat.id, payload: p as UpdateStockMaterialPayload })}
          onClose={() => setEditMat(null)}
          saving={updateMatMut.isPending}
        />
      )}
    </div>
  )
}
