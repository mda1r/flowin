// Expiry dates are calendar days stored as UTC midnight of that day. They are compared with today's date in
// Riyadh, as the server does, so an item counts as expiring "today" for its whole expiry day.
const STORE_TIME_ZONE = 'Asia/Riyadh'

export function storeToday(): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: STORE_TIME_ZONE }).format(new Date())
}

function dayNumber(isoDay: string) {
  const [y, m, d] = isoDay.slice(0, 10).split('-').map(Number)
  return Date.UTC(y, m - 1, d) / 86_400_000
}

export function expiryDay(expiryDate: string) {
  return expiryDate.slice(0, 10)
}

export function daysUntilExpiry(expiryDate: string) {
  return dayNumber(expiryDay(expiryDate)) - dayNumber(storeToday())
}

export function formatExpiry(expiryDate: string, lang: string) {
  return new Date(expiryDay(expiryDate) + 'T00:00:00Z').toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', {
    timeZone: 'UTC',
  })
}
