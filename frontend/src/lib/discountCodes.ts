import type { DiscountCodeResponse, DiscountCodeType } from '@/types/api'
import { riyadhYmd } from '@/lib/dates'
import { toAsciiDigits } from '@/lib/whatsapp'

// A code as the server keeps it: trimmed, upper case, Arabic-Indic digits as 0-9 (so "vip١٠" is "VIP10").
export const normalizeDiscountCode = (text: string) => toAsciiDigits(text).trim().toUpperCase()

// The quick picks on the owner's form; any whole or decimal 1-100 can be typed too.
export const QUICK_PERCENTS = [5, 10, 15, 20, 25, 30, 50, 100]

export type DiscountCodeState = 'active' | 'off' | 'expired' | 'usedUp'

// The order the server checks in: switched off, then past its expiry, then out of uses.
export function discountCodeState(code: DiscountCodeResponse, now: Date = new Date()): DiscountCodeState {
  if (!code.isActive) return 'off'
  if (code.expiryDate && new Date(code.expiryDate) < now) return 'expired'
  if (code.maxUses > 0 && code.usedCount >= code.maxUses) return 'usedUp'
  return 'active'
}

// The owner picks a calendar day; the code works until the end of that day in Saudi time (UTC+3 all year).
export const expiryFromYmd = (ymd: string) => new Date(`${ymd}T23:59:59.999+03:00`).toISOString()

export const ymdFromExpiry = (iso: string) => riyadhYmd(new Date(iso))

// A code applied at the till, as the server described it when the cashier checked it.
export interface AppliedDiscountCode {
  code: string
  label: string | null
  type: DiscountCodeType
  value: number
}

// "موظفين · 10٪" for the till chip; the code itself when there is no label.
export const appliedCodeName = (c: AppliedDiscountCode) => c.label?.trim() || c.code
