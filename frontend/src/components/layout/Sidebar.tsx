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
  FlaskConical,
  Sun,
  Moon,
  Monitor,
  X,
  ClipboardCheck,
} from 'lucide-react'
import { AiChatDrawer } from '@/components/ai/AiChatDrawer'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { useThemeStore } from '@/stores/themeStore'
import { useI18n } from '@/i18n'
import { getUserPermissions } from '@/lib/userPermissions'
import { BUSINESS_TYPE_ROUTES } from '@/lib/businessRoutes'
import type { BusinessType } from '@/types/api'

/* business-type accent identity: light/dark pairs, both readable as text on their surface */
const BUSINESS_ACCENTS: Record<BusinessType, { light: string; dark: string }> = {
  Restaurant:  { light: '#C2410C', dark: '#FB923C' },
  Hotel:       { light: '#2563EB', dark: '#60A5FA' },
  Gaming:      { light: '#7C3AED', dark: '#A78BFA' },
  Supermarket: { light: '#0B7A65', dark: '#3FD3B0' },
  Retail:      { light: '#BE185D', dark: '#F472B6' },
  Cafe:        { light: '#0B7A65', dark: '#3FD3B0' },
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
  { labelKey: 'stockMaterials', to: '/stock-materials', icon: <FlaskConical className="h-5 w-5" /> },
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
  { labelKey: 'dailyClose', to: '/daily-close', icon: <ClipboardCheck className="h-5 w-5" />, roles: ['Owner', 'Manager'] },
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
  mobileOpen: boolean
  onMobileClose: () => void
}

export function FlowinWordmark({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return <span aria-label="flowin" className="block h-6 w-6 rounded-full border-[3px] border-brand" />
  }
  return (
    <span dir="ltr" aria-label="flowin" className="select-none text-[1.35rem] font-bold leading-none tracking-tight text-fg">
      fl
      <span className="text-transparent [-webkit-text-stroke:2.5px_rgb(var(--brand))]">o</span>
      w
      <span className="relative inline-block">
        <span aria-hidden="true" className="absolute -top-[5px] left-1/2 h-[7px] w-[7px] -translate-x-1/2 rounded-full bg-brand" />
        ı
      </span>
      n
    </span>
  )
}

const THEME_ICON = { system: Monitor, light: Sun, dark: Moon } as const
const THEME_LABEL = {
  ar: { system: 'حسب الجهاز', light: 'فاتح', dark: 'داكن' },
  en: { system: 'System', light: 'Light', dark: 'Dark' },
} as const

export function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const { pathname } = useRouterState({ select: (s) => s.location })
  const { user, logout, tenantId, branchId } = useAuthStore()
  const { mode, cycle } = useThemeStore()
  const { t, lang, setLang } = useI18n()
  const router = useRouter()
  const [aiOpen, setAiOpen] = useState(false)

  const { data: aiFeature } = useQuery({
    queryKey: ['ai-available', branchId],
    queryFn: () => (branchId ? aiCashierApi.isAvailable(branchId) : Promise.resolve({ available: false })),
    enabled: !!branchId,
  })
  const aiAvailable = aiFeature?.available ?? false

  useEffect(() => {
    const identity = user?.businessType ? BUSINESS_ACCENTS[user.businessType] : BUSINESS_ACCENTS.Hotel
    const root = document.documentElement.style
    root.removeProperty('--accent')
    root.removeProperty('--glow')
    root.setProperty('--accent-l', identity.light)
    root.setProperty('--accent-d', identity.dark)
  }, [user?.businessType])

  const navItems = getNavItems(user?.businessType, user?.role, user?.id, tenantId ?? undefined)

  const initials = user ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.trim() || '؟' : '؟'

  // the drawer is always expanded; collapse only applies to the desktop rail
  const isRail = collapsed && !mobileOpen
  const ThemeIcon = THEME_ICON[mode]
  const themeLabel = THEME_LABEL[lang][mode]

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={onMobileClose} aria-hidden="true" />
      )}
      <aside
        className={cn(
          'sidebar-3d z-40 flex h-[100dvh] flex-col transition-[width,transform] duration-200 ease-out print:hidden',
          'fixed inset-y-0 start-0 w-64 lg:static',
          mobileOpen ? 'translate-x-0 shadow-lg' : 'max-lg:ltr:-translate-x-full max-lg:rtl:translate-x-full',
          isRail ? 'lg:w-[72px]' : 'lg:w-60',
        )}
        aria-label="القائمة الرئيسية"
      >
        <div className={cn('border-b border-border px-4', isRail ? 'flex h-16 items-center justify-center' : 'py-4')}>
          <div className={cn('flex items-center', isRail ? 'justify-center' : 'justify-between')}>
            {!isRail && <FlowinWordmark />}
            <button
              type="button"
              onClick={onMobileClose}
              className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-fg lg:hidden"
              aria-label="إغلاق القائمة"
            >
              <X className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onToggle}
              className="hidden rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-fg lg:inline-flex"
              aria-label={collapsed ? 'توسيع القائمة' : 'طي القائمة'}
            >
              {isRail ? <FlowinWordmark compact /> : <ChevronLeft className={cn('h-4 w-4 transition-transform ltr:rotate-180')} />}
            </button>
          </div>
          {!isRail && user?.businessType && (
            <span className="biz-badge mt-3">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: 'var(--accent)' }} aria-hidden="true" />
              <span aria-hidden="true">{BUSINESS_META[user.businessType].emoji}</span>
              {lang === 'ar' ? BUSINESS_META[user.businessType].ar : BUSINESS_META[user.businessType].en}
            </span>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-3">
          <ul className={cn('space-y-0.5 px-3', isRail && 'flex flex-col items-center px-2')}>
            {navItems.map((item) => {
              const isActive =
                item.to === '/'
                  ? pathname === '/'
                  : pathname === item.to || (pathname.startsWith(item.to + '/') && item.to !== '/settings')
              const label = t.nav[item.labelKey as keyof typeof t.nav]
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn('nav-item', isActive && 'nav-item-active', isRail && 'h-10 w-10 justify-center px-0 py-0')}
                    title={isRail ? label : undefined}
                  >
                    {isActive && !isRail && <span className="nav-accent-bar" aria-hidden="true" />}
                    <span className="nav-icon">{item.icon}</span>
                    {!isRail && <span className="truncate">{label}</span>}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="border-t border-border p-3">
          {!isRail && user && (
            <div className="sidebar-footer-card mb-3 flex items-center gap-3 rounded-xl p-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-brand-fg">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="sidebar-username truncate text-sm">
                  {user.firstName} {user.lastName}
                </p>
                <p className="sidebar-email truncate text-xs">{user.email}</p>
              </div>
            </div>
          )}
          <div className={cn('flex gap-1', isRail ? 'flex-col items-center' : 'flex-wrap')}>
            {aiAvailable && (
              <button
                type="button"
                onClick={() => setAiOpen((v) => !v)}
                className="nav-item !px-2 !py-2 text-sm"
                title={isRail ? 'AI' : undefined}
              >
                <span className="nav-icon">
                  <Bot className="h-4 w-4" />
                </span>
                {!isRail && 'AI'}
              </button>
            )}
            <button
              type="button"
              onClick={cycle}
              className="nav-item !px-2 !py-2 text-xs"
              title={themeLabel}
              aria-label={`${lang === 'ar' ? 'المظهر' : 'Theme'}: ${themeLabel}`}
            >
              <span className="nav-icon">
                <ThemeIcon className="h-4 w-4" />
              </span>
              {!isRail && themeLabel}
            </button>
            <button
              type="button"
              onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
              className="nav-item !px-2 !py-2 text-xs"
              title={lang === 'ar' ? 'English' : 'عربي'}
            >
              <span className="nav-icon">
                <Languages className="h-4 w-4" />
              </span>
              {!isRail && (lang === 'ar' ? 'EN' : 'عربي')}
            </button>
            <Link to="/settings" className="nav-item !px-2 !py-2 text-sm" title={isRail ? t.nav.settings : undefined}>
              <span className="nav-icon">
                <Settings className="h-4 w-4" />
              </span>
              {!isRail && t.nav.settings}
            </Link>
            <button
              type="button"
              onClick={() => {
                logout()
                void router.navigate({ to: '/login' })
              }}
              className="nav-item !px-2 !py-2 text-sm hover:!text-danger"
              title={isRail ? t.nav.logout : undefined}
            >
              <span className="nav-icon">
                <LogOut className="h-4 w-4" />
              </span>
              {!isRail && t.nav.logout}
            </button>
          </div>
        </div>
        <AiChatDrawer open={aiOpen} onClose={() => setAiOpen(false)} />
      </aside>
    </>
  )
}
