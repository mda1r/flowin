// Today as YYYY-MM-DD in the device's local time zone.
export const localYmd = (d: Date = new Date()) => d.toLocaleDateString('en-CA')

// UTC instants covering whole local days [fromYmd 00:00, day after toYmd 00:00).
export function localDaysToUtcRange(fromYmd: string, toYmd: string) {
  const from = new Date(`${fromYmd}T00:00:00`)
  const end = new Date(`${toYmd}T00:00:00`)
  end.setDate(end.getDate() + 1)
  return { from: from.toISOString(), to: end.toISOString() }
}
