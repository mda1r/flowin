import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import * as SecureStore from 'expo-secure-store'
import Constants from 'expo-constants'

const API_BASE = Constants.expoConfig?.extra?.apiBaseUrl ?? 'https://flowin-production-46b8.up.railway.app'

export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
})

apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await SecureStore.getItemAsync('accessToken')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let isRefreshing = false
let failedQueue: Array<{ resolve: (t: string) => void; reject: (e: unknown) => void }> = []

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)))
  failedQueue = []
}

apiClient.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    if (error.response?.status !== 401 || original._retry) return Promise.reject(error)

    const refreshToken = await SecureStore.getItemAsync('refreshToken')
    if (!refreshToken) {
      await clearTokens()
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
      const { data } = await axios.post<{ accessToken: string; refreshToken: string }>(
        `${API_BASE}/api/v1/auth/refresh`,
        { refreshToken },
      )
      await saveTokens(data.accessToken, data.refreshToken)
      processQueue(null, data.accessToken)
      original.headers.Authorization = `Bearer ${data.accessToken}`
      return apiClient(original)
    } catch (err) {
      processQueue(err, null)
      await clearTokens()
      return Promise.reject(err)
    } finally {
      isRefreshing = false
    }
  },
)

export async function saveTokens(accessToken: string, refreshToken: string) {
  await SecureStore.setItemAsync('accessToken', accessToken)
  await SecureStore.setItemAsync('refreshToken', refreshToken)
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync('accessToken')
  await SecureStore.deleteItemAsync('refreshToken')
}
