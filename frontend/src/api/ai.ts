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

export const aiApi = {
  chat: (branchId: string, data: AiChatRequest) =>
    apiClient.post<string>(`/api/v1/branches/${branchId}/ai/chat`, data),

  getInsights: (branchId: string) =>
    apiClient.get<AiInsightsResponse>(`/api/v1/branches/${branchId}/ai/insights`),
}
