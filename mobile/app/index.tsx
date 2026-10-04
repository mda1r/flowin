import { Redirect } from 'expo-router'
import { useAuthStore } from '@/stores/authStore'

export default function Index() {
  const { isAuthenticated } = useAuthStore()
  return isAuthenticated() ? <Redirect href="/(app)/pos" /> : <Redirect href="/(auth)/login" />
}
