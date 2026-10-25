import { useQuery } from '@tanstack/react-query'
import { customersApi } from '@/api/customers'
import { useAuthStore } from '@/stores/authStore'
import type { LoyaltySettings } from '@/types/api'

// Mirrors the server's LoyaltyRules. Each store sets its own programme; these are what every store starts with:
// 1 point per riyal paid; 100 points = 5 riyals off (VAT included); redeemable from any balance.
export const DEFAULT_LOYALTY: LoyaltySettings = {
  enabled: true,
  pointsPerCurrencyUnit: 1,
  redeemPoints: 100,
  redeemValue: 5,
  minRedeemPoints: 0,
}

const round = (n: number, decimals: number) => {
  const f = 10 ** decimals
  return Math.round((n + Number.EPSILON) * f) / f
}

export const valuePerPoint = (r: LoyaltySettings) => round(r.redeemValue / r.redeemPoints, 6)

// On the amount paid in halalas, like the server; the epsilon keeps 105 × 2 from flooring to 209.
export const pointsEarned = (amountPaid: number, r: LoyaltySettings) =>
  r.enabled && amountPaid > 0 ? Math.floor(round(amountPaid, 2) * r.pointsPerCurrencyUnit + 1e-9) : 0

export const pointsValue = (points: number, r: LoyaltySettings) => round(points * valuePerPoint(r), 2)

// The most points this bill can take, or 0 when the programme is off or the balance is under the store's minimum.
// Keeps at least one halala payable so client and server rounding never disagree on the cap.
export function maxRedeemablePoints(available: number, billTotal: number, r: LoyaltySettings) {
  if (!r.enabled || available < Math.max(r.minRedeemPoints, 1)) return 0
  const room = billTotal - 0.01
  let cap = Math.max(0, Math.floor(room / valuePerPoint(r)))
  while (cap > 0 && pointsValue(cap, r) > room) cap--
  const points = Math.min(available, cap)
  return points >= Math.max(r.minRedeemPoints, 1) ? points : 0
}

export function useLoyaltyRules(): LoyaltySettings {
  const { tenantId } = useAuthStore()
  const { data } = useQuery({
    queryKey: ['loyalty-settings', tenantId],
    queryFn: () => customersApi.getLoyaltySettings(tenantId!).then((r) => r.data),
    enabled: !!tenantId,
    staleTime: 5 * 60_000,
  })
  return data ?? DEFAULT_LOYALTY
}
