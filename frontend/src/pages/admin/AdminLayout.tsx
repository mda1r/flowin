import { useEffect, useState } from 'react'
import { Outlet, Link, useRouterState } from '@tanstack/react-router'
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  LogOut,
  ShieldCheck,
  Layers,
  Languages,
  Menu,
  Monitor,
  Moon,
  Sun,
  X,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useThemeStore } from '@/stores/themeStore'
import { useSignOut } from '@/lib/session'
import { useBelowLg } from '@/lib/useBelowLg'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n'
import { FlowinLockup } from '@/components/brand/Brand'

const THEME_ICON = { system: Monitor, light: Sun, dark: Moon } as const
const THEME_LABEL = {
  ar: { system: 'حسب الجهاز', light: 'فاتح', dark: 'داكن' },
  en: { system: 'System', light: 'Light', dark: 'Dark' },
} as const

export function AdminLayout() {
  const { user } = useAuthStore()
  const handleLogout = useSignOut()
  const { mode, cycle } = useThemeStore()
  const { t, lang, setLang } = useI18n()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const belowLg = useBelowLg()
  const [open, setOpen] = useState(false)

  useEffect(() => setOpen(false), [pathname])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const navItems = [
    { to: '/admin', label: t.nav.dashboard, icon: LayoutDashboard, exact: true },
    { to: '/admin/tenants', label: t.admin.tenants.title, icon: Building2 },
    { to: '/admin/brands', label: t.admin.brands.title, icon: Layers },
    { to: '/admin/plans', label: t.admin.plans.title, icon: CreditCard },
  ]

  const ThemeIcon = THEME_ICON[mode]
  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.trim() || 'S'

  return (
    <div className="flex h-[100dvh] bg-bg text-fg">
      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} aria-hidden="true" />}
      <aside
        id="admin-sidebar"
        inert={belowLg && !open}
        className={cn(
          'sidebar-3d fixed inset-y-0 start-0 z-40 flex w-64 flex-col transition-transform duration-200 lg:static lg:w-60',
          open ? 'translate-x-0 shadow-lg' : 'max-lg:ltr:-translate-x-full max-lg:rtl:translate-x-full',
        )}
        aria-label={t.admin.ui.panel}
      >
        <div className="border-b border-border px-4 py-4">
          <div className="flex items-center justify-between">
            <FlowinLockup />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-fg lg:hidden"
              aria-label={t.admin.ui.closeMenu}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <span className="biz-badge mt-3">
            <ShieldCheck className="h-3.5 w-3.5 text-brand-ink" aria-hidden="true" />
            {t.admin.ui.panel}
          </span>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pt-3">
          <ul className="space-y-0.5">
            {navItems.map(({ to, label, icon: Icon, exact }) => {
              const active = exact ? pathname === to : pathname === to || pathname.startsWith(to + '/')
              return (
                <li key={to}>
                  <Link to={to} aria-current={active ? 'page' : undefined} className={cn('nav-item', active && 'nav-item-active')}>
                    {active && <span className="nav-accent-bar" aria-hidden="true" />}
                    <span className="nav-icon">
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <span className="truncate">{label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="border-t border-border p-3">
          <div className="sidebar-footer-card mb-3 flex items-center gap-3 rounded-xl p-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-brand-fg">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="sidebar-username truncate text-sm">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="sidebar-email truncate text-xs">{user?.email}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={cycle}
              className="nav-item !px-2 !py-2 text-xs"
              aria-label={`${lang === 'ar' ? 'المظهر' : 'Theme'}: ${THEME_LABEL[lang][mode]}`}
            >
              <span className="nav-icon">
                <ThemeIcon className="h-4 w-4" />
              </span>
              {THEME_LABEL[lang][mode]}
            </button>
            <button type="button" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} className="nav-item !px-2 !py-2 text-xs">
              <span className="nav-icon">
                <Languages className="h-4 w-4" />
              </span>
              {lang === 'ar' ? 'EN' : 'عربي'}
            </button>
            <button type="button" onClick={handleLogout} className="nav-item !px-2 !py-2 text-sm hover:!text-danger">
              <span className="nav-icon">
                <LogOut className="h-4 w-4" />
              </span>
              {t.nav.logout}
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col" inert={open && belowLg}>
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-2 hover:text-fg"
            aria-label={t.admin.ui.openMenu}
            aria-expanded={open}
            aria-controls="admin-sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
          <FlowinLockup />
        </header>
        <main className="min-w-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
