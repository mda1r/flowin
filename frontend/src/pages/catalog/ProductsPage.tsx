import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, ChevronDown, ChevronUp, Pencil, Trash2, FlaskConical, ScanBarcode, Power } from 'lucide-react'
import { recipesApi } from '@/api/recipes'
import { RecipeModal } from './RecipeModal'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Modal, ConfirmModal } from '@/components/ui/Modal'
import { Card } from '@/components/ui/Card'
import { catalogApi } from '@/api/catalog'
import { inventoryApi } from '@/api/inventory'
import { useAuthStore } from '@/stores/authStore'
import { toast } from '@/components/ui/Toast'
import { marginPercent } from '@/lib/pricing'
import { apiErrorMessage } from '@/lib/apiError'
import { formatCurrency } from '@/lib/utils'
import { useI18n } from '@/i18n'
import type { ProductResponse, ProductVariantResponse } from '@/types/api'

type CategoryFormData = { name: string; description?: string }
type CreateFormData = {
  name: string
  sku: string
  barcode?: string
  variantName: string
  description?: string
  costPrice: number
  salePrice: number
  currency: string
  categoryId?: string
  trackInventory: boolean
  unitType: string
  initialQuantity: number
  expiryDate?: string
}
type EditProductFormData = { name: string; description?: string; categoryId?: string; trackInventory: boolean; unitType: string }
type EditVariantFormData = { name: string; sku: string; barcode?: string; costPrice: number; salePrice: number; currency: string }
type AddVariantFormData = EditVariantFormData & { initialQuantity: number; expiryDate?: string }

const randomSku = () => Math.random().toString(36).slice(2, 8).toUpperCase()

// USB scanners type the code then press Enter; keep that Enter from doing anything else in the form.
const swallowEnter = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') e.preventDefault() }

export function ProductsPage() {
  const [search, setSearch] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ProductResponse | null>(null)
  const [editingVariant, setEditingVariant] = useState<{ productId: string; variant: ProductVariantResponse } | null>(null)
  const [addingVariantTo, setAddingVariantTo] = useState<ProductResponse | null>(null)
  const [deactivatingProductId, setDeactivatingProductId] = useState<string | null>(null)
  const [deactivatingVariant, setDeactivatingVariant] = useState<{ productId: string; variant: ProductVariantResponse } | null>(null)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const { branchId, tenantId, user } = useAuthStore()
  // Catalog writes are Owner/Manager-only on the server; cashiers get a read-only list.
  const canManage = user?.role === 'Owner' || user?.role === 'Manager'
  const qc = useQueryClient()
  const { t } = useI18n()
  const [recipeVariant, setRecipeVariant] = useState<{ id: string; name: string; salePrice: number; currency: string } | null>(null)
  const { data: recipeSummaries } = useQuery({
    queryKey: ['recipe-summaries', tenantId],
    queryFn: () => recipesApi.listSummaries(tenantId!),
    enabled: !!tenantId,
  })
  const recipeByVariant = new Map((recipeSummaries?.data ?? []).map((r) => [r.variantId, r]))

  const categorySchema = z.object({
    name: z.string().min(1, t.products.nameRequired),
    description: z.string().optional(),
  })

  const createSchema = z.object({
    name: z.string().min(1, t.products.nameRequired),
    sku: z.string().trim().min(1, 'الرمز مطلوب').max(64),
    barcode: z.string().trim().max(64).optional(),
    variantName: z.string().min(1, t.products.variantNameRequired),
    description: z.string().optional(),
    costPrice: z.coerce.number().nonnegative(),
    salePrice: z.coerce.number().positive(t.products.pricePositive),
    currency: z.string().length(3),
    categoryId: z.string().optional(),
    trackInventory: z.boolean().default(true),
    unitType: z.string().default('Piece'),
    initialQuantity: z.coerce.number().nonnegative().default(0),
    expiryDate: z.string().optional(),
  })

  const editProductSchema = z.object({
    name: z.string().min(1, t.products.nameRequired),
    description: z.string().optional(),
    categoryId: z.string().optional(),
    trackInventory: z.boolean().default(true),
    unitType: z.string().default('Piece'),
  })

  const editVariantSchema = z.object({
    name: z.string().min(1, t.products.variantNameRequired),
    sku: z.string().trim().min(1, 'الرمز مطلوب').max(64),
    barcode: z.string().trim().max(64).optional(),
    costPrice: z.coerce.number().nonnegative(),
    salePrice: z.coerce.number().positive(t.products.pricePositive),
    currency: z.string().length(3),
  })

  const addVariantSchema = editVariantSchema.extend({
    initialQuantity: z.coerce.number().nonnegative().default(0),
    expiryDate: z.string().optional(),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['products', tenantId, search],
    queryFn: () => catalogApi.listProducts(tenantId!, { search: search || undefined }),
    enabled: !!tenantId,
  })

  const { data: categories } = useQuery({
    queryKey: ['categories', tenantId],
    queryFn: () => catalogApi.listCategories(),
  })

  const createForm = useForm<CreateFormData>({
    resolver: zodResolver(createSchema),
    defaultValues: { currency: 'SAR', variantName: 'افتراضي', trackInventory: true, unitType: 'Piece' },
  })

  const categoryForm = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
  })

  const editProductForm = useForm<EditProductFormData>({
    resolver: zodResolver(editProductSchema),
  })

  const editVariantForm = useForm<EditVariantFormData>({
    resolver: zodResolver(editVariantSchema),
    defaultValues: { currency: 'SAR' },
  })

  const addVariantForm = useForm<AddVariantFormData>({
    resolver: zodResolver(addVariantSchema),
    defaultValues: { currency: 'SAR' },
  })

  // Opens the variant's stock record in the active branch and records the opening quantity/expiry.
  const initStock = async (variantId: string, quantity: number, expiryDate?: string) => {
    if (!branchId) return
    try {
      const stockRes = await inventoryApi.initializeStock(branchId, variantId)
      // Recorded as a receipt so any role that can create products can set it (adjust is manager-only).
      // An expiry date without stock is not tracked, so it only goes in with a quantity.
      if (quantity > 0) {
        await inventoryApi.receiveStock(branchId, stockRes.data.id, {
          quantity,
          expiryDate: expiryDate ? expiryDate + 'T00:00:00Z' : null,
          notes: 'كمية أولية عند إنشاء المنتج',
        })
      }
    } catch {
      toast.error('تحذير', 'تم الحفظ لكن فشل تسجيل الكمية الأولية — راجع المخزون')
    }
  }

  const create = useMutation({
    mutationFn: async (data: CreateFormData) => {
      const result = await catalogApi.createProduct(tenantId!, {
        name: data.name,
        description: data.description,
        categoryId: data.categoryId || undefined,
        type: 'Standard',
        taxClass: 'Standard',
        trackInventory: data.trackInventory,
        unitType: data.unitType,
        sku: data.sku,
        barcode: data.barcode || undefined,
        variantName: data.variantName,
        costPrice: data.costPrice,
        salePrice: data.salePrice,
        currency: data.currency,
      })
      if (data.trackInventory) {
        for (const variant of result.data.variants) {
          await initStock(variant.id, data.initialQuantity, data.expiryDate)
        }
      }
      return result
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['stock', branchId] })
      setShowCreateModal(false)
      createForm.reset()
      toast.success(t.products.created)
    },
    onError: (err: unknown) => {
      toast.error(t.products.failed, apiErrorMessage(err, 'تحقق من البيانات'))
    },
  })

  const updateProduct = useMutation({
    mutationFn: (data: EditProductFormData) =>
      catalogApi.updateProduct(editingProduct!.id, {
        name: data.name,
        description: data.description,
        categoryId: data.categoryId || undefined,
        // Not editable here: send the stored values back so an edit never resets them.
        taxClass: editingProduct!.taxClass,
        imageUrl: editingProduct!.imageUrl,
        trackInventory: data.trackInventory,
        unitType: data.unitType,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      setEditingProduct(null)
      toast.success('تم تحديث المنتج')
    },
    onError: (err: unknown) => toast.error('فشل تحديث المنتج', apiErrorMessage(err)),
  })

  const updateVariant = useMutation({
    mutationFn: (data: EditVariantFormData) =>
      catalogApi.updateVariant(editingVariant!.productId, editingVariant!.variant.id, {
        name: data.name,
        sku: data.sku,
        // An empty string clears the barcode on the server; omitting it would keep the old one.
        barcode: data.barcode ?? '',
        costPrice: data.costPrice,
        salePrice: data.salePrice,
        currency: data.currency,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      setEditingVariant(null)
      toast.success('تم تحديث النوع')
    },
    onError: (err: unknown) => toast.error('فشل تحديث النوع', apiErrorMessage(err)),
  })

  const addVariant = useMutation({
    mutationFn: async (data: AddVariantFormData) => {
      const product = addingVariantTo!
      const result = await catalogApi.addVariant(product.id, {
        name: data.name,
        sku: data.sku,
        barcode: data.barcode || undefined,
        costPrice: data.costPrice,
        salePrice: data.salePrice,
        currency: data.currency,
      })
      if (product.trackInventory) {
        await initStock(result.data.id, data.initialQuantity, data.expiryDate)
      }
      return result
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['stock', branchId] })
      setAddingVariantTo(null)
      toast.success('تمت إضافة النوع')
    },
    onError: (err: unknown) => toast.error('فشل إضافة النوع', apiErrorMessage(err)),
  })

  const toggleVariant = useMutation({
    mutationFn: ({ productId, variant }: { productId: string; variant: ProductVariantResponse }) =>
      catalogApi.setVariantStatus(productId, variant.id, !variant.isActive),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['products'] })
      setDeactivatingVariant(null)
      toast.success(res.data.isActive ? 'تم تفعيل النوع' : 'تم إيقاف النوع')
    },
    onError: (err: unknown) => toast.error('تعذّر تغيير حالة النوع', apiErrorMessage(err)),
  })

  const createCategory = useMutation({
    mutationFn: (data: CategoryFormData) => catalogApi.createCategory(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] })
      setShowCategoryModal(false)
      categoryForm.reset()
      toast.success(t.products.categoryCreated)
    },
    onError: (err: unknown) => toast.error(t.products.categoryFailed, apiErrorMessage(err)),
  })

  const deactivate = useMutation({
    mutationFn: (productId: string) => catalogApi.deactivateProduct(productId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      setDeactivatingProductId(null)
      toast.success(t.products.deleted)
    },
    onError: (err: unknown) => toast.error(t.products.deleteFailed, apiErrorMessage(err)),
  })

  const openEdit = (product: ProductResponse) => {
    editProductForm.reset({
      name: product.name,
      description: product.description ?? '',
      categoryId: product.categoryId ?? '',
      trackInventory: product.trackInventory,
      unitType: product.unitType ?? 'Piece',
    })
    setEditingProduct(product)
  }

  const openEditVariant = (productId: string, variant: ProductVariantResponse) => {
    editVariantForm.reset({
      name: variant.name,
      sku: variant.sku,
      barcode: variant.barcode ?? '',
      costPrice: variant.costPrice,
      salePrice: variant.salePrice,
      currency: variant.currency,
    })
    setEditingVariant({ productId, variant })
  }

  const openAddVariant = (product: ProductResponse) => {
    const base = product.variants[0]
    addVariantForm.reset({
      name: '',
      sku: randomSku(),
      barcode: '',
      costPrice: base?.costPrice ?? 0,
      salePrice: base?.salePrice ?? 0,
      currency: base?.currency ?? 'SAR',
      initialQuantity: 0,
      expiryDate: '',
    })
    setAddingVariantTo(product)
  }

  const _raw = data?.data
  const products: ProductResponse[] = Array.isArray(_raw) ? _raw : ((_raw as any)?.items ?? [])

  return (
    <div className="page-fade" dir="rtl">
      <PageHeader
        title={t.products.title}
        description={t.products.subtitle}
        action={canManage && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => { categoryForm.reset(); setShowCategoryModal(true) }}>
              <Plus className="h-4 w-4" />
              {t.products.newCategory}
            </Button>
            <Button onClick={() => {
              createForm.reset({
                currency: 'SAR',
                variantName: 'افتراضي',
                trackInventory: true,
                sku: randomSku(),
              })
              setShowCreateModal(true)
            }}>
              <Plus className="h-4 w-4" />
              {t.products.addProduct}
            </Button>
          </div>
        )}
      />
      <div className="p-6">
        <Card>
          <div className="flex items-center gap-3 border-b border-border p-4" dir="rtl">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute end-3 top-2.5 h-4 w-4 text-muted" />
              <input
                type="text"
                placeholder={t.products.searchProducts}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input pe-9"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="skeleton h-14" style={{ animationDelay: `${i * 80}ms` }} />
              ))}
            </div>
          ) : products.length === 0 ? (
            <p className="p-10 text-center text-sm text-muted">{t.products.noProducts}</p>
          ) : (
            <div className="divide-y divide-border">
              {products.map((product) => {
                const firstVariant = product.variants[0]
                const isExpanded = expanded === product.id
                return (
                  <div key={product.id}>
                    <div className="row-hover flex w-full items-center gap-4 px-4 py-3">
                      <button
                        onClick={() => setExpanded(isExpanded ? null : product.id)}
                        className="flex flex-1 items-center gap-4 text-left"
                      >
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-lg text-lg"
                          style={{ background: 'color-mix(in srgb, var(--accent) 12%, transparent)' }}
                        >
                          {product.name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-fg">{product.name}</p>
                            {product.unitType && product.unitType !== 'Piece' && (
                              <span className="shrink-0 rounded-md bg-info/10 px-2 py-0.5 text-xs font-medium text-info">
                                {({'Kilogram':'كيلو','Gram':'جرام','Liter':'لتر','Milliliter':'مللي','Meter':'متر','Box':'صندوق'} as Record<string, string>)[product.unitType] ?? product.unitType}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted">{product.description ?? '—'}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          {firstVariant && (
                            <span className="tabular-nums text-sm font-semibold text-fg">
                              {formatCurrency(firstVariant.salePrice, firstVariant.currency)}
                            </span>
                          )}
                          <Badge variant={product.isActive ? 'green' : 'gray'}>
                            {product.isActive ? t.products.active : t.products.inactive}
                          </Badge>
                          <span className="text-xs text-muted">
                            {product.variants.length} {t.products.variants}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted" />
                          )}
                        </div>
                      </button>
                      {canManage && <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEdit(product)}
                          title={t.common.edit}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {product.isActive && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeactivatingProductId(product.id)}
                            title={t.common.delete}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-danger" />
                          </Button>
                        )}
                      </div>}
                    </div>

                    {isExpanded && (
                      <div className="border-t border-border bg-surface-2 px-4 py-3">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted">
                            {t.products.variants}
                          </p>
                          {canManage && product.isActive && (
                            <Button size="sm" variant="secondary" onClick={() => openAddVariant(product)}>
                              <Plus className="h-3.5 w-3.5" />
                              {t.products.addVariant}
                            </Button>
                          )}
                        </div>
                        <div className="space-y-2">
                          {product.variants.map((v) => (
                            <div
                              key={v.id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                            >
                              <div className="flex flex-wrap items-center gap-x-2">
                                <span className="font-medium text-fg">
                                  {v.name}
                                </span>
                                <span className="text-xs text-muted" dir="ltr">{v.sku}</span>
                                {v.barcode && (
                                  <span className="inline-flex items-center gap-1 text-xs tabular-nums text-muted" title={t.products.barcode}>
                                    <ScanBarcode className="h-3 w-3" />
                                    <span dir="ltr">{v.barcode}</span>
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                                <span className="text-xs text-muted">
                                  {t.products.costPrice}: {formatCurrency(v.costPrice, v.currency)}
                                </span>
                                <span className="font-semibold text-info">
                                  {formatCurrency(v.salePrice, v.currency)}
                                </span>
                                {recipeByVariant.get(v.id) && (
                                  <span className="text-xs tabular-nums text-muted">
                                    تكلفة الوصفة {recipeByVariant.get(v.id)!.totalCost.toFixed(2)} ر.س
                                    {v.salePrice > 0 && (
                                      <span className="ms-1">
                                        · هامش {marginPercent(v.salePrice, recipeByVariant.get(v.id)!.totalCost)!.toFixed(0)}%
                                      </span>
                                    )}
                                  </span>
                                )}
                                <Badge variant={v.isActive ? 'green' : 'gray'} className="text-xs">
                                  {v.isActive ? t.products.active : t.products.inactive}
                                </Badge>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => setRecipeVariant({ id: v.id, name: `${product.name} - ${v.name}`, salePrice: v.salePrice, currency: v.currency })}
                                  aria-label={`وصفة ${v.name}`}
                                >
                                  <FlaskConical className="h-3.5 w-3.5" />
                                  {recipeByVariant.get(v.id) ? 'الوصفة' : 'إضافة وصفة'}
                                </Button>
                                {canManage && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => openEditVariant(product.id, v)}
                                    title={t.common.edit}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                )}
                                {canManage && product.isActive && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() =>
                                      // Switching off pulls the variant from the POS, so it asks first; switching on is one tap.
                                      v.isActive
                                        ? setDeactivatingVariant({ productId: product.id, variant: v })
                                        : toggleVariant.mutate({ productId: product.id, variant: v })
                                    }
                                    disabled={toggleVariant.isPending}
                                    title={v.isActive ? 'إيقاف النوع' : 'تفعيل النوع'}
                                    aria-label={v.isActive ? `إيقاف ${v.name}` : `تفعيل ${v.name}`}
                                  >
                                    <Power className={v.isActive ? 'h-3 w-3 text-danger' : 'h-3 w-3 text-success'} />
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      {recipeVariant && <RecipeModal variant={recipeVariant} onClose={() => setRecipeVariant(null)} />}

      {/* Create modal */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={t.products.newProduct}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>{t.common.cancel}</Button>
            <Button loading={create.isPending} onClick={createForm.handleSubmit((d) => create.mutate(d))}>
              {t.common.add}
            </Button>
          </>
        }
      >
        <form className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label={t.products.name} error={createForm.formState.errors.name?.message} {...createForm.register('name')} />
            <Select label={t.products.category} {...createForm.register('categoryId')}>
              <option value="">{t.products.noCategory}</option>
              {categories?.data?.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
          <Input label={t.products.description} {...createForm.register('description')} />
          <div className="grid grid-cols-2 gap-4">
            <Input label={t.products.sku} dir="ltr" error={createForm.formState.errors.sku?.message} {...createForm.register('sku')} />
            <Input label={t.products.variantName} error={createForm.formState.errors.variantName?.message} {...createForm.register('variantName')} />
          </div>
          <Input
            label={t.products.barcode}
            dir="ltr"
            inputMode="numeric"
            autoComplete="off"
            placeholder="امسح الباركود أو اكتبه"
            hint="اختياري، للبيع بالماسح"
            onKeyDown={swallowEnter}
            error={createForm.formState.errors.barcode?.message}
            {...createForm.register('barcode')}
          />
          <div className="grid grid-cols-3 gap-4">
            <Input label={t.products.costPrice} type="number" step="0.01" min="0" error={createForm.formState.errors.costPrice?.message} {...createForm.register('costPrice')} />
            <Input label={t.products.salePrice} hint="شامل الضريبة" type="number" step="0.01" min="0" error={createForm.formState.errors.salePrice?.message} {...createForm.register('salePrice')} />
            <Input label={t.products.currency} maxLength={3} placeholder="SAR" error={createForm.formState.errors.currency?.message} {...createForm.register('currency')} />
          </div>
          <Select label="وحدة القياس" {...createForm.register('unitType')}>
            <option value="Piece">عدد (قطعة)</option>
            <option value="Kilogram">كيلوجرام (كغ)</option>
            <option value="Gram">جرام (جم)</option>
            <option value="Liter">لتر (ل)</option>
            <option value="Milliliter">مللي لتر (مل)</option>
            <option value="Meter">متر (م)</option>
            <option value="Box">صندوق</option>
          </Select>
          <label className="flex items-center gap-2 text-sm text-fg">
            <input type="checkbox" {...createForm.register('trackInventory')} className="rounded" />
            {t.products.trackInventory}
          </label>
          {createForm.watch('trackInventory') && (
            <div className="grid grid-cols-2 gap-4 rounded-xl border border-info/30 bg-info/10 p-3">
              <Input
                label="الكمية الأولية"
                type="number"
                min="0"
                step="1"
                placeholder="0"
                {...createForm.register('initialQuantity')}
              />
              <Input
                id="create-expiry-date"
                label="تاريخ الانتهاء (اختياري)"
                type="date"
                {...createForm.register('expiryDate')}
              />
            </div>
          )}
        </form>
      </Modal>

      {/* Edit product modal */}
      <Modal
        open={!!editingProduct}
        onClose={() => setEditingProduct(null)}
        title={t.products.editProduct}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditingProduct(null)}>{t.common.cancel}</Button>
            <Button loading={updateProduct.isPending} onClick={editProductForm.handleSubmit((d) => updateProduct.mutate(d))}>
              {t.common.save}
            </Button>
          </>
        }
      >
        <form className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label={t.products.name} error={editProductForm.formState.errors.name?.message} {...editProductForm.register('name')} />
            <Select label={t.products.category} {...editProductForm.register('categoryId')}>
              <option value="">{t.products.noCategory}</option>
              {categories?.data?.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
          <Input label={t.products.description} {...editProductForm.register('description')} />
          <Select label="وحدة القياس" {...editProductForm.register('unitType')}>
            <option value="Piece">عدد (قطعة)</option>
            <option value="Kilogram">كيلوجرام (كغ)</option>
            <option value="Gram">جرام (جم)</option>
            <option value="Liter">لتر (ل)</option>
            <option value="Milliliter">مللي لتر (مل)</option>
            <option value="Meter">متر (م)</option>
            <option value="Box">صندوق</option>
          </Select>
          <label className="flex items-center gap-2 text-sm text-fg">
            <input type="checkbox" {...editProductForm.register('trackInventory')} className="rounded" />
            {t.products.trackInventory}
          </label>
        </form>
      </Modal>

      {/* Edit variant modal */}
      <Modal
        open={!!editingVariant}
        onClose={() => setEditingVariant(null)}
        title="تعديل النوع"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditingVariant(null)}>{t.common.cancel}</Button>
            <Button loading={updateVariant.isPending} onClick={editVariantForm.handleSubmit((d) => updateVariant.mutate(d))}>
              {t.common.save}
            </Button>
          </>
        }
      >
        <form className="space-y-4">
          <Input label={t.products.variantName} error={editVariantForm.formState.errors.name?.message} {...editVariantForm.register('name')} />
          <div className="grid grid-cols-2 gap-4">
            <Input label={t.products.sku} dir="ltr" error={editVariantForm.formState.errors.sku?.message} {...editVariantForm.register('sku')} />
            <Input
              label={t.products.barcode}
              dir="ltr"
              inputMode="numeric"
              autoComplete="off"
              placeholder="امسح الباركود أو اكتبه"
              onKeyDown={swallowEnter}
              error={editVariantForm.formState.errors.barcode?.message}
              {...editVariantForm.register('barcode')}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label={t.products.costPrice} type="number" step="0.01" min="0" error={editVariantForm.formState.errors.costPrice?.message} {...editVariantForm.register('costPrice')} />
            <Input label={t.products.salePrice} hint="شامل الضريبة" type="number" step="0.01" min="0" error={editVariantForm.formState.errors.salePrice?.message} {...editVariantForm.register('salePrice')} />
            <Input label={t.products.currency} maxLength={3} error={editVariantForm.formState.errors.currency?.message} {...editVariantForm.register('currency')} />
          </div>
        </form>
      </Modal>

      {/* Add variant modal */}
      <Modal
        open={!!addingVariantTo}
        onClose={() => setAddingVariantTo(null)}
        title={addingVariantTo ? `${t.products.addVariant} — ${addingVariantTo.name}` : t.products.addVariant}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddingVariantTo(null)}>{t.common.cancel}</Button>
            <Button loading={addVariant.isPending} onClick={addVariantForm.handleSubmit((d) => addVariant.mutate(d))}>
              {t.common.add}
            </Button>
          </>
        }
      >
        <form className="space-y-4">
          <Input
            label={t.products.variantName}
            placeholder="مثال: كبير، 500 مل، أحمر"
            error={addVariantForm.formState.errors.name?.message}
            {...addVariantForm.register('name')}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input label={t.products.sku} dir="ltr" error={addVariantForm.formState.errors.sku?.message} {...addVariantForm.register('sku')} />
            <Input
              label={t.products.barcode}
              dir="ltr"
              inputMode="numeric"
              autoComplete="off"
              placeholder="امسح الباركود أو اكتبه"
              onKeyDown={swallowEnter}
              error={addVariantForm.formState.errors.barcode?.message}
              {...addVariantForm.register('barcode')}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label={t.products.costPrice} type="number" step="0.01" min="0" error={addVariantForm.formState.errors.costPrice?.message} {...addVariantForm.register('costPrice')} />
            <Input label={t.products.salePrice} hint="شامل الضريبة" type="number" step="0.01" min="0" error={addVariantForm.formState.errors.salePrice?.message} {...addVariantForm.register('salePrice')} />
            <Input label={t.products.currency} maxLength={3} error={addVariantForm.formState.errors.currency?.message} {...addVariantForm.register('currency')} />
          </div>
          {addingVariantTo?.trackInventory && (
            <div className="grid grid-cols-2 gap-4 rounded-xl border border-info/30 bg-info/10 p-3">
              <Input
                label="الكمية الأولية"
                type="number"
                min="0"
                step="1"
                placeholder="0"
                {...addVariantForm.register('initialQuantity')}
              />
              <Input
                id="add-variant-expiry-date"
                label="تاريخ الانتهاء (اختياري)"
                type="date"
                {...addVariantForm.register('expiryDate')}
              />
            </div>
          )}
        </form>
      </Modal>

      {/* Category creation modal */}
      <Modal
        open={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        title={t.products.newCategory}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCategoryModal(false)}>{t.common.cancel}</Button>
            <Button loading={createCategory.isPending} onClick={categoryForm.handleSubmit((d) => createCategory.mutate(d))}>
              {t.common.add}
            </Button>
          </>
        }
      >
        <form className="space-y-4">
          <Input label={t.products.categoryName} error={categoryForm.formState.errors.name?.message} {...categoryForm.register('name')} />
          <Input label={t.products.description} {...categoryForm.register('description')} />
        </form>
      </Modal>

      {/* Deactivate confirm */}
      <ConfirmModal
        open={!!deactivatingProductId}
        onClose={() => setDeactivatingProductId(null)}
        onConfirm={() => { if (deactivatingProductId) { deactivate.mutate(deactivatingProductId) } }}
        title="إلغاء تفعيل المنتج"
        message={t.products.deleteConfirm}
        confirmLabel="إلغاء التفعيل"
        confirmVariant="danger"
        loading={deactivate.isPending}
      />

      {/* Deactivate variant confirm */}
      <ConfirmModal
        open={!!deactivatingVariant}
        onClose={() => setDeactivatingVariant(null)}
        onConfirm={() => { if (deactivatingVariant) { toggleVariant.mutate(deactivatingVariant) } }}
        title="إيقاف النوع"
        message={`إيقاف النوع «${deactivatingVariant?.variant.name ?? ''}»؟ لن يظهر في نقطة البيع.`}
        confirmLabel="إيقاف"
        confirmVariant="danger"
        loading={toggleVariant.isPending}
      />
    </div>
  )
}
