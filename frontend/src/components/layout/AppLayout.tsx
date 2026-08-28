import { useEffect, useState } from 'react'
import { Outlet } from '@tanstack/react-router'
import { Sidebar } from './Sidebar'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/stores/authStore'

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const { setUser } = useAuthStore()

  useEffect(() => {
    authApi.me().then(({ data }) => setUser(data)).catch(() => {})
  }, [setUser])

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
