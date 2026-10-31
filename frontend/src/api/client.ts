import axios, { isAxiosError, type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/stores/authStore'
import { toast } from '@/components/ui/Toast'

const clientConfig = {
  baseURL: (() => { const u = import.meta.env.VITE_API_BASE_URL || ''; return u.charCodeAt(0) === 0xFEFF ? u.slice(1) : u; })(),
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
}

export const apiClient = axios.create(clientConfig)

// Same host and timeout as apiClient but without its interceptors, so a refresh can never recurse into itself.
const refreshClient = axios.create(clientConfig)

// Auth calls answer 401 for a wrong password or a dead token; refreshing and retrying them makes no sense.
const SKIP_REFRESH = ['/api/v1/auth/login', '/api/v1/auth/refresh', '/api/v1/auth/logout']

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let isRefreshing = false
let failedQueue: Array<{
  resolve: (token: string) => void
  reject: (err: unknown) => void
}> = []

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((p) => {
    if (error) {
      p.reject(error)
    } else {
      p.resolve(token!)
    }
  })
  failedQueue = []
}

apiClient.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean
    }
    if (error.response?.status !== 401 || !original || original._retry || SKIP_REFRESH.some((p) => original.url?.includes(p))) {
      return Promise.reject(error)
    }

    const { refreshToken, setTokens, logout } = useAuthStore.getState()
    if (!refreshToken) {
      logout()
      return Promise.reject(error)
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject })
      }).then((token) => {
        original.headers.Authorization = `Bearer ${token}`
        return apiClient(original)
      })
    }

    original._retry = true
    isRefreshing = true

    try {
      const { data } = await refreshClient.post<{
        accessToken: string
        refreshToken: string
      }>('/api/v1/auth/refresh', { refreshToken })
      setTokens(data.accessToken, data.refreshToken)
      processQueue(null, data.accessToken)
      original.headers.Authorization = `Bearer ${data.accessToken}`
      return apiClient(original)
    } catch (err) {
      processQueue(err, null)
      // A suspended business loses its sessions mid-shift; say why instead of a bare logout.
      if (isAxiosError(err) && (err.response?.data as { title?: string } | undefined)?.title === 'IAM.TenantSuspended') {
        const ar = document.documentElement.lang !== 'en'
        toast.error(
          ar ? 'تم إيقاف الحساب' : 'Account suspended',
          ar ? 'الحساب موقوف، تواصل مع الدعم' : 'This account is suspended. Please contact support.',
        )
      }
      // Only the server refusing the refresh token ends the session. A dropped connection, a 5xx or a 429
      // keeps it, so the till carries on (sales queue offline) and the next request simply tries again.
      const status = axios.isAxiosError(err) ? err.response?.status : undefined
      if (status === 401 || status === 403) logout()
      return Promise.reject(err)
    } finally {
      isRefreshing = false
    }
  },
)
