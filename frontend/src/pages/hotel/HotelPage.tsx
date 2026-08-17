import { useState, useEffect, type ReactNode } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  BedDouble, AlertTriangle, CheckCircle, Clock, Sparkles, Plus, QrCode,
  Users, Home, Brush, Calendar, Phone, CreditCard,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { hotelApi } from '@/api/hotel'
import { zatcaApi } from '@/api/zatca'
import { useAuthStore } from '@/stores/authStore'
import { toast } from '@/components/ui/Toast'
import { formatCurrency, formatDate } from '@/lib/utils'
import { generateZatcaQr, SAUDI_VAT_RATE } from '@/lib/zatca'
import type { RoomResponse, ReservationResponse, RoomType, RoomStatus } from '@/types/api'

// ── Types ──────────────────────────────────────────────────────────────────────

type Tab = 'dashboard' | 'cashier' | 'cleaning'

const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  Standard: 'غرفة مفردة',
  Deluxe: 'غرفة مزدوجة',
  Suite: 'جناح',
  Presidential: 'جناح رئاسي',
}

const STATUS_LABELS: Record<RoomStatus, string> = {
  Available: 'متاحة',
  Occupied: 'مشغولة',
  Reserved: 'محجوزة',
  Maintenance: 'صيانة',
}

const STATUS_BADGE: Record<RoomStatus, 'green' | 'red' | 'blue' | 'gray'> = {
  Available: 'green',
  Occupied: 'red',
  Reserved: 'blue',
  Maintenance: 'gray',
}

// ── Check-in form schema ───────────────────────────────────────────────────────

const checkInSchema = z.object({
  roomId: z.string().min(1, 'اختر غرفة'),
  guestName: z.string().min(2, 'أدخل الاسم الكامل'),
  guestNationalId: z.string().min(3, 'أدخل رقم الهوية أو الجواز'),
  guestPhone: z.string().min(9, 'أدخل رقم هاتف صحيح'),
  checkIn: z.string().min(1, 'اختر تاريخ الوصول'),
  checkOut: z.string().min(1, 'اختر تاريخ المغادرة'),
  ratePerNight: z.coerce.number().positive('السعر يجب أن يكون أكبر من صفر'),
  notes: z.string().optional(),
})

type CheckInFormData = z.infer<typeof checkInSchema>

// ── Add-room schema ────────────────────────────────────────────────────────────

const addRoomSchema = z.object({
  roomNumber: z.string().min(1, 'رقم الغرفة مطلوب'),
  roomType: z.enum(['Standard', 'Deluxe', 'Suite', 'Presidential']),
  floor: z.coerce.number().int().min(0, 'الطابق يجب أن يكون صحيحاً'),
  capacity: z.coerce.number().int().positive('السعة يجب أن تكون أكبر من صفر'),
  nightlyRate: z.coerce.number().positive('السعر يجب أن يكون أكبر من صفر'),
  currency: z.string().length(3, 'رمز العملة 3 أحرف'),
  description: z.string().optional(),
})

type AddRoomFormData = z.infer<typeof addRoomSchema>

// ── Utility helpers ────────────────────────────────────────────────────────────

function todayDateStr() {
  return new Date().toISOString().split('T')[0]
}

function tomorrowDateStr() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

function nightsCount(checkIn: string, checkOut: string): number {
  const d1 = new Date(checkIn)
  const d2 = new Date(checkOut)
  return Math.max(0, Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)))
}

function daysUntilCheckout(checkOut: string): number {
  const now = new Date()
  const out = new Date(checkOut)
  return Math.ceil((out.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function isCheckoutToday(checkOut: string): boolean {
  const today = new Date()
  const out = new Date(checkOut)
  return (
    out.getFullYear() === today.getFullYear() &&
    out.getMonth() === today.getMonth() &&
    out.getDate() === today.getDate()
  )
}

function isCheckoutOverdue(checkOut: string): boolean {
  return new Date(checkOut) < new Date()
}

// ── Main component ─────────────────────────────────────────────────────────────

export function HotelPage() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const [showAddRoom, setShowAddRoom] = useState(false)
  const [checkoutReceipt, setCheckoutReceipt] = useState<ReservationResponse | null>(null)
  const [checkoutRoomNumber, setCheckoutRoomNumber] = useState<string>('')

  const { branchId, tenantId } = useAuthStore()
  const qc = useQueryClient()

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['hotel-rooms', branchId] })
    qc.invalidateQueries({ queryKey: ['hotel-reservations', branchId] })
    qc.invalidateQueries({ queryKey: ['hotel-alerts', branchId] })
  }

  // ── Data queries ───────────────────────────────────────────────────────────

  const { data: roomsData, isLoading: roomsLoading } = useQuery({
    queryKey: ['hotel-rooms', branchId],
    queryFn: () => hotelApi.listHotelRooms(branchId!),
    enabled: !!branchId,
    refetchInterval: 60000,
  })

  const { data: reservationsData } = useQuery({
    queryKey: ['hotel-reservations', branchId],
    queryFn: () => hotelApi.listReservations(branchId!),
    enabled: !!branchId,
    refetchInterval: 60000,
  })

  const { data: alertsData } = useQuery({
    queryKey: ['hotel-alerts', branchId],
    queryFn: () => hotelApi.getCheckoutAlerts(branchId!),
    enabled: !!branchId,
    refetchInterval: 60000,
  })

  const rooms: RoomResponse[] = roomsData?.data ?? []
  const reservations: ReservationResponse[] = reservationsData?.data ?? []
  const alerts: ReservationResponse[] = alertsData?.data ?? []

  // ── Alert toasts ───────────────────────────────────────────────────────────

  useEffect(() => {
    const overdue = alerts.filter((a) => isCheckoutOverdue(a.checkOut))
    if (overdue.length > 0) {
      toast.error(
        'تنبيه تأخير المغادرة',
        `${overdue.length} ضيف تجاوز وقت تسجيل المغادرة`,
      )
    }
  }, [alerts.length]) // only fire when count changes

  // ── Mutations ──────────────────────────────────────────────────────────────

  const markClean = useMutation({
    mutationFn: (roomId: string) => hotelApi.markClean(branchId!, roomId),
    onSuccess: (_, roomId) => {
      invalidateAll()
      const room = rooms.find((r) => r.id === roomId)
      toast.success('تم تحديث حالة النظافة', `الغرفة ${room?.roomNumber ?? ''} جاهزة`)
    },
    onError: () => toast.error('فشل التحديث', 'يرجى المحاولة مرة أخرى'),
  })

  // ── Stats ──────────────────────────────────────────────────────────────────

  const totalRooms = rooms.filter((r) => r.isActive).length
  const occupiedRooms = rooms.filter((r) => r.status === 'Occupied').length
  const availableRooms = rooms.filter((r) => r.status === 'Available').length
  const needsCleaningRooms = rooms.filter((r) => r.cleaningStatus === 'NeedsClean').length
  const todayCheckouts = alerts.filter(
    (a) => isCheckoutToday(a.checkOut) || isCheckoutOverdue(a.checkOut),
  )

  // ── Tabs ───────────────────────────────────────────────────────────────────

  const tabs: { id: Tab; label: string; icon: ReactNode; count?: number }[] = [
    { id: 'dashboard', label: 'لوحة التحكم', icon: <Home className="h-4 w-4" /> },
    {
      id: 'cashier',
      label: 'الكاشير',
      icon: <CreditCard className="h-4 w-4" />,
      count: reservations.length,
    },
    {
      id: 'cleaning',
      label: 'التنظيف',
      icon: <Brush className="h-4 w-4" />,
      count: needsCleaningRooms || undefined,
    },
  ]

  const overdueCount = alerts.filter((a) => isCheckoutOverdue(a.checkOut)).length
  const soonCount = alerts.filter(
    (a) => !isCheckoutOverdue(a.checkOut) && new Date(a.checkOut) <= new Date(Date.now() + 2 * 60 * 60 * 1000),
  ).length

  return (
    <div dir="rtl">
      <PageHeader
        title="إدارة الفندق"
        description="إدارة الغرف والحجوزات والتنظيف"
        action={
          <Button onClick={() => setShowAddRoom(true)}>
            <Plus className="h-4 w-4" />
            إضافة غرفة
          </Button>
        }
      />

      <div className="px-6 pb-6 space-y-4">

        {/* ── Persistent alert bar ────────────────────────────────────────── */}
        {overdueCount > 0 && (
          <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900 dark:bg-red-900/20">
            <AlertTriangle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
            <p className="text-sm font-medium text-red-700 dark:text-red-300">
              {overdueCount} ضيف تجاوز وقت المغادرة — يرجى المتابعة فوراً
            </p>
          </div>
        )}
        {soonCount > 0 && overdueCount === 0 && (
          <div className="flex items-center gap-3 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 dark:border-yellow-900 dark:bg-yellow-900/20">
            <Clock className="h-5 w-5 shrink-0 text-yellow-600 dark:text-yellow-400" />
            <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
              {soonCount} ضيف سيغادر خلال ساعتين — كن مستعداً
            </p>
          </div>
        )}

        {/* ── Tabs ────────────────────────────────────────────────────────── */}
        <div className="flex gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-gray-800 dark:bg-gray-900">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-gray-100'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="rounded-full bg-blue-500 px-1.5 py-0.5 text-xs text-white">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Tab: Dashboard ────────────────────────────────────────────────── */}
        {activeTab === 'dashboard' && (
          <DashboardTab
            rooms={rooms}
            loading={roomsLoading}
            totalRooms={totalRooms}
            occupiedRooms={occupiedRooms}
            availableRooms={availableRooms}
            needsCleaningRooms={needsCleaningRooms}
            todayCheckouts={todayCheckouts}
          />
        )}

        {/* ── Tab: Cashier ──────────────────────────────────────────────────── */}
        {activeTab === 'cashier' && (
          <CashierTab
            rooms={rooms}
            reservations={reservations}
            branchId={branchId!}
            tenantId={tenantId!}
            onCheckoutSuccess={(reservation, roomNumber) => {
              setCheckoutReceipt(reservation)
              setCheckoutRoomNumber(roomNumber)
            }}
            onDataChange={invalidateAll}
          />
        )}

        {/* ── Tab: Cleaning ─────────────────────────────────────────────────── */}
        {activeTab === 'cleaning' && (
          <CleaningTab
            rooms={rooms}
            loading={roomsLoading}
            onMarkClean={(roomId) => markClean.mutate(roomId)}
            markCleanPending={markClean.isPending}
          />
        )}
      </div>

      {/* ── Add Room Modal ────────────────────────────────────────────────── */}
      <AddRoomModal
        open={showAddRoom}
        onClose={() => setShowAddRoom(false)}
        branchId={branchId!}
        tenantId={tenantId!}
        onSuccess={invalidateAll}
      />

      {/* ── ZATCA Checkout Receipt ────────────────────────────────────────── */}
      {checkoutReceipt && (
        <HotelReceiptModal
          reservation={checkoutReceipt}
          roomNumber={checkoutRoomNumber}
          onClose={() => { setCheckoutReceipt(null); setCheckoutRoomNumber('') }}
        />
      )}
    </div>
  )
}

// ── Dashboard Tab ──────────────────────────────────────────────────────────────

function DashboardTab({
  rooms,
  loading,
  totalRooms,
  occupiedRooms,
  availableRooms,
  needsCleaningRooms,
  todayCheckouts,
}: {
  rooms: RoomResponse[]
  loading: boolean
  totalRooms: number
  occupiedRooms: number
  availableRooms: number
  needsCleaningRooms: number
  todayCheckouts: ReservationResponse[]
}) {
  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="إجمالي الغرف" value={totalRooms} color="gray" icon={<BedDouble className="h-5 w-5" />} />
        <StatCard label="مشغولة" value={occupiedRooms} color="red" icon={<Users className="h-5 w-5" />} />
        <StatCard label="متاحة" value={availableRooms} color="green" icon={<CheckCircle className="h-5 w-5" />} />
        <StatCard label="تحتاج تنظيف" value={needsCleaningRooms} color="orange" icon={<Brush className="h-5 w-5" />} />
      </div>

      {/* Today's checkouts */}
      {todayCheckouts.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
            مغادرة اليوم ({todayCheckouts.length})
          </h3>
          <div className="divide-y divide-gray-100 rounded-xl border border-orange-200 bg-orange-50 dark:divide-gray-800 dark:border-orange-900/50 dark:bg-orange-900/10">
            {todayCheckouts.map((r) => {
              const overdue = isCheckoutOverdue(r.checkOut)
              return (
                <div key={r.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{r.guestName}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(r.checkOut).toLocaleTimeString('ar-SA', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  {overdue ? (
                    <Badge variant="red">متأخر</Badge>
                  ) : (
                    <Badge variant="orange">اليوم</Badge>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Room grid */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
          ))}
        </div>
      ) : rooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <BedDouble className="mb-3 h-12 w-12 text-gray-300" />
          <p className="text-gray-500">لا توجد غرف مسجلة بعد</p>
          <p className="text-sm text-gray-400">أضف أول غرفة باستخدام زر "إضافة غرفة"</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {rooms
            .filter((r) => r.isActive)
            .sort((a, b) => a.floor - b.floor || a.roomNumber.localeCompare(b.roomNumber))
            .map((room) => (
              <RoomCard key={room.id} room={room} />
            ))}
        </div>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  color,
  icon,
}: {
  label: string
  value: number
  color: 'gray' | 'red' | 'green' | 'orange'
  icon: ReactNode
}) {
  const colors = {
    gray: 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50',
    red: 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-900/20',
    green: 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-900/20',
    orange: 'border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-900/20',
  }

  const textColors = {
    gray: 'text-gray-600 dark:text-gray-400',
    red: 'text-red-700 dark:text-red-400',
    green: 'text-green-700 dark:text-green-400',
    orange: 'text-orange-700 dark:text-orange-400',
  }

  const valueColors = {
    gray: 'text-gray-900 dark:text-gray-100',
    red: 'text-red-900 dark:text-red-300',
    green: 'text-green-900 dark:text-green-300',
    orange: 'text-orange-900 dark:text-orange-300',
  }

  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <div className={`mb-2 ${textColors[color]}`}>{icon}</div>
      <p className={`text-2xl font-bold ${valueColors[color]}`}>{value}</p>
      <p className={`text-xs ${textColors[color]}`}>{label}</p>
    </div>
  )
}

function RoomCard({ room }: { room: RoomResponse }) {
  const res = room.activeReservation
  const daysLeft = res ? daysUntilCheckout(res.checkOut) : null
  const overdue = res ? isCheckoutOverdue(res.checkOut) : false
  const today = res ? isCheckoutToday(res.checkOut) : false

  const cleaningBadge: Record<string, { label: string; variant: 'green' | 'orange' | 'yellow' }> = {
    Clean: { label: 'نظيفة', variant: 'green' },
    NeedsClean: { label: 'تحتاج تنظيف', variant: 'orange' },
    InProgress: { label: 'جاري التنظيف', variant: 'yellow' },
  }
  const cleaning = cleaningBadge[room.cleaningStatus] ?? cleaningBadge.Clean

  return (
    <div
      className={`relative rounded-xl border p-4 transition-all ${
        overdue
          ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
          : today
          ? 'border-orange-300 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/20'
          : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900'
      }`}
    >
      {/* Alert indicator */}
      {(overdue || today) && (
        <div className="absolute -top-1.5 -right-1.5">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white shadow-sm">
            <AlertTriangle className="h-2.5 w-2.5" />
          </span>
        </div>
      )}

      <div className="mb-2 flex items-center justify-between gap-1 flex-wrap">
        <BedDouble className="h-4 w-4 text-gray-400 shrink-0" />
        <Badge variant={STATUS_BADGE[room.status]}>{STATUS_LABELS[room.status]}</Badge>
      </div>

      <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{room.roomNumber}</p>
      <p className="text-xs text-gray-500 mb-2">
        {ROOM_TYPE_LABELS[room.roomType]} · ط{room.floor}
      </p>

      <Badge variant={cleaning.variant} className="mb-2">{cleaning.label}</Badge>

      {res && (
        <div className="mt-2 border-t border-gray-100 pt-2 dark:border-gray-800">
          <p className="truncate text-xs font-medium text-gray-800 dark:text-gray-200">{res.guestName}</p>
          <p className="text-xs text-gray-500">
            {overdue ? (
              <span className="font-medium text-red-600 dark:text-red-400">متأخر عن المغادرة</span>
            ) : today ? (
              <span className="font-medium text-orange-600 dark:text-orange-400">يغادر اليوم</span>
            ) : (
              <span>يغادر بعد {daysLeft} {daysLeft === 1 ? 'يوم' : 'أيام'}</span>
            )}
          </p>
          <p className="text-xs text-gray-400">
            {formatDate(res.checkOut, 'ar-SA')}
          </p>
        </div>
      )}

      {!res && (
        <p className="mt-1 text-sm font-semibold text-blue-600 dark:text-blue-400">
          {formatCurrency(room.nightlyRate, room.currency)} / ليلة
        </p>
      )}
    </div>
  )
}

// ── Cashier Tab ────────────────────────────────────────────────────────────────

function CashierTab({
  rooms,
  reservations,
  branchId,
  tenantId,
  onCheckoutSuccess,
  onDataChange,
}: {
  rooms: RoomResponse[]
  reservations: ReservationResponse[]
  branchId: string
  tenantId: string
  onCheckoutSuccess: (reservation: ReservationResponse, roomNumber: string) => void
  onDataChange: () => void
}) {
  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<CheckInFormData>({
    resolver: zodResolver(checkInSchema),
    defaultValues: {
      checkIn: todayDateStr(),
      checkOut: tomorrowDateStr(),
      ratePerNight: 0,
    },
  })

  const watchedRoomId = watch('roomId')
  const watchedCheckIn = watch('checkIn')
  const watchedCheckOut = watch('checkOut')
  const watchedRate = watch('ratePerNight')

  const nights = nightsCount(watchedCheckIn ?? '', watchedCheckOut ?? '')
  const subtotal = nights * (watchedRate || 0)
  const vat = subtotal * SAUDI_VAT_RATE
  const total = subtotal + vat

  // Auto-fill rate when room changes
  useEffect(() => {
    if (!watchedRoomId) return
    const room = rooms.find((r) => r.id === watchedRoomId)
    if (room) {
      setValue('ratePerNight', room.nightlyRate)
    }
  }, [watchedRoomId, rooms, setValue])

  const availableRooms = rooms.filter((r) => r.isActive && r.status === 'Available')

  const checkIn = useMutation({
    mutationFn: (data: CheckInFormData) =>
      hotelApi.checkIn(branchId, data.roomId, {
        tenantId,
        guestName: data.guestName,
        guestNationalId: data.guestNationalId,
        guestPhone: data.guestPhone,
        checkIn: new Date(data.checkIn).toISOString(),
        checkOut: new Date(data.checkOut).toISOString(),
        ratePerNight: data.ratePerNight,
        notes: data.notes || undefined,
      }),
    onSuccess: () => {
      onDataChange()
      reset({ checkIn: todayDateStr(), checkOut: tomorrowDateStr(), ratePerNight: 0 })
      toast.success('تم تسجيل الوصول', 'تم إنشاء الحجز بنجاح')
    },
    onError: () => toast.error('فشل تسجيل الوصول', 'يرجى التحقق من البيانات والمحاولة مرة أخرى'),
  })

  const checkOut = useMutation({
    mutationFn: ({ reservationId }: { reservationId: string; roomNumber: string }) =>
      hotelApi.checkOut(branchId, reservationId),
    onSuccess: (response, variables) => {
      onDataChange()
      onCheckoutSuccess(response.data, variables.roomNumber)
    },
    onError: () => toast.error('فشل تسجيل المغادرة', 'يرجى المحاولة مرة أخرى'),
  })

  const roomMap = Object.fromEntries(rooms.map((r) => [r.id, r]))

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Check-in form */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-5 text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-blue-500" />
          تسجيل وصول جديد
        </h3>

        <form onSubmit={handleSubmit((d) => checkIn.mutate(d))} className="space-y-4">
          {/* Room select */}
          <Select
            label="الغرفة"
            error={errors.roomId?.message}
            {...register('roomId')}
          >
            <option value="">اختر غرفة متاحة...</option>
            {availableRooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.roomNumber} — {ROOM_TYPE_LABELS[r.roomType]} (ط{r.floor}) — {formatCurrency(r.nightlyRate, r.currency)}/ليلة
              </option>
            ))}
          </Select>

          {availableRooms.length === 0 && (
            <p className="rounded-lg bg-yellow-50 px-3 py-2 text-xs text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400">
              لا توجد غرف متاحة حالياً
            </p>
          )}

          {/* Guest info */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="الاسم الكامل"
              placeholder="محمد أحمد السعيد"
              error={errors.guestName?.message}
              {...register('guestName')}
            />
            <Input
              label="رقم الهوية / الجواز"
              placeholder="1234567890"
              error={errors.guestNationalId?.message}
              {...register('guestNationalId')}
            />
          </div>

          <Input
            label="رقم الهاتف"
            placeholder="0501234567"
            type="tel"
            error={errors.guestPhone?.message}
            {...register('guestPhone')}
          />

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="تاريخ الوصول"
              type="date"
              error={errors.checkIn?.message}
              {...register('checkIn')}
            />
            <Input
              label="تاريخ المغادرة المتوقعة"
              type="date"
              error={errors.checkOut?.message}
              {...register('checkOut')}
            />
          </div>

          {/* Rate */}
          <Input
            label="السعر في الليلة (ر.س)"
            type="number"
            step="0.01"
            min="0"
            error={errors.ratePerNight?.message}
            {...register('ratePerNight')}
          />

          <Input
            label="ملاحظات (اختياري)"
            placeholder="طلبات خاصة..."
            {...register('notes')}
          />

          {/* Total preview */}
          {nights > 0 && watchedRate > 0 && (
            <div className="rounded-xl bg-blue-50 p-4 dark:bg-blue-900/20">
              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>{nights} ليلة × {formatCurrency(watchedRate)}</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>ضريبة القيمة المضافة 15%</span>
                  <span>{formatCurrency(vat)}</span>
                </div>
                <div className="flex justify-between border-t border-blue-200 pt-1 font-bold text-gray-900 dark:border-blue-800 dark:text-gray-100">
                  <span>الإجمالي</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            loading={checkIn.isPending}
            disabled={availableRooms.length === 0}
          >
            تسجيل الوصول
          </Button>
        </form>
      </div>

      {/* Active reservations */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            الحجوزات النشطة ({reservations.length})
          </h3>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {reservations.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">
              لا توجد حجوزات نشطة
            </div>
          ) : (
            reservations.map((res) => {
              const room = roomMap[res.roomId]
              const overdue = isCheckoutOverdue(res.checkOut)
              return (
                <div key={res.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{res.guestName}</p>
                        {room && (
                          <Badge variant="blue">غرفة {room.roomNumber}</Badge>
                        )}
                        {overdue && <Badge variant="red">متأخر</Badge>}
                        {!overdue && isCheckoutToday(res.checkOut) && (
                          <Badge variant="orange">يغادر اليوم</Badge>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />{res.guestPhone}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(res.checkIn, 'ar-SA')} — {formatDate(res.checkOut, 'ar-SA')}
                        </span>
                        <span>{res.nights} ليلة</span>
                      </div>
                      <p className="mt-1 text-xs font-semibold text-green-700 dark:text-green-400">
                        {formatCurrency(res.totalAmount)} (قبل الضريبة)
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={overdue ? 'danger' : 'secondary'}
                      loading={checkOut.isPending && checkOut.variables?.reservationId === res.id}
                      onClick={() =>
                        checkOut.mutate({
                          reservationId: res.id,
                          roomNumber: room?.roomNumber ?? '',
                        })
                      }
                    >
                      مغادرة
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

// ── Cleaning Tab ───────────────────────────────────────────────────────────────

function CleaningTab({
  rooms,
  loading,
  onMarkClean,
  markCleanPending,
}: {
  rooms: RoomResponse[]
  loading: boolean
  onMarkClean: (roomId: string) => void
  markCleanPending: boolean
}) {
  const dirtyRooms = rooms.filter(
    (r) => r.isActive && (r.cleaningStatus === 'NeedsClean' || r.cleaningStatus === 'InProgress'),
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          غرف تحتاج تنظيف
        </h3>
        {dirtyRooms.length > 0 && (
          <span className="rounded-full bg-orange-500 px-3 py-1 text-sm font-bold text-white">
            {dirtyRooms.length}
          </span>
        )}
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
          ))}
        </div>
      ) : dirtyRooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Sparkles className="mb-3 h-12 w-12 text-green-400" />
          <p className="font-medium text-gray-700 dark:text-gray-300">جميع الغرف نظيفة</p>
          <p className="text-sm text-gray-400">لا توجد غرف تحتاج إلى تنظيف</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {dirtyRooms.map((room) => (
            <div
              key={room.id}
              className="rounded-xl border border-orange-200 bg-orange-50 p-5 dark:border-orange-900/50 dark:bg-orange-900/10"
            >
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {room.roomNumber}
                  </p>
                  <p className="text-sm text-gray-500">
                    {ROOM_TYPE_LABELS[room.roomType]} · الطابق {room.floor}
                  </p>
                </div>
                <Badge
                  variant={room.cleaningStatus === 'InProgress' ? 'yellow' : 'orange'}
                >
                  {room.cleaningStatus === 'InProgress' ? 'جاري التنظيف' : 'تحتاج تنظيف'}
                </Badge>
              </div>
              <Button
                variant="primary"
                className="w-full"
                loading={markCleanPending}
                onClick={() => onMarkClean(room.id)}
              >
                <CheckCircle className="h-4 w-4" />
                تم التنظيف
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Add Room Modal ─────────────────────────────────────────────────────────────

function AddRoomModal({
  open,
  onClose,
  branchId,
  tenantId,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  branchId: string
  tenantId: string
  onSuccess: () => void
}) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<AddRoomFormData>({
    resolver: zodResolver(addRoomSchema),
    defaultValues: {
      roomType: 'Standard',
      floor: 1,
      capacity: 2,
      currency: 'SAR',
    },
  })

  const create = useMutation({
    mutationFn: (data: AddRoomFormData) =>
      hotelApi.createHotelRoom(branchId, {
        tenantId,
        roomType: data.roomType,
        roomNumber: data.roomNumber,
        floor: data.floor,
        capacity: data.capacity,
        nightlyRate: data.nightlyRate,
        currency: data.currency,
        description: data.description || undefined,
      }),
    onSuccess: () => {
      onSuccess()
      onClose()
      reset({ roomType: 'Standard', floor: 1, capacity: 2, currency: 'SAR' })
      toast.success('تمت الإضافة', 'تم إضافة الغرفة بنجاح')
    },
    onError: () => toast.error('فشلت الإضافة', 'قد يكون رقم الغرفة مستخدماً بالفعل'),
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="إضافة غرفة جديدة"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>إلغاء</Button>
          <Button loading={create.isPending} onClick={handleSubmit((d) => create.mutate(d))}>
            إضافة
          </Button>
        </>
      }
    >
      <form className="space-y-4" dir="rtl">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="رقم الغرفة"
            placeholder="101"
            error={errors.roomNumber?.message}
            {...register('roomNumber')}
          />
          <Select label="نوع الغرفة" {...register('roomType')}>
            {(Object.entries(ROOM_TYPE_LABELS) as [RoomType, string][]).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Input
            label="الطابق"
            type="number"
            min={0}
            error={errors.floor?.message}
            {...register('floor')}
          />
          <Input
            label="السعة"
            type="number"
            min={1}
            error={errors.capacity?.message}
            {...register('capacity')}
          />
          <Input
            label="العملة"
            maxLength={3}
            error={errors.currency?.message}
            {...register('currency')}
          />
        </div>
        <Input
          label="السعر في الليلة"
          type="number"
          step="0.01"
          min={0}
          error={errors.nightlyRate?.message}
          {...register('nightlyRate')}
        />
        <Input
          label="وصف (اختياري)"
          placeholder="وصف اختياري للغرفة"
          {...register('description')}
        />
      </form>
    </Modal>
  )
}

// ── Hotel ZATCA Receipt Modal ──────────────────────────────────────────────────

function HotelReceiptModal({
  reservation,
  roomNumber,
  onClose,
}: {
  reservation: ReservationResponse
  roomNumber: string
  onClose: () => void
}) {
  const { data: zatcaSettings } = useQuery({
    queryKey: ['zatca-settings'],
    queryFn: () => zatcaApi.getSettings(),
    staleTime: 60_000,
  })
  const vatNumber = zatcaSettings?.data?.vatRegistrationNumber ?? ''

  const total = reservation.totalAmount
  const vat = +(total * SAUDI_VAT_RATE / (1 + SAUDI_VAT_RATE)).toFixed(2)
  const subtotal = total - vat

  const qrCode = generateZatcaQr({
    sellerName: zatcaSettings?.data?.sellerName ?? 'flowin',
    vatNumber,
    timestamp: reservation.updatedAt,
    totalWithVat: total,
    vatAmount: vat,
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" dir="rtl">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900">
        <div className="mb-4 text-center">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">فاتورة ضريبية</h2>
          <p className="text-xs text-gray-500">flowin</p>
          {vatNumber && <p className="text-xs text-gray-500">رقم ضريبة القيمة المضافة: {vatNumber}</p>}
        </div>

        <div className="mb-4 rounded-xl bg-gray-50 p-3 text-sm dark:bg-gray-800">
          <div className="flex justify-between py-0.5">
            <span className="text-gray-500">الضيف</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">{reservation.guestName}</span>
          </div>
          <div className="flex justify-between py-0.5">
            <span className="text-gray-500">الهوية</span>
            <span className="text-gray-700 dark:text-gray-300">{reservation.guestNationalId}</span>
          </div>
          {roomNumber && (
            <div className="flex justify-between py-0.5">
              <span className="text-gray-500">الغرفة</span>
              <span className="text-gray-700 dark:text-gray-300">{roomNumber}</span>
            </div>
          )}
          <div className="flex justify-between py-0.5">
            <span className="text-gray-500">تاريخ الوصول</span>
            <span className="text-gray-700 dark:text-gray-300">{formatDate(reservation.checkIn, 'ar-SA')}</span>
          </div>
          <div className="flex justify-between py-0.5">
            <span className="text-gray-500">تاريخ المغادرة</span>
            <span className="text-gray-700 dark:text-gray-300">{formatDate(reservation.checkOut, 'ar-SA')}</span>
          </div>
          <div className="flex justify-between py-0.5">
            <span className="text-gray-500">عدد الليالي</span>
            <span className="text-gray-700 dark:text-gray-300">{reservation.nights}</span>
          </div>
          <div className="flex justify-between py-0.5">
            <span className="text-gray-500">سعر الليلة</span>
            <span className="text-gray-700 dark:text-gray-300">{formatCurrency(reservation.ratePerNight)}</span>
          </div>
        </div>

        <div className="mb-4 space-y-1 border-t border-gray-200 pt-3 text-sm dark:border-gray-700">
          <div className="flex justify-between text-gray-600 dark:text-gray-400">
            <span>المجموع قبل الضريبة</span>
            <span className="tabular-nums">{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between text-gray-600 dark:text-gray-400">
            <span>ضريبة القيمة المضافة 15%</span>
            <span className="tabular-nums">{formatCurrency(vat)}</span>
          </div>
          <div className="flex justify-between font-bold text-gray-900 dark:text-gray-100">
            <span>الإجمالي</span>
            <span className="tabular-nums">{formatCurrency(total)}</span>
          </div>
        </div>

        {/* ZATCA QR */}
        <div className="mb-4 flex flex-col items-center gap-2 rounded-xl bg-gray-50 p-3 dark:bg-gray-800">
          <QrCode className="h-4 w-4 text-gray-500" />
          <p className="text-xs text-gray-500">رمز ZATCA للتحقق</p>
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(qrCode)}`}
            alt="رمز ZATCA للتحقق"
            width={100}
            height={100}
            className="rounded-lg"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
        </div>

        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">إغلاق</Button>
          <Button variant="primary" onClick={() => window.print()} className="flex-1">طباعة</Button>
        </div>
      </div>
    </div>
  )
}
