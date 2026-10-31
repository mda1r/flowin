import { apiClient } from './client'
import type { ShiftResponse } from '@/types/api'

export const shiftsApi = {
  // 204 (no body) when the user has no open shift in this branch.
  getCurrent: (branchId: string) =>
    apiClient.get<ShiftResponse | null>(`/api/v1/branches/${branchId}/shifts/current`),

  // Owner/Manager only.
  list: (branchId: string, page = 1, pageSize = 20) =>
    apiClient.get<ShiftResponse[]>(`/api/v1/branches/${branchId}/shifts`, {
      params: { page, pageSize },
    }),

  // Owner/Manager only: every open shift in the branch, with totals so far.
  listOpen: (branchId: string) =>
    apiClient.get<ShiftResponse[]>(`/api/v1/branches/${branchId}/shifts/open`),

  // One shift with its totals computed on the server (live while it is open).
  summary: (branchId: string, shiftId: string) =>
    apiClient.get<ShiftResponse>(`/api/v1/branches/${branchId}/shifts/${shiftId}/summary`),

  open: (branchId: string, openingCash: number) =>
    apiClient.post<ShiftResponse>(`/api/v1/branches/${branchId}/shifts`, { openingCash }),

  close: (branchId: string, shiftId: string, closingCash: number, closingCardCount: number, notes?: string) =>
    apiClient.post<ShiftResponse>(
      `/api/v1/branches/${branchId}/shifts/${shiftId}/close`,
      { closingCash, closingCardCount, notes },
    ),

  // Owner/Manager closes another user's shift; the server records who closed it.
  forceClose: (branchId: string, shiftId: string, closingCash: number, closingCardCount: number, notes?: string) =>
    apiClient.post<ShiftResponse>(
      `/api/v1/branches/${branchId}/shifts/${shiftId}/force-close`,
      { closingCash, closingCardCount, notes },
    ),
}
