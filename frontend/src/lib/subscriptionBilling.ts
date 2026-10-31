import { SAUDI_VAT_RATE } from '@/lib/zatca'

// Durations the admin can sell in one click, in months.
export const RENEW_MONTHS = [1, 3, 6, 12] as const

const DAY_MS = 24 * 60 * 60 * 1000
const AVG_MONTH_DAYS = 30.4375

// Whole months a subscription covers (a 28–31 day period counts as one month).
export function subscriptionMonths(startDate: string, expiryDate: string): number {
  const days = (new Date(expiryDate).getTime() - new Date(startDate).getTime()) / DAY_MS
  return Math.max(1, Math.round(days / AVG_MONTH_DAYS))
}

// Whole days a subscription covers; under SHORTEST_MONTH_DAYS it is not a billable month.
export const SHORTEST_MONTH_DAYS = 28
export function subscriptionDays(startDate: string, expiryDate: string): number {
  return Math.max(0, Math.round((new Date(expiryDate).getTime() - new Date(startDate).getTime()) / DAY_MS))
}

// Plan prices are stored net per month; customers pay them with 15% VAT.
export const periodTotalWithVat = (netMonthlyPrice: number, months: number) =>
  netMonthlyPrice * months * (1 + SAUDI_VAT_RATE)

// Same day-of-month `months` later, as yyyy-mm-dd for a date input.
export function addMonthsIso(isoDate: string, months: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + months)
  return d.toISOString().slice(0, 10)
}

// Arabic count of months: شهر، شهرين، 3 أشهر، 12 شهراً
export function monthsLabel(months: number): string {
  if (months === 1) return 'شهر'
  if (months === 2) return 'شهرين'
  if (months <= 10) return `${months} أشهر`
  return `${months} شهراً`
}

// Arabic count of days: يوم، يومين، 3 أيام، 11 يوماً
export function daysLabel(days: number): string {
  if (days === 1) return 'يوم'
  if (days === 2) return 'يومين'
  if (days >= 3 && days <= 10) return `${days} أيام`
  return `${days} يوماً`
}
