// One place that decides how dates and numbers look in each UI language.
// Always Gregorian (plain 'ar-SA' can come out in the Umm al-Qura calendar) and
// one digit style everywhere, so receipts, reports and screens agree.

export type Lang = 'ar' | 'en'

// Digits used in Arabic mode: 'latn' (0-9) matches the ZATCA QR, the charts and
// what most Saudi tills print. Switch to 'arab' (٠-٩) here and nowhere else.
const AR_DIGITS: 'latn' | 'arab' = 'latn'

let active: Lang = 'ar'

// Called by the i18n provider on every render, so code outside React (toasts,
// formatCurrency, the offline queue) follows the chosen language too.
export function setActiveLang(lang: Lang) {
  active = lang
}

export function activeLang(): Lang {
  return active
}

// Accepts a UI language or a legacy BCP-47 tag ('ar-SA', 'en-US') from older callers.
function toLang(lang?: string): Lang {
  if (!lang) return active
  return lang.toLowerCase().startsWith('ar') ? 'ar' : 'en'
}

export function intlLocale(lang?: string): string {
  return toLang(lang) === 'ar' ? `ar-SA-u-ca-gregory-nu-${AR_DIGITS}` : 'en-US-u-ca-gregory-nu-latn'
}

const toDate = (d: string | number | Date) => (d instanceof Date ? d : new Date(d))

export function fmtNum(value: number, opts?: Intl.NumberFormatOptions, lang?: string): string {
  return new Intl.NumberFormat(intlLocale(lang), opts).format(value)
}

export function fmtDate(
  date: string | number | Date,
  opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' },
  lang?: string,
): string {
  return new Intl.DateTimeFormat(intlLocale(lang), opts).format(toDate(date))
}

export function fmtTime(date: string | number | Date, lang?: string): string {
  return fmtDate(date, { hour: '2-digit', minute: '2-digit' }, lang)
}

export function fmtDateTime(
  date: string | number | Date,
  opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' },
  lang?: string,
): string {
  return fmtDate(date, opts, lang)
}
