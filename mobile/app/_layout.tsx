import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useAuthStore } from '@/stores/authStore'
import { syncOfflineOrders } from '@/lib/sync'
import { getDb } from '@/lib/db'

SplashScreen.preventAutoHideAsync()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
})

export default function RootLayout() {
  const { loadFromStorage, isLoading } = useAuthStore()

  useEffect(() => {
    async function init() {
      await getDb()
      await loadFromStorage()
      SplashScreen.hideAsync()
      // Background sync on app start
      syncOfflineOrders().catch(() => null)
    }
    init()
  }, [loadFromStorage])

  if (isLoading) return null

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }} />
      </QueryClientProvider>
    </GestureHandlerRootView>
  )
}
