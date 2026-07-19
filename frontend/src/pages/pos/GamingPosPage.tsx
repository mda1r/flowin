import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Gamepad2, Timer, X, Zap } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/stores/authStore'
import { gamingApi } from '@/api/gaming'
import { toast } from '@/components/ui/Toast'
import { cn, formatCurrency } from '@/lib/utils'
import type { GameStationResponse, GameSessionBillResponse, StationType } from '@/types/api'

/* neon gaming accent scoped to this page */
const GAMING_ACCENT: React.CSSProperties = {
  '--accent': '#7C3AED',
  '--glow': 'rgba(124,58,237,0.45)',
} as React.CSSProperties

/* arcade cabinet: slightly angled top bezel in the accent color */
const CABINET_BEZEL: React.CSSProperties = {
  background: 'linear-gradient(180deg, color-mix(in srgb, var(--accent) 45%, transparent), transparent)',
  transform: 'perspective(300px) rotateX(38deg)',
  transformOrigin: 'top center',
}

const STATION_TYPE_AR: Record<StationType, string> = {
  Console: 'كونسول',
  PC: 'كمبيوتر',
  VR: 'واقع افتراضي',
  Arcade: 'أركيد',
  Board: 'ألعاب ورقية',
}

const DURATION_OPTIONS = [
  { label: '30 دقيقة', value: 30 },
  { label: 'ساعة', value: 60 },
  { label: 'ساعة ونصف', value: 90 },
  { label: 'ساعتان', value: 120 },
  { label: 'مفتوح', value: 999 },
]

function getElapsedMinutes(startTime: string): number {
  return Math.floor((Date.now() - new Date(startTime).getTime()) / 60000)
}

export function GamingPosPage() {
  const { branchId } = useAuthStore()
  const qc = useQueryClient()

  const [renderKey, setRenderKey] = useState(0)
  const [startStation, setStartStation] = useState<GameStationResponse | null>(null)
  const [endStation, setEndStation] = useState<GameStationResponse | null>(null)
  const [bill, setBill] = useState<GameSessionBillResponse | null>(null)
  const [playerName, setPlayerName] = useState('')
  const [duration, setDuration] = useState(60)

  // Tick every 30 s to refresh elapsed time display
  useEffect(() => {
    const id = setInterval(() => setRenderKey(k => k + 1), 30000)
    return () => clearInterval(id)
  }, [])

  const { data: stations = [], isLoading } = useQuery({
    queryKey: ['gaming', 'stations', branchId],
    queryFn: () => gamingApi.listStations(branchId!).then(r => r.data),
    enabled: !!branchId,
    refetchInterval: 60000,
  })

  const activeStations = stations.filter(s => s.isActive)
  const availableCount = activeStations.filter(s => s.status === 'Available').length
  const inUseCount = activeStations.filter(s => s.status === 'InUse').length

  const startMut = useMutation({
    mutationFn: () =>
      gamingApi.startSession(branchId!, startStation!.id, {
        playerName,
        durationMinutes: duration,
        ratePerHour: startStation!.hourlyRate,
      }),
    onSuccess: () => {
      toast.success('بدأت الجلسة', `${startStation!.name} — ${playerName}`)
      qc.invalidateQueries({ queryKey: ['gaming', 'stations'] })
      closeStart()
    },
    onError: () => toast.error('فشل بدء الجلسة', 'يرجى المحاولة مرة أخرى'),
  })

  const endMut = useMutation({
    mutationFn: () =>
      gamingApi.endSessionById(branchId!, endStation!.activeSession!.sessionId),
    onSuccess: result => {
      setBill(result.data)
      qc.invalidateQueries({ queryKey: ['gaming', 'stations'] })
    },
    onError: () => toast.error('فشل إنهاء الجلسة', 'يرجى المحاولة مرة أخرى'),
  })

  const closeStart = () => {
    setStartStation(null)
    setPlayerName('')
    setDuration(60)
  }

  const handleEndStation = (station: GameStationResponse) => {
    setEndStation(station)
    endMut.mutate()
  }

  const closeBill = () => {
    setBill(null)
    setEndStation(null)
  }

  // suppress lint on renderKey — it's only used to trigger re-renders
  void renderKey

  return (
    <div dir="rtl" className="flex h-[calc(100vh-0px)] flex-col" style={GAMING_ACCENT}>
      <PageHeader title="نقطة البيع — الألعاب" />

      {/* Stats bar */}
      <div className="flex gap-3 px-6 py-3">
        <span className="card-3d px-3 py-1.5 text-sm text-gray-500">
          متاح: <strong className="text-blue-500">{availableCount}</strong>
        </span>
        <span className="card-3d px-3 py-1.5 text-sm text-gray-500">
          في جلسة: <strong style={{ color: 'var(--accent)' }}>{inUseCount}</strong>
        </span>
        <span className="card-3d px-3 py-1.5 text-sm text-gray-500">
          الكل: <strong className="text-gray-900 dark:text-gray-100">{activeStations.length}</strong>
        </span>
      </div>

      {/* Station grid — arcade cabinets */}
      <div className="scene-3d flex-1 overflow-y-auto p-6 pt-2">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="shimmer-skeleton h-44" />
            ))}
          </div>
        ) : activeStations.length === 0 ? (
          <div className="mt-20 text-center text-sm text-gray-400">
            <Gamepad2 className="mx-auto mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" />
            <p>لا توجد محطات</p>
            <p className="mt-1 text-xs">أضف محطات من قسم الألعاب أولاً</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {activeStations.map(station => {
              const isAvail = station.status === 'Available'
              const isInUse = station.status === 'InUse'
              const session = station.activeSession
              const elapsed = session ? getElapsedMinutes(session.startTime) : 0
              const planned = session?.durationMinutes ?? 0
              const isOvertime = isInUse && planned !== 999 && elapsed > planned
              const progressPct = planned && planned !== 999
                ? Math.min(100, Math.round((elapsed / planned) * 100))
                : 0

              return (
                <div
                  key={station.id}
                  className={cn(
                    'card-3d card-3d-lift extruded-3d relative flex flex-col overflow-visible p-4 pt-5',
                    isAvail && 'halo-idle',
                    isInUse && !isOvertime && 'neon-border',
                    isOvertime && 'danger-glow',
                    !isAvail && !isInUse && 'opacity-60',
                  )}
                  style={isAvail ? { '--glow': 'rgba(59,130,246,0.35)' } as React.CSSProperties : undefined}
                >
                  {/* angled cabinet top edge */}
                  <div aria-hidden="true" className="absolute inset-x-3 top-0 h-2 rounded-t-md" style={CABINET_BEZEL} />

                  <div className="mb-2 flex items-center justify-between">
                    <span
                      className={cn(
                        'text-xs font-bold',
                        isAvail
                          ? 'text-blue-500'
                          : isInUse
                            ? isOvertime ? 'text-red-500' : ''
                            : 'text-gray-400',
                      )}
                      style={isInUse && !isOvertime ? { color: 'var(--accent)' } : undefined}
                    >
                      {isAvail ? 'متاح' : isInUse ? (isOvertime ? 'تجاوز الوقت!' : 'في جلسة') : 'صيانة'}
                    </span>
                    <Gamepad2
                      className={cn(
                        'h-4 w-4',
                        isAvail ? 'text-blue-500' : isInUse ? (isOvertime ? 'text-red-500' : '') : 'text-gray-400',
                      )}
                      style={isInUse && !isOvertime ? { color: 'var(--accent)', filter: 'drop-shadow(0 0 6px var(--glow))' } : undefined}
                    />
                  </div>

                  <p className="text-emboss truncate font-bold text-gray-900 dark:text-gray-100">{station.name}</p>
                  <p className="text-xs text-gray-500">{STATION_TYPE_AR[station.type]}</p>
                  <p className="text-xs text-gray-500">{formatCurrency(station.hourlyRate)} / ساعة</p>

                  {isInUse && session && (
                    <div
                      className="mt-2 rounded-lg px-2 py-2"
                      style={{
                        background: isOvertime
                          ? 'rgba(239,68,68,0.12)'
                          : 'color-mix(in srgb, var(--accent) 12%, transparent)',
                        boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.18)',
                      }}
                    >
                      <p className="truncate text-xs font-semibold text-gray-800 dark:text-gray-200">
                        {session.playerName}
                      </p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <Timer className={cn('h-3 w-3', isOvertime ? 'text-red-500' : 'text-gray-500')} />
                        <span
                          className={cn('seg-display text-sm font-bold', isOvertime && 'text-red-500')}
                          style={!isOvertime ? { color: 'var(--accent)' } : { textShadow: '0 0 10px rgba(239,68,68,0.6)' }}
                        >
                          {elapsed}/{planned === 999 ? '∞' : planned}
                        </span>
                        <span className="text-[10px] text-gray-500">دق</span>
                      </div>
                      {planned !== 999 && (
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-200 shadow-inner dark:bg-gray-700">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${progressPct}%`,
                              background: isOvertime ? '#ef4444' : 'var(--accent)',
                              boxShadow: isOvertime ? '0 0 8px rgba(239,68,68,0.7)' : '0 0 8px var(--glow)',
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-3">
                    {isAvail && (
                      <button
                        onClick={() => setStartStation(station)}
                        className="btn-3d w-full py-1.5 text-xs"
                      >
                        ابدأ جلسة
                      </button>
                    )}
                    {isInUse && (
                      <button
                        onClick={() => handleEndStation(station)}
                        disabled={endMut.isPending && endStation?.id === station.id}
                        className="btn-3d w-full py-1.5 text-xs"
                        style={
                          isOvertime
                            ? { background: '#ef4444', boxShadow: '0 4px 0 rgba(0,0,0,0.3), 0 10px 24px rgba(239,68,68,0.4)' }
                            : undefined
                        }
                      >
                        {endMut.isPending && endStation?.id === station.id ? 'جاري الإنهاء...' : 'إنهاء الجلسة'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Start session modal */}
      {startStation && (
        <div className="scene-3d fixed inset-0 z-50 flex items-center justify-center" style={GAMING_ACCENT}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeStart} />
          <div
            className="glass-panel relative mx-4 w-full max-w-sm animate-float-up p-6"
            style={{ borderColor: 'color-mix(in srgb, var(--accent) 40%, transparent)' }}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">بدء جلسة</h2>
                <p className="text-xs text-gray-500">
                  {startStation.name} — {STATION_TYPE_AR[startStation.type]}
                </p>
              </div>
              <button onClick={closeStart}>
                <X className="h-4 w-4 text-gray-400 transition-colors hover:text-gray-600" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                  اسم اللاعب
                </label>
                <input
                  value={playerName}
                  onChange={e => setPlayerName(e.target.value)}
                  className="input-3d w-full"
                  placeholder="أحمد محمد"
                  autoFocus
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-gray-600 dark:text-gray-400">
                  مدة الجلسة
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {DURATION_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setDuration(opt.value)}
                      className={cn('tab-3d !rounded-xl py-2.5', duration === opt.value ? 'tab-3d-active' : 'tab-3d-idle')}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div
                className="rounded-xl p-3"
                style={{
                  background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
                  boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.15), 0 0 14px var(--glow)',
                }}
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">السعر التقديري</span>
                  <span className="seg-display font-bold" style={{ color: 'var(--accent)' }}>
                    {duration === 999
                      ? 'يحسب عند الإنهاء'
                      : formatCurrency((startStation.hourlyRate / 60) * duration)}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-gray-400">
                  <span>{formatCurrency(startStation.hourlyRate)} / ساعة</span>
                  {duration !== 999 && <span>{duration} دقيقة</span>}
                </div>
              </div>
            </div>

            <div className="mt-4 flex gap-3">
              <Button variant="secondary" onClick={closeStart} className="flex-1">
                إلغاء
              </Button>
              <Button
                variant="primary"
                onClick={() => startMut.mutate()}
                loading={startMut.isPending}
                disabled={!playerName.trim()}
                className="btn-3d flex-1 !bg-[color:var(--accent)] shadow-glow-accent hover:!bg-[color:var(--accent)]"
              >
                <Zap className="ms-1.5 h-4 w-4" />
                ابدأ الجلسة
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bill modal — dark glass with purple accent */}
      {bill && (
        <div className="scene-3d fixed inset-0 z-50 flex items-center justify-center" style={GAMING_ACCENT}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeBill} />
          <div
            className="glass-panel relative mx-4 w-full max-w-sm animate-float-up p-6"
            style={{ borderColor: 'color-mix(in srgb, var(--accent) 45%, transparent)' }}
          >
            <h2 className="mb-4 text-base font-semibold">فاتورة الجلسة</h2>

            <div className="mb-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">المحطة</span>
                <span className="font-medium">{bill.stationName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">اللاعب</span>
                <span className="font-medium">{bill.playerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">المدة الفعلية</span>
                <span className="seg-display">{bill.actualDurationMinutes} دقيقة</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">السعر / ساعة</span>
                <span>{formatCurrency(bill.ratePerHour)}</span>
              </div>
            </div>

            <div
              className="mb-6 rounded-xl p-4"
              style={{
                background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
                boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.18), 0 0 22px var(--glow)',
              }}
            >
              <p className="text-xs text-gray-500">الإجمالي</p>
              <p className="text-emboss seg-display text-3xl font-bold" style={{ color: 'var(--accent)' }}>
                {formatCurrency(bill.totalAmount)}
              </p>
            </div>

            <Button
              variant="primary"
              onClick={closeBill}
              className="btn-3d w-full !bg-[color:var(--accent)] hover:!bg-[color:var(--accent)]"
            >
              تم الاستلام
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
