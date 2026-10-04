import { useEffect, useState, type ReactNode } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, ScrollView, useWindowDimensions,
} from 'react-native'
import { router } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import Constants from 'expo-constants'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '@/stores/authStore'
import { scanAndConnect, disconnect, getPrinterName, requestBluetoothPermission, type PrinterDevice } from '@/lib/printer'

const C = {
  bg: '#0f172a', card: '#1e293b', border: '#334155',
  primary: '#10b981', danger: '#ef4444',
  text: '#f8fafc', muted: '#94a3b8', subtle: '#64748b',
}

const TABLET_BREAKPOINT = 768
const PAGE_PADDING = 16
const GAP = 16

const API_URL_KEY = 'nexuspos_api_url'
const DEFAULT_API_URL: string = Constants.expoConfig?.extra?.apiBaseUrl ?? 'https://flowin-production-46b8.up.railway.app'
const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0'

type IconName = keyof typeof Ionicons.glyphMap

// ── Pieces ────────────────────────────────────────────────────────────────────

function Section({ title, icon, width, children }: { title: string; icon: IconName; width: number; children: ReactNode }) {
  return (
    <View style={[styles.section, { width }]}>
      <View style={styles.sectionHeader}>
        <Ionicons name={icon} size={18} color={C.muted} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  )
}

function SettingRow({ icon, label, right, last }: { icon: IconName; label: string; right: ReactNode; last?: boolean }) {
  return (
    <View style={[styles.settingRow, last && { borderBottomWidth: 0 }]}>
      <View style={styles.settingLeft}>
        <Ionicons name={icon} size={18} color={C.muted} />
        <Text style={styles.settingLabel}>{label}</Text>
      </View>
      <View style={styles.settingRight}>{right}</View>
    </View>
  )
}

const shortId = (id?: string | null) => (id ? `${id.slice(0, 8)}…` : '—')

// ── Screen ────────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { user, logout, branchId, tenantId } = useAuthStore()
  const { width } = useWindowDimensions()
  const isTablet = width >= TABLET_BREAKPOINT
  const sectionWidth = isTablet ? Math.floor((width - PAGE_PADDING * 2 - GAP) / 2) : width - PAGE_PADDING * 2

  const [apiUrl, setApiUrl] = useState('')
  const [editingUrl, setEditingUrl] = useState(false)
  const [tempUrl, setTempUrl] = useState('')

  // Printer state
  const [scanning, setScanning] = useState(false)
  const [devices, setDevices] = useState<PrinterDevice[]>([])
  const [connectedDevice, setConnectedDevice] = useState<string | null>(null)
  const [connecting, setConnecting] = useState<string | null>(null)

  useEffect(() => {
    SecureStore.getItemAsync(API_URL_KEY)
      .then((v) => setApiUrl(v ?? DEFAULT_API_URL))
      .catch(() => setApiUrl(DEFAULT_API_URL))

    getPrinterName().then(setConnectedDevice).catch(() => null)
  }, [])

  async function saveApiUrl() {
    const next = tempUrl.trim()
    if (!next) return
    await SecureStore.setItemAsync(API_URL_KEY, next)
    setApiUrl(next)
    setEditingUrl(false)
    Alert.alert('تم الحفظ', 'سيُطبَّق عنوان الخادم الجديد عند إعادة فتح التطبيق')
  }

  async function handleScanPrinters() {
    setScanning(true)
    setDevices([])
    try {
      const granted = await requestBluetoothPermission()
      if (!granted) {
        Alert.alert('الإذن مطلوب', 'يلزم السماح باستخدام البلوتوث للبحث عن الطابعات')
        return
      }
      const found = await scanAndConnect(null)
      setDevices(found)
      if (found.length === 0) Alert.alert('لا توجد أجهزة', 'لم يتم العثور على طابعات قريبة — تأكد من تشغيل الطابعة')
    } catch (e) {
      Alert.alert('خطأ', e instanceof Error && e.message ? e.message : 'تعذّر فحص الطابعات')
    } finally {
      setScanning(false)
    }
  }

  async function handleConnect(device: PrinterDevice) {
    setConnecting(device.id)
    try {
      await scanAndConnect(device)
      setConnectedDevice(device.name)
      setDevices([])
      await SecureStore.setItemAsync('nexuspos_printer_id', device.id)
      await SecureStore.setItemAsync('nexuspos_printer_name', device.name)
    } catch {
      Alert.alert('خطأ', 'تعذّر الاتصال بالطابعة')
    } finally {
      setConnecting(null)
    }
  }

  async function handleDisconnect() {
    try {
      await disconnect()
      setConnectedDevice(null)
      await SecureStore.deleteItemAsync('nexuspos_printer_id')
      await SecureStore.deleteItemAsync('nexuspos_printer_name')
    } catch {
      Alert.alert('خطأ', 'تعذّر قطع الاتصال')
    }
  }

  function handleLogout() {
    Alert.alert('تسجيل الخروج', 'هل تريد تسجيل الخروج من هذا الجهاز؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'خروج',
        style: 'destructive',
        onPress: async () => {
          await logout()
          router.replace('/(auth)/login')
        },
      },
    ])
  }

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || '—'

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.grid}>
        {/* ── Account ── */}
        <Section title="الحساب" icon="person-circle-outline" width={sectionWidth}>
          <View style={styles.userCard}>
            <View style={styles.userAvatar}>
              <Text style={styles.userAvatarText}>{user?.firstName?.charAt(0)?.toUpperCase() ?? '?'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.userName}>{fullName}</Text>
              <Text style={styles.userEmail} numberOfLines={1}>{user?.email ?? '—'}</Text>
              {user?.role ? (
                <View style={styles.roleChip}>
                  <Ionicons name="shield-checkmark-outline" size={12} color={C.primary} />
                  <Text style={styles.roleText}>{user.role}</Text>
                </View>
              ) : null}
            </View>
          </View>
          <SettingRow icon="business-outline" label="المنشأة" right={<Text style={styles.metaText}>{shortId(tenantId)}</Text>} />
          <SettingRow icon="storefront-outline" label="الفرع" right={<Text style={styles.metaText}>{shortId(branchId)}</Text>} last />
          <TouchableOpacity style={styles.dangerBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={18} color={C.danger} />
            <Text style={styles.dangerBtnText}>تسجيل الخروج</Text>
          </TouchableOpacity>
        </Section>

        {/* ── Server ── */}
        <Section title="إعدادات الخادم" icon="server-outline" width={sectionWidth}>
          {editingUrl ? (
            <View>
              <Text style={styles.label}>عنوان API</Text>
              <TextInput
                style={styles.input}
                value={tempUrl}
                onChangeText={setTempUrl}
                placeholder="https://your-backend.example.com"
                placeholderTextColor={C.subtle}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <View style={styles.btnRow}>
                <TouchableOpacity style={[styles.btn, { flex: 1 }]} onPress={saveApiUrl}>
                  <Ionicons name="checkmark" size={18} color="#fff" />
                  <Text style={styles.btnText}>حفظ</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, styles.btnSecondary, { flex: 1 }]} onPress={() => setEditingUrl(false)}>
                  <Text style={styles.btnText}>إلغاء</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <SettingRow
              icon="globe-outline"
              label="عنوان API"
              last
              right={
                <TouchableOpacity style={styles.editBtn} onPress={() => { setTempUrl(apiUrl); setEditingUrl(true) }}>
                  <Ionicons name="pencil" size={14} color={C.primary} />
                  <Text style={styles.editBtnText} numberOfLines={1} ellipsizeMode="middle">
                    {apiUrl.replace(/^https?:\/\//, '') || '—'}
                  </Text>
                </TouchableOpacity>
              }
            />
          )}
        </Section>

        {/* ── Printer ── */}
        <Section title="طابعة الإيصالات (Bluetooth)" icon="print-outline" width={sectionWidth}>
          {connectedDevice ? (
            <View>
              <View style={styles.printerConnected}>
                <View style={styles.printerIcon}>
                  <Ionicons name="print" size={20} color={C.primary} />
                </View>
                <Text style={styles.printerName} numberOfLines={1}>{connectedDevice}</Text>
                <View style={styles.connectedBadge}>
                  <Text style={styles.connectedText}>متصل</Text>
                </View>
              </View>
              <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={handleDisconnect}>
                <Ionicons name="close-circle-outline" size={18} color="#fff" />
                <Text style={styles.btnText}>قطع الاتصال</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.helpText}>شغّل الطابعة وفعّل البلوتوث ثم ابدأ الفحص</Text>
              <TouchableOpacity style={[styles.btn, scanning && styles.btnDisabled]} onPress={handleScanPrinters} disabled={scanning}>
                {scanning ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Ionicons name="bluetooth" size={18} color="#fff" />
                    <Text style={styles.btnText}>فحص الطابعات</Text>
                  </>
                )}
              </TouchableOpacity>

              {devices.length > 0 && (
                <View style={{ marginTop: 14 }}>
                  <Text style={styles.subTitle}>الأجهزة المكتشفة ({devices.length})</Text>
                  {devices.map((d) => (
                    <TouchableOpacity key={d.id} style={styles.deviceRow} onPress={() => handleConnect(d)} disabled={connecting === d.id}>
                      <Ionicons name="print-outline" size={18} color={C.muted} />
                      <Text style={styles.deviceName} numberOfLines={1}>{d.name}</Text>
                      {connecting === d.id ? (
                        <ActivityIndicator size="small" color={C.primary} />
                      ) : (
                        <Ionicons name="chevron-back" size={16} color={C.subtle} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}
        </Section>

        {/* ── About ── */}
        <Section title="عن التطبيق" icon="information-circle-outline" width={sectionWidth}>
          <SettingRow icon="cube-outline" label="الإصدار" right={<Text style={styles.metaText}>{APP_VERSION}</Text>} />
          <SettingRow icon="phone-portrait-outline" label="الواجهة" right={<Text style={styles.metaText}>{isTablet ? 'جهاز لوحي' : 'هاتف'}</Text>} />
          <SettingRow icon="cloud-outline" label="الخادم" right={<Text style={styles.metaText} numberOfLines={1} ellipsizeMode="middle">{apiUrl.replace(/^https?:\/\//, '') || '—'}</Text>} last />
        </Section>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  content: { padding: PAGE_PADDING, paddingBottom: 32 },
  grid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: GAP, alignItems: 'flex-start' },

  section: {
    backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 16,
  },
  sectionHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginBottom: 14 },
  sectionTitle: { color: C.text, fontSize: 15, fontWeight: '800' },
  subTitle: { color: C.muted, fontSize: 12, fontWeight: '700', textAlign: 'right', marginBottom: 8 },
  helpText: { color: C.subtle, fontSize: 12, textAlign: 'right', marginBottom: 12 },

  userCard: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, marginBottom: 6 },
  userAvatar: {
    width: 54, height: 54, borderRadius: 27, backgroundColor: C.primary + '33',
    justifyContent: 'center', alignItems: 'center',
  },
  userAvatarText: { color: C.primary, fontWeight: '800', fontSize: 22 },
  userName: { color: C.text, fontSize: 16, fontWeight: '800', textAlign: 'right' },
  userEmail: { color: C.muted, fontSize: 13, textAlign: 'right', marginTop: 2 },
  roleChip: {
    alignSelf: 'flex-end', flexDirection: 'row-reverse', alignItems: 'center', gap: 4,
    backgroundColor: C.primary + '22', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginTop: 6,
  },
  roleText: { color: C.primary, fontSize: 11, fontWeight: '700' },

  settingRow: {
    flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderColor: C.border,
  },
  settingLeft: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, flexShrink: 0 },
  settingLabel: { color: C.text, fontSize: 14 },
  settingRight: { flexShrink: 1, alignItems: 'flex-start' },
  metaText: { color: C.muted, fontSize: 13 },
  editBtn: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  editBtnText: { color: C.muted, fontSize: 13, maxWidth: 170 },

  label: { color: C.muted, fontSize: 13, marginBottom: 6, textAlign: 'right' },
  input: {
    backgroundColor: C.bg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    color: C.text, fontSize: 14, borderWidth: 1, borderColor: C.border, marginBottom: 12, textAlign: 'left',
  },
  btnRow: { flexDirection: 'row-reverse', gap: 8 },
  btn: {
    backgroundColor: C.primary, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 14,
    flexDirection: 'row-reverse', justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  btnSecondary: { backgroundColor: C.border },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  dangerBtn: {
    marginTop: 14, borderRadius: 12, paddingVertical: 12, borderWidth: 1, borderColor: C.danger + '66',
    flexDirection: 'row-reverse', justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  dangerBtnText: { color: C.danger, fontSize: 15, fontWeight: '700' },

  printerConnected: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginBottom: 14 },
  printerIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.primary + '22', justifyContent: 'center', alignItems: 'center' },
  printerName: { color: C.text, fontSize: 15, flex: 1, textAlign: 'right' },
  connectedBadge: { backgroundColor: C.primary + '22', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  connectedText: { color: C.primary, fontSize: 12, fontWeight: '700' },
  deviceRow: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 10, backgroundColor: C.bg,
    borderRadius: 10, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: C.border,
  },
  deviceName: { color: C.text, flex: 1, textAlign: 'right' },
})
