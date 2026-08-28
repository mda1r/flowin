import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { aiCashierApi } from '@/api/aiCashier'
import { Link, useRouterState, useRouter } from '@tanstack/react-router'
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Warehouse,
  Users,
  TrendingUp,
  ShoppingBag,
  DollarSign,
  Calculator,
  UtensilsCrossed,
  Hotel,
  FileText,
  Gamepad2,
  Settings,
  LogOut,
  ChevronLeft,
  Languages,
  UserCog,
  GitBranch,
  ClipboardList,
  Shield,
  BarChart2,
  Activity,
  ChefHat,
  Receipt,
  Bot,
} from 'lucide-react'
import { AiChatDrawer } from '@/components/ai/AiChatDrawer'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/i18n'
import { getUserPermissions } from '@/lib/userPermissions'
import { BUSINESS_TYPE_ROUTES } from '@/lib/businessRoutes'
import type { BusinessType } from '@/types/api'

/* business-type accent identity, injected as CSS variables on :root */
const BUSINESS_ACCENTS: Record<BusinessType, { accent: string; glow: string }> = {
  Restaurant:  { accent: '#FF7B5B', glow: 'rgba(255,123,91,0.30)' },
  Hotel:       { accent: '#4F7EF7', glow: 'rgba(79,126,247,0.28)' },
  Gaming:      { accent: '#A78BFA', glow: 'rgba(167,139,250,0.35)' },
  Supermarket: { accent: '#34D399', glow: 'rgba(52,211,153,0.30)' },
  Retail:      { accent: '#F472B6', glow: 'rgba(244,114,182,0.30)' },
  Cafe:        { accent: '#34D399', glow: 'rgba(52,211,153,0.30)' },
}

/* themed identity chip shown under the brand name */
const BUSINESS_META: Record<BusinessType, { emoji: string; ar: string; en: string }> = {
  Restaurant:  { emoji: '🍽️', ar: 'مطعم',       en: 'Restaurant' },
  Hotel:       { emoji: '🏨', ar: 'فندق',        en: 'Hotel' },
  Gaming:      { emoji: '🎮', ar: 'صالة ألعاب',  en: 'Gaming Lounge' },
  Supermarket: { emoji: '🛒', ar: 'سوبر ماركت',  en: 'Supermarket' },
  Retail:      { emoji: '🛍️', ar: 'متجر تجزئة', en: 'Retail Store' },
  Cafe:        { emoji: '☕', ar: 'كافيه',       en: 'Cafe' },
}

interface NavItem {
  labelKey: string
  to: string
  icon: React.ReactNode
  roles?: string[]
}

const ALL_NAV_ITEMS: NavItem[] = [
  { labelKey: 'dashboard', to: '/', icon: <LayoutDashboard className="h-5 w-5" /> },
  { labelKey: 'pos', to: '/pos', icon: <ShoppingCart className="h-5 w-5" /> },
  { labelKey: 'products', to: '/products', icon: <Package className="h-5 w-5" /> },
  { labelKey: 'inventory', to: '/inventory', icon: <Warehouse className="h-5 w-5" /> },
  { labelKey: 'stockCount', to: '/stock-counts', icon: <ClipboardList className="h-5 w-5" /> },
  { labelKey: 'customers', to: '/customers', icon: <Users className="h-5 w-5" /> },
  { labelKey: 'sales', to: '/sales', icon: <TrendingUp className="h-5 w-5" /> },
  { labelKey: 'purchasing', to: '/purchasing', icon: <ShoppingBag className="h-5 w-5" /> },
  { labelKey: 'finance', to: '/finance', icon: <DollarSign className="h-5 w-5" /> },
  { labelKey: 'taxes', to: '/taxes', icon: <Calculator className="h-5 w-5" /> },
  { labelKey: 'reports', to: '/reports', icon: <BarChart2 className="h-5 w-5" /> },
  { labelKey: 'restaurant', to: '/restaurant', icon: <UtensilsCrossed className="h-5 w-5" /> },
  { labelKey: 'hotel', to: '/hotel', icon: <Hotel className="h-5 w-5" /> },
  { labelKey: 'hotelContracts', to: '/hotel/contracts', icon: <FileText className="h-5 w-5" /> },
  { labelKey: 'gaming', to: '/gaming', icon: <Gamepad2 className="h-5 w-5" /> },
  { labelKey: 'zatca', to: '/settings/zatca', icon: <Shield className="h-5 w-5" /> },
  { labelKey: 'users', to: '/users', icon: <UserCog className="h-5 w-5" />, roles: ['Owner', 'Manager'] },
  { labelKey: 'branches', to: '/branches', icon: <GitBranch className="h-5 w-5" />, roles: ['Owner', 'Manager'] },
  { labelKey: 'kitchen', to: '/cafe/kitchen', icon: <ChefHat className="h-5 w-5" /> },
  { labelKey: 'shiftReports', to: '/shifts', icon: <FileText className="h-5 w-5" /> },
  { labelKey: 'invoices', to: '/invoices', icon: <Receipt className="h-5 w-5" /> },
  { labelKey: 'activityLogs', to: '/activity-logs', icon: <Activity className="h-5 w-5" />, roles: ['Owner', 'Manager'] },
]


function getNavItems(
  businessType: BusinessType | undefined,
  role: string | undefined,
  userId: string | undefined,
  tenantId: string | undefined,
): NavItem[] {
  const baseItems = businessType
    ? (() => {
        const allowed = new Set(BUSINESS_TYPE_ROUTES[businessType] ?? [])
        return ALL_NAV_ITEMS.filter((item) => allowed.has(item.to))
      })()
    : ALL_NAV_ITEMS

  const roleFiltered = baseItems.filter((item) => !item.roles || (role && item.roles.includes(role)))

  // Apply per-user page permissions (Owner/Manager always get everything)
  if (userId && tenantId && role !== 'Owner' && role !== 'Manager') {
    const perms = getUserPermissions(tenantId, userId)
    if (perms) {
      const allowed = new Set(perms)
      return roleFiltered.filter((item) => allowed.has(item.to))
    }
  }

  return roleFiltered
}

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { pathname } = useRouterState({ select: (s) => s.location })
  const { user, logout, tenantId, branchId } = useAuthStore()
  const { t, lang, setLang } = useI18n()
  const router = useRouter()
  const [aiOpen, setAiOpen] = useState(false)

  const { data: aiFeature } = useQuery({
    queryKey: ['ai-available', branchId],
    queryFn: () => branchId ? aiCashierApi.isAvailable(branchId) : Promise.resolve({ available: false }),
    enabled: !!branchId,
  })
  const aiAvailable = aiFeature?.available ?? false

  // inject the business-type accent identity globally
  useEffect(() => {
    const identity = user?.businessType ? BUSINESS_ACCENTS[user.businessType] : BUSINESS_ACCENTS.Hotel
    document.documentElement.style.setProperty('--accent', identity.accent)
    document.documentElement.style.setProperty('--glow', identity.glow)
  }, [user?.businessType])

  const navItems = getNavItems(user?.businessType, user?.role, user?.id, tenantId ?? undefined)

  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.trim() || '؟'
    : '؟'

  return (
    <aside
      className={cn(
        'sidebar-3d relative z-20 flex h-screen flex-col transition-all duration-spring ease-spring',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      {/* Logo — breathing glow mark + business identity chip */}
      <div
        className={cn('border-b px-4', collapsed ? 'flex h-16 items-center justify-center' : 'py-3.5')}
        style={{ borderColor: 'var(--card-border)' }}
      >
        <div className="flex items-center justify-between">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <svg
                viewBox="0 0 48 48"
                className="logo-breathe h-8 w-8 shrink-0"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <circle cx="16" cy="24" r="11.5" fill="none" stroke="#62E6C7" strokeWidth="4.5" strokeLinecap="round" />
                <rect x="31" y="7" width="8" height="34" rx="4" fill="#62E6C7" />
              </svg>
              <span
                className="select-none text-xl font-extrabold tracking-tight"
                style={{
                  color: '#ffffff',
                  textShadow: '0 0 20px color-mix(in srgb, var(--accent) 40%, transparent)',
                }}
              >
                flow<span style={{ color: '#62E6C7' }}>I</span>n
              </span>
            </div>
          )}
          <button
            onClick={onToggle}
            className="card-3d card-3d-lift ms-auto rounded-lg p-1.5 text-gray-400 transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]"
            aria-label={collapsed ? 'توسيع القائمة' : 'طي القائمة'}
          >
            <ChevronLeft
              className={cn('h-4 w-4 transition-transform duration-spring ease-spring', collapsed && 'rotate-180')}
            />
          </button>
        </div>
        {!collapsed && user?.businessType && (
          <span className="biz-badge mt-2.5">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: 'var(--accent)', boxShadow: '0 0 6px var(--glow)' }}
              aria-hidden="true"
            />
            <span aria-hidden="true">{BUSINESS_META[user.businessType].emoji}</span>
            {lang === 'ar' ? BUSINESS_META[user.businessType].ar : BUSINESS_META[user.businessType].en}
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="scene-3d flex-1 overflow-y-auto py-4">
        <ul className={cn('space-y-1 px-2', collapsed && 'flex flex-col items-center space-y-2')}>
          {navItems.map((item) => {
            const isActive = item.to === '/'
              ? pathname === '/'
              : pathname === item.to || (pathname.startsWith(item.to + '/') && item.to !== '/settings')
            const label = t.nav[item.labelKey as keyof typeof t.nav]
            return (
              <li key={item.to} className={cn(collapsed && 'w-auto')}>
                <Link
                  to={item.to}
                  className={cn(
                    'nav-item relative',
                    isActive && 'nav-item-active',
                    collapsed && 'h-10 w-10 justify-center rounded-full px-0 py-0',
                  )}
                  style={
                    isActive
                      ? {
                          background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
                          borderColor: 'color-mix(in srgb, var(--accent) 30%, transparent)',
                        }
                      : undefined
                  }
                  title={collapsed ? label : undefined}
                >
                  {isActive && !collapsed && <span className="nav-accent-bar" aria-hidden="true" />}
                  <span className="nav-icon">{item.icon}</span>
                  {!collapsed && <span>{label}</span>}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div
        className="mx-3 h-px shrink-0"
        style={{ background: 'color-mix(in srgb, var(--accent) 20%, var(--card-border))' }}
        aria-hidden="true"
      />
      <div className="p-3">
        {!collapsed && user && (
          <div className="sidebar-footer-card mb-3 flex items-center gap-3 rounded-xl p-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold"
              style={{
                background: '#62E6C7',
                color: '#23262D',
              }}
            >
              {initials}
            </div>
            <div className="min-w-0">
              <p className="sidebar-username truncate text-sm">{user.firstName} {user.lastName}</p>
              <p className="sidebar-email truncate text-xs">{user.email}</p>
            </div>
          </div>
        )}
        <div className={cn('flex gap-1', collapsed ? 'flex-col items-center' : 'flex-wrap')}>
          {aiAvailable && (
            <button
              onClick={() => setAiOpen(v => !v)}
              className="nav-item !px-2 !py-2 text-sm"
              title={collapsed ? 'AI' : undefined}
            >
              <span className="nav-icon"><Bot className="h-4 w-4" /></span>
              {!collapsed && 'AI'}
            </button>
          )}
          <button
            onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
            className="nav-item !px-2 !py-2 text-xs"
            title={lang === 'ar' ? 'English' : 'عربي'}
          >
            <span className="nav-icon"><Languages className="h-4 w-4" /></span>
            {!collapsed && (lang === 'ar' ? 'EN' : 'عر')}
          </button>
          <Link
            to="/settings"
            className="nav-item !px-2 !py-2 text-sm"
            title={collapsed ? t.nav.settings : undefined}
          >
            <span className="nav-icon"><Settings className="h-4 w-4" /></span>
            {!collapsed && t.nav.settings}
          </Link>
          <button
            onClick={() => { logout(); void router.navigate({ to: '/login' }) }}
            className="nav-item !px-2 !py-2 text-sm"
            title={collapsed ? t.nav.logout : undefined}
          >
            <span className="nav-icon"><LogOut className="h-4 w-4" /></span>
            {!collapsed && t.nav.logout}
          </button>
        </div>
      </div>
      <AiChatDrawer open={aiOpen} onClose={() => setAiOpen(false)} />
    </aside>
  )
}
