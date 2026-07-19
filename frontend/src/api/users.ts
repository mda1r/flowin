import { apiClient } from './client'
import type { UserSummaryResponse, CreateUserRequest } from '@/types/api'

export const usersApi = {
  list: () => apiClient.get<UserSummaryResponse[]>('/api/v1/users'),
  create: (data: CreateUserRequest) => apiClient.post<UserSummaryResponse>('/api/v1/users', data),
  delete: (id: string) => apiClient.delete(`/api/v1/users/${id}`),
}
