import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BedDouble, LogIn, LogOut, X, Sparkles } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/stores/authStore'
import { hotelApi } from '@/api/hotel'
import { toast } from '@/components/ui/Toast'
import { cn, formatCurrency } from '@/lib/utils'
import type { RoomResponse, RoomType } from '@/types/api'

/* hotel accent scoped to this page */
const HOTEL_ACCENT: React.CSSProperties = {
  '--accent': '#1E40AF',
  '--glow': 'rgba(30,64,175,0.35)',
} as React.CSSProperties

const ROOM_TYPE_AR: Record<RoomType, string> = {
  Standard: 'قياسي',
  Deluxe: 'ديلوكس',
  Suite: 'جناح',
  Presidential: 'رئاسي',
}

export function HotelPosPage() {
  const { branchId, tenantId } = useAuthStore()
  const qc = useQueryClient()

  const [selectedRoom, setSelectedRoom] = useState<RoomResponse | null>(null)
  const [showCheckIn, setShowCheckIn] = useState(false)
  const [showCheckOut, setShowCheckOut] = useState(false)

  const today = new Date().toISOString().slice(0, 10)
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)

  const [guestName, setGuestName] = useState('')
  const [guestNationalId, setGuestNationalId] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [checkInDate, setCheckInDate] = useState(today)
  const [checkOutDate, setCheckOutDate] = useState(tomorrow)
  const [notes, setNotes] = useState('')

  const { data: rooms = [], isLoading } = useQuery({
    queryKey: ['hotel', 'rooms', branchId],
    queryFn: () => hotelApi.listHotelRooms(branchId!).then(r => r.data),
    enabled: !!branchId,
    refetchInterval: 30000,
  })

  const activeRooms = rooms.filter(r => r.isActive)
  const availableCount = activeRooms.filter(r => r.status === 'Available').length
  const occupiedCount = activeRooms.filter(r => r.status === 'Occupied').length

  /* isometric floor-plan: group rooms by floor, lowest first */
  const floors = [...new Set(activeRooms.map(r => r.floor))].sort((a, b) => a - b)

  const nights = Math.max(
    1,
    Math.round((new Date(checkOutDate).getTime() - new Date(checkInDate).getTime()) / 86400000),
  )

  const checkInMut = useMutation({
    mutationFn: () =>
      hotelApi.checkIn(branchId!, selectedRoom!.id, {
        tenantId: tenantId!,
        guestName,
        guestNationalId,
        guestPhone,
        checkIn: new Date(checkInDate).toISOString(),
        checkOut: new Date(checkOutDate).toISOString(),
        ratePerNight: selectedRoom!.nightlyRate,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      toast.success('تم تسجيل الدخول', `الغرفة ${selectedRoom!.roomNumber} — ${guestName}`)
      qc.invalidateQueries({ queryKey: ['hotel', 'rooms'] })
      closeCheckIn()
    },
    onError: () => toast.error('فشل تسجيل الدخول', 'يرجى المحاولة مرة أخرى'),
  })

  const checkOutMut = useMutation({
    mutationFn: () =>
      hotelApi.checkOut(branchId!, selectedRoom!.activeReservation!.id),
    onSuccess: () => {
      toast.success('تم تسجيل الخروج', `الغرفة ${selectedRoom!.roomNumber}`)
      qc.invalidateQueries({ queryKey: ['hotel', 'rooms'] })
      closeCheckOut()
    },
    onError: () => toast.error('فشل تسجيل الخروج', 'يرجى المحاولة مرة أخرى'),
  })

  const closeCheckIn = () => {
    setShowCheckIn(false)
    setSelectedRoom(null)
    setGuestName('')
    setGuestNationalId('')
    setGuestPhone('')
    setCheckInDate(today)
    setCheckOutDate(tomorrow)
    setNotes('')
  }

  const closeCheckOut = () => {
    setShowCheckOut(false)
    setSelectedRoom(null)
  }

  const openCheckIn = (room: RoomResponse) => {
    setSelectedRoom(room)
    setShowCheckIn(true)
  }

  const openCheckOut = (room: RoomResponse) => {
    setSelectedRoom(room)
    setShowCheckOut(true)
  }

  return (
    <div dir="rtl" className="flex h-[calc(100vh-0px)] flex-col" style={HOTEL_ACCENT}>
      <PageHeader title="نقطة البيع — الفندق" />

      {/* Stats bar */}
      <div className="flex gap-3 px-6 py-3">
        <span className="card-3d px-3 py-1.5 text-sm text-gray-500">
          متاح: <strong style={{ color: 'var(--accent)' }}>{availableCount}</strong>
        </span>
        <span className="card-3d px-3 py-1.5 text-sm text-gray-500">
          مشغول: <strong className="text-amber-600">{occupiedCount}</strong>
        </span>
        <span className="card-3d px-3 py-1.5 text-sm text-gray-500">
          الكل: <strong className="text-gray-900 dark:text-gray-100">{activeRooms.length}</strong>
        </span>
      </div>

      {/* Floor-plan grid */}
      <div className="scene-3d flex-1 overflow-y-auto p-6 pt-2">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="shimmer-skeleton h-36" />
            ))}
          </div>
        ) : activeRooms.length === 0 ? (
          <div className="mt-20 text-center text-sm text-gray-400">
            <BedDouble className="mx-auto mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" />
            <p>لا توجد غرف</p>
            <p className="mt-1 text-xs">أضف غرفاً من قسم الفندق أولاً</p>
          </div>
        ) : (
          <div className="space-y-8">
            {floors.map(floor => (
              <section key={floor}>
                <div className="mb-3 flex items-center gap-2">
                  <span
                    className="iso-tile block h-3.5 w-3.5 rounded-[2px]"
                    style={{
                      background: 'var(--accent)',
                      boxShadow: '2px 2px 0 color-mix(in srgb, var(--accent) 45%, black)',
                    }}
                  />
                  <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">الطابق {floor}</h3>
                </div>
                <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
                  {activeRooms.filter(r => r.floor === floor).map(room => {
                    const isAvail = room.status === 'Available'
                    const isOccupied = room.status === 'Occupied'
                    const needsClean = room.cleaningStatus === 'NeedsClean'
                    const reservation = room.activeReservation

                    return (
                      <div
                        key={room.id}
                        className={cn(
                          'card-3d card-3d-lift extruded-3d relative mt-3 flex flex-col p-4',
                          isAvail && 'halo-idle',
                          !isAvail && !isOccupied && 'opacity-60',
                        )}
                        style={
                          isOccupied
                            ? {
                                boxShadow: room.checkOutAlert
                                  ? '0 1px 0 var(--rim-3d) inset, 0 0 0 1px rgba(245,158,11,0.5), 0 7px 0 -2px rgba(120,53,15,0.55), 0 14px 28px var(--shadow-mid), 0 0 26px rgba(245,158,11,0.4)'
                                  : '0 1px 0 var(--rim-3d) inset, 0 0 0 1px rgba(245,158,11,0.35), 0 7px 0 -2px rgba(120,53,15,0.45), 0 14px 28px var(--shadow-mid), 0 0 20px rgba(245,158,11,0.28)',
                              }
                            : undefined
                        }
                      >
                        {/* floating guest badge above the block */}
                        {isOccupied && reservation && (
                          <span
                            className="glass-panel absolute -top-3 start-3 max-w-[80%] truncate rounded-full px-2.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300"
                            style={{ boxShadow: '0 4px 12px var(--shadow-mid), 0 0 12px rgba(245,158,11,0.35)' }}
                          >
                            {reservation.guestName}
                          </span>
                        )}

                        <div className="mb-2 flex items-center justify-between">
                          <span
                            className={cn(
                              'text-xs font-bold',
                              isOccupied
                                ? room.checkOutAlert ? 'text-amber-600' : 'text-amber-500'
                                : !isAvail && 'text-gray-400',
                            )}
                            style={isAvail ? { color: 'var(--accent)' } : undefined}
                          >
                            {isAvail ? 'متاح' : isOccupied ? (room.checkOutAlert ? 'خروج اليوم!' : 'مشغول') : 'صيانة'}
                          </span>
                          <div className="flex items-center gap-1">
                            {needsClean && <Sparkles className="h-3.5 w-3.5 text-yellow-400" />}
                            <BedDouble
                              className={cn('h-4 w-4', isOccupied ? 'text-amber-500' : !isAvail && 'text-gray-400')}
                              style={isAvail ? { color: 'var(--accent)' } : undefined}
                            />
                          </div>
                        </div>

                        <p className="text-emboss text-2xl font-bold text-gray-900 dark:text-gray-100">
                          {room.roomNumber}
                        </p>
                        <p className="text-xs text-gray-500">
                          {ROOM_TYPE_AR[room.roomType]} · ط{room.floor}
                        </p>

                        {isOccupied && reservation && (
                          <p className="mt-2 text-xs text-gray-400">
                            خروج: {new Date(reservation.checkOut).toLocaleDateString('ar-SA')}
                          </p>
                        )}

                        <p className="mt-auto pt-2 text-xs font-semibold text-gray-600 dark:text-gray-400">
                          {formatCurrency(room.nightlyRate)} / ليلة
                        </p>

                        {(isAvail || isOccupied) && (
                          <button
                            onClick={() => isAvail ? openCheckIn(room) : openCheckOut(room)}
                            className="btn-3d mt-3 w-full py-1.5 text-xs"
                            style={
                              isOccupied
                                ? {
                                    background: room.checkOutAlert ? '#d97706' : '#f59e0b',
                                    boxShadow: '0 4px 0 rgba(0,0,0,0.3), 0 10px 24px rgba(245,158,11,0.35)',
                                  }
                                : undefined
                            }
                          >
                            {isAvail ? 'تسجيل دخول' : 'تسجيل خروج'}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {/* Check-in modal — crystalline glass */}
      {showCheckIn && selectedRoom && (
        <div className="scene-3d fixed inset-0 z-50 flex items-center justify-center" style={HOTEL_ACCENT}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeCheckIn} />
          <div
            className="glass-panel relative mx-4 w-full max-w-md animate-float-up p-6"
            style={{ borderColor: 'color-mix(in srgb, var(--accent) 40%, transparent)' }}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">تسجيل دخول</h2>
                <p className="text-xs text-gray-500">
                  غرفة {selectedRoom.roomNumber} — {ROOM_TYPE_AR[selectedRoom.roomType]}
                </p>
              </div>
              <button onClick={closeCheckIn}>
                <X className="h-4 w-4 text-gray-400 transition-colors hover:text-gray-600" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                  اسم الضيف
                </label>
                <input
                  value={guestName}
                  onChange={e => setGuestName(e.target.value)}
                  className="input-3d w-full"
                  placeholder="محمد السعيد"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                    رقم الهوية
                  </label>
                  <input
                    value={guestNationalId}
                    onChange={e => setGuestNationalId(e.target.value)}
                    className="input-3d w-full"
                    placeholder="1234567890"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                    رقم الجوال
                  </label>
                  <input
                    value={guestPhone}
                    onChange={e => setGuestPhone(e.target.value)}
                    className="input-3d w-full"
                    placeholder="05xxxxxxxx"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                    تاريخ الدخول
                  </label>
                  <input
                    type="date"
                    value={checkInDate}
                    onChange={e => setCheckInDate(e.target.value)}
                    className="input-3d w-full"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                    تاريخ الخروج
                  </label>
                  <input
                    type="date"
                    value={checkOutDate}
                    min={checkInDate}
                    onChange={e => setCheckOutDate(e.target.value)}
                    className="input-3d w-full"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                  ملاحظات (اختياري)
                </label>
                <input
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="input-3d w-full"
                  placeholder="طلبات خاصة..."
                />
              </div>

              <div
                className="rounded-xl p-3"
                style={{
                  background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
                  boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.12), 0 0 14px var(--glow)',
                }}
              >
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{nights} {nights === 1 ? 'ليلة' : 'ليالٍ'} × {formatCurrency(selectedRoom.nightlyRate)}</span>
                  <span className="font-bold" style={{ color: 'var(--accent)' }}>
                    {formatCurrency(selectedRoom.nightlyRate * nights)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 flex gap-3">
              <Button variant="secondary" onClick={closeCheckIn} className="flex-1">
                إلغاء
              </Button>
              <Button
                variant="primary"
                onClick={() => checkInMut.mutate()}
                loading={checkInMut.isPending}
                disabled={!guestName || !guestNationalId || !guestPhone}
                className="btn-3d flex-1 !bg-[color:var(--accent)] hover:!bg-[color:var(--accent)]"
              >
                <LogIn className="ms-1.5 h-4 w-4" />
                تسجيل الدخول
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Check-out modal — crystalline glass */}
      {showCheckOut && selectedRoom && selectedRoom.activeReservation && (
        <div className="scene-3d fixed inset-0 z-50 flex items-center justify-center" style={HOTEL_ACCENT}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeCheckOut} />
          <div
            className="glass-panel relative mx-4 w-full max-w-sm animate-float-up p-6"
            style={{ borderColor: 'color-mix(in srgb, var(--accent) 40%, transparent)' }}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">تسجيل خروج</h2>
                <p className="text-xs text-gray-500">غرفة {selectedRoom.roomNumber}</p>
              </div>
              <button onClick={closeCheckOut}>
                <X className="h-4 w-4 text-gray-400 transition-colors hover:text-gray-600" />
              </button>
            </div>

            <div className="mb-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">الضيف</span>
                <span className="font-medium">{selectedRoom.activeReservation.guestName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">رقم الجوال</span>
                <span>{selectedRoom.activeReservation.guestPhone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">تاريخ الدخول</span>
                <span>{new Date(selectedRoom.activeReservation.checkIn).toLocaleDateString('ar-SA')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">تاريخ الخروج</span>
                <span>{new Date(selectedRoom.activeReservation.checkOut).toLocaleDateString('ar-SA')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">عدد الليالي</span>
                <span>{selectedRoom.activeReservation.nights} ليالٍ</span>
              </div>
            </div>

            <div
              className="mb-6 rounded-xl p-4"
              style={{
                background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
                boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.12), 0 0 18px var(--glow)',
              }}
            >
              <p className="text-xs text-gray-500">الإجمالي المستحق</p>
              <p className="text-emboss text-3xl font-bold" style={{ color: 'var(--accent)' }}>
                {formatCurrency(selectedRoom.activeReservation.totalAmount)}
              </p>
            </div>

            <div className="flex gap-3">
              <Button variant="secondary" onClick={closeCheckOut} className="flex-1">
                إلغاء
              </Button>
              <Button
                variant="primary"
                onClick={() => checkOutMut.mutate()}
                loading={checkOutMut.isPending}
                className="btn-3d flex-1 !bg-[color:var(--accent)] hover:!bg-[color:var(--accent)]"
              >
                <LogOut className="ms-1.5 h-4 w-4" />
                تأكيد الخروج
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
