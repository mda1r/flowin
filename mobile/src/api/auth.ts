import { apiClient } from './client'
import type { AuthTokens, UserProfile } from '@/types/api'

export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post<AuthTokens>('/api/v1/auth/login', { email, password }),

  refresh: (refreshToken: string) =>
    apiClient.post<AuthTokens>('/api/v1/auth/refresh', { refreshToken }),

  me: () => apiClient.get<UserProfile>('/api/v1/auth/me'),

  logout: (refreshToken: string) =>
    apiClient.post('/api/v1/auth/logout', { refreshToken }),

  changePassword: (currentPassword: string, newPassword: string) =>
    apiClient.patch('/api/v1/auth/password', { currentPassword, newPassword }),

  updateProfile: (firstName: string, lastName: string) =>
    apiClient.patch('/api/v1/auth/profile', { firstName, lastName }),
}
