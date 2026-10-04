import { useEffect, useMemo, useRef, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, Pressable, FlatList, ScrollView,
  StyleSheet, Alert, Modal, ActivityIndicator, KeyboardAvoidingView, Platform,
  Animated, Easing, useWindowDimensions,
} from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CameraView, useCameraPermissions } from 'expo-camera'
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuthStore } from '@/stores/authStore'
import { useCartStore, type CartLine } from '@/stores/cartStore'
import { catalogApi, ordersApi, shiftsApi } from '@/api/index'
import { cacheProducts, getCachedProducts, cacheCategories, getCachedCategories, saveOfflineOrder } from '@/lib/db'
import { printReceipt } from '@/lib/printer'
import type { CategoryResponse, PaymentMethod, ProductResponse, ShiftResponse } from '@/types/api'
import 'react-native-get-random-values'
import { v4 as uuidv4 } from 'uuid'

// ── Design tokens ─────────────────────────────────────────────────────────────

const C = {
  bg: '#0f172a', card: '#1e293b', border: '#334155', surface: '#0f172a',
  inset: '#0b1222', elevated: '#26354a',
  primary: '#10b981', primaryDeep: '#059669', danger: '#ef4444', warn: '#f59e0b',
  blue: '#3b82f6', violet: '#a78bfa',
  text: '#f8fafc', muted: '#94a3b8', subtle: '#64748b',
}

const TABLET_BREAKPOINT = 768
const CART_WIDTH = 340
const AVATAR_COLORS = ['#10b981', '#3b82f6', '#a78bfa', '#f59e0b', '#f472b6', '#22d3ee', '#fb7185', '#84cc16']

type IconName = keyof typeof Ionicons.glyphMap

interface LastOrder {
  id: string
  lines: CartLine[]
  method: PaymentMethod
  subtotal: number
  tax: number
  total: number
  tendered?: number
  change: number
}

const money = (n: number) => `${n.toFixed(2)} ر.س`
const pad2 = (n: number) => n.toString().padStart(2, '0')
const timeLabel = (iso: string) => {
  const d = new Date(iso)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}
const initialOf = (name: string) => (name.trim().charAt(0) || '؟').toUpperCase()
const methodLabel = (m: PaymentMethod) => (m === 'Cash' ? 'نقداً' : m === 'Card' ? 'بطاقة' : 'مختلط')

function avatarColor(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

function httpStatus(err: unknown): number | undefined {
  return (err as { response?: { status?: number } })?.response?.status
}

// ── Small pieces ──────────────────────────────────────────────────────────────

function ProductAvatar({ name, size = 46 }: { name: string; size?: number }) {
  const color = avatarColor(name)
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2, backgroundColor: color + '22',
      borderWidth: 1, borderColor: color + '40', justifyContent: 'center', alignItems: 'center',
    }}>
      <Text style={{ color, fontSize: size * 0.42, fontWeight: '800' }}>{initialOf(name)}</Text>
    </View>
  )
}

function StepLabel({ n, text }: { n: number; text: string }) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepDot}><Text style={styles.stepDotText}>{n}</Text></View>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  )
}

// ── Shift Gate ────────────────────────────────────────────────────────────────

const OPENING_QUICK = [0, 100, 200, 500]

function ShiftGate({ branchId, onOpen }: { branchId: string; onOpen: (s: ShiftResponse) => void }) {
  const { user } = useAuthStore()
  const [cash, setCash] = useState('0')
  const [loading, setLoading] = useState(false)

  async function open() {
    setLoading(true)
    try {
      const { data } = await shiftsApi.open(branchId, { openingCash: parseFloat(cash) || 0 })
      onOpen(data)
    } catch (err) {
      if (httpStatus(err) === 409) {
        // A shift is already open for this user — load it instead
        try {
          const { data: active } = await shiftsApi.getActive(branchId)
          if (active) { onOpen(active); return }
        } catch {}
      }
      Alert.alert('خطأ', 'تعذّر فتح الوردية')
    } finally {
      setLoading(false)
    }
  }

  const cashNum = parseFloat(cash) || 0

  return (
    <KeyboardAvoidingView style={styles.center} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.gateGlow} pointerEvents="none" />
      <View style={styles.gateOuter}>
        <View style={styles.gateOuterTop} pointerEvents="none" />
        <View style={styles.gateOuterMid} pointerEvents="none" />
        <View style={styles.gateCard}>
          <View style={styles.gateIconRing}>
            <View style={styles.gateIcon}>
              <Ionicons name="storefront" size={40} color={C.primary} />
            </View>
          </View>
          {user?.firstName ? <Text style={styles.gateEyebrow}>مرحباً {user.firstName}</Text> : null}
          <Text style={styles.gateTitle}>فتح وردية جديدة</Text>
          <Text style={styles.gateHint}>أدخل النقد الافتتاحي الموجود في الدرج لبدء البيع</Text>

          <Text style={styles.label}>النقد الافتتاحي</Text>
          <View style={styles.gateInputRow}>
            <View style={styles.currencyPrefix}>
              <Text style={styles.currencyPrefixText}>ر.س</Text>
            </View>
            <TextInput
              style={styles.gateInput}
              value={cash}
              onChangeText={setCash}
              keyboardType="numeric"
              selectTextOnFocus
              placeholder="0.00"
              placeholderTextColor={C.subtle}
            />
          </View>

          <View style={styles.quickRow}>
            {OPENING_QUICK.map((v) => {
              const active = Math.abs(cashNum - v) < 0.01 && cash.trim() !== ''
              return (
                <TouchableOpacity key={v} style={[styles.quickChip, active && styles.quickChipActive]} onPress={() => setCash(String(v))}>
                  <Text style={[styles.quickChipText, active && styles.quickChipTextActive]}>{v === 0 ? 'بدون نقد' : v}</Text>
                </TouchableOpacity>
              )
            })}
          </View>

          <TouchableOpacity style={[styles.btn, styles.btnGlow, loading && styles.btnDisabled]} onPress={open} disabled={loading} activeOpacity={0.85}>
            {loading ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name="lock-open-outline" size={18} color="#fff" />
                <Text style={styles.btnText}>فتح الوردية</Text>
              </>
            )}
          </TouchableOpacity>
          <View style={styles.gateFootRow}>
            <Ionicons name="shield-checkmark-outline" size={13} color={C.subtle} />
            <Text style={styles.gateFootText}>تُسجَّل الوردية باسمك ووقت الفتح الحالي</Text>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

// ── Payment Modal ─────────────────────────────────────────────────────────────

interface PaymentModalProps {
  visible: boolean
  total: number
  centered: boolean
  onPay: (method: PaymentMethod, tendered?: number, cash?: number, card?: number) => void
  onClose: () => void
}

const METHODS: { key: PaymentMethod; label: string; hint: string; icon: IconName; color: string }[] = [
  { key: 'Cash', label: 'نقداً', hint: 'من الدرج', icon: 'cash-outline', color: C.primary },
  { key: 'Card', label: 'بطاقة', hint: 'جهاز الشبكة', icon: 'card-outline', color: C.blue },
  { key: 'Split', label: 'مختلط', hint: 'نقد + بطاقة', icon: 'git-merge-outline', color: C.violet },
]

function PaymentModal({ visible, total, centered, onPay, onClose }: PaymentModalProps) {
  const insets = useSafeAreaInsets()
  const [method, setMethod] = useState<PaymentMethod>('Cash')
  const [tendered, setTendered] = useState(total.toFixed(2))
  const [splitCash, setSplitCash] = useState('')
  const [splitCard, setSplitCard] = useState('')

  useEffect(() => {
    if (!visible) return
    setMethod('Cash')
    setTendered(total.toFixed(2))
    setSplitCash('')
    setSplitCard('')
  }, [visible, total])

  const tenderedNum = parseFloat(tendered || '0') || 0
  const change = Math.max(0, tenderedNum - total)
  const shortfall = method === 'Cash' && tenderedNum < total - 0.001

  const quickAmounts = useMemo(() => {
    const exact = Math.ceil(total * 100) / 100
    return Array.from(new Set([exact, 50, 100, 200, 500].filter((v) => v >= total))).slice(0, 4)
  }, [total])

  const cashPart = parseFloat(splitCash || '0') || 0
  const cardPart = parseFloat(splitCard || '0') || 0
  const splitDiff = total - cashPart - cardPart
  const splitOk = Math.abs(splitDiff) < 0.01 && cashPart + cardPart > 0

  function setCashPart(v: string) {
    setSplitCash(v)
    const rem = total - (parseFloat(v) || 0)
    setSplitCard(rem > 0 ? rem.toFixed(2) : '')
  }

  function setCardPart(v: string) {
    setSplitCard(v)
    const rem = total - (parseFloat(v) || 0)
    setSplitCash(rem > 0 ? rem.toFixed(2) : '')
  }

  function confirm() {
    if (method === 'Split') {
      if (Math.abs(splitDiff) > 0.01) {
        Alert.alert('خطأ', 'مجموع النقد والبطاقة يجب أن يساوي الإجمالي')
        return
      }
      onPay('Split', undefined, cashPart, cardPart)
    } else if (method === 'Cash') {
      if (shortfall) {
        Alert.alert('خطأ', 'المبلغ المدفوع أقل من الإجمالي')
        return
      }
      onPay('Cash', tenderedNum)
    } else {
      onPay('Card')
    }
  }

  const activeMethod = METHODS.find((m) => m.key === method) ?? METHODS[0]
  const confirmDisabled = (method === 'Cash' && shortfall) || (method === 'Split' && !splitOk)

  return (
    <Modal visible={visible} animationType={centered ? 'fade' : 'slide'} transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.overlay, centered && styles.overlayCentered]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, centered ? styles.sheetCentered : { paddingBottom: Math.max(insets.bottom, 20) }]}>
          {!centered && <View style={styles.sheetHandle} />}
          <ScrollView keyboardShouldPersistTaps="handled" bounces={false} showsVerticalScrollIndicator={false}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>إتمام الدفع</Text>
              <TouchableOpacity onPress={onClose} hitSlop={8} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={C.muted} />
              </TouchableOpacity>
            </View>

            <View style={styles.dueBox}>
              <View style={styles.dueBoxGlow} pointerEvents="none" />
              <Text style={styles.dueLabel}>المبلغ المستحق</Text>
              <Text style={styles.dueValue}>{money(total)}</Text>
              <Text style={styles.dueSub}>شامل ضريبة القيمة المضافة 15%</Text>
            </View>

            <StepLabel n={1} text="اختر طريقة الدفع" />
            <View style={styles.methodRow}>
              {METHODS.map((m) => {
                const active = method === m.key
                return (
                  <Pressable
                    key={m.key}
                    style={({ pressed }) => [
                      styles.methodTile,
                      active && { borderColor: m.color, backgroundColor: m.color + '14' },
                      pressed && styles.pressed,
                    ]}
                    onPress={() => setMethod(m.key)}
                  >
                    {active && (
                      <View style={[styles.methodCheck, { backgroundColor: m.color }]}>
                        <Ionicons name="checkmark" size={12} color="#fff" />
                      </View>
                    )}
                    <View style={[styles.methodIcon, { backgroundColor: active ? m.color + '2a' : C.elevated }]}>
                      <Ionicons name={m.icon} size={24} color={active ? m.color : C.muted} />
                    </View>
                    <Text style={[styles.methodText, active && { color: C.text }]}>{m.label}</Text>
                    <Text style={styles.methodHint}>{m.hint}</Text>
                  </Pressable>
                )
              })}
            </View>

            {method === 'Cash' && (
              <>
                <StepLabel n={2} text="المبلغ المستلم من العميل" />
                <View style={[styles.amountRow, shortfall && styles.amountRowError]}>
                  <View style={styles.currencyPrefix}>
                    <Text style={styles.currencyPrefixText}>ر.س</Text>
                  </View>
                  <TextInput
                    style={styles.amountInput}
                    value={tendered}
                    onChangeText={setTendered}
                    keyboardType="numeric"
                    selectTextOnFocus
                    placeholderTextColor={C.subtle}
                    textAlign="right"
                  />
                </View>
                <View style={styles.quickRow}>
                  {quickAmounts.map((v) => {
                    const exact = Math.abs(v - total) < 0.01
                    const active = Math.abs(v - tenderedNum) < 0.01
                    return (
                      <TouchableOpacity key={v} style={[styles.quickChip, active && styles.quickChipActive]} onPress={() => setTendered(v.toFixed(2))}>
                        {exact && <Ionicons name="flash" size={12} color={active ? C.primary : C.muted} />}
                        <Text style={[styles.quickChipText, active && styles.quickChipTextActive]}>{exact ? 'بالضبط' : v.toFixed(0)}</Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>
                <View style={[styles.changeBox, shortfall ? styles.changeBoxError : styles.changeBoxOk]}>
                  <View style={styles.changeIconWrap}>
                    <Ionicons name={shortfall ? 'alert-circle' : 'wallet-outline'} size={20} color={shortfall ? C.danger : C.primary} />
                  </View>
                  <Text style={[styles.changeLabel, { flex: 1 }]}>{shortfall ? 'المتبقي على العميل' : 'الباقي للعميل'}</Text>
                  <Text style={[styles.changeValue, shortfall && { color: C.danger }]}>
                    {money(shortfall ? total - tenderedNum : change)}
                  </Text>
                </View>
              </>
            )}

            {method === 'Split' && (
              <>
                <StepLabel n={2} text="وزّع المبلغ بين النقد والبطاقة" />
                <View style={styles.splitRow}>
                  <View style={styles.splitCol}>
                    <Text style={styles.label}>نقداً</Text>
                    <View style={styles.splitInputRow}>
                      <Ionicons name="cash-outline" size={16} color={C.primary} />
                      <TextInput style={styles.splitInput} value={splitCash} onChangeText={setCashPart} keyboardType="numeric" placeholder="0.00" placeholderTextColor={C.subtle} textAlign="right" />
                    </View>
                  </View>
                  <View style={styles.splitCol}>
                    <Text style={styles.label}>بطاقة</Text>
                    <View style={styles.splitInputRow}>
                      <Ionicons name="card-outline" size={16} color={C.blue} />
                      <TextInput style={styles.splitInput} value={splitCard} onChangeText={setCardPart} keyboardType="numeric" placeholder="0.00" placeholderTextColor={C.subtle} textAlign="right" />
                    </View>
                  </View>
                </View>
                <View style={styles.splitBar}>
                  <View style={[styles.splitBarCash, { flex: Math.max(cashPart, 0.0001) }]} />
                  <View style={[styles.splitBarCard, { flex: Math.max(cardPart, 0.0001) }]} />
                  <View style={[styles.splitBarRest, { flex: Math.max(splitDiff, 0.0001) }]} />
                </View>
                <View style={[styles.splitStatus, splitOk ? styles.changeBoxOk : styles.splitStatusWarn]}>
                  <Ionicons name={splitOk ? 'checkmark-circle' : 'information-circle-outline'} size={16} color={splitOk ? C.primary : C.warn} />
                  <Text style={[styles.splitDiff, { color: splitOk ? C.primary : C.warn }]}>
                    {splitOk ? 'المجموع مطابق للإجمالي' : `الفرق: ${money(Math.abs(splitDiff))}`}
                  </Text>
                </View>
              </>
            )}

            {method === 'Card' && (
              <>
                <StepLabel n={2} text="الدفع على الجهاز" />
                <View style={styles.cardHintBox}>
                  <View style={[styles.methodIcon, { backgroundColor: C.blue + '22' }]}>
                    <Ionicons name="card" size={22} color={C.blue} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardHintTitle}>اقبل {money(total)} على جهاز الشبكة</Text>
                    <Text style={styles.cardHint}>بعد نجاح العملية على الجهاز، أكّد الدفع هنا لإغلاق الطلب</Text>
                  </View>
                </View>
              </>
            )}

            <StepLabel n={3} text="التأكيد" />
            <TouchableOpacity
              style={[styles.btn, styles.btnGlow, styles.confirmBtn, { backgroundColor: activeMethod.color }, confirmDisabled && styles.btnDisabled]}
              onPress={confirm}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.btnText}>تأكيد الدفع</Text>
              <View style={styles.btnAmountPill}>
                <Text style={styles.btnAmountText}>{money(total)}</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>إلغاء والعودة للسلة</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ── Barcode Scanner Modal ─────────────────────────────────────────────────────

function BarcodeModal({ visible, onScan, onClose }: {
  visible: boolean; onScan: (code: string) => void; onClose: () => void
}) {
  const [permission, requestPermission] = useCameraPermissions()
  const [scanned, setScanned] = useState(false)

  useEffect(() => {
    if (visible && !permission?.granted) requestPermission()
    if (!visible) setScanned(false)
  }, [visible, permission?.granted, requestPermission])

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.scannerRoot}>
        {permission?.granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            onBarcodeScanned={scanned ? undefined : ({ data }) => {
              setScanned(true)
              onScan(data)
            }}
          />
        ) : (
          <View style={[styles.center, { backgroundColor: 'transparent' }]}>
            <View style={styles.scannerPermIcon}>
              <Ionicons name="camera-outline" size={36} color={C.muted} />
            </View>
            <Text style={styles.scannerHint}>يلزم إذن الكاميرا لمسح الباركود</Text>
          </View>
        )}
        <View style={styles.scannerFrame} pointerEvents="none">
          <View style={[styles.scannerCorner, styles.cornerTL]} />
          <View style={[styles.scannerCorner, styles.cornerTR]} />
          <View style={[styles.scannerCorner, styles.cornerBL]} />
          <View style={[styles.scannerCorner, styles.cornerBR]} />
          <View style={styles.scanLine} />
        </View>
        <View style={styles.scannerHintPill}>
          <Ionicons name="barcode-outline" size={16} color="#fff" />
          <Text style={styles.scannerHint}>وجّه الكاميرا نحو الباركود</Text>
        </View>
        <TouchableOpacity style={styles.scannerClose} onPress={onClose}>
          <Ionicons name="close" size={20} color="#fff" />
          <Text style={styles.btnText}>إغلاق</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  )
}

// ── Catalog pieces ────────────────────────────────────────────────────────────

function CategoryPills({ categories, active, onChange }: {
  categories: CategoryResponse[]
  active: string | null
  onChange: (id: string | null) => void
}) {
  const items: { id: string | null; name: string; color: string }[] = [
    { id: null, name: 'الكل', color: C.primary },
    ...categories.map((c) => ({ id: c.id, name: c.name, color: avatarColor(c.name) })),
  ]
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.catRow}
      contentContainerStyle={styles.catRowContent}
      keyboardShouldPersistTaps="handled"
    >
      {items.map((c) => {
        const isActive = active === c.id
        return (
          <Pressable
            key={c.id ?? 'all'}
            style={({ pressed }) => [
              styles.catChip,
              isActive && { backgroundColor: c.color + '22', borderColor: c.color },
              pressed && styles.pressed,
            ]}
            onPress={() => onChange(c.id)}
          >
            {c.id === null ? (
              <Ionicons name="apps" size={13} color={isActive ? c.color : C.muted} />
            ) : (
              <View style={[styles.catDot, { backgroundColor: c.color }]} />
            )}
            <Text style={[styles.catText, isActive && { color: c.color }]}>{c.name}</Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

function ProductCard({ product, inCart, onPress }: { product: ProductResponse; inCart: number; onPress: () => void }) {
  const variant = product.variants.find((v) => v.isActive) ?? product.variants[0]
  const showVariant = !!variant?.name && variant.name !== product.name && variant.name !== 'افتراضي'
  return (
    <Pressable
      style={({ pressed }) => [styles.productCard, inCart > 0 && styles.productCardInCart, pressed && styles.productCardPressed]}
      onPress={onPress}
    >
      <View style={styles.productTop}>
        <ProductAvatar name={product.name} />
        {inCart > 0 ? (
          <View style={styles.inCartBadge}>
            <Ionicons name="cart" size={11} color="#fff" />
            <Text style={styles.inCartText}>{inCart}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
      {showVariant && <Text style={styles.variantName} numberOfLines={1}>{variant!.name}</Text>}
      <View style={styles.productBottom}>
        <Text style={styles.productPrice}>{variant ? money(variant.salePrice) : '—'}</Text>
        <View style={[styles.addFab, inCart > 0 && styles.addFabActive]}>
          <Ionicons name="add" size={18} color={inCart > 0 ? '#fff' : C.primary} />
        </View>
      </View>
    </Pressable>
  )
}

// ── Cart ──────────────────────────────────────────────────────────────────────

function CartLineRow({ line }: { line: CartLine }) {
  const { updateQuantity, removeLine } = useCartStore()
  const meta = line.variantName && line.variantName !== 'افتراضي' ? `${line.variantName} · ${money(line.unitPrice)}` : money(line.unitPrice)
  return (
    <View style={styles.cartLine}>
      <ProductAvatar name={line.productName} size={38} />
      <View style={styles.cartLineInfo}>
        <Text style={styles.cartLineName} numberOfLines={1}>{line.productName}</Text>
        <Text style={styles.cartLineMeta} numberOfLines={1}>{meta}</Text>
        <Text style={styles.lineTotal}>{money(line.unitPrice * line.quantity)}</Text>
      </View>
      <View style={styles.qtyRow}>
        <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(line.variantId, line.quantity - 1)} hitSlop={6}>
          <Ionicons name={line.quantity <= 1 ? 'trash-outline' : 'remove'} size={15} color={line.quantity <= 1 ? C.danger : C.text} />
        </TouchableOpacity>
        <Text style={styles.qty}>{line.quantity}</Text>
        <TouchableOpacity style={[styles.qtyBtn, styles.qtyBtnPlus]} onPress={() => updateQuantity(line.variantId, line.quantity + 1)} hitSlop={6}>
          <Ionicons name="add" size={15} color="#fff" />
        </TouchableOpacity>
      </View>
      <TouchableOpacity onPress={() => removeLine(line.variantId)} hitSlop={8} style={styles.removeBtn}>
        <Ionicons name="close" size={16} color={C.subtle} />
      </TouchableOpacity>
    </View>
  )
}

function CartPanel({ onRequestPay, onClose }: { onRequestPay: () => void; onClose?: () => void }) {
  const cart = useCartStore()
  const lines = cart.lines
  const itemCount = lines.reduce((s, l) => s + l.quantity, 0)
  const subtotal = cart.subtotal()
  const tax = cart.taxAmount()
  const total = cart.total()
  const empty = lines.length === 0

  function confirmClear() {
    if (empty) return
    Alert.alert('مسح السلة', 'هل تريد إزالة جميع العناصر؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'مسح', style: 'destructive', onPress: cart.clear },
    ])
  }

  return (
    <View style={styles.cartPanel}>
      <View style={styles.cartHeader}>
        <View style={styles.cartTitleRow}>
          <View style={styles.cartTitleIcon}>
            <Ionicons name="cart" size={18} color={C.primary} />
          </View>
          <View>
            <Text style={styles.cartTitle}>السلة</Text>
            <Text style={styles.cartSubtitle}>{itemCount} عنصر · {lines.length} صنف</Text>
          </View>
        </View>
        <View style={styles.cartHeaderActions}>
          {!empty && (
            <TouchableOpacity onPress={confirmClear} hitSlop={8} style={styles.iconBtnGhost}>
              <Ionicons name="trash-outline" size={18} color={C.danger} />
            </TouchableOpacity>
          )}
          {onClose && (
            <TouchableOpacity onPress={onClose} hitSlop={8} style={styles.iconBtnGhost}>
              <Ionicons name="chevron-down" size={22} color={C.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {empty ? (
        <View style={styles.emptyCart}>
          <View style={styles.emptyIcon}>
            <Ionicons name="cart-outline" size={40} color={C.subtle} />
          </View>
          <Text style={styles.emptyTitle}>السلة فارغة</Text>
          <Text style={styles.emptyHint}>اضغط على أي منتج لإضافته إلى السلة</Text>
        </View>
      ) : (
        <FlatList
          data={lines}
          keyExtractor={(l) => l.variantId}
          renderItem={({ item }) => <CartLineRow line={item} />}
          style={styles.cartList}
          contentContainerStyle={{ paddingBottom: 8 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />
      )}

      <View style={styles.totals}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>قبل الضريبة</Text>
          <Text style={styles.totalValue}>{money(subtotal)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>ضريبة القيمة المضافة 15%</Text>
          <Text style={styles.totalValue}>{money(tax)}</Text>
        </View>
        <View style={styles.grandRow}>
          <Text style={styles.grandLabel}>الإجمالي</Text>
          <Text style={styles.grandValue}>{money(total)}</Text>
        </View>
      </View>

      <TouchableOpacity style={[styles.btn, styles.btnGlow, styles.payBtn, empty && styles.btnDisabled]} onPress={onRequestPay} disabled={empty} activeOpacity={0.85}>
        <View style={styles.payBtnLeft}>
          <Ionicons name="checkmark-circle" size={20} color="#fff" />
          <Text style={styles.btnText}>الدفع</Text>
        </View>
        <Text style={styles.payBtnAmount}>{money(total)}</Text>
      </TouchableOpacity>
      {onClose && !empty && (
        <TouchableOpacity style={styles.clearBtn} onPress={confirmClear}>
          <Text style={styles.clearText}>مسح السلة</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

// ── Success overlay ───────────────────────────────────────────────────────────

function SuccessOverlay({ visible, order, isOnline, onPrint, onNew }: {
  visible: boolean
  order: LastOrder | null
  isOnline: boolean
  onPrint: () => void
  onNew: () => void
}) {
  const insets = useSafeAreaInsets()
  const { height } = useWindowDimensions()
  const scale = useRef(new Animated.Value(0)).current
  const ring = useRef(new Animated.Value(0)).current
  const content = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!visible) return
    scale.setValue(0)
    ring.setValue(0)
    content.setValue(0)
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }),
      Animated.timing(ring, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(content, { toValue: 1, duration: 420, delay: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start()
  }, [visible, scale, ring, content])

  const itemCount = order ? order.lines.reduce((s, l) => s + l.quantity, 0) : 0

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onNew}>
      <View style={[styles.successRoot, { paddingTop: insets.top + 24, paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.successTop}>
          <View style={styles.successIconWrap}>
            <Animated.View
              style={[styles.successRing, {
                opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
                transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.9] }) }],
              }]}
            />
            <Animated.View style={[styles.successIcon, { transform: [{ scale }] }]}>
              <Ionicons name="checkmark" size={48} color="#fff" />
            </Animated.View>
          </View>
          <Animated.View style={{ alignItems: 'center', opacity: content, transform: [{ translateY: content.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}>
            <Text style={styles.successTitle}>تم إتمام الطلب</Text>
            {order && (
              <>
                <Text style={styles.successTotal}>{money(order.total)}</Text>
                <View style={styles.successMetaRow}>
                  <View style={styles.successMetaPill}>
                    <Ionicons name="bag-handle-outline" size={13} color={C.muted} />
                    <Text style={styles.successMeta}>{itemCount} عنصر</Text>
                  </View>
                  <View style={styles.successMetaPill}>
                    <Ionicons name={order.method === 'Card' ? 'card-outline' : order.method === 'Split' ? 'git-merge-outline' : 'cash-outline'} size={13} color={C.muted} />
                    <Text style={styles.successMeta}>{methodLabel(order.method)}</Text>
                  </View>
                  {!isOnline && (
                    <View style={[styles.successMetaPill, { backgroundColor: C.warn + '22' }]}>
                      <Ionicons name="cloud-offline-outline" size={13} color={C.warn} />
                      <Text style={[styles.successMeta, { color: C.warn }]}>محفوظ محلياً</Text>
                    </View>
                  )}
                </View>
              </>
            )}
          </Animated.View>
        </View>

        {order && (
          <Animated.View style={[styles.successCard, { opacity: content, maxHeight: height * 0.42 }]}>
            {order.change > 0 && (
              <View style={[styles.changeBox, styles.changeBoxOk, { marginBottom: 12 }]}>
                <View style={styles.changeIconWrap}>
                  <Ionicons name="wallet-outline" size={20} color={C.primary} />
                </View>
                <Text style={[styles.changeLabel, { flex: 1 }]}>الباقي للعميل</Text>
                <Text style={styles.changeValue}>{money(order.change)}</Text>
              </View>
            )}
            <View style={styles.successCardHeader}>
              <Ionicons name="receipt-outline" size={15} color={C.muted} />
              <Text style={styles.successCardTitle}>ملخص الطلب</Text>
              <Text style={styles.successOrderId}>#{order.id.slice(0, 8).toUpperCase()}</Text>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              {order.lines.map((l) => (
                <View key={l.variantId} style={styles.successLine}>
                  <View style={styles.successQty}><Text style={styles.successQtyText}>{l.quantity}×</Text></View>
                  <Text style={styles.successLineName} numberOfLines={1}>{l.productName}</Text>
                  <Text style={styles.successLineTotal}>{money(l.unitPrice * l.quantity)}</Text>
                </View>
              ))}
              <View style={[styles.totalRow, { marginTop: 8 }]}>
                <Text style={styles.totalLabel}>قبل الضريبة</Text>
                <Text style={styles.totalValue}>{money(order.subtotal)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>الضريبة</Text>
                <Text style={styles.totalValue}>{money(order.tax)}</Text>
              </View>
              {order.method === 'Cash' && order.tendered !== undefined && (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>المدفوع</Text>
                  <Text style={styles.totalValue}>{money(order.tendered)}</Text>
                </View>
              )}
            </ScrollView>
          </Animated.View>
        )}

        <View style={styles.successActions}>
          <TouchableOpacity style={[styles.btn, styles.btnGlow]} onPress={onPrint} activeOpacity={0.85}>
            <Ionicons name="print-outline" size={18} color="#fff" />
            <Text style={styles.btnText}>طباعة الإيصال</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={onNew} activeOpacity={0.85}>
            <Ionicons name="add-circle-outline" size={18} color={C.text} />
            <Text style={styles.btnText}>طلب جديد</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

// ── Main POS Screen ────────────────────────────────────────────────────────────

export default function PosScreen() {
  const { user, branchId, tenantId } = useAuthStore()
  const cart = useCartStore()
  const qc = useQueryClient()
  const insets = useSafeAreaInsets()
  const { width, height } = useWindowDimensions()
  const isTablet = width >= TABLET_BREAKPOINT
  const gridWidth = isTablet ? width - CART_WIDTH : width
  const numColumns = gridWidth >= 900 ? 4 : gridWidth >= 560 ? 3 : 2

  const [shift, setShift] = useState<ShiftResponse | null>(null)
  const [shiftLoading, setShiftLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [cartVisible, setCartVisible] = useState(false)
  const [paymentVisible, setPaymentVisible] = useState(false)
  const [barcodeVisible, setBarcodeVisible] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const [successVisible, setSuccessVisible] = useState(false)
  const [lastOrder, setLastOrder] = useState<LastOrder | null>(null)

  // Network status
  useEffect(() => NetInfo.addEventListener((s: NetInfoState) => setIsOnline(!!s.isConnected)), [])

  // Load active shift (the endpoint answers 204 with an empty body when there is none)
  useEffect(() => {
    if (!branchId) { setShiftLoading(false); return }
    shiftsApi.getActive(branchId)
      .then(({ data }) => setShift(data || null))
      .catch(() => setShift(null))
      .finally(() => setShiftLoading(false))
  }, [branchId])

  // Products with offline fallback
  const { data: products = [] } = useQuery<ProductResponse[]>({
    queryKey: ['products'],
    queryFn: async () => {
      if (!isOnline) {
        const cached = await getCachedProducts()
        return cached as unknown as ProductResponse[]
      }
      const { data } = await catalogApi.listProducts({ pageSize: 500 })
      await cacheProducts(data)
      return data
    },
  })

  const { data: categories = [] } = useQuery<CategoryResponse[]>({
    queryKey: ['categories'],
    queryFn: async (): Promise<CategoryResponse[]> => {
      if (!isOnline) {
        const cached = await getCachedCategories()
        return cached.map((c) => ({ ...c, isActive: true }))
      }
      const { data } = await catalogApi.listCategories({ pageSize: 100 })
      await cacheCategories(data)
      return data
    },
  })

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products.filter((p) => {
      if (!p.isActive || p.variants.length === 0) return false
      if (activeCategory && p.categoryId !== activeCategory) return false
      if (!q) return true
      return (
        (p.name ?? '').toLowerCase().includes(q) ||
        p.variants.some((v) => v.barcode?.includes(q) || v.sku?.toLowerCase().includes(q))
      )
    })
  }, [products, activeCategory, search])

  const qtyByVariant = useMemo(() => {
    const m: Record<string, number> = {}
    for (const l of cart.lines) m[l.variantId] = l.quantity
    return m
  }, [cart.lines])
  const itemCount = cart.lines.reduce((s, l) => s + l.quantity, 0)

  function handleAddProduct(product: ProductResponse) {
    const variant = product.variants.find((v) => v.isActive) ?? product.variants[0]
    if (!variant) return
    cart.addLine({
      variantId: variant.id,
      productName: product.name,
      variantName: variant.name,
      unitPrice: variant.salePrice,
    })
  }

  function handleBarcodeScanned(code: string) {
    setBarcodeVisible(false)
    const matched = products.find((p) => p.variants.some((v) => v.barcode === code))
    if (matched) {
      handleAddProduct(matched)
    } else {
      setSearch(code)
    }
  }

  async function handlePay(method: PaymentMethod, tendered?: number, cashAmt?: number, cardAmt?: number) {
    setPaymentVisible(false)
    if (!branchId || !tenantId) {
      Alert.alert('خطأ', 'لم يتم تحديد الفرع أو المنشأة لهذا الحساب')
      return
    }

    const lines = cart.lines
    const subtotal = cart.subtotal()
    const tax = cart.taxAmount()
    const total = cart.total()
    // The backend requires amountTendered on every completion; card/split settle for the exact total.
    const amountTendered = method === 'Cash' ? (tendered ?? total) : total
    const change = method === 'Cash' ? Math.max(0, amountTendered - total) : 0

    const finish = (id: string) => {
      cart.clear()
      setLastOrder({ id, lines, method, subtotal, tax, total, tendered: amountTendered, change })
      setSuccessVisible(true)
    }

    if (!isOnline) {
      const id = uuidv4()
      await saveOfflineOrder({
        id,
        branchId,
        tenantId,
        lines,
        paymentMethod: method,
        amountTendered,
        cashAmount: cashAmt,
        cardAmount: cardAmt,
        customerId: cart.customerId ?? undefined,
        subtotal,
        taxAmount: tax,
        total,
        createdAt: Date.now(),
        synced: false,
      })
      finish(id)
      return
    }

    try {
      const { data: order } = await ordersApi.createOrder(branchId, {
        tenantId,
        currency: 'SAR',
        taxRate: 0.15,
        customerId: cart.customerId ?? undefined,
      })
      for (const line of lines) {
        await ordersApi.addLine(branchId, order.id, {
          variantId: line.variantId,
          productName: line.productName,
          variantName: line.variantName,
          unitPrice: Math.round((line.unitPrice / 1.15) * 10000) / 10000,
          quantity: line.quantity,
        })
      }
      await ordersApi.complete(branchId, order.id, {
        paymentMethod: method,
        amountTendered,
        cashAmount: cashAmt,
        cardAmount: cardAmt,
      })
      qc.invalidateQueries({ queryKey: ['shift'] })
      qc.invalidateQueries({ queryKey: ['sales-summary'] })
      finish(order.id)
    } catch {
      Alert.alert('خطأ', 'تعذّر إتمام الطلب')
    }
  }

  async function handlePrint() {
    if (!lastOrder) return
    try {
      await printReceipt({
        storeName: user?.firstName ?? 'flowIn',
        orderId: lastOrder.id,
        date: new Date().toLocaleString('ar-SA'),
        lines: lastOrder.lines.map((l) => ({ name: l.productName, qty: l.quantity, price: l.unitPrice })),
        subtotal: lastOrder.subtotal,
        tax: lastOrder.tax,
        total: lastOrder.total,
        paymentMethod: methodLabel(lastOrder.method),
        amountTendered: lastOrder.tendered,
        changeDue: lastOrder.change,
      })
    } catch {
      Alert.alert('خطأ', 'تعذّر الطباعة — تأكد من اتصال الطابعة')
    }
  }

  if (!branchId) {
    return (
      <View style={styles.center}>
        <View style={styles.emptyIcon}>
          <Ionicons name="business-outline" size={40} color={C.subtle} />
        </View>
        <Text style={styles.centerText}>لم يتم تحديد فرع لهذا الحساب</Text>
      </View>
    )
  }

  if (shiftLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={C.primary} size="large" />
        <Text style={styles.centerText}>جارٍ التحقق من الوردية…</Text>
      </View>
    )
  }

  if (!shift) {
    return <ShiftGate branchId={branchId} onOpen={setShift} />
  }

  const openPayment = () => {
    if (cartVisible) {
      // Let the cart sheet slide away before presenting the payment modal on top.
      setCartVisible(false)
      setTimeout(() => setPaymentVisible(true), 320)
      return
    }
    setPaymentVisible(true)
  }

  return (
    <View style={styles.screen}>
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline" size={14} color="#fff" />
          <Text style={styles.offlineText}>غير متصل — سيتم حفظ الطلبات محلياً ومزامنتها لاحقاً</Text>
        </View>
      )}

      <View style={[styles.body, isTablet && styles.bodyRow]}>
        {/* ── Products ── */}
        <View style={styles.productPanel}>
          <View style={styles.topBar}>
            <View style={styles.shiftChip}>
              <View style={[styles.dotRing, { borderColor: (isOnline ? C.primary : C.danger) + '55' }]}>
                <View style={[styles.dot, { backgroundColor: isOnline ? C.primary : C.danger }]} />
              </View>
              <Text style={styles.shiftText} numberOfLines={1}>
                {shift.cashierName || user?.firstName || 'كاشير'}
              </Text>
              <View style={styles.shiftDivider} />
              <Ionicons name="time-outline" size={13} color={C.subtle} />
              <Text style={styles.shiftTime}>{timeLabel(shift.openedAt)}</Text>
            </View>
            <View style={styles.countPillMuted}>
              <Ionicons name="cube-outline" size={13} color={C.muted} />
              <Text style={styles.countText}>{filteredProducts.length} منتج</Text>
            </View>
          </View>

          <View style={styles.searchRow}>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color={C.subtle} />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="بحث بالاسم أو الباركود..."
                placeholderTextColor={C.subtle}
                textAlign="right"
                returnKeyType="search"
                autoCorrect={false}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={C.subtle} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity style={styles.scanBtn} onPress={() => setBarcodeVisible(true)} activeOpacity={0.8}>
              <Ionicons name="barcode-outline" size={24} color={C.primary} />
            </TouchableOpacity>
          </View>

          <CategoryPills categories={categories} active={activeCategory} onChange={setActiveCategory} />

          <FlatList
            key={`grid-${numColumns}`}
            data={filteredProducts}
            numColumns={numColumns}
            keyExtractor={(p) => p.id}
            renderItem={({ item }) => (
              <ProductCard
                product={item}
                inCart={qtyByVariant[(item.variants.find((v) => v.isActive) ?? item.variants[0])?.id ?? ''] ?? 0}
                onPress={() => handleAddProduct(item)}
              />
            )}
            columnWrapperStyle={numColumns > 1 ? { gap: 10 } : undefined}
            contentContainerStyle={[styles.gridContent, !isTablet && { paddingBottom: 120 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyGrid}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="cube-outline" size={40} color={C.subtle} />
                </View>
                <Text style={styles.emptyTitle}>{products.length === 0 ? 'لا توجد منتجات بعد' : 'لا توجد نتائج مطابقة'}</Text>
                <Text style={styles.emptyHint}>{products.length === 0 ? 'أضف منتجات من شاشة المنتجات' : 'جرّب كلمة بحث أخرى أو فئة مختلفة'}</Text>
              </View>
            }
          />
        </View>

        {/* ── Cart (tablet: side panel) ── */}
        {isTablet && (
          <View style={styles.cartSide}>
            <CartPanel onRequestPay={openPayment} />
          </View>
        )}
      </View>

      {/* ── Cart (phone: sticky bar + bottom sheet) ── */}
      {!isTablet && itemCount > 0 && (
        <View style={styles.cartBar}>
          <TouchableOpacity style={styles.cartBarInfo} onPress={() => setCartVisible(true)} activeOpacity={0.85}>
            <View style={styles.cartBarIconWrap}>
              <Ionicons name="cart" size={22} color={C.text} />
              <View style={styles.cartBarBadge}>
                <Text style={styles.cartBarBadgeText}>{itemCount}</Text>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cartBarLabel}>عرض السلة</Text>
              <Text style={styles.cartBarTotal}>{money(cart.total())}</Text>
            </View>
            <Ionicons name="chevron-up" size={18} color={C.subtle} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.cartBarPay} onPress={openPayment} activeOpacity={0.85}>
            <Text style={styles.cartBarPayText}>الدفع</Text>
            <Ionicons name="arrow-back" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {!isTablet && (
        <Modal visible={cartVisible} animationType="slide" transparent onRequestClose={() => setCartVisible(false)}>
          <View style={styles.overlay}>
            <Pressable style={styles.backdrop} onPress={() => setCartVisible(false)} />
            <View style={[styles.cartSheet, { height: Math.min(height * 0.82, 680), paddingBottom: Math.max(insets.bottom, 12) }]}>
              <View style={styles.sheetHandle} />
              <CartPanel onClose={() => setCartVisible(false)} onRequestPay={openPayment} />
            </View>
          </View>
        </Modal>
      )}

      {/* ── Modals ── */}
      <PaymentModal
        visible={paymentVisible}
        total={cart.total()}
        centered={isTablet}
        onPay={handlePay}
        onClose={() => setPaymentVisible(false)}
      />

      <BarcodeModal
        visible={barcodeVisible}
        onScan={handleBarcodeScanned}
        onClose={() => setBarcodeVisible(false)}
      />

      <SuccessOverlay
        visible={successVisible}
        order={lastOrder}
        isOnline={isOnline}
        onPrint={handlePrint}
        onNew={() => setSuccessVisible(false)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg, padding: 24 },
  centerText: { color: C.muted, marginTop: 14, fontSize: 15, textAlign: 'center' },
  body: { flex: 1 },
  bodyRow: { flexDirection: 'row' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },

  offlineBanner: {
    backgroundColor: '#b91c1c', flexDirection: 'row-reverse', alignItems: 'center',
    justifyContent: 'center', paddingVertical: 7, gap: 6,
  },
  offlineText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // Products panel
  productPanel: { flex: 1 },
  topBar: {
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4, gap: 8,
  },
  shiftChip: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 7, flexShrink: 1,
    backgroundColor: C.card, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: C.border,
  },
  dotRing: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  shiftText: { color: C.text, fontSize: 12, fontWeight: '700', flexShrink: 1 },
  shiftDivider: { width: 1, height: 12, backgroundColor: C.border },
  shiftTime: { color: C.muted, fontSize: 12, fontWeight: '600' },
  countPillMuted: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 5,
    backgroundColor: C.card, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: C.border,
  },
  countText: { color: C.muted, fontSize: 12, fontWeight: '600' },

  searchRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8 },
  searchBox: {
    flex: 1, flexDirection: 'row-reverse', alignItems: 'center', gap: 8,
    backgroundColor: C.card, borderRadius: 14, paddingHorizontal: 14, height: 48,
    borderWidth: 1, borderColor: C.border,
  },
  searchInput: { flex: 1, color: C.text, fontSize: 15, paddingVertical: 0 },
  scanBtn: {
    width: 48, height: 48, borderRadius: 14, backgroundColor: C.primary + '14',
    borderWidth: 1, borderColor: C.primary + '55', justifyContent: 'center', alignItems: 'center',
  },

  catRow: { flexGrow: 0 },
  catRowContent: { paddingHorizontal: 14, paddingVertical: 6, gap: 8 },
  catChip: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 7,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
  },
  catDot: { width: 8, height: 8, borderRadius: 4 },
  catText: { color: C.muted, fontSize: 13, fontWeight: '700' },

  gridContent: { padding: 14, gap: 10, flexGrow: 1 },
  productCard: {
    flex: 1, backgroundColor: C.card, borderRadius: 16, padding: 12,
    borderWidth: 1, borderColor: C.border, minHeight: 160,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  productCardInCart: { borderColor: C.primary, backgroundColor: '#1a2f3a' },
  productCardPressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },
  productTop: { flexDirection: 'row-reverse', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 },
  inCartBadge: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 3,
    minWidth: 26, height: 24, borderRadius: 12, paddingHorizontal: 8,
    backgroundColor: C.primary, justifyContent: 'center',
  },
  inCartText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  productName: { color: C.text, fontSize: 14, fontWeight: '700', textAlign: 'right', lineHeight: 20 },
  variantName: { color: C.muted, fontSize: 12, textAlign: 'right', marginTop: 2 },
  productBottom: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 10 },
  productPrice: { color: C.primary, fontSize: 15, fontWeight: '800' },
  addFab: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: C.primary + '1f',
    borderWidth: 1, borderColor: C.primary + '55', justifyContent: 'center', alignItems: 'center',
  },
  addFabActive: { backgroundColor: C.primary, borderColor: C.primary },

  emptyGrid: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: C.card,
    borderWidth: 1, borderColor: C.border, justifyContent: 'center', alignItems: 'center', marginBottom: 14,
  },
  emptyTitle: { color: C.text, fontSize: 15, fontWeight: '700' },
  emptyHint: { color: C.subtle, fontSize: 12, marginTop: 4, textAlign: 'center' },

  // Phone sticky bar + sheet
  cartBar: {
    position: 'absolute', left: 14, right: 14, bottom: 14,
    backgroundColor: C.card, borderRadius: 20, padding: 8, paddingRight: 12,
    flexDirection: 'row-reverse', alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 12,
  },
  cartBarInfo: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  cartBarIconWrap: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.elevated, justifyContent: 'center', alignItems: 'center' },
  cartBarBadge: {
    position: 'absolute', top: -4, left: -4, minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6,
    backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: C.card,
  },
  cartBarBadgeText: { color: '#fff', fontWeight: '800', fontSize: 11 },
  cartBarLabel: { color: C.muted, fontSize: 11, fontWeight: '600', textAlign: 'right' },
  cartBarTotal: { color: C.text, fontSize: 17, fontWeight: '800', textAlign: 'right' },
  cartBarPay: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 6,
    backgroundColor: C.primary, borderRadius: 14, paddingHorizontal: 18, height: 46,
    shadowColor: C.primary, shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  cartBarPayText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  cartSheet: {
    backgroundColor: C.card, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: 8, borderTopWidth: 1, borderColor: C.border,
  },

  // Cart panel (shared)
  cartSide: { width: CART_WIDTH, backgroundColor: C.card, borderLeftWidth: 1, borderColor: C.border },
  cartPanel: { flex: 1, padding: 14 },
  cartHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  cartTitleRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  cartTitleIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: C.primary + '1f', justifyContent: 'center', alignItems: 'center' },
  cartTitle: { color: C.text, fontSize: 17, fontWeight: '800', textAlign: 'right' },
  cartSubtitle: { color: C.muted, fontSize: 11, textAlign: 'right', marginTop: 1 },
  cartHeaderActions: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  iconBtnGhost: { padding: 6, borderRadius: 10 },
  emptyCart: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  cartList: { flex: 1 },
  cartLine: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 10, paddingVertical: 10,
    borderBottomWidth: 1, borderColor: C.border + '99',
  },
  cartLineInfo: { flex: 1 },
  cartLineName: { color: C.text, fontSize: 14, fontWeight: '700', textAlign: 'right' },
  cartLineMeta: { color: C.muted, fontSize: 11, textAlign: 'right', marginTop: 1 },
  lineTotal: { color: C.primary, fontSize: 12, fontWeight: '800', textAlign: 'right', marginTop: 3 },
  qtyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: C.inset, borderRadius: 12, padding: 3, borderWidth: 1, borderColor: C.border,
  },
  qtyBtn: { width: 28, height: 28, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  qtyBtnPlus: { backgroundColor: C.primary },
  qty: { color: C.text, minWidth: 26, textAlign: 'center', fontWeight: '800', fontSize: 14 },
  removeBtn: { padding: 4 },

  totals: {
    backgroundColor: C.inset, borderRadius: 16, padding: 12, marginTop: 8, marginBottom: 12,
    borderWidth: 1, borderColor: C.border,
  },
  totalRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 6 },
  totalLabel: { color: C.muted, fontSize: 13 },
  totalValue: { color: C.text, fontSize: 13, fontWeight: '600' },
  grandRow: {
    flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 10, marginTop: 2, borderTopWidth: 1, borderColor: C.border,
  },
  grandLabel: { color: C.text, fontSize: 15, fontWeight: '800' },
  grandValue: { color: C.primary, fontSize: 22, fontWeight: '900' },

  // Buttons / inputs
  btn: {
    backgroundColor: C.primary, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16,
    alignItems: 'center', flexDirection: 'row-reverse', justifyContent: 'center', gap: 8,
  },
  btnGlow: { shadowColor: C.primary, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  btnSecondary: { backgroundColor: C.elevated, borderWidth: 1, borderColor: C.border },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  payBtn: { justifyContent: 'space-between', paddingVertical: 15 },
  payBtnLeft: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  payBtnAmount: { color: '#fff', fontSize: 15, fontWeight: '800', opacity: 0.95 },
  clearBtn: { marginTop: 6, alignItems: 'center', padding: 10 },
  clearText: { color: C.danger, fontSize: 14, fontWeight: '600' },
  cancelBtn: { marginTop: 8, alignItems: 'center', padding: 12 },
  cancelText: { color: C.muted, fontSize: 14, fontWeight: '600' },
  label: { color: C.muted, fontSize: 13, marginBottom: 6, textAlign: 'right', fontWeight: '600' },
  quickRow: { flexDirection: 'row-reverse', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  quickChip: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 5,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9,
    backgroundColor: C.inset, borderWidth: 1, borderColor: C.border,
  },
  quickChipActive: { backgroundColor: C.primary + '1f', borderColor: C.primary },
  quickChipText: { color: C.text, fontSize: 13, fontWeight: '700' },
  quickChipTextActive: { color: C.primary },
  currencyPrefix: {
    paddingHorizontal: 14, alignSelf: 'stretch', justifyContent: 'center',
    backgroundColor: C.elevated, borderLeftWidth: 1, borderColor: C.border,
  },
  currencyPrefixText: { color: C.muted, fontSize: 14, fontWeight: '800' },

  // Shift gate
  gateGlow: {
    position: 'absolute', width: 420, height: 420, borderRadius: 210,
    backgroundColor: C.primary + '0d', top: '18%',
  },
  gateOuter: { width: '100%', maxWidth: 440, borderRadius: 26, padding: 1.5, backgroundColor: C.border, overflow: 'hidden' },
  gateOuterTop: { position: 'absolute', top: 0, left: 0, right: 0, height: '45%', backgroundColor: C.primary + '88' },
  gateOuterMid: { position: 'absolute', top: '45%', left: 0, right: 0, height: '25%', backgroundColor: C.primary + '33' },
  gateCard: { backgroundColor: C.card, borderRadius: 25, padding: 24, alignItems: 'stretch' },
  gateIconRing: {
    alignSelf: 'center', width: 96, height: 96, borderRadius: 48, backgroundColor: C.primary + '0f',
    borderWidth: 1, borderColor: C.primary + '33', justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  gateIcon: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: C.primary + '22',
    justifyContent: 'center', alignItems: 'center',
  },
  gateEyebrow: { color: C.primary, fontSize: 13, fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  gateTitle: { color: C.text, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  gateHint: { color: C.muted, fontSize: 13, textAlign: 'center', marginTop: 6, marginBottom: 22, lineHeight: 20 },
  gateInputRow: {
    flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: C.inset, borderRadius: 14,
    borderWidth: 1, borderColor: C.border, overflow: 'hidden', marginBottom: 12, height: 60,
  },
  gateInput: { flex: 1, color: C.text, textAlign: 'center', fontSize: 28, fontWeight: '800', paddingVertical: 0, paddingHorizontal: 12 },
  gateFootRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14 },
  gateFootText: { color: C.subtle, fontSize: 11 },

  // Overlays / sheets
  overlay: { flex: 1, backgroundColor: 'rgba(2,6,23,0.72)', justifyContent: 'flex-end' },
  overlayCentered: { justifyContent: 'center', alignItems: 'center', padding: 24 },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    backgroundColor: C.card, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 20, paddingTop: 10, borderTopWidth: 1, borderColor: C.border, maxHeight: '94%',
  },
  sheetCentered: { width: 480, maxWidth: '100%', borderRadius: 26, paddingTop: 20, borderWidth: 1 },
  sheetHandle: { alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: C.border, marginBottom: 10 },
  sheetHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sheetTitle: { color: C.text, fontSize: 19, fontWeight: '800', textAlign: 'right' },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.elevated, justifyContent: 'center', alignItems: 'center' },
  dueBox: {
    backgroundColor: C.primary + '14', borderRadius: 18, padding: 16, alignItems: 'center', marginBottom: 18,
    borderWidth: 1, borderColor: C.primary + '55', overflow: 'hidden',
  },
  dueBoxGlow: { position: 'absolute', width: 260, height: 260, borderRadius: 130, backgroundColor: C.primary + '12', top: -150 },
  dueLabel: { color: C.muted, fontSize: 12, fontWeight: '600' },
  dueValue: { color: C.primary, fontSize: 34, fontWeight: '900', marginTop: 2 },
  dueSub: { color: C.subtle, fontSize: 11, marginTop: 2 },
  stepRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginBottom: 10 },
  stepDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.primary + '22', borderWidth: 1, borderColor: C.primary + '66', justifyContent: 'center', alignItems: 'center' },
  stepDotText: { color: C.primary, fontSize: 11, fontWeight: '800' },
  stepText: { color: C.text, fontSize: 13, fontWeight: '700' },
  methodRow: { flexDirection: 'row-reverse', gap: 10, marginBottom: 18 },
  methodTile: {
    flex: 1, alignItems: 'center', backgroundColor: C.inset, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 6,
    borderWidth: 1.5, borderColor: C.border, gap: 6,
  },
  methodCheck: { position: 'absolute', top: 8, left: 8, width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  methodIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  methodText: { color: C.muted, fontWeight: '800', fontSize: 14 },
  methodHint: { color: C.subtle, fontSize: 10, fontWeight: '600' },
  amountRow: {
    flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: C.inset, borderRadius: 14,
    borderWidth: 1, borderColor: C.border, overflow: 'hidden', marginBottom: 12, height: 58,
  },
  amountRowError: { borderColor: C.danger },
  amountInput: { flex: 1, color: C.text, fontSize: 24, fontWeight: '800', paddingHorizontal: 14, paddingVertical: 0 },
  changeBox: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 10,
    borderRadius: 14, padding: 12, marginBottom: 18, borderWidth: 1,
  },
  changeBoxOk: { backgroundColor: C.primary + '14', borderColor: C.primary + '55' },
  changeBoxError: { backgroundColor: C.danger + '14', borderColor: C.danger + '55' },
  changeIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center' },
  changeLabel: { color: C.muted, fontSize: 13, fontWeight: '600', textAlign: 'right' },
  changeValue: { color: C.primary, fontSize: 20, fontWeight: '900' },
  splitRow: { flexDirection: 'row-reverse', gap: 10 },
  splitCol: { flex: 1 },
  splitInputRow: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 8, backgroundColor: C.inset, borderRadius: 12,
    borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, height: 50, marginBottom: 12,
  },
  splitInput: { flex: 1, color: C.text, fontSize: 17, fontWeight: '700', paddingVertical: 0 },
  splitBar: { flexDirection: 'row-reverse', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: C.inset, marginBottom: 10 },
  splitBarCash: { backgroundColor: C.primary },
  splitBarCard: { backgroundColor: C.blue },
  splitBarRest: { backgroundColor: 'transparent' },
  splitStatus: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, padding: 10, marginBottom: 18, borderWidth: 1 },
  splitStatusWarn: { backgroundColor: C.warn + '14', borderColor: C.warn + '55' },
  splitDiff: { fontSize: 13, fontWeight: '700' },
  cardHintBox: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 12, backgroundColor: C.inset, borderRadius: 14,
    padding: 12, borderWidth: 1, borderColor: C.border, marginBottom: 18,
  },
  cardHintTitle: { color: C.text, fontSize: 14, fontWeight: '700', textAlign: 'right' },
  cardHint: { color: C.muted, fontSize: 12, textAlign: 'right', marginTop: 2, lineHeight: 18 },
  confirmBtn: { paddingVertical: 15 },
  btnAmountPill: { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  btnAmountText: { color: '#fff', fontSize: 14, fontWeight: '800' },

  // Scanner
  scannerRoot: { flex: 1, backgroundColor: '#000', justifyContent: 'flex-end', alignItems: 'center', padding: 24, gap: 16 },
  scannerPermIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  scannerFrame: { position: 'absolute', top: '28%', left: '12%', right: '12%', height: 220 },
  scannerCorner: { position: 'absolute', width: 34, height: 34, borderColor: C.primary },
  cornerTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 16 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 16 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 16 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 16 },
  scanLine: { position: 'absolute', left: 16, right: 16, top: '50%', height: 2, backgroundColor: C.primary + 'aa' },
  scannerHintPill: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
  },
  scannerHint: { color: '#fff', fontSize: 14, textAlign: 'center', opacity: 0.9 },
  scannerClose: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 8, alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 14, paddingVertical: 14, justifyContent: 'center',
  },

  // Success
  successRoot: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 24 },
  successTop: { alignItems: 'center', marginBottom: 20 },
  successIconWrap: { width: 120, height: 120, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  successRing: { position: 'absolute', width: 88, height: 88, borderRadius: 44, backgroundColor: C.primary },
  successIcon: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: C.primary,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: C.primary, shadowOpacity: 0.55, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8,
  },
  successTitle: { color: C.text, fontSize: 22, fontWeight: '800' },
  successTotal: { color: C.primary, fontSize: 38, fontWeight: '900', marginTop: 6 },
  successMetaRow: { flexDirection: 'row-reverse', gap: 8, marginTop: 10, flexWrap: 'wrap', justifyContent: 'center' },
  successMetaPill: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, backgroundColor: C.card, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: C.border },
  successMeta: { color: C.muted, fontSize: 12, fontWeight: '600' },
  successCard: {
    alignSelf: 'center', width: '100%', maxWidth: 460, backgroundColor: C.card, borderRadius: 20, padding: 16,
    borderWidth: 1, borderColor: C.border,
  },
  successCardHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginBottom: 8 },
  successCardTitle: { color: C.text, fontSize: 14, fontWeight: '800', flex: 1, textAlign: 'right' },
  successOrderId: { color: C.subtle, fontSize: 11, fontWeight: '700' },
  successLine: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, paddingVertical: 7, borderBottomWidth: 1, borderColor: C.border + '99' },
  successQty: { minWidth: 34, borderRadius: 8, backgroundColor: C.inset, paddingHorizontal: 6, paddingVertical: 3, alignItems: 'center' },
  successQtyText: { color: C.muted, fontSize: 12, fontWeight: '800' },
  successLineName: { color: C.text, fontSize: 13, flex: 1, textAlign: 'right' },
  successLineTotal: { color: C.text, fontSize: 13, fontWeight: '700' },
  successActions: { marginTop: 'auto', paddingTop: 16, gap: 10, alignSelf: 'center', width: '100%', maxWidth: 460 },
})
