import { apiClient } from './client'
import type { ExpenseResponse, ExpenseCategory, ExpenseStatus, ExpenseSummaryResponse } from '@/types/api'

export type ExpenseFilters = {
  category?: ExpenseCategory
  status?: ExpenseStatus
  dateFrom?: string
  dateTo?: string
}

export type ExpenseInput = {
  category: ExpenseCategory
  amount: number
  description: string
  expenseDate: string
  notes?: string
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

  // Tenant and currency come from the server. approveNow is only honoured for users who may approve;
  // anyone else's expense still waits for approval.
  createExpense: (branchId: string, data: ExpenseInput & { approveNow?: boolean }) =>
    apiClient.post<ExpenseResponse>(
      `/api/v1/branches/${branchId}/expenses`,
      data,
    ),

  // Owner/Manager/Accountant only, and only while the expense is pending.
  updateExpense: (branchId: string, expenseId: string, data: ExpenseInput) =>
    apiClient.put<ExpenseResponse>(
      `/api/v1/branches/${branchId}/expenses/${expenseId}`,
      data,
    ),

  // Owner/Manager/Accountant only; the approver is the signed-in user.
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
