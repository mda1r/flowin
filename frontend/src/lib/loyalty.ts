// Mirrors the server's LoyaltyPolicy: 1 point per riyal paid; 100 points = 5 riyals off (VAT included).
export const LOYALTY_POINT_VALUE = 0.05

export const pointsEarned = (amountPaid: number) => (amountPaid > 0 ? Math.floor(amountPaid) : 0)

export const pointsValue = (points: number) => Math.round(points * LOYALTY_POINT_VALUE * 100) / 100

// Keeps at least one halala payable so client and server rounding never disagree on the cap.
export const maxRedeemablePoints = (available: number, billTotal: number) =>
  Math.max(0, Math.min(available, Math.floor((billTotal - 0.01) / LOYALTY_POINT_VALUE)))
