import { useEffect, useRef, useState } from 'react'
import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { Menu } from 'lucide-react'
import { Sidebar, FlowinWordmark } from './Sidebar'
import { authApi } from '@/api/auth'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/i18n'

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { setUser } = useAuthStore()
  const accessToken = useAuthStore((s) => s.accessToken)
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { t } = useI18n()
  const menuBtnRef = useRef<HTMLButtonElement>(null)
  const wasOpen = useRef(false)

  // The route guard only runs on navigation; a session cleared mid-page (failed token refresh) must also leave.
  useEffect(() => {
    if (!accessToken) void navigate({ to: '/login', replace: true })
  }, [accessToken, navigate])

  useEffect(() => {
    authApi.me().then(({ data }) => setUser(data)).catch(() => {})
  }, [setUser])

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // drawer open: freeze the page behind it; on close, hand focus back to the hamburger
  useEffect(() => {
    if (mobileOpen) {
      wasOpen.current = true
      const prevOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = prevOverflow
      }
    }
    if (wasOpen.current) {
      wasOpen.current = false
      const active = document.activeElement
      if (!active || active === document.body || document.getElementById('app-sidebar')?.contains(active)) {
        menuBtnRef.current?.focus()
      }
    }
  }, [mobileOpen])

  return (
    <div className="flex h-[100dvh] bg-bg print:block print:h-auto print:bg-white">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col" inert={mobileOpen}>
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-4 lg:hidden print:hidden">
          <button
            ref={menuBtnRef}
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-2 hover:text-fg"
            aria-label={t.common.openMenu}
            aria-expanded={mobileOpen}
            aria-controls="app-sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
          <FlowinWordmark />
        </header>
        <main className={cn('min-w-0 flex-1 overflow-y-auto print:overflow-visible', mobileOpen && 'max-lg:overflow-hidden')}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
