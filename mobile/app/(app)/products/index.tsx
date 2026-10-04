import { useMemo, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, FlatList, ScrollView,
  StyleSheet, Alert, Modal, ActivityIndicator, Switch, KeyboardAvoidingView, Platform,
  RefreshControl, useWindowDimensions,
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { catalogApi, inventoryApi } from '@/api/index'
import { useAuthStore } from '@/stores/authStore'
import type { ProductResponse, CategoryResponse } from '@/types/api'

const C = {
  bg: '#0f172a', card: '#1e293b', border: '#334155',
  primary: '#10b981', danger: '#ef4444', warn: '#f59e0b',
  text: '#f8fafc', muted: '#94a3b8', subtle: '#64748b',
}

const TABLET_BREAKPOINT = 768
const PANEL_WIDTH = 400
const AVATAR_COLORS = ['#10b981', '#3b82f6', '#a78bfa', '#f59e0b', '#f472b6', '#22d3ee', '#fb7185', '#84cc16']

type IconName = keyof typeof Ionicons.glyphMap

interface FormState {
  name: string
  description: string
  categoryId: string
  salePrice: string
  costPrice: string
  sku: string
  barcode: string
  trackInventory: boolean
  initialQuantity: string
}

function toForm(p: ProductResponse | null): FormState {
  const v = p?.variants[0]
  return {
    name: p?.name ?? '',
    description: p?.description ?? '',
    categoryId: p?.categoryId ?? '',
    salePrice: v ? String(v.salePrice) : '',
    costPrice: v && v.costPrice ? String(v.costPrice) : '',
    sku: v?.sku ?? '',
    barcode: v?.barcode ?? '',
    trackInventory: p?.trackInventory ?? true,
    initialQuantity: '',
  }
}

const money = (n: number) => `${n.toFixed(2)} ر.س`
const generateSku = () => Math.random().toString(36).slice(2, 8).toUpperCase()
const parseNum = (s: string) => parseFloat(s.replace(',', '.'))
const initialOf = (name: string) => (name.trim().charAt(0) || '؟').toUpperCase()

function avatarColor(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

function apiErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { detail?: string; title?: string; errors?: Record<string, string[]> } } })?.response?.data
  if (data?.errors) {
    const first = Object.values(data.errors).flat()[0]
    if (first) return first
  }
  return data?.detail ?? data?.title ?? fallback
}

// ── Form (tablet side panel / phone full-screen modal) ────────────────────────

function ProductForm({ product, categories, onDone, onCancel }: {
  product: ProductResponse | null
  categories: CategoryResponse[]
  onDone: () => void
  onCancel: () => void
}) {
  const { branchId } = useAuthStore()
  const qc = useQueryClient()
  const isEdit = !!product
  const variant = product?.variants[0] ?? null
  const [form, setForm] = useState<FormState>(() => toForm(product))
  const set = <K extends keyof FormState>(key: K) => (value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))

  const mutation = useMutation({
    mutationFn: async (): Promise<{ stockWarning: boolean }> => {
      const salePrice = parseNum(form.salePrice)
      const costPrice = form.costPrice.trim() ? parseNum(form.costPrice) : 0
      const common = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        categoryId: form.categoryId || undefined,
      }

      if (product) {
        // PUT requires taxClass + trackInventory; PATCH on the variant requires name/prices/currency.
        await catalogApi.updateProduct(product.id, {
          ...common,
          taxClass: product.taxClass || 'Standard',
          trackInventory: form.trackInventory,
        })
        if (variant) {
          await catalogApi.updateVariant(product.id, variant.id, {
            name: variant.name,
            costPrice,
            salePrice,
            currency: variant.currency || 'SAR',
            barcode: form.barcode.trim() || undefined,
          })
        }
        return { stockWarning: false }
      }

      const { data: created } = await catalogApi.createProduct({
        ...common,
        trackInventory: form.trackInventory,
        sku: form.sku.trim() || generateSku(),
        variantName: 'افتراضي',
        costPrice,
        salePrice,
        currency: 'SAR',
        barcode: form.barcode.trim() || undefined,
      })

      // Tracked products need a stock record at this branch before they show up in Inventory.
      let stockWarning = false
      if (form.trackInventory && branchId) {
        const initialQty = parseNum(form.initialQuantity)
        for (const v of created.variants ?? []) {
          try {
            const { data: stock } = await inventoryApi.initialize(branchId, { variantId: v.id })
            if (initialQty > 0) {
              await inventoryApi.adjust(branchId, stock.id, { newQuantity: initialQty, notes: 'كمية أولية عند إنشاء المنتج' })
            }
          } catch {
            stockWarning = true
          }
        }
      }
      return { stockWarning }
    },
    onSuccess: ({ stockWarning }) => {
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['inventory', branchId] })
      if (stockWarning) Alert.alert('تنبيه', 'تم إنشاء المنتج لكن تعذّر تسجيل الكمية الأولية — راجع شاشة المخزون')
      onDone()
    },
    onError: (err) => Alert.alert('خطأ', apiErrorMessage(err, isEdit ? 'تعذّر تحديث المنتج' : 'تعذّر إنشاء المنتج')),
  })

  function handleSave() {
    if (!form.name.trim()) return Alert.alert('خطأ', 'اسم المنتج مطلوب')
    const sale = parseNum(form.salePrice)
    if (!(sale > 0)) return Alert.alert('خطأ', 'سعر البيع مطلوب ويجب أن يكون أكبر من صفر')
    if (form.costPrice.trim() && !(parseNum(form.costPrice) >= 0)) return Alert.alert('خطأ', 'سعر التكلفة غير صالح')
    if (!isEdit && form.initialQuantity.trim() && !(parseNum(form.initialQuantity) >= 0)) return Alert.alert('خطأ', 'الكمية الأولية غير صالحة')
    mutation.mutate()
  }

  const color = avatarColor(form.name || 'new')

  return (
    <View>
      <View style={styles.formHeader}>
        <View style={[styles.avatar, styles.avatarLg, { backgroundColor: color + '26' }]}>
          <Text style={[styles.avatarTextLg, { color }]}>{initialOf(form.name)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.formTitle}>{isEdit ? 'تعديل المنتج' : 'منتج جديد'}</Text>
          {product && (
            <View style={styles.formStatusRow}>
              <StatusBadge active={product.isActive} />
              {variant && <Text style={styles.meta}>SKU: {variant.sku}</Text>}
            </View>
          )}
        </View>
        <TouchableOpacity onPress={onCancel} hitSlop={8}>
          <Ionicons name="close" size={24} color={C.muted} />
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>اسم المنتج *</Text>
      <TextInput style={styles.input} value={form.name} onChangeText={set('name')} textAlign="right" placeholder="مثال: قهوة عربية" placeholderTextColor={C.subtle} />

      <Text style={styles.label}>الوصف</Text>
      <TextInput style={styles.input} value={form.description} onChangeText={set('description')} textAlign="right" placeholder="اختياري" placeholderTextColor={C.subtle} />

      <Text style={styles.label}>الفئة</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={[styles.chip, !form.categoryId && styles.chipActive]} onPress={() => set('categoryId')('')}>
          <Text style={[styles.chipText, !form.categoryId && { color: '#fff' }]}>بدون فئة</Text>
        </TouchableOpacity>
        {categories.map((c) => {
          const active = form.categoryId === c.id
          return (
            <TouchableOpacity key={c.id} style={[styles.chip, active && styles.chipActive]} onPress={() => set('categoryId')(c.id)}>
              <Text style={[styles.chipText, active && { color: '#fff' }]}>{c.name}</Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      <View style={styles.twoCol}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>سعر البيع (ر.س) *</Text>
          <TextInput style={styles.input} value={form.salePrice} onChangeText={set('salePrice')} keyboardType="decimal-pad" textAlign="right" placeholder="0.00" placeholderTextColor={C.subtle} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>سعر التكلفة (ر.س)</Text>
          <TextInput style={styles.input} value={form.costPrice} onChangeText={set('costPrice')} keyboardType="decimal-pad" textAlign="right" placeholder="0.00" placeholderTextColor={C.subtle} />
        </View>
      </View>

      <View style={styles.twoCol}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>SKU</Text>
          {isEdit ? (
            <View style={[styles.input, styles.inputReadonly]}>
              <Text style={styles.readonlyText}>{variant?.sku ?? '—'}</Text>
            </View>
          ) : (
            <TextInput style={styles.input} value={form.sku} onChangeText={set('sku')} autoCapitalize="characters" autoCorrect={false} textAlign="right" placeholder="يُولَّد تلقائياً" placeholderTextColor={C.subtle} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>الباركود</Text>
          <TextInput style={styles.input} value={form.barcode} onChangeText={set('barcode')} keyboardType="number-pad" autoCorrect={false} textAlign="right" placeholder="اختياري" placeholderTextColor={C.subtle} />
        </View>
      </View>

      <View style={styles.switchRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.switchLabel}>تتبع المخزون</Text>
          <Text style={styles.switchHint}>يُنشأ سجل مخزون لهذا المنتج في الفرع الحالي</Text>
        </View>
        <Switch
          value={form.trackInventory}
          onValueChange={set('trackInventory')}
          thumbColor={form.trackInventory ? C.primary : '#cbd5e1'}
          trackColor={{ true: C.primary + '55', false: C.border }}
        />
      </View>

      {!isEdit && form.trackInventory && (
        <>
          <Text style={styles.label}>الكمية الأولية</Text>
          <TextInput style={styles.input} value={form.initialQuantity} onChangeText={set('initialQuantity')} keyboardType="decimal-pad" textAlign="right" placeholder="0" placeholderTextColor={C.subtle} />
        </>
      )}

      <TouchableOpacity style={[styles.btn, mutation.isPending && styles.btnDisabled]} onPress={handleSave} disabled={mutation.isPending}>
        {mutation.isPending ? <ActivityIndicator color="#fff" /> : (
          <>
            <Ionicons name="checkmark" size={18} color="#fff" />
            <Text style={styles.btnText}>{isEdit ? 'حفظ التعديلات' : 'إضافة المنتج'}</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  )
}

// ── List pieces ───────────────────────────────────────────────────────────────

function StatusBadge({ active }: { active: boolean }) {
  const color = active ? C.primary : C.subtle
  return (
    <View style={[styles.badge, { backgroundColor: color + '22' }]}>
      <View style={[styles.badgeDot, { backgroundColor: color }]} />
      <Text style={[styles.badgeText, { color: active ? C.primary : C.muted }]}>{active ? 'نشط' : 'غير نشط'}</Text>
    </View>
  )
}

function ProductCard({ product, categoryName, selected, onEdit, onDeactivate }: {
  product: ProductResponse
  categoryName?: string
  selected: boolean
  onEdit: () => void
  onDeactivate: () => void
}) {
  const variant = product.variants[0]
  const color = avatarColor(product.name)
  const meta = [categoryName ?? 'بدون فئة', variant?.sku].filter(Boolean).join(' · ')
  return (
    <TouchableOpacity style={[styles.card, selected && styles.cardSelected, !product.isActive && styles.cardInactive]} onPress={onEdit} activeOpacity={0.8}>
      <View style={[styles.avatar, { backgroundColor: color + '26' }]}>
        <Text style={[styles.avatarText, { color }]}>{initialOf(product.name)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{product.name}</Text>
          <StatusBadge active={product.isActive} />
        </View>
        <Text style={styles.meta} numberOfLines={1}>{meta}</Text>
        <View style={styles.cardBottom}>
          <Text style={styles.price}>{variant ? money(variant.salePrice) : '—'}</Text>
          {product.variants.length > 1 && <Text style={styles.metaSmall}>{product.variants.length} أنواع</Text>}
          {product.trackInventory && (
            <View style={styles.trackChip}>
              <Ionicons name="layers-outline" size={11} color={C.muted} />
              <Text style={styles.trackChipText}>مخزون</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity onPress={onEdit} style={styles.iconBtn} hitSlop={6}>
          <Ionicons name="pencil" size={18} color={C.primary} />
        </TouchableOpacity>
        {product.isActive && (
          <TouchableOpacity onPress={onDeactivate} style={styles.iconBtn} hitSlop={6}>
            <Ionicons name="ban-outline" size={18} color={C.danger} />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  )
}

function Empty({ icon, title, hint }: { icon: IconName; title: string; hint?: string }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={36} color={C.subtle} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {hint ? <Text style={styles.emptyHint}>{hint}</Text> : null}
    </View>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ProductsScreen() {
  const qc = useQueryClient()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const isTablet = width >= TABLET_BREAKPOINT

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  // undefined → form closed · null → creating · object → editing
  const [editing, setEditing] = useState<ProductResponse | null | undefined>(undefined)

  const productsQuery = useQuery<ProductResponse[]>({
    queryKey: ['products'],
    queryFn: async () => {
      const { data } = await catalogApi.listProducts({ pageSize: 200 })
      return data
    },
  })

  const categoriesQuery = useQuery<CategoryResponse[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await catalogApi.listCategories({ pageSize: 100 })
      return data
    },
  })

  const deactivate = useMutation({
    mutationFn: (id: string) => catalogApi.deactivateProduct(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
    onError: () => Alert.alert('خطأ', 'تعذّر إلغاء تفعيل المنتج'),
  })

  function confirmDeactivate(p: ProductResponse) {
    Alert.alert('إلغاء تفعيل المنتج', `سيتم إخفاء "${p.name}" من نقطة البيع. هل تريد المتابعة؟`, [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'إلغاء التفعيل', style: 'destructive', onPress: () => deactivate.mutate(p.id) },
    ])
  }

  const products = productsQuery.data ?? []
  const categories = categoriesQuery.data ?? []
  const categoryNames = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products.filter((p) => {
      if (categoryFilter && p.categoryId !== categoryFilter) return false
      if (!q) return true
      return (
        (p.name ?? '').toLowerCase().includes(q) ||
        p.variants.some((v) => v.sku?.toLowerCase().includes(q) || v.barcode?.includes(q))
      )
    })
  }, [products, categoryFilter, search])

  const activeCount = products.filter((p) => p.isActive).length
  const formOpen = editing !== undefined
  const closeForm = () => setEditing(undefined)
  const numColumns = isTablet ? 2 : 1

  const form = formOpen ? (
    <ProductForm
      key={editing?.id ?? 'new'}
      product={editing ?? null}
      categories={categories}
      onDone={closeForm}
      onCancel={closeForm}
    />
  ) : null

  const categoryPills: { id: string | null; name: string }[] = [{ id: null, name: 'الكل' }, ...categories.map((c) => ({ id: c.id, name: c.name }))]

  return (
    <View style={styles.screen}>
      <View style={[styles.body, isTablet && styles.bodyRow]}>
        {/* ── List ── */}
        <View style={styles.listPane}>
          <View style={styles.toolbar}>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color={C.subtle} />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="بحث بالاسم أو SKU أو الباركود..."
                placeholderTextColor={C.subtle}
                textAlign="right"
                autoCorrect={false}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={C.subtle} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity style={styles.addBtn} onPress={() => setEditing(null)}>
              <Ionicons name="add" size={26} color="#fff" />
            </TouchableOpacity>
          </View>

          {categories.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsRow} contentContainerStyle={styles.pillsContent} keyboardShouldPersistTaps="handled">
              {categoryPills.map((c) => {
                const active = categoryFilter === c.id
                return (
                  <TouchableOpacity key={c.id ?? 'all'} style={[styles.chip, active && styles.chipActive]} onPress={() => setCategoryFilter(c.id)}>
                    <Text style={[styles.chipText, active && { color: '#fff' }]}>{c.name}</Text>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          )}
          <Text style={styles.statsText}>{products.length} منتج · {activeCount} نشط</Text>

          {productsQuery.isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={C.primary} size="large" />
            </View>
          ) : productsQuery.isError ? (
            <Empty icon="cloud-offline-outline" title="تعذّر تحميل المنتجات" hint="اسحب للأسفل لإعادة المحاولة" />
          ) : (
            <FlatList
              key={`products-${numColumns}`}
              data={filtered}
              numColumns={numColumns}
              keyExtractor={(p) => p.id}
              renderItem={({ item }) => (
                <ProductCard
                  product={item}
                  categoryName={item.categoryId ? categoryNames.get(item.categoryId) : undefined}
                  selected={isTablet && editing?.id === item.id}
                  onEdit={() => setEditing(item)}
                  onDeactivate={() => confirmDeactivate(item)}
                />
              )}
              columnWrapperStyle={numColumns > 1 ? { gap: 8 } : undefined}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl refreshing={productsQuery.isFetching && !productsQuery.isLoading} onRefresh={productsQuery.refetch} tintColor={C.primary} />
              }
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                products.length === 0 ? (
                  <Empty icon="cube-outline" title="لا توجد منتجات بعد" hint="أضف أول منتج من زر الإضافة" />
                ) : (
                  <Empty icon="search-outline" title="لا توجد نتائج مطابقة" />
                )
              }
            />
          )}
        </View>

        {/* ── Tablet: form beside the list ── */}
        {isTablet && (
          <View style={styles.sidePane}>
            {form ? (
              <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
                {form}
              </ScrollView>
            ) : (
              <View style={styles.empty}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="cube-outline" size={36} color={C.subtle} />
                </View>
                <Text style={styles.emptyTitle}>اختر منتجاً لتعديله</Text>
                <Text style={styles.emptyHint}>أو أضف منتجاً جديداً</Text>
                <TouchableOpacity style={[styles.btn, { marginTop: 16, alignSelf: 'stretch' }]} onPress={() => setEditing(null)}>
                  <Ionicons name="add" size={20} color="#fff" />
                  <Text style={styles.btnText}>منتج جديد</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>

      {/* ── Phone: form as a full-screen modal ── */}
      {!isTablet && (
        <Modal visible={formOpen} animationType="slide" onRequestClose={closeForm}>
          <KeyboardAvoidingView style={styles.modalBg} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView
              contentContainerStyle={{ padding: 20, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }}
              keyboardShouldPersistTaps="handled"
            >
              {form}
            </ScrollView>
          </KeyboardAvoidingView>
        </Modal>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  body: { flex: 1 },
  bodyRow: { flexDirection: 'row' },
  listPane: { flex: 1 },
  sidePane: { width: PANEL_WIDTH, backgroundColor: C.card, borderLeftWidth: 1, borderColor: C.border },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  toolbar: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, padding: 12, paddingBottom: 6 },
  searchBox: {
    flex: 1, flexDirection: 'row-reverse', alignItems: 'center', gap: 8,
    backgroundColor: C.card, borderRadius: 12, paddingHorizontal: 12, height: 46,
    borderWidth: 1, borderColor: C.border,
  },
  searchInput: { flex: 1, color: C.text, fontSize: 15, paddingVertical: 0 },
  addBtn: { width: 46, height: 46, borderRadius: 12, backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center' },
  pillsRow: { flexGrow: 0 },
  pillsContent: { paddingHorizontal: 12, paddingVertical: 6, gap: 8 },
  statsText: { color: C.subtle, fontSize: 12, textAlign: 'right', paddingHorizontal: 14, paddingBottom: 6 },

  listContent: { padding: 12, paddingTop: 4, gap: 8, flexGrow: 1 },
  card: {
    flex: 1, flexDirection: 'row-reverse', alignItems: 'center', gap: 12, backgroundColor: C.card,
    borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border,
  },
  cardSelected: { borderColor: C.primary },
  cardInactive: { opacity: 0.7 },
  avatar: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center' },
  avatarLg: { width: 54, height: 54, borderRadius: 27 },
  avatarText: { fontSize: 18, fontWeight: '800' },
  avatarTextLg: { fontSize: 22, fontWeight: '800' },
  nameRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  name: { color: C.text, fontSize: 15, fontWeight: '700', textAlign: 'right', flexShrink: 1 },
  meta: { color: C.muted, fontSize: 12, textAlign: 'right', marginTop: 2 },
  metaSmall: { color: C.subtle, fontSize: 11 },
  cardBottom: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginTop: 6 },
  price: { color: C.primary, fontWeight: '800', fontSize: 15 },
  trackChip: { flexDirection: 'row-reverse', alignItems: 'center', gap: 3, backgroundColor: C.bg, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  trackChipText: { color: C.muted, fontSize: 10, fontWeight: '700' },
  badge: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  actions: { alignItems: 'center', gap: 6 },
  iconBtn: { padding: 6 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: C.card, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  emptyTitle: { color: C.text, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  emptyHint: { color: C.subtle, fontSize: 12, marginTop: 6, textAlign: 'center' },

  // Form
  modalBg: { flex: 1, backgroundColor: C.bg },
  formHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, marginBottom: 16 },
  formTitle: { color: C.text, fontSize: 18, fontWeight: '800', textAlign: 'right' },
  formStatusRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginTop: 4 },
  label: { color: C.muted, fontSize: 13, marginBottom: 6, textAlign: 'right' },
  input: {
    backgroundColor: C.bg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    color: C.text, fontSize: 15, borderWidth: 1, borderColor: C.border, marginBottom: 14,
  },
  inputReadonly: { justifyContent: 'center', opacity: 0.7 },
  readonlyText: { color: C.muted, fontSize: 15, textAlign: 'right' },
  twoCol: { flexDirection: 'row-reverse', gap: 10 },
  chipRow: { gap: 8, paddingBottom: 14 },
  chip: {
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
  },
  chipActive: { backgroundColor: C.primary, borderColor: C.primary },
  chipText: { color: C.muted, fontSize: 13, fontWeight: '600' },
  switchRow: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 12, marginBottom: 14,
    backgroundColor: C.bg, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.border,
  },
  switchLabel: { color: C.text, fontSize: 14, fontWeight: '700', textAlign: 'right' },
  switchHint: { color: C.subtle, fontSize: 11, textAlign: 'right', marginTop: 2 },
  btn: {
    backgroundColor: C.primary, borderRadius: 14, paddingVertical: 14, marginTop: 4,
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
})
