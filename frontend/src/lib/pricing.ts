import { SAUDI_VAT_RATE } from '@/lib/zatca'

// Shelf and menu prices include VAT; the business keeps only the net amount.
export const netOfVat = (grossPrice: number) => grossPrice / (1 + SAUDI_VAT_RATE)

// Profit margin as a percentage of the net (pre-VAT) price; null when there is no price to compare against.
export function marginPercent(grossPrice: number, cost: number): number | null {
  const net = netOfVat(grossPrice)
  return net > 0 ? ((net - cost) / net) * 100 : null
}

// Margin colour shared by the recipe editor and the product list: a loss is danger, under 30% a warning.
export function marginTone(margin: number | null): string {
  if (margin === null) return 'text-muted'
  return margin < 0 ? 'text-danger' : margin < 30 ? 'text-warning' : 'text-success'
}
