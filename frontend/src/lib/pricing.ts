import { SAUDI_VAT_RATE } from '@/lib/zatca'

// Shelf and menu prices include VAT; the business keeps only the net amount.
export const netOfVat = (grossPrice: number) => grossPrice / (1 + SAUDI_VAT_RATE)

// Profit margin as a percentage of the net (pre-VAT) price; null when there is no price to compare against.
export function marginPercent(grossPrice: number, cost: number): number | null {
  const net = netOfVat(grossPrice)
  return net > 0 ? ((net - cost) / net) * 100 : null
}
