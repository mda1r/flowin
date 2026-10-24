import { apiClient } from './client'
import type { RecipeResponse, RecipeSummaryResponse } from '@/types/stockMaterial'

const base = (tenantId: string) => `/api/v1/tenants/${tenantId}/recipes`

export const recipesApi = {
  listSummaries: (tenantId: string) => apiClient.get<RecipeSummaryResponse[]>(base(tenantId)),

  get: (tenantId: string, variantId: string) => apiClient.get<RecipeResponse>(`${base(tenantId)}/${variantId}`),

  set: (tenantId: string, variantId: string, lines: { materialId: string; quantity: number }[]) =>
    apiClient.put<RecipeResponse>(`${base(tenantId)}/${variantId}`, { lines }),
}
