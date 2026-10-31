import { riyadhYmd } from '@/lib/dates'

// A shift open longer than this was almost certainly forgotten.
export const LONG_OPEN_HOURS = 16

// The business day turns over at 06:00 Riyadh, so a cafe shift running past midnight is still "today's".
const BUSINESS_DAY_START_HOUR = 6

const businessDay = (ms: number) => riyadhYmd(new Date(ms - BUSINESS_DAY_START_HOUR * 3_600_000))

export const shiftOpenHours = (openedAt: string, now = Date.now()) =>
  (now - new Date(openedAt).getTime()) / 3_600_000

// Why an open shift should be closed now, or null when it is fine. A shift left open breaks the daily close,
// the shift report and the drawer count.
export function staleShiftReason(openedAt: string, now = Date.now()): 'long' | 'previousDay' | null {
  if (shiftOpenHours(openedAt, now) > LONG_OPEN_HOURS) return 'long'
  if (businessDay(new Date(openedAt).getTime()) < businessDay(now)) return 'previousDay'
  return null
}
