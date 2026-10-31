import { apiClient } from './client'
import type { ExpenseResponse, ExpenseCategory, ExpenseStatus, ExpenseSummaryResponse } from '@/types/api'

export type ExpenseFilters = {
  category?: ExpenseCategory
  status?: ExpenseStatus
  dateFrom?: string
  dateTo?: string
}

export const financeApi = {
  listExpenses: (
    branchId: string,
    params?: ExpenseFilters & { page?: number; pageSize?: number },
  ) =>
    apiClient.get<ExpenseResponse[]>(
      `/api/v1/branches/${branchId}/expenses`,
      { params: { page: 1, pageSize: 20, ...params } },
    ),

  // Every page for the filters, for the accountant's CSV export.
  listAllExpenses: async (branchId: string, filters: ExpenseFilters) => {
    const PAGE_SIZE = 200
    const all: ExpenseResponse[] = []
    for (let page = 1; page <= 50; page++) {
      const { data } = await financeApi.listExpenses(branchId, { ...filters, page, pageSize: PAGE_SIZE })
      all.push(...data)
      if (data.length < PAGE_SIZE) break
    }
    return all
  },

  getSummary: (branchId: string, dateFrom: string, dateTo: string) =>
    apiClient.get<ExpenseSummaryResponse>(
      `/api/v1/branches/${branchId}/expenses/summary`,
      { params: { dateFrom, dateTo } },
    ),

  getExpense: (branchId: string, expenseId: string) =>
    apiClient.get<ExpenseResponse>(
      `/api/v1/branches/${branchId}/expenses/${expenseId}`,
    ),

  // Tenant comes from the token on the server.
  createExpense: (
    branchId: string,
    data: {
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

  // Owner/Manager only; the approver is the signed-in user.
  approve: (branchId: string, expenseId: string) =>
    apiClient.post<ExpenseResponse>(
      `/api/v1/branches/${branchId}/expenses/${expenseId}/approve`,
    ),

  void: (branchId: string, expenseId: string, data?: { reason?: string }) =>
    apiClient.post<ExpenseResponse>(
      `/api/v1/branches/${branchId}/expenses/${expenseId}/void`,
      data ?? {},
    ),
}
