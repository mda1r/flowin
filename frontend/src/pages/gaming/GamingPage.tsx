import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Wrench, Monitor } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { gamingApi } from '@/api/gaming'
import { useAuthStore } from '@/stores/authStore'
import { toast } from '@/components/ui/Toast'
import { formatCurrency, cn } from '@/lib/utils'
import type {
  GameStationResponse,
  GameSessionBillResponse,
  StationType,
} from '@/types/api'

// ── Audio & Notifications ────────────────────────────────────────────────────

function playBeep(frequency = 880, duration = 0.35) {
  try {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = frequency
    osc.type = 'sine'
    gain.gain.setValueAtTime(0.4, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    osc.start()
    osc.stop(ctx.currentTime + duration)
    setTimeout(() => ctx.close(), (duration + 0.1) * 1000)
  } catch {
    /* silently fail */
  }
}

function playAlarmSequence() {
  playBeep(880, 0.3)
  setTimeout(() => playBeep(880, 0.3), 400)
  setTimeout(() => playBeep(1320, 0.4), 800)
}

function sendGameNotification(title: string, body: string) {
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    void new Notification(title, { body, tag: 'gaming-time-up' })
  }
}

// ── Constants ────────────────────────────────────────────────────────────────

const TYPE_ICON: Record<StationType, string> = {
  Console: '🎮',
  PC: '💻',
  VR: '🥽',
  Arcade: '🕹️',
  Board: '♟️',
}

const TYPE_LABEL: Record<StationType, string> = {
  Console: 'كونسول',
  PC: 'كمبيوتر',
  VR: 'واقع افتراضي',
  Arcade: 'أركيد',
  Board: 'ألعاب لوحية',
}

const STATION_TYPES: StationType[] = ['Console', 'PC', 'VR', 'Arcade', 'Board']

const DURATION_PRESETS = [
  { label: '30 دق', value: 30 },
  { label: '1 ساعة', value: 60 },
  { label: '2 ساعة', value: 120 },
]

const EXTEND_PRESETS = [
  { label: '15 دق', value: 15 },
  { label: '30 دق', value: 30 },
  { label: '1 ساعة', value: 60 },
]

// ── Start Session State ──────────────────────────────────────────────────────

interface StartForm {
  playerName: string
  durationMinutes: number
  customDuration: boolean
  customMinutes: string
  ratePerHour: number
}

// ── Main Page ────────────────────────────────────────────────────────────────

export function GamingPage() {
  const { branchId, tenantId } = useAuthStore()
  const qc = useQueryClient()

  // Request notification permission once on mount
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      void Notification.requestPermission()
    }
  }, [])

  // ── Modal state ──────────────────────────────────────────────────────────
  const [createModal, setCreateModal] = useState(false)
  const [startModal, setStartModal] = useState<GameStationResponse | null>(null)
  const [extendModal, setExtendModal] = useState<GameStationResponse | null>(null)
  const [billModal, setBillModal] = useState<GameSessionBillResponse | null>(null)

  // Start session form state
  const [startForm, setStartForm] = useState<StartForm>({
    playerName: '',
    durationMinutes: 60,
    customDuration: false,
    customMinutes: '60',
    ratePerHour: 0,
  })

  // Extend session form state
  const [extendMinutes, setExtendMinutes] = useState(30)
  const [extendCustom, setExtendCustom] = useState(false)
  const [extendCustomVal, setExtendCustomVal] = useState('30')

  // Create station form state
  const [newStation, setNewStation] = useState({
    name: '',
    stationType: 'Console' as StationType,
    hourlyRate: '',
    currency: 'SAR',
  })

  // Payment method for bill
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash')

  // ── Query ────────────────────────────────────────────────────────────────
  const { data: stations = [], isLoading } = useQuery({
    queryKey: ['gaming-stations', branchId],
    queryFn: () => gamingApi.listStations(branchId!),
    enabled: !!branchId,
    refetchInterval: 30_000,
    select: (r) => r.data,
  })

  // ── Mutations ────────────────────────────────────────────────────────────
  const invalidate = useCallback(
    () => qc.invalidateQueries({ queryKey: ['gaming-stations', branchId] }),
    [qc, branchId],
  )

  const createMut = useMutation({
    mutationFn: () =>
      gamingApi.createStation(branchId!, {
        tenantId: tenantId!,
        stationType: newStation.stationType,
        name: newStation.name,
        hourlyRate: parseFloat(newStation.hourlyRate) || 0,
        currency: newStation.currency,
      }),
    onSuccess: () => {
      invalidate()
      setCreateModal(false)
      setNewStation({ name: '', stationType: 'Console', hourlyRate: '', currency: 'SAR' })
      toast.success('تم إنشاء المحطة بنجاح')
    },
    onError: () => toast.error('فشل إنشاء المحطة'),
  })

  const startMut = useMutation({
    mutationFn: () => {
      const dur = startForm.customDuration
        ? parseInt(startForm.customMinutes, 10) || 60
        : startForm.durationMinutes
      return gamingApi.startSession(branchId!, startModal!.id, {
        playerName: startForm.playerName,
        durationMinutes: dur,
        ratePerHour: startForm.ratePerHour,
      })
    },
    onSuccess: () => {
      invalidate()
      setStartModal(null)
      toast.success('بدأت الجلسة')
    },
    onError: () => toast.error('فشل بدء الجلسة'),
  })

  const extendMut = useMutation({
    mutationFn: () => {
      const extra = extendCustom
        ? parseInt(extendCustomVal, 10) || 30
        : extendMinutes
      const sessionId = extendModal!.activeSession!.sessionId
      return gamingApi.extendSession(branchId!, sessionId, extra)
    },
    onSuccess: () => {
      invalidate()
      setExtendModal(null)
      toast.success('تم تمديد الوقت')
    },
    onError: () => toast.error('فشل تمديد الوقت'),
  })

  const endMut = useMutation({
    mutationFn: (station: GameStationResponse) =>
      gamingApi.endSessionById(branchId!, station.activeSession!.sessionId),
    onSuccess: (res) => {
      invalidate()
      setBillModal(res.data)
      toast.success('انتهت الجلسة')
    },
    onError: () => toast.error('فشل إنهاء الجلسة'),
  })

  const maintenanceMut = useMutation({
    mutationFn: (stationId: string) => gamingApi.setMaintenance(branchId!, stationId),
    onSuccess: () => {
      invalidate()
      toast.success('تم تغيير حالة المحطة')
    },
    onError: () => toast.error('فشل تغيير الحالة'),
  })

  // ── Summary stats ────────────────────────────────────────────────────────
  const playingStations = stations.filter((s) => s.status === 'InUse')
  const availableCount = stations.filter((s) => s.status === 'Available').length

  const estimatedRevenue = playingStations.reduce((sum, s) => {
    if (!s.activeSession) return sum
    const elapsedHours = Math.max(
      0,
      (Date.now() - new Date(s.activeSession.startTime).getTime()) / 3600_000,
    )
    return sum + elapsedHours * s.activeSession.ratePerHour
  }, 0)

  const currency = stations[0]?.currency ?? 'SAR'

  // ── Handlers ─────────────────────────────────────────────────────────────
  const openStartModal = (station: GameStationResponse) => {
    setStartForm({
      playerName: '',
      durationMinutes: 60,
      customDuration: false,
      customMinutes: '60',
      ratePerHour: station.hourlyRate,
    })
    setStartModal(station)
  }

  const openExtendModal = (station: GameStationResponse) => {
    setExtendMinutes(30)
    setExtendCustom(false)
    setExtendCustomVal('30')
    setExtendModal(station)
  }

  // ── Print receipt ─────────────────────────────────────────────────────────
  const printReceipt = () => {
    if (!billModal) return
    const win = window.open('', '_blank', 'width=400,height=600')
    if (!win) return
    const startTime = new Date(billModal.startTime).toLocaleString('ar-SA')
    const endTime = new Date(billModal.endTime).toLocaleString('ar-SA')
    win.document.write(`
      <html dir="rtl"><head><meta charset="utf-8"><title>إيصال</title>
      <style>body{font-family:Arial,sans-serif;padding:24px;direction:rtl}
      h2{text-align:center}table{width:100%;border-collapse:collapse}
      td{padding:8px;border-bottom:1px solid #eee}
      .total{font-size:1.4em;font-weight:bold;color:#16a34a}
      .footer{text-align:center;margin-top:24px;font-size:0.85em;color:#888}
      </style></head><body>
      <h2>إيصال جلسة ألعاب</h2>
      <table>
        <tr><td>المحطة</td><td>${billModal.stationName}</td></tr>
        <tr><td>اللاعب</td><td>${billModal.playerName}</td></tr>
        <tr><td>بداية الجلسة</td><td>${startTime}</td></tr>
        <tr><td>نهاية الجلسة</td><td>${endTime}</td></tr>
        <tr><td>المدة الفعلية</td><td>${Math.round(billModal.actualDurationMinutes)} دقيقة</td></tr>
        <tr><td>السعر / ساعة</td><td>${formatCurrency(billModal.ratePerHour, billModal.currency)}</td></tr>
        <tr><td class="total">الإجمالي</td><td class="total">${formatCurrency(billModal.totalAmount, billModal.currency)}</td></tr>
        <tr><td>طريقة الدفع</td><td>${paymentMethod === 'cash' ? 'نقداً' : 'بطاقة'}</td></tr>
      </table>
      <div class="footer">شكراً لزيارتكم</div>
      </body></html>
    `)
    win.document.close()
    win.print()
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div dir="rtl">
      <PageHeader
        title="مركز الألعاب"
        description="إدارة محطات الألعاب والجلسات"
        action={
          <Button onClick={() => setCreateModal(true)}>
            <Plus className="h-4 w-4" />
            إضافة محطة
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {/* ── Summary Bar ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="محطات شغّالة"
            value={`${playingStations.length} / ${stations.length}`}
            color="blue"
          />
          <StatCard
            label="محطات متاحة"
            value={String(availableCount)}
            color="green"
          />
          <StatCard
            label="إيرادات تقديرية"
            value={formatCurrency(estimatedRevenue, currency)}
            color="purple"
          />
          <StatCard
            label="إجمالي المحطات"
            value={String(stations.length)}
            color="gray"
          />
        </div>

        {/* ── Station Grid ──────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-52 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800"
              />
            ))}
          </div>
        ) : stations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-gray-400">
            <Monitor className="h-12 w-12" />
            <p className="text-lg">لا توجد محطات بعد</p>
            <Button onClick={() => setCreateModal(true)}>إضافة محطة</Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {stations.map((station) => (
              <StationCard
                key={station.id}
                station={station}
                onStart={() => openStartModal(station)}
                onExtend={() => openExtendModal(station)}
                onEnd={() => endMut.mutate(station)}
                onMaintenance={() => maintenanceMut.mutate(station.id)}
                endLoading={endMut.isPending}
                maintenanceLoading={maintenanceMut.isPending}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Create Station Modal ───────────────────────────────────────────── */}
      <Modal
        open={createModal}
        onClose={() => setCreateModal(false)}
        title="إضافة محطة جديدة"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateModal(false)}>
              إلغاء
            </Button>
            <Button
              loading={createMut.isPending}
              disabled={!newStation.name || !newStation.hourlyRate}
              onClick={() => createMut.mutate()}
            >
              إنشاء
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="اسم المحطة"
            placeholder="مثال: PS5 - 1"
            value={newStation.name}
            onChange={(e) => setNewStation((p) => ({ ...p, name: e.target.value }))}
          />
          <Select
            label="نوع المحطة"
            value={newStation.stationType}
            onChange={(e) =>
              setNewStation((p) => ({ ...p, stationType: e.target.value as StationType }))
            }
          >
            {STATION_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_ICON[t]} {TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="السعر / ساعة"
              type="number"
              min="0"
              step="0.5"
              placeholder="50"
              value={newStation.hourlyRate}
              onChange={(e) => setNewStation((p) => ({ ...p, hourlyRate: e.target.value }))}
            />
            <Input
              label="العملة"
              maxLength={3}
              value={newStation.currency}
              onChange={(e) =>
                setNewStation((p) => ({ ...p, currency: e.target.value.toUpperCase() }))
              }
            />
          </div>
        </div>
      </Modal>

      {/* ── Start Session Modal ────────────────────────────────────────────── */}
      <Modal
        open={!!startModal}
        onClose={() => setStartModal(null)}
        title="بدء جلسة جديدة"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setStartModal(null)}>
              إلغاء
            </Button>
            <Button
              loading={startMut.isPending}
              disabled={!startForm.playerName}
              onClick={() => startMut.mutate()}
            >
              بدء الجلسة
            </Button>
          </>
        }
      >
        {startModal && (
          <div className="space-y-5">
            {/* Station info */}
            <div className="flex items-center gap-3 rounded-xl bg-gray-50 dark:bg-gray-800 p-3">
              <span className="text-3xl">{TYPE_ICON[startModal.type]}</span>
              <div>
                <p className="font-semibold text-gray-900 dark:text-gray-100">
                  {startModal.name}
                </p>
                <p className="text-xs text-gray-500">{TYPE_LABEL[startModal.type]}</p>
              </div>
            </div>

            {/* Player name */}
            <Input
              label="اسم اللاعب"
              placeholder="أدخل اسم اللاعب"
              value={startForm.playerName}
              onChange={(e) =>
                setStartForm((p) => ({ ...p, playerName: e.target.value }))
              }
            />

            {/* Duration */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                المدة
              </label>
              <div className="flex gap-2 flex-wrap">
                {DURATION_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() =>
                      setStartForm((p) => ({
                        ...p,
                        durationMinutes: preset.value,
                        customDuration: false,
                      }))
                    }
                    className={cn(
                      'rounded-lg border px-4 py-2 text-sm font-medium transition-all',
                      !startForm.customDuration &&
                        startForm.durationMinutes === preset.value
                        ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                        : 'border-gray-300 text-gray-600 hover:border-gray-400 dark:border-gray-700 dark:text-gray-400',
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setStartForm((p) => ({ ...p, customDuration: true }))
                  }
                  className={cn(
                    'rounded-lg border px-4 py-2 text-sm font-medium transition-all',
                    startForm.customDuration
                      ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                      : 'border-gray-300 text-gray-600 hover:border-gray-400 dark:border-gray-700 dark:text-gray-400',
                  )}
                >
                  مخصص
                </button>
              </div>
              {startForm.customDuration && (
                <Input
                  type="number"
                  min="1"
                  max="600"
                  placeholder="أدخل عدد الدقائق"
                  value={startForm.customMinutes}
                  onChange={(e) =>
                    setStartForm((p) => ({ ...p, customMinutes: e.target.value }))
                  }
                  hint="بالدقائق"
                />
              )}
            </div>

            {/* Rate & estimated total */}
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="السعر / ساعة"
                type="number"
                min="0"
                step="0.5"
                value={startForm.ratePerHour}
                onChange={(e) =>
                  setStartForm((p) => ({ ...p, ratePerHour: parseFloat(e.target.value) || 0 }))
                }
              />
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  التكلفة المتوقعة
                </label>
                <div className="flex h-9 items-center rounded-lg bg-green-50 px-3 dark:bg-green-900/20">
                  <span className="font-bold text-green-700 dark:text-green-400">
                    {formatCurrency(
                      ((startForm.customDuration
                        ? parseInt(startForm.customMinutes, 10) || 0
                        : startForm.durationMinutes) /
                        60) *
                        startForm.ratePerHour,
                      startModal.currency,
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Extend Session Modal ───────────────────────────────────────────── */}
      <Modal
        open={!!extendModal}
        onClose={() => setExtendModal(null)}
        title="تمديد الوقت"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setExtendModal(null)}>
              إلغاء
            </Button>
            <Button loading={extendMut.isPending} onClick={() => extendMut.mutate()}>
              تمديد
            </Button>
          </>
        }
      >
        {extendModal?.activeSession && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              اللاعب: <span className="font-semibold">{extendModal.activeSession.playerName}</span>
            </p>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                الوقت الإضافي
              </label>
              <div className="flex gap-2 flex-wrap">
                {EXTEND_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => {
                      setExtendMinutes(preset.value)
                      setExtendCustom(false)
                    }}
                    className={cn(
                      'rounded-lg border px-4 py-2 text-sm font-medium transition-all',
                      !extendCustom && extendMinutes === preset.value
                        ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                        : 'border-gray-300 text-gray-600 hover:border-gray-400 dark:border-gray-700 dark:text-gray-400',
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setExtendCustom(true)}
                  className={cn(
                    'rounded-lg border px-4 py-2 text-sm font-medium transition-all',
                    extendCustom
                      ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                      : 'border-gray-300 text-gray-600 hover:border-gray-400 dark:border-gray-700 dark:text-gray-400',
                  )}
                >
                  مخصص
                </button>
              </div>
              {extendCustom && (
                <Input
                  type="number"
                  min="1"
                  max="300"
                  value={extendCustomVal}
                  onChange={(e) => setExtendCustomVal(e.target.value)}
                  hint="بالدقائق"
                />
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ── Bill / End Session Modal ───────────────────────────────────────── */}
      <Modal
        open={!!billModal}
        onClose={() => setBillModal(null)}
        title="الفاتورة"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setBillModal(null)}>
              إغلاق
            </Button>
            <Button onClick={printReceipt}>
              🖨️ طباعة الإيصال
            </Button>
          </>
        }
      >
        {billModal && (
          <div className="space-y-5">
            {/* Station + player header */}
            <div className="rounded-xl bg-gray-50 dark:bg-gray-800 p-4 space-y-1">
              <p className="font-bold text-gray-900 dark:text-gray-100 text-lg">
                {billModal.stationName}
              </p>
              <p className="text-sm text-gray-500">اللاعب: {billModal.playerName}</p>
            </div>

            {/* Bill details */}
            <div className="space-y-2 text-sm">
              {[
                {
                  label: 'بداية الجلسة',
                  value: new Date(billModal.startTime).toLocaleString('ar-SA'),
                },
                {
                  label: 'نهاية الجلسة',
                  value: new Date(billModal.endTime).toLocaleString('ar-SA'),
                },
                {
                  label: 'المدة الفعلية',
                  value: `${Math.round(billModal.actualDurationMinutes)} دقيقة`,
                },
                {
                  label: 'السعر / ساعة',
                  value: formatCurrency(billModal.ratePerHour, billModal.currency),
                },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800"
                >
                  <span className="text-gray-500">{label}</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{value}</span>
                </div>
              ))}

              {/* Total */}
              <div className="flex justify-between py-3 rounded-xl bg-green-50 dark:bg-green-900/20 px-4 mt-2">
                <span className="font-bold text-green-800 dark:text-green-300 text-base">
                  الإجمالي
                </span>
                <span className="font-bold text-green-700 dark:text-green-400 text-xl">
                  {formatCurrency(billModal.totalAmount, billModal.currency)}
                </span>
              </div>
            </div>

            {/* Payment method */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                طريقة الدفع
              </label>
              <div className="flex gap-3">
                {[
                  { value: 'cash', label: '💵 نقداً' },
                  { value: 'card', label: '💳 بطاقة' },
                ].map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setPaymentMethod(m.value as 'cash' | 'card')}
                    className={cn(
                      'flex-1 rounded-lg border py-2.5 text-sm font-medium transition-all',
                      paymentMethod === m.value
                        ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                        : 'border-gray-300 text-gray-600 dark:border-gray-700 dark:text-gray-400',
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color: 'blue' | 'green' | 'purple' | 'gray'
}) {
  const colors = {
    blue: 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-900/20 dark:text-blue-200',
    green:
      'border-green-200 bg-green-50 text-green-900 dark:border-green-900 dark:bg-green-900/20 dark:text-green-200',
    purple:
      'border-purple-200 bg-purple-50 text-purple-900 dark:border-purple-900 dark:bg-purple-900/20 dark:text-purple-200',
    gray: 'border-gray-200 bg-gray-50 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200',
  }
  const sub = {
    blue: 'text-blue-600 dark:text-blue-400',
    green: 'text-green-600 dark:text-green-400',
    purple: 'text-purple-600 dark:text-purple-400',
    gray: 'text-gray-500 dark:text-gray-400',
  }

  return (
    <div className={cn('rounded-xl border px-4 py-3', colors[color])}>
      <p className={cn('text-xs font-medium', sub[color])}>{label}</p>
      <p className="text-xl font-bold mt-0.5">{value}</p>
    </div>
  )
}

// ── Station Card ──────────────────────────────────────────────────────────────

function StationCard({
  station,
  onStart,
  onExtend,
  onEnd,
  onMaintenance,
  endLoading,
  maintenanceLoading,
}: {
  station: GameStationResponse
  onStart: () => void
  onExtend: () => void
  onEnd: () => void
  onMaintenance: () => void
  endLoading: boolean
  maintenanceLoading: boolean
}) {
  const [timeLeftSec, setTimeLeftSec] = useState(0)
  const [isWarning, setIsWarning] = useState(false)
  const [isExpired, setIsExpired] = useState(false)
  const alertedWarning = useRef(false)
  const alertedExpired = useRef(false)

  const session = station.activeSession

  useEffect(() => {
    // Reset alerts when session changes
    alertedWarning.current = false
    alertedExpired.current = false

    if (station.status !== 'InUse' || !session) {
      setTimeLeftSec(0)
      setIsWarning(false)
      setIsExpired(false)
      return
    }

    const endMs =
      new Date(session.startTime).getTime() + session.durationMinutes * 60_000

    const tick = () => {
      const remaining = Math.max(0, Math.floor((endMs - Date.now()) / 1000))
      setTimeLeftSec(remaining)

      const warn = remaining > 0 && remaining <= 300
      const expired = remaining === 0
      setIsWarning(warn)
      setIsExpired(expired)

      if (warn && !alertedWarning.current) {
        alertedWarning.current = true
        playBeep(440, 0.3) // soft warning tone
      }

      if (expired && !alertedExpired.current) {
        alertedExpired.current = true
        playAlarmSequence()
        sendGameNotification('انتهى وقت اللعب! ⏰', station.name)
      }
    }

    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [session?.startTime, session?.durationMinutes, station.status, station.name])

  const mm = Math.floor(timeLeftSec / 60)
  const ss = timeLeftSec % 60
  const timerDisplay = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`

  const totalSec = (session?.durationMinutes ?? 0) * 60
  const progressPct = totalSec > 0 ? Math.max(0, (timeLeftSec / totalSec) * 100) : 0

  // Card border / glow by status
  const cardClass = cn(
    'flex flex-col rounded-2xl border p-4 transition-all duration-300',
    'bg-white dark:bg-gray-900',
    station.status === 'Available' &&
      'border-green-300 shadow-md shadow-green-200/50 dark:border-green-800 dark:shadow-green-900/30',
    station.status === 'InUse' &&
      !isWarning &&
      !isExpired &&
      'border-blue-300 shadow-md shadow-blue-200/50 dark:border-blue-800 dark:shadow-blue-900/30',
    (isWarning || (station.status === 'InUse' && !session)) &&
      'border-red-400 shadow-md shadow-red-200/50 dark:border-red-800 dark:shadow-red-900/30',
    isExpired && 'border-red-500 animate-pulse',
    station.status === 'Maintenance' && 'border-gray-200 opacity-70 dark:border-gray-700',
  )

  // Status badge
  const statusBadge =
    station.status === 'Available' ? (
      <Badge variant="green">متاح</Badge>
    ) : station.status === 'InUse' ? (
      <Badge variant={isWarning || isExpired ? 'red' : 'blue'}>
        {isExpired ? 'انتهى!' : 'يلعب'}
      </Badge>
    ) : (
      <Badge variant="gray">صيانة</Badge>
    )

  return (
    <div className={cardClass}>
      {/* Header row */}
      <div className="flex items-start justify-between mb-2">
        <span className="text-2xl">{TYPE_ICON[station.type]}</span>
        {statusBadge}
      </div>

      {/* Station name */}
      <p className="font-bold text-gray-900 dark:text-gray-100 text-sm leading-tight">
        {station.name}
      </p>
      <p className="text-xs text-gray-400 mb-1">{TYPE_LABEL[station.type]}</p>

      {/* Rate */}
      <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-3">
        {formatCurrency(station.hourlyRate, station.currency)} / ساعة
      </p>

      {/* ── InUse: player + timer ───────────────────────────────────────── */}
      {station.status === 'InUse' && session && (
        <div className="flex-1 space-y-2 mb-3">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 truncate">
            👤 {session.playerName}
          </p>

          {/* Timer */}
          {isExpired ? (
            <div className="text-center py-1">
              <p className="text-red-600 dark:text-red-400 font-bold text-base">
                انتهى الوقت!
              </p>
            </div>
          ) : (
            <>
              <div className="text-center">
                <span
                  className={cn(
                    'font-mono text-2xl font-bold tabular-nums',
                    isWarning
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-gray-900 dark:text-gray-100',
                  )}
                >
                  {timerDisplay}
                </span>
                <p className="text-xs text-gray-400 mt-0.5">دقيقة : ثانية</p>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-1000',
                    isWarning ? 'bg-red-500' : 'bg-blue-500',
                  )}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Available: spacer ──────────────────────────────────────────────── */}
      {station.status === 'Available' && <div className="flex-1" />}

      {/* ── Maintenance: spacer ────────────────────────────────────────────── */}
      {station.status === 'Maintenance' && (
        <div className="flex-1 flex items-center">
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <Wrench className="h-3 w-3" /> قيد الصيانة
          </p>
        </div>
      )}

      {/* ── Action buttons ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1.5 mt-auto">
        {station.status === 'Available' && (
          <Button
            variant="primary"
            size="sm"
            className="w-full justify-center"
            onClick={onStart}
          >
            ▶ بدء جلسة
          </Button>
        )}

        {station.status === 'InUse' && (
          <div className="flex gap-1">
            <Button
              variant="secondary"
              size="sm"
              className="flex-1 justify-center text-xs"
              onClick={onExtend}
            >
              + تمديد
            </Button>
            <Button
              variant="danger"
              size="sm"
              className="flex-1 justify-center text-xs"
              onClick={onEnd}
              loading={endLoading}
            >
              إنهاء
            </Button>
          </div>
        )}

        {station.status !== 'Maintenance' && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center text-xs text-gray-400"
            onClick={onMaintenance}
            loading={maintenanceLoading}
          >
            <Wrench className="h-3 w-3" />
            صيانة
          </Button>
        )}
      </div>
    </div>
  )
}
