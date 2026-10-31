import { apiClient } from './client'
import type { ExpenseResponse, ExpenseCategory, ExpenseStatus } from '@/types/api'

export const financeApi = {
  listExpenses: (
    branchId: string,
    params?: {
      category?: ExpenseCategory
      status?: ExpenseStatus
      dateFrom?: string
      dateTo?: string
      page?: number
      pageSize?: number
    },
  ) =>
    apiClient.get<ExpenseResponse[]>(
      `/api/v1/branches/${branchId}/expenses`,
      { params: { page: 1, pageSize: 20, ...params } },
    ),

  getExpense: (branchId: string, expenseId: string) =>
    apiClient.get<ExpenseResponse>(
      `/api/v1/branches/${branchId}/expenses/${expenseId}`,
    ),

  createExpense: (
    branchId: string,
    data: {
      tenantId: string
      category: ExpenseCategory
      amount: number
      currency: string
      description: string
      expenseDate: string
      notes?: string
    },
  ) =>
    apiClient.post<ExpenseResponse>(
      `/api/v1/branches/${branchId}/expenses`,
      data,
    ),

  approve: (branchId: string, expenseId: string, data: { approvedBy: string }) =>
    apiClient.post<ExpenseResponse>(
      `/api/v1/branches/${branchId}/expenses/${expenseId}/approve`,
      data,
    ),

  void: (branchId: string, expenseId: string, data?: { reason?: string }) =>
    apiClient.post<ExpenseResponse>(
      `/api/v1/branches/${branchId}/expenses/${expenseId}/void`,
      data,
    ),
}
