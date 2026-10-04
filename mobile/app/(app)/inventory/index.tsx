import { useMemo, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, Pressable, FlatList, ScrollView,
  StyleSheet, Alert, Modal, ActivityIndicator, KeyboardAvoidingView, Platform,
  RefreshControl, useWindowDimensions,
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { catalogApi, inventoryApi } from '@/api/index'
import { useAuthStore } from '@/stores/authStore'
import type { ProductResponse, StockLevelResponse } from '@/types/api'

// ── Design tokens ─────────────────────────────────────────────────────────────

const C = {
  bg: '#0f172a', card: '#1e293b', border: '#334155', inset: '#0b1222', elevated: '#26354a',
  primary: '#10b981', danger: '#ef4444', warn: '#f59e0b', blue: '#3b82f6',
  text: '#f8fafc', muted: '#94a3b8', subtle: '#64748b',
}

const TABLET_BREAKPOINT = 768
const PANEL_WIDTH = 360
const AVATAR_COLORS = ['#10b981', '#3b82f6', '#a78bfa', '#f59e0b', '#f472b6', '#22d3ee', '#fb7185', '#84cc16']

type IconName = keyof typeof Ionicons.glyphMap
type Filter = 'all' | 'low' | 'out'
type AdjustType = 'in' | 'out' | 'set'
type StockStatus = 'ok' | 'low' | 'out'

/** A stock row joined with its catalog product/variant (the stock endpoint carries no names). */
interface StockRow {
  stock: StockLevelResponse
  productName: string
  variantName: string
  sku: string
  matched: boolean
}

const STATUS: Record<StockStatus, { label: string; color: string; icon: IconName }> = {
  ok: { label: 'متوفر', color: C.primary, icon: 'checkmark-circle' },
  low: { label: 'منخفض', color: C.warn, icon: 'alert-circle' },
  out: { label: 'نفد', color: C.danger, icon: 'close-circle' },
}

const ADJUST_TYPES: { key: AdjustType; label: string; icon: IconName; hint: string; color: string }[] = [
  { key: 'in', label: 'إضافة', icon: 'arrow-down-circle-outline', hint: 'تُضاف الكمية إلى المخزون الحالي', color: C.primary },
  { key: 'out', label: 'خصم', icon: 'arrow-up-circle-outline', hint: 'تُخصم الكمية من المخزون الحالي', color: C.danger },
  { key: 'set', label: 'تحديد', icon: 'create-outline', hint: 'تصبح هي الكمية الفعلية (مثلاً بعد الجرد)', color: C.blue },
]

function statusOf(s: StockLevelResponse): StockStatus {
  if (s.quantity <= 0) return 'out'
  if (s.isLowStock || (s.reorderPoint > 0 && s.quantity <= s.reorderPoint)) return 'low'
  return 'ok'
}

const fmtQty = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2))
const round3 = (n: number) => Math.round(n * 1000) / 1000
const initialOf = (name: string) => (name.trim().charAt(0) || '؟').toUpperCase()

function avatarColor(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

function joinStockWithCatalog(stock: StockLevelResponse[], products: ProductResponse[]): StockRow[] {
  const byVariant = new Map<string, { productName: string; variantName: string; sku: string }>()
  for (const p of products) {
    for (const v of p.variants) byVariant.set(v.id, { productName: p.name, variantName: v.name, sku: v.sku })
  }
  return stock
    .map((s) => {
      const info = byVariant.get(s.variantId)
      return {
        stock: s,
        productName: info?.productName ?? 'منتج غير معروف',
        variantName: info?.variantName ?? '',
        sku: info?.sku ?? '',
        matched: !!info,
      }
    })
    .sort((a, b) => a.productName.localeCompare(b.productName, 'ar'))
}

// ── Adjust form (shared by the tablet side panel and the phone bottom sheet) ──

function AdjustForm({ row, onDone, onCancel }: { row: StockRow; onDone: () => void; onCancel: () => void }) {
  const { branchId } = useAuthStore()
  const qc = useQueryClient()
  const [type, setType] = useState<AdjustType>('in')
  const [qty, setQty] = useState('')
  const [notes, setNotes] = useState('')

  const current = row.stock.quantity
  const amount = parseFloat(qty.replace(',', '.'))
  const hasAmount = qty.trim() !== '' && Number.isFinite(amount) && amount >= 0
  const newQuantity = !hasAmount
    ? null
    : type === 'in' ? round3(current + amount)
    : type === 'out' ? round3(Math.max(0, current - amount))
    : round3(amount)
  const overdraw = type === 'out' && hasAmount && amount > current
  const status = STATUS[statusOf(row.stock)]
  const activeType = ADJUST_TYPES.find((t) => t.key === type) ?? ADJUST_TYPES[0]
  const color = avatarColor(row.productName)

  const mutation = useMutation({
    mutationFn: async () => {
      if (!branchId || newQuantity === null) throw new Error('invalid adjustment')
      // The backend takes the absolute quantity; the in/out arithmetic happens here.
      await inventoryApi.adjust(branchId, row.stock.id, { newQuantity, notes: notes.trim() || undefined })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory', branchId] })
      onDone()
    },
    onError: () => Alert.alert('خطأ', 'تعذّر تعديل المخزون'),
  })

  const previewColor = newQuantity === null
    ? C.subtle
    : newQuantity <= 0 ? C.danger
    : row.stock.reorderPoint > 0 && newQuantity <= row.stock.reorderPoint ? C.warn
    : C.primary
  const delta = newQuantity === null ? 0 : round3(newQuantity - current)

  return (
    <View>
      <View style={styles.formHeader}>
        <View style={[styles.avatar, styles.avatarLg, { backgroundColor: color + '22', borderColor: color + '44' }]}>
          <Text style={[styles.avatarTextLg, { color }]}>{initialOf(row.productName)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.formTitle} numberOfLines={2}>{row.productName}</Text>
          <Text style={styles.meta} numberOfLines={1}>{[row.variantName !== 'افتراضي' ? row.variantName : '', row.sku].filter(Boolean).join(' · ') || '—'}</Text>
        </View>
        <TouchableOpacity onPress={onCancel} hitSlop={8} style={styles.closeBtn}>
          <Ionicons name="close" size={20} color={C.muted} />
        </TouchableOpacity>
      </View>

      <View style={styles.currentBox}>
        <View style={{ flex: 1 }}>
          <Text style={styles.currentLabel}>الكمية الحالية</Text>
          <View style={[styles.badge, { backgroundColor: status.color + '22', alignSelf: 'flex-end', marginTop: 6 }]}>
            <Ionicons name={status.icon} size={12} color={status.color} />
            <Text style={[styles.badgeText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>
        <Text style={[styles.currentValue, { color: status.color }]}>{fmtQty(current)}</Text>
      </View>

      <Text style={styles.label}>نوع التعديل</Text>
      <View style={styles.typeRow}>
        {ADJUST_TYPES.map((t) => {
          const active = type === t.key
          return (
            <Pressable
              key={t.key}
              style={({ pressed }) => [styles.typeBtn, active && { backgroundColor: t.color + '1a', borderColor: t.color }, pressed && styles.pressed]}
              onPress={() => setType(t.key)}
            >
              <Ionicons name={t.icon} size={20} color={active ? t.color : C.muted} />
              <Text style={[styles.typeText, active && { color: C.text }]}>{t.label}</Text>
            </Pressable>
          )
        })}
      </View>
      <View style={styles.hintRow}>
        <Ionicons name="information-circle-outline" size={13} color={C.subtle} />
        <Text style={styles.hint}>{activeType.hint}</Text>
      </View>

      <Text style={styles.label}>{type === 'set' ? 'الكمية الفعلية' : 'الكمية'}</Text>
      <View style={[styles.qtyInputRow, hasAmount && { borderColor: activeType.color + '88' }]}>
        <View style={[styles.qtyInputIcon, { backgroundColor: activeType.color + '22' }]}>
          <Ionicons name={type === 'in' ? 'add' : type === 'out' ? 'remove' : 'create-outline'} size={18} color={activeType.color} />
        </View>
        <TextInput
          style={styles.qtyInput}
          value={qty}
          onChangeText={setQty}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={C.subtle}
          textAlign="center"
        />
        <Text style={styles.qtyUnit}>وحدة</Text>
      </View>

      <View style={[styles.previewBox, { borderColor: previewColor + '55', backgroundColor: previewColor + '10' }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.previewLabel}>الكمية بعد التعديل</Text>
          <View style={styles.previewDeltaRow}>
            <Text style={styles.previewOld}>{fmtQty(current)}</Text>
            <Ionicons name="arrow-back" size={13} color={C.subtle} />
            {newQuantity !== null && delta !== 0 && (
              <Text style={[styles.previewDelta, { color: delta > 0 ? C.primary : C.danger }]}>
                {delta > 0 ? `+${fmtQty(delta)}` : fmtQty(delta)}
              </Text>
            )}
          </View>
        </View>
        <Text style={[styles.previewNew, { color: previewColor }]}>{newQuantity === null ? '—' : fmtQty(newQuantity)}</Text>
      </View>
      {overdraw && (
        <View style={styles.warnRow}>
          <Ionicons name="warning-outline" size={14} color={C.warn} />
          <Text style={styles.warnText}>الكمية المخصومة أكبر من المتوفر — سيتم تصفير المخزون</Text>
        </View>
      )}

      <Text style={styles.label}>ملاحظة (اختياري)</Text>
      <View style={styles.noteRow}>
        <Ionicons name="document-text-outline" size={16} color={C.subtle} />
        <TextInput
          style={styles.noteInput}
          value={notes}
          onChangeText={setNotes}
          placeholder="سبب التعديل..."
          placeholderTextColor={C.subtle}
          textAlign="right"
        />
      </View>

      <TouchableOpacity
        style={[styles.btn, { backgroundColor: activeType.color, shadowColor: activeType.color }, (!hasAmount || mutation.isPending) && styles.btnDisabled]}
        onPress={() => mutation.mutate()}
        disabled={!hasAmount || mutation.isPending}
        activeOpacity={0.85}
      >
        {mutation.isPending ? <ActivityIndicator color="#fff" /> : (
          <>
            <Ionicons name="checkmark" size={18} color="#fff" />
            <Text style={styles.btnText}>تأكيد التعديل</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  )
}

// ── List pieces ───────────────────────────────────────────────────────────────

function StatCard({ label, value, color, icon, active, onPress }: {
  label: string; value: number; color: string; icon: IconName; active: boolean; onPress: () => void
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.statCard, active && { borderColor: color, backgroundColor: color + '14' }, pressed && styles.pressed]}
      onPress={onPress}
    >
      <View style={[styles.statIcon, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
    </Pressable>
  )
}

function StockCard({ row, selected, onPress }: { row: StockRow; selected: boolean; onPress: () => void }) {
  const status = statusOf(row.stock)
  const meta = STATUS[status]
  const color = avatarColor(row.productName)
  const variant = row.variantName !== 'افتراضي' ? row.variantName : ''
  return (
    <Pressable
      style={({ pressed }) => [styles.card, selected && styles.cardSelected, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      <View style={[styles.statusStripe, { backgroundColor: meta.color }]} />
      <View style={[styles.avatar, { backgroundColor: color + '22', borderColor: color + '44' }]}>
        <Text style={[styles.avatarText, { color }]}>{initialOf(row.productName)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.name, !row.matched && { color: C.muted }]} numberOfLines={1}>
          {row.productName}{variant ? <Text style={styles.variantInline}>  ·  {variant}</Text> : null}
        </Text>
        <View style={styles.metaRow}>
          {row.sku ? (
            <View style={styles.skuChip}>
              <Ionicons name="barcode-outline" size={11} color={C.subtle} />
              <Text style={styles.skuText}>{row.sku}</Text>
            </View>
          ) : null}
          <Text style={styles.metaSmall}>حد إعادة الطلب: {fmtQty(row.stock.reorderPoint)}</Text>
        </View>
      </View>
      <View style={styles.qtyBlock}>
        <View style={[styles.qtyBadge, { backgroundColor: meta.color + '1f', borderColor: meta.color + '55' }]}>
          <Text style={[styles.qty, { color: meta.color }]}>{fmtQty(row.stock.quantity)}</Text>
        </View>
        <View style={styles.statusRow}>
          <Ionicons name={meta.icon} size={11} color={meta.color} />
          <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
        </View>
      </View>
      <Ionicons name="chevron-back" size={16} color={selected ? C.primary : C.subtle} />
    </Pressable>
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

export default function InventoryScreen() {
  const { branchId } = useAuthStore()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const isTablet = width >= TABLET_BREAKPOINT

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const productsQuery = useQuery<ProductResponse[]>({
    queryKey: ['products'],
    queryFn: async () => {
      const { data } = await catalogApi.listProducts({ pageSize: 200 })
      return data
    },
  })

  const stockQuery = useQuery<StockLevelResponse[]>({
    queryKey: ['inventory', branchId],
    queryFn: async () => {
      const { data } = await inventoryApi.listLevels(branchId!)
      return data
    },
    enabled: !!branchId,
  })

  const rows = useMemo(
    () => joinStockWithCatalog(stockQuery.data ?? [], productsQuery.data ?? []),
    [stockQuery.data, productsQuery.data],
  )

  const counts = useMemo(() => ({
    all: rows.length,
    low: rows.filter((r) => statusOf(r.stock) === 'low').length,
    out: rows.filter((r) => statusOf(r.stock) === 'out').length,
  }), [rows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (filter !== 'all' && statusOf(r.stock) !== filter) return false
      if (!q) return true
      return (
        r.productName.toLowerCase().includes(q) ||
        r.variantName.toLowerCase().includes(q) ||
        r.sku.toLowerCase().includes(q)
      )
    })
  }, [rows, filter, search])

  const selected = rows.find((r) => r.stock.id === selectedId) ?? null
  const isLoading = stockQuery.isLoading || productsQuery.isLoading
  const isRefreshing = (stockQuery.isFetching || productsQuery.isFetching) && !isLoading
  const refresh = () => {
    stockQuery.refetch()
    productsQuery.refetch()
  }
  const closeForm = () => setSelectedId(null)

  const FILTERS: { key: Filter; label: string; count: number; color: string; icon: IconName }[] = [
    { key: 'all', label: 'الكل', count: counts.all, color: C.primary, icon: 'layers-outline' },
    { key: 'low', label: 'منخفض', count: counts.low, color: C.warn, icon: 'alert-circle' },
    { key: 'out', label: 'نفد', count: counts.out, color: C.danger, icon: 'close-circle' },
  ]

  const form = selected ? (
    <AdjustForm key={selected.stock.id} row={selected} onDone={closeForm} onCancel={closeForm} />
  ) : null

  const toggleFilter = (key: Filter) => setFilter((f) => (f === key && key !== 'all' ? 'all' : key))

  return (
    <View style={styles.screen}>
      <View style={[styles.body, isTablet && styles.bodyRow]}>
        {/* ── Stock list ── */}
        <View style={styles.listPane}>
          <View style={styles.statsRow}>
            <StatCard label="إجمالي الأصناف" value={counts.all} color={C.blue} icon="layers-outline" active={filter === 'all'} onPress={() => setFilter('all')} />
            <StatCard label="مخزون منخفض" value={counts.low} color={C.warn} icon="alert-circle" active={filter === 'low'} onPress={() => toggleFilter('low')} />
            <StatCard label="نفد من المخزون" value={counts.out} color={C.danger} icon="close-circle" active={filter === 'out'} onPress={() => toggleFilter('out')} />
          </View>

          <View style={styles.toolbar}>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color={C.subtle} />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="بحث بالاسم أو SKU..."
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

            <View style={styles.filterRow}>
              {FILTERS.map((f) => {
                const active = filter === f.key
                return (
                  <Pressable
                    key={f.key}
                    style={({ pressed }) => [styles.filterChip, active && { backgroundColor: f.color + '1f', borderColor: f.color }, pressed && styles.pressed]}
                    onPress={() => setFilter(f.key)}
                  >
                    <Ionicons name={f.icon} size={13} color={active ? f.color : C.subtle} />
                    <Text style={[styles.filterText, active && { color: f.color }]}>{f.label}</Text>
                    <View style={[styles.filterCount, { backgroundColor: active ? f.color : C.elevated }]}>
                      <Text style={[styles.filterCountText, { color: active ? '#fff' : C.muted }]}>{f.count}</Text>
                    </View>
                  </Pressable>
                )
              })}
            </View>
          </View>

          {!branchId ? (
            <Empty icon="business-outline" title="لم يتم تحديد فرع لهذا الحساب" />
          ) : isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={C.primary} size="large" />
            </View>
          ) : stockQuery.isError ? (
            <Empty icon="cloud-offline-outline" title="تعذّر تحميل المخزون" hint="اسحب للأسفل لإعادة المحاولة" />
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(r) => r.stock.id}
              renderItem={({ item }) => (
                <StockCard
                  row={item}
                  selected={isTablet && item.stock.id === selectedId}
                  onPress={() => setSelectedId(item.stock.id)}
                />
              )}
              contentContainerStyle={styles.listContent}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor={C.primary} />}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={
                filtered.length > 0 ? (
                  <Text style={styles.resultCount}>{filtered.length} صنف{filter !== 'all' || search ? ' مطابق' : ''}</Text>
                ) : null
              }
              ListEmptyComponent={
                rows.length === 0 ? (
                  <Empty
                    icon="layers-outline"
                    title="لا توجد أصناف مخزون في هذا الفرع"
                    hint="يُنشأ سجل المخزون تلقائياً عند إضافة منتج مع تفعيل تتبع المخزون"
                  />
                ) : (
                  <Empty icon="search-outline" title="لا توجد نتائج مطابقة" hint="جرّب تغيير الفلتر أو كلمة البحث" />
                )
              }
            />
          )}
        </View>

        {/* ── Tablet: adjust panel beside the list ── */}
        {isTablet && (
          <View style={styles.sidePane}>
            {form ? (
              <ScrollView contentContainerStyle={{ padding: 18 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                {form}
              </ScrollView>
            ) : (
              <Empty icon="swap-vertical" title="اختر صنفاً من القائمة" hint="تظهر هنا أدوات تعديل الكمية (إضافة / خصم / تحديد)" />
            )}
          </View>
        )}
      </View>

      {/* ── Phone: adjust as a bottom sheet ── */}
      {!isTablet && (
        <Modal visible={!!selected} transparent animationType="slide" onRequestClose={closeForm}>
          <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <Pressable style={styles.backdrop} onPress={closeForm} />
            <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
              <View style={styles.sheetHandle} />
              <ScrollView keyboardShouldPersistTaps="handled" bounces={false} showsVerticalScrollIndicator={false}>
                {form}
              </ScrollView>
            </View>
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
  pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },

  // Stats
  statsRow: { flexDirection: 'row-reverse', gap: 8, paddingHorizontal: 12, paddingTop: 12 },
  statCard: {
    flex: 1, backgroundColor: C.card, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: C.border,
    alignItems: 'flex-end', gap: 4,
  },
  statIcon: { width: 30, height: 30, borderRadius: 9, justifyContent: 'center', alignItems: 'center', marginBottom: 2 },
  statValue: { fontSize: 24, fontWeight: '900' },
  statLabel: { color: C.muted, fontSize: 11, fontWeight: '600' },

  toolbar: { padding: 12, gap: 10 },
  searchBox: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 8,
    backgroundColor: C.card, borderRadius: 14, paddingHorizontal: 14, height: 48,
    borderWidth: 1, borderColor: C.border,
  },
  searchInput: { flex: 1, color: C.text, fontSize: 15, paddingVertical: 0 },
  filterRow: { flexDirection: 'row-reverse', gap: 8 },
  filterChip: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 6,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
  },
  filterText: { color: C.muted, fontSize: 13, fontWeight: '700' },
  filterCount: { minWidth: 22, height: 20, borderRadius: 10, paddingHorizontal: 6, justifyContent: 'center', alignItems: 'center' },
  filterCountText: { fontSize: 11, fontWeight: '800' },
  resultCount: { color: C.subtle, fontSize: 12, textAlign: 'right', marginBottom: 8, paddingHorizontal: 2 },

  listContent: { padding: 12, paddingTop: 0, flexGrow: 1 },
  card: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 12, backgroundColor: C.card,
    borderRadius: 16, padding: 14, paddingRight: 18, borderWidth: 1, borderColor: C.border, overflow: 'hidden',
  },
  cardSelected: { borderColor: C.primary, backgroundColor: '#1a2f3a' },
  cardPressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
  statusStripe: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 4 },
  avatar: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  avatarLg: { width: 54, height: 54, borderRadius: 27 },
  avatarText: { fontSize: 18, fontWeight: '800' },
  avatarTextLg: { fontSize: 22, fontWeight: '800' },
  name: { color: C.text, fontSize: 15, fontWeight: '700', textAlign: 'right' },
  variantInline: { color: C.muted, fontSize: 13, fontWeight: '600' },
  metaRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginTop: 5, flexWrap: 'wrap' },
  skuChip: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, backgroundColor: C.inset, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  skuText: { color: C.muted, fontSize: 11, fontWeight: '700' },
  meta: { color: C.muted, fontSize: 12, textAlign: 'right', marginTop: 2 },
  metaSmall: { color: C.subtle, fontSize: 11, textAlign: 'right' },
  qtyBlock: { alignItems: 'center', minWidth: 60, gap: 4 },
  qtyBadge: { minWidth: 56, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, alignItems: 'center' },
  qty: { fontSize: 20, fontWeight: '900' },
  statusRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 3 },
  badge: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  emptyTitle: { color: C.text, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  emptyHint: { color: C.subtle, fontSize: 12, marginTop: 6, textAlign: 'center', lineHeight: 18 },

  // Adjust form
  formHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, marginBottom: 16 },
  formTitle: { color: C.text, fontSize: 16, fontWeight: '800', textAlign: 'right' },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.elevated, justifyContent: 'center', alignItems: 'center' },
  currentBox: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 12,
    backgroundColor: C.inset, borderRadius: 16, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: C.border,
  },
  currentLabel: { color: C.muted, fontSize: 13, fontWeight: '600', textAlign: 'right' },
  currentValue: { fontSize: 32, fontWeight: '900' },
  label: { color: C.muted, fontSize: 13, marginBottom: 8, textAlign: 'right', fontWeight: '600' },
  hintRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, marginBottom: 14 },
  hint: { color: C.subtle, fontSize: 11, textAlign: 'right', flex: 1 },
  typeRow: { flexDirection: 'row-reverse', gap: 8, marginBottom: 8 },
  typeBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.inset, borderRadius: 14, paddingVertical: 12, gap: 5,
    borderWidth: 1.5, borderColor: C.border,
  },
  typeText: { color: C.muted, fontWeight: '800', fontSize: 13 },
  qtyInputRow: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 10, backgroundColor: C.inset, borderRadius: 16,
    borderWidth: 1.5, borderColor: C.border, paddingHorizontal: 10, height: 68, marginBottom: 12,
  },
  qtyInputIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  qtyInput: { flex: 1, color: C.text, fontSize: 32, fontWeight: '900', paddingVertical: 0 },
  qtyUnit: { color: C.subtle, fontSize: 12, fontWeight: '700', width: 40, textAlign: 'center' },
  previewBox: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 12,
    borderRadius: 16, padding: 14, marginBottom: 8, borderWidth: 1,
  },
  previewLabel: { color: C.muted, fontSize: 12, fontWeight: '600', textAlign: 'right' },
  previewDeltaRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginTop: 4 },
  previewOld: { color: C.subtle, fontSize: 14, fontWeight: '700' },
  previewDelta: { fontSize: 13, fontWeight: '800' },
  previewNew: { fontSize: 36, fontWeight: '900' },
  warnRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginBottom: 8 },
  warnText: { color: C.warn, fontSize: 12, textAlign: 'right', flex: 1 },
  noteRow: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 8, backgroundColor: C.inset, borderRadius: 12,
    borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, height: 48, marginBottom: 16,
  },
  noteInput: { flex: 1, color: C.text, fontSize: 14, paddingVertical: 0 },
  btn: {
    backgroundColor: C.primary, borderRadius: 14, paddingVertical: 15, marginTop: 4,
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5,
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  // Phone sheet
  overlay: { flex: 1, backgroundColor: 'rgba(2,6,23,0.72)', justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    backgroundColor: C.card, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingTop: 10, maxHeight: '92%', borderTopWidth: 1, borderColor: C.border,
  },
  sheetHandle: { alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: C.border, marginBottom: 14 },
})
