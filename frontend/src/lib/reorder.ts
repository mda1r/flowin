import type { StockItemResponse } from '@/types/api'
import type { StockMaterialResponse } from '@/types/stockMaterial'

// Raw materials: refill to the maximum level when one is set, otherwise to twice the reorder level.
// Storage units (bags, cartons) are bought whole, so the quantity rounds up.
export function materialReorderQty(m: StockMaterialResponse): number {
  const current = m.currentQuantityInStorageUnits
  const target = m.maxLevel != null && m.maxLevel > 0 ? m.maxLevel : (m.reorderLevel ?? 0) * 2
  const needed = Math.ceil(target - current)
  return needed > 0 ? needed : Math.max(Math.ceil(m.reorderLevel ?? 1), 1)
}

// Products: use the configured reorder quantity, otherwise refill to twice the reorder point.
export function productReorderQty(item: StockItemResponse): number {
  if (item.reorderQuantity > 0) return item.reorderQuantity
  return Math.max(Math.ceil(item.reorderPoint * 2 - item.quantity), 1)
}
