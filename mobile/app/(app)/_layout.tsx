import { Tabs, router } from 'expo-router'
import { useEffect } from 'react'
import { type ColorValue } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuthStore } from '@/stores/authStore'
import { syncOfflineOrders } from '@/lib/sync'
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo'

function TabIcon({ name, color, size }: { name: keyof typeof Ionicons.glyphMap; color: ColorValue; size: number }) {
  return <Ionicons name={name} color={color as string} size={size} />
}

export default function AppLayout() {
  const { isAuthenticated } = useAuthStore()

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/(auth)/login')
    }
  }, [isAuthenticated])

  // Sync when network comes back
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state: NetInfoState) => {
      if (state.isConnected) syncOfflineOrders().catch(() => null)
    })
    return unsub
  }, [])

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#10b981',
        tabBarInactiveTintColor: '#64748b',
        tabBarStyle: { backgroundColor: '#1e293b', borderTopColor: '#334155' },
        headerStyle: { backgroundColor: '#1e293b' },
        headerTintColor: '#f8fafc',
      }}
    >
      <Tabs.Screen
        name="pos/index"
        options={{
          title: 'نقطة البيع',
          tabBarIcon: ({ color, size }) => <TabIcon name="cart" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="products/index"
        options={{
          title: 'المنتجات',
          tabBarIcon: ({ color, size }) => <TabIcon name="cube" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="inventory/index"
        options={{
          title: 'المخزون',
          tabBarIcon: ({ color, size }) => <TabIcon name="layers" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="customers/index"
        options={{
          title: 'العملاء',
          tabBarIcon: ({ color, size }) => <TabIcon name="people" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="reports/index"
        options={{
          title: 'التقارير',
          tabBarIcon: ({ color, size }) => <TabIcon name="bar-chart" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings/index"
        options={{
          title: 'الإعدادات',
          tabBarIcon: ({ color, size }) => <TabIcon name="settings" color={color} size={size} />,
        }}
      />
    </Tabs>
  )
}
