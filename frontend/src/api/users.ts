import { apiClient } from './client'
import type { UserSummaryResponse, CreateUserRequest, UpdateUserRequest } from '@/types/api'

export const usersApi = {
  list: () => apiClient.get<UserSummaryResponse[]>('/api/v1/users'),
  create: (data: CreateUserRequest) => apiClient.post<UserSummaryResponse>('/api/v1/users', data),
  update: (id: string, data: UpdateUserRequest) => apiClient.put<UserSummaryResponse>(`/api/v1/users/${id}`, data),
  activate: (id: string) => apiClient.post<UserSummaryResponse>(`/api/v1/users/${id}/activate`),
  deactivate: (id: string) => apiClient.post<UserSummaryResponse>(`/api/v1/users/${id}/deactivate`),
  /** null gives the user back every page their role allows. */
  setPages: (id: string, pages: string[] | null) =>
    apiClient.put<UserSummaryResponse>(`/api/v1/users/${id}/pages`, { pages }),
  resetPassword: (id: string, newPassword: string) =>
    apiClient.post(`/api/v1/users/${id}/reset-password`, { newPassword }),
  /** Deactivates by default; `permanent` hard-deletes and only works for accounts that never signed in. */
  delete: (id: string, permanent = false) =>
    apiClient.delete(`/api/v1/users/${id}`, { params: permanent ? { permanent: true } : undefined }),
}
