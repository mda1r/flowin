import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, ChevronDown, ChevronUp, Pencil, Trash2 } from 'lucide-react'
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
import { formatCurrency } from '@/lib/utils'
import { useI18n } from '@/i18n'
import type { ProductResponse, ProductVariantResponse } from '@/types/api'

type CategoryFormData = { name: string; description?: string }
type CreateFormData = {
  name: string
  sku: string
  variantName: string
  description?: string
  costPrice: number
  salePrice: number
  currency: string
  categoryId?: string
  trackInventory: boolean
  initialQuantity: number
  expiryDate?: string
}
type EditProductFormData = { name: string; description?: string; categoryId?: string; trackInventory: boolean }
type EditVariantFormData = { name: string; costPrice: number; salePrice: number; currency: string }

export function ProductsPage() {
  const [search, setSearch] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ProductResponse | null>(null)
  const [editingVariant, setEditingVariant] = useState<{ productId: string; variant: ProductVariantResponse } | null>(null)
  const [deactivatingProductId, setDeactivatingProductId] = useState<string | null>(null)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const { branchId, tenantId } = useAuthStore()
  const qc = useQueryClient()
  const { t } = useI18n()

  const categorySchema = z.object({
    name: z.string().min(1, t.products.nameRequired),
    description: z.string().optional(),
  })

  const createSchema = z.object({
    name: z.string().min(1, t.products.nameRequired),
    sku: z.string().min(1, t.products.nameRequired),
    variantName: z.string().min(1, t.products.variantNameRequired),
    description: z.string().optional(),
    costPrice: z.coerce.number().nonnegative(),
    salePrice: z.coerce.number().positive(t.products.pricePositive),
    currency: z.string().length(3),
    categoryId: z.string().optional(),
    trackInventory: z.boolean().default(true),
    initialQuantity: z.coerce.number().nonnegative().default(0),
    expiryDate: z.string().optional(),
  })

  const editProductSchema = z.object({
    name: z.string().min(1, t.products.nameRequired),
    description: z.string().optional(),
    categoryId: z.string().optional(),
    trackInventory: z.boolean().default(true),
  })

  const editVariantSchema = z.object({
    name: z.string().min(1, t.products.variantNameRequired),
    costPrice: z.coerce.number().nonnegative(),
    salePrice: z.coerce.number().positive(t.products.pricePositive),
    currency: z.string().length(3),
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
    defaultValues: { currency: 'SAR', variantName: 'افتراضي', trackInventory: true },
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

  const extractApiError = (err: unknown): string | null => {
    const response = (err as any)?.response
    const data = response?.data
    return data?.message
      ?? data?.title
      ?? (data?.errors ? JSON.stringify(data.errors) : null)
      ?? (typeof data === 'string' ? data : null)
      ?? (response ? `خطأ ${response.status}` : 'تحقق من اتصال الإنترنت')
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
        sku: data.sku,
        variantName: data.variantName,
        costPrice: data.costPrice,
        salePrice: data.salePrice,
        currency: data.currency,
      })
      if (data.trackInventory && branchId) {
        for (const variant of result.data.variants) {
          try {
            const stockRes = await inventoryApi.initializeStock(branchId, variant.id)
            const expiryIso = data.expiryDate ? data.expiryDate + 'T00:00:00Z' : null
            if (data.initialQuantity > 0 || expiryIso) {
              await inventoryApi.adjustStock(branchId, stockRes.data.id, {
                newQuantity: data.initialQuantity,
                expiryDate: expiryIso,
                notes: data.initialQuantity > 0 ? 'كمية أولية عند إنشاء المنتج' : undefined,
              })
            }
          } catch {
            toast.error('تحذير', 'تم إنشاء المنتج لكن فشل تسجيل الكمية الأولية — راجع المخزون')
          }
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
      toast.error(t.products.failed, extractApiError(err) ?? 'تحقق من البيانات')
    },
  })

  const updateProduct = useMutation({
    mutationFn: (data: EditProductFormData) =>
      catalogApi.updateProduct(editingProduct!.id, {
        name: data.name,
        description: data.description,
        categoryId: data.categoryId || undefined,
        taxClass: 'Standard',
        trackInventory: data.trackInventory,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      setEditingProduct(null)
      toast.success('تم تحديث المنتج')
    },
    onError: (err: unknown) => toast.error('فشل تحديث المنتج', extractApiError(err) ?? undefined),
  })

  const updateVariant = useMutation({
    mutationFn: (data: EditVariantFormData) =>
      catalogApi.updateVariant(editingVariant!.productId, editingVariant!.variant.id, {
        name: data.name,
        costPrice: data.costPrice,
        salePrice: data.salePrice,
        currency: data.currency,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      setEditingVariant(null)
      toast.success('تم تحديث النوع')
    },
    onError: (err: unknown) => toast.error('فشل تحديث النوع', extractApiError(err) ?? undefined),
  })

  const createCategory = useMutation({
    mutationFn: (data: CategoryFormData) => catalogApi.createCategory(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] })
      setShowCategoryModal(false)
      categoryForm.reset()
      toast.success(t.products.categoryCreated)
    },
    onError: (err: unknown) => toast.error(t.products.categoryFailed, extractApiError(err) ?? undefined),
  })

  const deactivate = useMutation({
    mutationFn: (productId: string) => catalogApi.deactivateProduct(productId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      setDeactivatingProductId(null)
      toast.success(t.products.deleted)
    },
    onError: () => toast.error(t.products.deleteFailed),
  })

  const openEdit = (product: ProductResponse) => {
    editProductForm.reset({
      name: product.name,
      description: product.description ?? '',
      categoryId: product.categoryId ?? '',
      trackInventory: product.trackInventory,
    })
    setEditingProduct(product)
  }

  const openEditVariant = (productId: string, variant: ProductVariantResponse) => {
    editVariantForm.reset({
      name: variant.name,
      costPrice: variant.costPrice,
      salePrice: variant.salePrice,
      currency: variant.currency,
    })
    setEditingVariant({ productId, variant })
  }

  const _raw = data?.data
  const products: ProductResponse[] = Array.isArray(_raw) ? _raw : ((_raw as any)?.items ?? [])

  return (
    <div className="page-fade" dir="rtl">
      <PageHeader
        title={t.products.title}
        description={t.products.subtitle}
        action={
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
                sku: Math.random().toString(36).slice(2, 8).toUpperCase(),
              })
              setShowCreateModal(true)
            }}>
              <Plus className="h-4 w-4" />
              {t.products.addProduct}
            </Button>
          </div>
        }
      />
      <div className="p-6">
        <Card>
          <div className="flex items-center gap-3 border-b border-gray-200 p-4 dark:border-gray-800" dir="rtl">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute end-3 top-2.5 h-4 w-4 text-gray-400" />
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
            <p className="p-10 text-center text-sm text-gray-400">{t.products.noProducts}</p>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
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
                          <p className="font-medium text-gray-900 dark:text-gray-100">{product.name}</p>
                          <p className="text-xs text-gray-500">{product.description ?? '—'}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          {firstVariant && (
                            <span className="tabular-nums text-sm font-semibold text-gray-700 dark:text-gray-300">
                              {formatCurrency(firstVariant.salePrice, firstVariant.currency)}
                            </span>
                          )}
                          <Badge variant={product.isActive ? 'green' : 'gray'}>
                            {product.isActive ? t.products.active : t.products.inactive}
                          </Badge>
                          <span className="text-xs text-gray-400">
                            {product.variants.length} {t.products.variants}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          )}
                        </div>
                      </button>
                      <div className="flex items-center gap-1 shrink-0">
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
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-800/50">
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                          {t.products.variants}
                        </p>
                        <div className="space-y-2">
                          {product.variants.map((v) => (
                            <div
                              key={v.id}
                              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                            >
                              <div>
                                <span className="font-medium text-gray-900 dark:text-gray-100">
                                  {v.name}
                                </span>
                                <span className="ml-2 text-xs text-gray-400">{v.sku}</span>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="text-xs text-gray-500">
                                  {t.products.costPrice}: {formatCurrency(v.costPrice, v.currency)}
                                </span>
                                <span className="font-semibold text-blue-600 dark:text-blue-400">
                                  {formatCurrency(v.salePrice, v.currency)}
                                </span>
                                <Badge variant={v.isActive ? 'green' : 'gray'} className="text-xs">
                                  {v.isActive ? t.products.active : t.products.inactive}
                                </Badge>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openEditVariant(product.id, v)}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
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
            <Input label={t.products.sku} error={createForm.formState.errors.sku?.message} {...createForm.register('sku')} />
            <Input label={t.products.variantName} error={createForm.formState.errors.variantName?.message} {...createForm.register('variantName')} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label={t.products.costPrice} type="number" step="0.01" min="0" error={createForm.formState.errors.costPrice?.message} {...createForm.register('costPrice')} />
            <Input label={t.products.salePrice} type="number" step="0.01" min="0" error={createForm.formState.errors.salePrice?.message} {...createForm.register('salePrice')} />
            <Input label={t.products.currency} maxLength={3} placeholder="SAR" error={createForm.formState.errors.currency?.message} {...createForm.register('currency')} />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" {...createForm.register('trackInventory')} className="rounded" />
            {t.products.trackInventory}
          </label>
          {createForm.watch('trackInventory') && (
            <div className="grid grid-cols-2 gap-4 rounded-xl border border-blue-100 bg-blue-50/50 p-3 dark:border-blue-900/30 dark:bg-blue-900/10">
              <Input
                label="الكمية الأولية"
                type="number"
                min="0"
                step="1"
                placeholder="0"
                {...createForm.register('initialQuantity')}
              />
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">تاريخ الانتهاء (اختياري)</label>
                <input
                  type="date"
                  {...createForm.register('expiryDate')}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
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
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
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
          <div className="grid grid-cols-3 gap-4">
            <Input label={t.products.costPrice} type="number" step="0.01" min="0" error={editVariantForm.formState.errors.costPrice?.message} {...editVariantForm.register('costPrice')} />
            <Input label={t.products.salePrice} type="number" step="0.01" min="0" error={editVariantForm.formState.errors.salePrice?.message} {...editVariantForm.register('salePrice')} />
            <Input label={t.products.currency} maxLength={3} error={editVariantForm.formState.errors.currency?.message} {...editVariantForm.register('currency')} />
          </div>
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
    </div>
  )
}
