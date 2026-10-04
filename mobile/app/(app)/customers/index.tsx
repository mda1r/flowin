import { useMemo, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, Pressable, FlatList, ScrollView,
  StyleSheet, Alert, Modal, ActivityIndicator, KeyboardAvoidingView, Platform,
  RefreshControl, useWindowDimensions,
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { customersApi } from '@/api/index'
import { useAuthStore } from '@/stores/authStore'
import type { CustomerResponse } from '@/types/api'

// ── Design tokens ─────────────────────────────────────────────────────────────

const C = {
  bg: '#0f172a', card: '#1e293b', border: '#334155', inset: '#0b1222', elevated: '#26354a',
  primary: '#10b981', danger: '#ef4444', warn: '#f59e0b', gold: '#fbbf24',
  text: '#f8fafc', muted: '#94a3b8', subtle: '#64748b',
}

const TABLET_BREAKPOINT = 768
const PANEL_WIDTH = 380
const AVATAR_COLORS = ['#10b981', '#3b82f6', '#a78bfa', '#f59e0b', '#f472b6', '#22d3ee', '#fb7185', '#84cc16']

type IconName = keyof typeof Ionicons.glyphMap

interface FormState {
  name: string
  phone: string
  email: string
  address: string
  notes: string
}

const EMPTY_FORM: FormState = { name: '', phone: '', email: '', address: '', notes: '' }

const FIELDS: {
  key: keyof FormState
  label: string
  icon: IconName
  keyboard: 'default' | 'phone-pad' | 'email-address'
  multiline?: boolean
  required?: boolean
  placeholder?: string
}[] = [
  { key: 'name', label: 'الاسم', icon: 'person-outline', keyboard: 'default', required: true, placeholder: 'اسم العميل' },
  { key: 'phone', label: 'رقم الهاتف', icon: 'call-outline', keyboard: 'phone-pad', placeholder: '05xxxxxxxx' },
  { key: 'email', label: 'البريد الإلكتروني', icon: 'mail-outline', keyboard: 'email-address', placeholder: 'name@example.com' },
  { key: 'address', label: 'العنوان', icon: 'location-outline', keyboard: 'default', placeholder: 'المدينة، الحي' },
  { key: 'notes', label: 'ملاحظات', icon: 'document-text-outline', keyboard: 'default', multiline: true, placeholder: 'تفضيلات العميل أو أي ملاحظة' },
]

function toForm(c: CustomerResponse | null): FormState {
  if (!c) return EMPTY_FORM
  return { name: c.name ?? '', phone: c.phone ?? '', email: c.email ?? '', address: c.address ?? '', notes: c.notes ?? '' }
}

function apiErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { detail?: string; title?: string } } })?.response?.data
  return data?.detail ?? data?.title ?? fallback
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return parts.slice(0, 2).map((p) => p.charAt(0)).join('').toUpperCase() || '؟'
}

function avatarColor(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

const pad2 = (n: number) => n.toString().padStart(2, '0')
const dateLabel = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`
}

// ── Form (tablet side panel / phone bottom sheet) ─────────────────────────────

function CustomerForm({ tenantId, customer, onDone, onCancel }: {
  tenantId: string
  customer: CustomerResponse | null
  onDone: () => void
  onCancel: () => void
}) {
  const qc = useQueryClient()
  const isEdit = !!customer
  const [form, setForm] = useState<FormState>(() => toForm(customer))
  const set = (key: keyof FormState) => (value: string) => setForm((f) => ({ ...f, [key]: value }))

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
        notes: form.notes.trim() || undefined,
      }
      if (customer) await customersApi.update(tenantId, customer.id, payload)
      else await customersApi.create(tenantId, payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers', tenantId] })
      onDone()
    },
    onError: (err) => Alert.alert('خطأ', apiErrorMessage(err, 'تعذّر حفظ بيانات العميل')),
  })

  function handleSave() {
    if (!form.name.trim()) {
      Alert.alert('خطأ', 'اسم العميل مطلوب')
      return
    }
    mutation.mutate()
  }

  const color = avatarColor(form.name || 'new')

  return (
    <View>
      <View style={styles.formHeader}>
        <View style={[styles.avatar, styles.avatarLg, { backgroundColor: color + '26', borderColor: color + '55' }]}>
          {isEdit || form.name.trim() ? (
            <Text style={[styles.avatarTextLg, { color }]}>{initialsOf(form.name)}</Text>
          ) : (
            <Ionicons name="person-add-outline" size={24} color={color} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.formTitle}>{isEdit ? 'تعديل العميل' : 'عميل جديد'}</Text>
          <Text style={styles.meta}>{customer ? `عضو منذ ${dateLabel(customer.createdAt)}` : 'أدخل بيانات العميل الأساسية'}</Text>
        </View>
        <TouchableOpacity onPress={onCancel} hitSlop={8} style={styles.closeBtn}>
          <Ionicons name="close" size={20} color={C.muted} />
        </TouchableOpacity>
      </View>

      {customer && (
        <View style={styles.loyaltyCard}>
          <View style={styles.loyaltyGlow} pointerEvents="none" />
          <View style={styles.loyaltyIcon}>
            <Ionicons name="star" size={22} color={C.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.loyaltyLabel}>رصيد نقاط الولاء</Text>
            <Text style={styles.loyaltyValue}>{customer.loyaltyPoints ?? 0} <Text style={styles.loyaltyUnit}>نقطة</Text></Text>
          </View>
          <View style={[styles.chip, { backgroundColor: (customer.isActive ? C.primary : C.subtle) + '22' }]}>
            <View style={[styles.chipDot, { backgroundColor: customer.isActive ? C.primary : C.subtle }]} />
            <Text style={[styles.chipText, { color: customer.isActive ? C.primary : C.muted }]}>
              {customer.isActive ? 'نشط' : 'غير نشط'}
            </Text>
          </View>
        </View>
      )}

      {FIELDS.map((f) => (
        <View key={f.key}>
          <Text style={styles.label}>
            {f.label}{f.required ? <Text style={{ color: C.danger }}> *</Text> : null}
          </Text>
          <View style={[styles.inputBox, f.multiline && styles.inputBoxMultiline]}>
            <View style={[styles.inputIcon, f.multiline && { marginTop: 2 }]}>
              <Ionicons name={f.icon} size={16} color={C.muted} />
            </View>
            <TextInput
              style={[styles.input, f.multiline && styles.inputMultiline]}
              value={form[f.key]}
              onChangeText={set(f.key)}
              keyboardType={f.keyboard}
              autoCapitalize={f.key === 'email' ? 'none' : 'sentences'}
              autoCorrect={false}
              textAlign="right"
              multiline={f.multiline}
              numberOfLines={f.multiline ? 3 : 1}
              placeholder={f.placeholder}
              placeholderTextColor={C.subtle}
            />
          </View>
        </View>
      ))}

      <TouchableOpacity
        style={[styles.btn, mutation.isPending && styles.btnDisabled]}
        onPress={handleSave}
        disabled={mutation.isPending}
        activeOpacity={0.85}
      >
        {mutation.isPending ? <ActivityIndicator color="#fff" /> : (
          <>
            <Ionicons name="checkmark" size={18} color="#fff" />
            <Text style={styles.btnText}>{isEdit ? 'حفظ التعديلات' : 'إضافة العميل'}</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  )
}

// ── List pieces ───────────────────────────────────────────────────────────────

function CustomerCard({ customer, selected, onPress }: { customer: CustomerResponse; selected: boolean; onPress: () => void }) {
  const color = avatarColor(customer.name)
  const points = customer.loyaltyPoints ?? 0
  return (
    <Pressable
      style={({ pressed }) => [styles.card, selected && styles.cardSelected, !customer.isActive && styles.cardInactive, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      <View style={[styles.avatar, { backgroundColor: color + '26', borderColor: color + '55' }]}>
        <Text style={[styles.avatarText, { color }]}>{initialsOf(customer.name)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{customer.name}</Text>
          {!customer.isActive && (
            <View style={[styles.chip, { backgroundColor: C.subtle + '33' }]}>
              <Text style={[styles.chipText, { color: C.muted }]}>غير نشط</Text>
            </View>
          )}
        </View>
        <View style={styles.contactRow}>
          {customer.phone ? (
            <View style={styles.contactItem}>
              <Ionicons name="call-outline" size={12} color={C.subtle} />
              <Text style={styles.meta}>{customer.phone}</Text>
            </View>
          ) : null}
          {customer.email ? (
            <View style={[styles.contactItem, { flexShrink: 1 }]}>
              <Ionicons name="mail-outline" size={12} color={C.subtle} />
              <Text style={styles.meta} numberOfLines={1}>{customer.email}</Text>
            </View>
          ) : null}
          {!customer.phone && !customer.email && <Text style={styles.meta}>لا توجد بيانات تواصل</Text>}
        </View>
        <View style={styles.chipsRow}>
          <View style={styles.goldChip}>
            <Ionicons name="star" size={11} color={C.gold} />
            <Text style={styles.goldChipText}>{points} نقطة</Text>
          </View>
          <View style={styles.sinceChip}>
            <Ionicons name="calendar-outline" size={11} color={C.subtle} />
            <Text style={styles.sinceText}>منذ {dateLabel(customer.createdAt)}</Text>
          </View>
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

export default function CustomersScreen() {
  const { tenantId } = useAuthStore()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const isTablet = width >= TABLET_BREAKPOINT

  const [search, setSearch] = useState('')
  // undefined → form closed · null → creating · object → editing
  const [editing, setEditing] = useState<CustomerResponse | null | undefined>(undefined)

  const query = useQuery<CustomerResponse[]>({
    queryKey: ['customers', tenantId],
    queryFn: async () => {
      const { data } = await customersApi.list(tenantId!, { pageSize: 200 })
      return data
    },
    enabled: !!tenantId,
  })

  const customers = query.data ?? []
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return customers
    return customers.filter((c) =>
      (c.name ?? '').toLowerCase().includes(q) ||
      (c.phone ?? '').includes(q) ||
      (c.email ?? '').toLowerCase().includes(q),
    )
  }, [customers, search])

  const activeCount = customers.filter((c) => c.isActive).length
  const totalPoints = customers.reduce((s, c) => s + (c.loyaltyPoints ?? 0), 0)
  const formOpen = editing !== undefined
  const closeForm = () => setEditing(undefined)

  const form = tenantId && formOpen ? (
    <CustomerForm
      key={editing?.id ?? 'new'}
      tenantId={tenantId}
      customer={editing ?? null}
      onDone={closeForm}
      onCancel={closeForm}
    />
  ) : null

  return (
    <View style={styles.screen}>
      <View style={[styles.body, isTablet && styles.bodyRow]}>
        {/* ── List ── */}
        <View style={styles.listPane}>
          <View style={styles.toolbar}>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={20} color={C.subtle} />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="ابحث بالاسم أو الهاتف أو البريد..."
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
            {isTablet && (
              <TouchableOpacity style={styles.addBtn} onPress={() => setEditing(null)} disabled={!tenantId} activeOpacity={0.85}>
                <Ionicons name="person-add" size={20} color="#fff" />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statPill}>
              <Ionicons name="people-outline" size={13} color={C.primary} />
              <Text style={styles.statText}>{customers.length} عميل</Text>
            </View>
            <View style={styles.statPill}>
              <View style={[styles.chipDot, { backgroundColor: C.primary }]} />
              <Text style={styles.statText}>{activeCount} نشط</Text>
            </View>
            <View style={[styles.statPill, { borderColor: C.gold + '44' }]}>
              <Ionicons name="star" size={12} color={C.gold} />
              <Text style={[styles.statText, { color: C.gold }]}>{totalPoints} نقطة</Text>
            </View>
          </View>

          {!tenantId ? (
            <Empty icon="business-outline" title="لم يتم تحديد المنشأة لهذا الحساب" />
          ) : query.isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={C.primary} size="large" />
            </View>
          ) : query.isError ? (
            <Empty icon="cloud-offline-outline" title="تعذّر تحميل العملاء" hint="اسحب للأسفل لإعادة المحاولة" />
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(c) => c.id}
              renderItem={({ item }) => (
                <CustomerCard
                  customer={item}
                  selected={isTablet && editing?.id === item.id}
                  onPress={() => setEditing(item)}
                />
              )}
              contentContainerStyle={[styles.listContent, !isTablet && { paddingBottom: 96 }]}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              refreshControl={
                <RefreshControl refreshing={query.isFetching && !query.isLoading} onRefresh={query.refetch} tintColor={C.primary} />
              }
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                customers.length === 0 ? (
                  <Empty icon="people-outline" title="لا يوجد عملاء بعد" hint="أضف أول عميل من زر الإضافة" />
                ) : (
                  <Empty icon="search-outline" title="لا توجد نتائج مطابقة" hint="جرّب اسماً أو رقماً آخر" />
                )
              }
            />
          )}
        </View>

        {/* ── Tablet: form beside the list ── */}
        {isTablet && (
          <View style={styles.sidePane}>
            {form ? (
              <ScrollView contentContainerStyle={{ padding: 18 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                {form}
              </ScrollView>
            ) : (
              <View style={styles.empty}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="people-outline" size={36} color={C.subtle} />
                </View>
                <Text style={styles.emptyTitle}>اختر عميلاً لتعديل بياناته</Text>
                <Text style={styles.emptyHint}>أو أضف عميلاً جديداً إلى قاعدة العملاء</Text>
                <TouchableOpacity style={[styles.btn, { marginTop: 18, alignSelf: 'stretch' }]} onPress={() => setEditing(null)} disabled={!tenantId} activeOpacity={0.85}>
                  <Ionicons name="person-add" size={18} color="#fff" />
                  <Text style={styles.btnText}>عميل جديد</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>

      {/* ── Phone: FAB + form as a bottom sheet ── */}
      {!isTablet && !!tenantId && (
        <TouchableOpacity style={styles.fab} onPress={() => setEditing(null)} activeOpacity={0.85}>
          <Ionicons name="person-add" size={22} color="#fff" />
          <Text style={styles.fabText}>عميل جديد</Text>
        </TouchableOpacity>
      )}

      {!isTablet && (
        <Modal visible={formOpen} transparent animationType="slide" onRequestClose={closeForm}>
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

  toolbar: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, padding: 14, paddingBottom: 8 },
  searchBox: {
    flex: 1, flexDirection: 'row-reverse', alignItems: 'center', gap: 10,
    backgroundColor: C.card, borderRadius: 16, paddingHorizontal: 16, height: 54,
    borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  searchInput: { flex: 1, color: C.text, fontSize: 16, paddingVertical: 0 },
  addBtn: {
    width: 54, height: 54, borderRadius: 16, backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center',
    shadowColor: C.primary, shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 5,
  },
  statsRow: { flexDirection: 'row-reverse', gap: 8, paddingHorizontal: 14, paddingBottom: 10 },
  statPill: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 6, backgroundColor: C.card, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: C.border,
  },
  statText: { color: C.muted, fontSize: 12, fontWeight: '700' },

  listContent: { padding: 14, paddingTop: 2, flexGrow: 1 },
  card: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 12, backgroundColor: C.card,
    borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.border,
  },
  cardSelected: { borderColor: C.primary, backgroundColor: '#1a2f3a' },
  cardInactive: { opacity: 0.7 },
  cardPressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
  avatar: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  avatarLg: { width: 58, height: 58, borderRadius: 29 },
  avatarText: { fontWeight: '800', fontSize: 16 },
  avatarTextLg: { fontWeight: '800', fontSize: 19 },
  nameRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  name: { color: C.text, fontSize: 15, fontWeight: '700', textAlign: 'right', flexShrink: 1 },
  contactRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginTop: 3, flexWrap: 'wrap' },
  contactItem: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  meta: { color: C.muted, fontSize: 12, textAlign: 'right' },
  chipsRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  chip: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, maxWidth: 200 },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontSize: 11, fontWeight: '700' },
  goldChip: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
    backgroundColor: C.gold + '1f', borderWidth: 1, borderColor: C.gold + '55',
  },
  goldChipText: { color: C.gold, fontSize: 11, fontWeight: '800' },
  sinceChip: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: C.inset },
  sinceText: { color: C.subtle, fontSize: 11, fontWeight: '600' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  emptyTitle: { color: C.text, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  emptyHint: { color: C.subtle, fontSize: 12, marginTop: 6, textAlign: 'center' },

  fab: {
    position: 'absolute', bottom: 18, left: 18, flexDirection: 'row-reverse', alignItems: 'center', gap: 8,
    backgroundColor: C.primary, borderRadius: 18, paddingHorizontal: 18, height: 54,
    shadowColor: C.primary, shadowOpacity: 0.45, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  fabText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  // Form
  formHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, marginBottom: 16 },
  formTitle: { color: C.text, fontSize: 18, fontWeight: '800', textAlign: 'right' },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.elevated, justifyContent: 'center', alignItems: 'center' },
  loyaltyCard: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 12, backgroundColor: C.gold + '12', borderRadius: 16,
    padding: 14, borderWidth: 1, borderColor: C.gold + '44', marginBottom: 18, overflow: 'hidden',
  },
  loyaltyGlow: { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: C.gold + '10', right: -50, top: -70 },
  loyaltyIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: C.gold + '22', justifyContent: 'center', alignItems: 'center' },
  loyaltyLabel: { color: C.muted, fontSize: 12, fontWeight: '600', textAlign: 'right' },
  loyaltyValue: { color: C.gold, fontSize: 24, fontWeight: '900', textAlign: 'right', marginTop: 2 },
  loyaltyUnit: { fontSize: 13, fontWeight: '700', color: C.gold },
  label: { color: C.muted, fontSize: 13, marginBottom: 6, textAlign: 'right', fontWeight: '600' },
  inputBox: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 10,
    backgroundColor: C.inset, borderRadius: 14, paddingHorizontal: 10, paddingLeft: 14, borderWidth: 1, borderColor: C.border, marginBottom: 14,
  },
  inputBoxMultiline: { alignItems: 'flex-start', paddingVertical: 10 },
  inputIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: C.elevated, justifyContent: 'center', alignItems: 'center' },
  input: { flex: 1, color: C.text, fontSize: 15, paddingVertical: 13 },
  inputMultiline: { minHeight: 76, textAlignVertical: 'top', paddingVertical: 0 },
  btn: {
    backgroundColor: C.primary, borderRadius: 14, paddingVertical: 15, marginTop: 4,
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: C.primary, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5,
  },
  btnDisabled: { opacity: 0.5 },
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
