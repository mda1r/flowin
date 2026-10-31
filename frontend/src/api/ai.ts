import { apiClient } from './client'

export interface AiChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AiChatRequest {
  message: string
  history?: AiChatMessage[]
}

export interface AiInsightsResponse {
  salesInsight: string
  trendInsight: string
  recommendation: string
  generatedAt: string
}

/** What the signed-in user can open: the assistant is Owner/Manager only and needs the 'ai' feature. */
export interface AiAvailability {
  assistant: boolean
  cashier: boolean
}

export const aiApi = {
  available: (branchId: string) =>
    apiClient.get<AiAvailability>(`/api/v1/branches/${branchId}/ai/available`).then((r) => r.data),

  chat: (branchId: string, data: AiChatRequest) =>
    apiClient.post<string>(`/api/v1/branches/${branchId}/ai/chat`, data),

  getInsights: (branchId: string) =>
    apiClient.get<AiInsightsResponse>(`/api/v1/branches/${branchId}/ai/insights`),
}
