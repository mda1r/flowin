// Today as YYYY-MM-DD in the device's local time zone.
export const localYmd = (d: Date = new Date()) => d.toLocaleDateString('en-CA')

// UTC instants covering whole local days [fromYmd 00:00, day after toYmd 00:00).
export function localDaysToUtcRange(fromYmd: string, toYmd: string) {
  const from = new Date(`${fromYmd}T00:00:00`)
  const end = new Date(`${toYmd}T00:00:00`)
  end.setDate(end.getDate() + 1)
  return { from: from.toISOString(), to: end.toISOString() }
}

// Calendar date (YYYY-MM-DD) in Saudi time, which the shop's business day and expiry dates follow.
export const riyadhYmd = (d: Date = new Date()) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' })

const ymdDayNumber = (ymd: string) => Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10)) / 86_400_000

// Whole calendar days from today to the instant's date, both in Riyadh: 0 = today, 1 = tomorrow, negative = past.
export function riyadhDaysUntil(iso: string, now: Date = new Date()) {
  return Math.round(ymdDayNumber(riyadhYmd(new Date(iso))) - ymdDayNumber(riyadhYmd(now)))
}
