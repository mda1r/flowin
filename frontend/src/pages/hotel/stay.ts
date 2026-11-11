import { isAxiosError } from 'axios'
import { apiErrorMessage } from '@/lib/apiError'
import { vatRate } from '@/lib/vat'
import type { ReservationResponse } from '@/types/api'

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * One VAT rule for every hotel screen: the server stores the net stay amount,
 * and whatever the guest sees or pays is that amount plus 15% VAT.
 */
export function stayTotals(netAmount: number) {
  const subtotal = round2(netAmount)
  const vat = round2(subtotal * vatRate())
  return { subtotal, vat, total: round2(subtotal + vat) }
}

// Day number in UTC — the server counts nights on UTC dates.
const utcDay = (iso: string | Date) => {
  const value = typeof iso === 'string' && !/[zZ]|[+-]\d\d:\d\d$/.test(iso) ? `${iso}Z` : iso
  return Math.floor(new Date(value).getTime() / 86_400_000)
}

/**
 * Nights the guest will be billed if they check out at `at`. Mirrors the server:
 * leaving before the booked date bills the nights stayed (min 1); otherwise the booked nights.
 * The departure day is the Saudi calendar day, compared with the booked yyyy-mm-dd dates.
 */
export function billableNights(res: Pick<ReservationResponse, 'checkIn' | 'checkOut' | 'nights'>, at: Date = new Date()) {
  const today = utcDay(`${at.toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' })}T00:00:00Z`)
  if (today >= utcDay(res.checkOut)) return res.nights
  return Math.max(1, today - utcDay(res.checkIn))
}

/** Number of nights between check-in and a new check-out date (yyyy-mm-dd). */
export function nightsUntil(checkIn: string, newCheckOutYmd: string) {
  return utcDay(`${newCheckOutYmd}T00:00:00Z`) - utcDay(checkIn)
}

const HOTEL_ERRORS: Record<string, string> = {
  'Room.HasActiveReservation': 'في الغرفة نزيل، سجّل خروجه أو ألغِ الحجز أولاً',
  'Room.OccupiedOnlyByCheckIn': 'تصبح الغرفة مشغولة عبر تسجيل الدخول فقط',
  'Room.Inactive': 'هذه الغرفة موقوفة',
  'Room.AlreadyOccupied': 'الغرفة مشغولة حالياً',
  'Room.UnderMaintenance': 'الغرفة تحت الصيانة',
  'Room.RoomNumberTaken': 'رقم الغرفة مستخدم',
  'Reservation.NotActive': 'الحجز لم يعد نشطاً',
  'Reservation.InvalidExtendDate': 'يجب أن يكون تاريخ المغادرة الجديد بعد الحالي',
  'Reservation.InvalidCheckoutDate': 'يجب أن يكون تاريخ المغادرة بعد الوصول',
  'Contract.Locked': 'لا يمكن تعديل عقد موقّع أو ملغى',
  'Contract.AlreadyExecuted': 'العقد موقّع مسبقاً',
  'Contract.AlreadySigned': 'لا يمكن إلغاء عقد موقّع',
  'Contract.Cancelled': 'هذا العقد ملغى',
  'Contract.AlreadyActive': 'العقد ساري مسبقاً',
}

export function hotelErrorMessage(err: unknown, fallback?: string) {
  const code = isAxiosError(err) ? (err.response?.data as { title?: string } | undefined)?.title : undefined
  return (code && HOTEL_ERRORS[code]) || apiErrorMessage(err, fallback)
}
