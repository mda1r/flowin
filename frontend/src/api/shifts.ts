import { apiClient } from './client'
import type { ShiftResponse } from '@/types/api'

export const shiftsApi = {
  getCurrent: (branchId: string) =>
    apiClient.get<ShiftResponse | null>(`/api/v1/branches/${branchId}/shifts/current`),

  list: (branchId: string, page = 1, pageSize = 20) =>
    apiClient.get<ShiftResponse[]>(`/api/v1/branches/${branchId}/shifts`, {
      params: { page, pageSize },
    }),

  open: (branchId: string, openingCash: number) =>
    apiClient.post<ShiftResponse>(`/api/v1/branches/${branchId}/shifts`, { openingCash }),

  close: (branchId: string, shiftId: string, closingCash: number, notes?: string) =>
    apiClient.post<ShiftResponse>(
      `/api/v1/branches/${branchId}/shifts/${shiftId}/close`,
      { closingCash, notes },
    ),
}
