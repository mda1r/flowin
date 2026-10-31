import { apiClient } from './client'
import type { AuthTokens, UserProfile } from '@/types/api'

// A short label for the sessions list, e.g. "Chrome · Windows" or "flowin desktop · macOS".
function deviceInfo(): string {
  if (typeof navigator === 'undefined') return 'Unknown device'
  const ua = navigator.userAgent
  const app = typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)
    ? 'flowin desktop'
    : /Edg\//.test(ua) ? 'Edge'
    : /OPR\//.test(ua) ? 'Opera'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) ? 'Safari'
    : 'Browser'
  const os = /Android/.test(ua) ? 'Android'
    : /iPhone|iPad|iPod/.test(ua) ? 'iOS'
    : /Windows/.test(ua) ? 'Windows'
    : /Mac OS X|Macintosh/.test(ua) ? 'macOS'
    : /CrOS/.test(ua) ? 'ChromeOS'
    : /Linux/.test(ua) ? 'Linux'
    : ''
  return os ? `${app} · ${os}` : app
}

export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post<AuthTokens>('/api/v1/auth/login', { email, password, deviceInfo: deviceInfo() }),

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
