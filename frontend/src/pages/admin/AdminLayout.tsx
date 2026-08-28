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
    <div className="flex h-screen bg-slate-950" dir="rtl">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col bg-slate-900 border-l border-slate-800">
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-800">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 shadow">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">flowin</p>
            <p className="text-xs text-blue-400">{t.admin.dashboard.title}</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <NavLink key={item.to} {...item} />
          ))}
        </nav>

        {/* User footer */}
        <div className="border-t border-slate-800 p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
              {user?.firstName?.charAt(0) ?? 'S'}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="truncate text-xs text-slate-400">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
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
          ? 'bg-blue-600 text-white'
          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      }`}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      {label}
    </Link>
  )
}
