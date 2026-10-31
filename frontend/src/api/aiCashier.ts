import { apiClient } from './client'

export interface AiCashierAction {
  type: 'add_item' | 'set_quantity' | 'remove_item' | 'complete_order' | string
  variantId?: string
  quantity?: number
  notes?: string
  paymentMethod?: 'Cash' | 'Card'
}

export interface AiCashierResponse {
  message: string
  actions: AiCashierAction[]
  state: 'greeting' | 'taking_order' | 'summarizing' | 'payment_method' | 'complete' | 'error' | string
  /** The server dropped something the model asked for; `message` is only the correction. */
  corrected?: boolean
}

export interface AiCashierMessage {
  role: 'user' | 'assistant'
  content: string
}

/** A cart line as the POS shows it; lineTotal includes VAT. */
export interface AiCashierCartLine {
  variantId: string
  name: string
  quantity: number
  lineTotal: number
}

export interface AiCashierCartSnapshot {
  lines: AiCashierCartLine[]
  /** Cart total including VAT, the same figure the receipt prints. */
  total: number
}

export const aiCashierApi = {
  isAvailable: (branchId: string) =>
    apiClient
      .get<{ available: boolean }>(`/api/v1/branches/${branchId}/ai/cashier/available`)
      .then((r) => r.data),

  chat: (branchId: string, messages: AiCashierMessage[], cart?: AiCashierCartSnapshot, signal?: AbortSignal) =>
    apiClient
      .post<AiCashierResponse>(
        `/api/v1/branches/${branchId}/ai/cashier`,
        { messages, cart: cart?.lines ?? [], cartTotal: cart?.total },
        { signal },
      )
      .then((r) => r.data),
}
