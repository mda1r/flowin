export type CostMethod = 'LastPurchase' | 'WeightedAverage'

export interface StockMaterialCategoryResponse {
  id: string
  name: string
  isActive: boolean
}

export interface StockMaterialResponse {
  id: string
  code: string
  nameAr: string
  nameEn?: string
  categoryId?: string
  categoryName?: string
  storageUnit: string
  componentUnit: string
  conversionFactor: number
  costMethod: CostMethod
  currentCost: number
  currentQuantityInStorageUnits: number
  minLevel?: number
  maxLevel?: number
  reorderLevel?: number
  isActive: boolean
  isLowStock: boolean
}

export interface CreateStockMaterialCategoryPayload {
  name: string
}

export interface CreateStockMaterialPayload {
  code: string
  nameAr: string
  nameEn?: string
  categoryId?: string
  storageUnit: string
  componentUnit: string
  conversionFactor: number
  costMethod: number
  initialCost?: number
  minLevel?: number
  maxLevel?: number
  reorderLevel?: number
}

export interface UpdateStockMaterialPayload {
  code: string
  nameAr: string
  nameEn?: string
  categoryId?: string
  storageUnit: string
  componentUnit: string
  conversionFactor: number
  costMethod: number
  manualCost?: number
  minLevel?: number
  maxLevel?: number
  reorderLevel?: number
}
