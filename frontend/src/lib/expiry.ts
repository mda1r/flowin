import type { Translations } from '@/i18n/en'

// Days are whole Riyadh calendar days (as the server returns them): 0 = expires today, negative = already expired.
export function expiryText(t: Translations, days: number) {
  if (days < 0) return t.inventory.expiredLabel
  if (days === 0) return t.inventory.expiresToday
  if (days === 1) return t.inventory.expiresTomorrow
  return t.inventory.expiresIn.replace('{days}', String(days))
}
