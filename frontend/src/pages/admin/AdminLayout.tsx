import { Outlet, Link, useNavigate } from '@tanstack/react-router'
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  LogOut,
  ShieldCheck,
  Layers,
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/i18n'
import { FlowinLogo } from '@/components/brand/Brand'

export function AdminLayout() {
  const { logout, user } = useAuthStore()
  const navigate = useNavigate()
  const { t } = useI18n()

  const navItems = [
    { to: '/admin', label: t.nav.dashboard, icon: LayoutDashboard, exact: true },
    { to: '/admin/tenants', label: t.admin.tenants.title, icon: Building2 },
    { to: '/admin/brands', label: t.admin.brands.title, icon: Layers },
    { to: '/admin/plans', label: t.admin.plans.title, icon: CreditCard },
  ]

  const handleLogout = () => {
    logout()
    navigate({ to: '/login' })
  }

  return (
    <div className="scheme-dark flex h-screen bg-bg text-fg" dir="rtl">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col bg-surface border-l border-border">
        {/* Brand */}
        <div className="border-b border-border px-5 py-5">
          <FlowinLogo className="h-[26px] text-fg" />
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-brand-ink">
            <ShieldCheck className="h-3.5 w-3.5" />
            {t.admin.dashboard.title}
          </p>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <NavLink key={item.to} {...item} />
          ))}
        </nav>

        {/* User footer */}
        <div className="border-t border-border p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-xs font-bold text-brand-fg">
              {user?.firstName?.charAt(0) ?? 'S'}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-fg">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="truncate text-xs text-muted">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-fg transition-colors"
          >
            <LogOut className="h-4 w-4" />
            {t.nav.logout}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}

function NavLink({
  to,
  label,
  icon: Icon,
  exact,
}: {
  to: string
  label: string
  icon: React.ElementType
  exact?: boolean
}) {
  const pathname = window.location.pathname
  const isActive = exact ? pathname === to : pathname.startsWith(to)

  return (
    <Link
      to={to}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
        isActive
          ? 'nav-item-active'
          : 'text-muted hover:bg-surface-2 hover:text-fg'
      }`}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      {label}
    </Link>
  )
}
