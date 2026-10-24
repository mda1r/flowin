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
  costPerComponentUnit: number
}

export type StockMaterialMovementType = 'Receive' | 'Adjustment'

export interface StockMaterialMovementResponse {
  id: string
  type: StockMaterialMovementType
  quantityChange: number
  unitCost?: number
  quantityAfter: number
  costAfter: number
  note?: string
  userId?: string
  createdAt: string
}

export interface ReceiveStockMaterialPayload {
  quantity: number
  unitCost: number
  note?: string
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
  initialQuantity?: number
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
  manualQuantity?: number
  minLevel?: number
  maxLevel?: number
  reorderLevel?: number
}
