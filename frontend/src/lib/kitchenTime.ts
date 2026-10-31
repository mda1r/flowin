// How long a ticket has been waiting, and the colour that says so across the room. A drink should be out in a
// few minutes, a dish takes longer, so each screen passes its own limits: below `warn` is on time, from `warn`
// it is getting late, from `late` it is overdue.

export interface KitchenTimeLimits {
  warn: number
  late: number
}

export const RESTAURANT_TIME_LIMITS: KitchenTimeLimits = { warn: 10, late: 20 }
export const CAFE_TIME_LIMITS: KitchenTimeLimits = { warn: 5, late: 10 }

export function minutesSince(isoDate: string, now: number): number {
  return Math.max(0, Math.floor((now - new Date(isoDate).getTime()) / 60000))
}

export function timeColor(minutes: number, limits: KitchenTimeLimits = RESTAURANT_TIME_LIMITS): string {
  if (minutes < limits.warn) return 'text-success'
  if (minutes < limits.late) return 'text-warning'
  return 'text-danger'
}

export function timeBorderColor(minutes: number, limits: KitchenTimeLimits = RESTAURANT_TIME_LIMITS): string {
  if (minutes < limits.warn) return 'border-success'
  if (minutes < limits.late) return 'border-warning'
  return 'border-danger'
}
