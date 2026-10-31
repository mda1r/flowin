import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { fmtDate, fmtNum } from './locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// `locale` takes a UI language ('ar' | 'en') or a legacy tag like 'ar-SA'; it defaults to the active language.
export function formatCurrency(
  amount: number,
  currency = 'SAR',
  locale?: string,
): string {
  return fmtNum(amount, { style: 'currency', currency, minimumFractionDigits: 2 }, locale)
}

export function formatDate(date: string | Date, locale?: string): string {
  return fmtDate(date, { year: 'numeric', month: 'short', day: 'numeric' }, locale)
}

export function formatDateTime(date: string | Date, locale?: string): string {
  return fmtDate(date, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }, locale)
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength) + '…'
}

export function normalizeArabic(text: string): string {
  return text
    .replace(/[ً-ٟ]/g, '') // strip tashkeel
    .replace(/[أإآ]/g, 'ا')           // unify alef variants
    .replace(/ة/g, 'ه')               // taa marbuta → haa
    .replace(/ى/g, 'ي')               // alef maqsura → yaa
    .trim()
    .toLowerCase()
}
