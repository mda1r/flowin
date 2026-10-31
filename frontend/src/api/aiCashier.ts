import { apiClient } from './client'

export interface AiCashierAction {
  type: 'add_item' | 'complete_order' | string
  variantId?: string
  quantity?: number
  notes?: string
  paymentMethod?: 'Cash' | 'Card'
}

export interface AiCashierResponse {
  message: string
  actions: AiCashierAction[]
  state: 'greeting' | 'taking_order' | 'summarizing' | 'payment_method' | 'complete' | string
}

export interface AiCashierMessage {
  role: 'user' | 'assistant'
  content: string
}

export const aiCashierApi = {
  isAvailable: (branchId: string) =>
    apiClient
      .get<{ available: boolean }>(`/api/v1/branches/${branchId}/ai/cashier/available`)
      .then((r) => r.data),

  chat: (branchId: string, messages: AiCashierMessage[]) =>
    apiClient
      .post<AiCashierResponse>(`/api/v1/branches/${branchId}/ai/cashier`, { messages })
      .then((r) => r.data),
}
