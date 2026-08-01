import { createRouter, createRoute, createRootRoute, redirect, Outlet } from '@tanstack/react-router'
import { AppLayout } from '@/components/layout/AppLayout'
import { LoginPage } from '@/pages/auth/LoginPage'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { POSPage } from '@/pages/pos/PosPage'
import { ProductsPage } from '@/pages/catalog/ProductsPage'
import { InventoryPage } from '@/pages/inventory/InventoryPage'
import { CustomersPage } from '@/pages/crm/CustomersPage'
import { SalesPage } from '@/pages/sales/SalesPage'
import { PurchasingPage } from '@/pages/purchasing/PurchasingPage'
import { FinancePage } from '@/pages/finance/FinancePage'
import { RestaurantPage } from '@/pages/restaurant/RestaurantPage'
import { KitchenPage } from '@/pages/restaurant/KitchenPage'
import { HotelPage } from '@/pages/hotel/HotelPage'
import { ContractsPage } from '@/pages/hotel/ContractsPage'
import { GamingPage } from '@/pages/gaming/GamingPage'
import { SettingsPage } from '@/pages/settings/SettingsPage'
import { useAuthStore } from '@/stores/authStore'
import { AdminLayout } from '@/pages/admin/AdminLayout'
import { AdminDashboard } from '@/pages/admin/AdminDashboard'
import { TenantsPage } from '@/pages/admin/TenantsPage'
import { TenantDetailPage } from '@/pages/admin/TenantDetailPage'
import { PlansPage } from '@/pages/admin/PlansPage'
import { UsersPage } from '@/pages/users/UsersPage'
import { BranchesPage } from '@/pages/branches/BranchesPage'
import { StockCountPage } from '@/pages/inventory/StockCountPage'
import { StockCountDetailPage } from '@/pages/inventory/StockCountDetailPage'
import { ZatcaSettingsPage } from '@/pages/settings/ZatcaSettingsPage'
import { ReportsPage } from '@/pages/reports/ReportsPage'

const rootRoute = createRootRoute()

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
})

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'app',
  component: AppLayout,
  beforeLoad: () => {
    if (!useAuthStore.getState().isAuthenticated()) {
      throw redirect({ to: '/login' })
    }
  },
})

const dashboardRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/',
  component: DashboardPage,
})

const posRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/pos',
  component: POSPage,
})

const productsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/products',
  component: ProductsPage,
})

const inventoryRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/inventory',
  component: InventoryPage,
})

const customersRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/customers',
  component: CustomersPage,
})

const salesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/sales',
  component: SalesPage,
})

const purchasingRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/purchasing',
  component: PurchasingPage,
})

const financeRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/finance',
  component: FinancePage,
})

const restaurantRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/restaurant',
  component: RestaurantPage,
})

const hotelRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/hotel',
  component: HotelPage,
})

const hotelContractsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/hotel/contracts',
  component: ContractsPage,
})

const gamingRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/gaming',
  component: GamingPage,
})

const settingsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/settings',
  component: SettingsPage,
})

const usersRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/users',
  component: UsersPage,
})

const branchesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/branches',
  component: BranchesPage,
})

const stockCountRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/stock-counts',
  component: StockCountPage,
})

const stockCountDetailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/stock-counts/$sessionId',
  component: StockCountDetailPage,
})

const zatcaSettingsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/settings/zatca',
  component: ZatcaSettingsPage,
})

const reportsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/reports',
  component: ReportsPage,
})

// ── Admin routes ──────────────────────────────────────────────────────────────

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'admin',
  component: AdminLayout,
  beforeLoad: () => {
    const { isAuthenticated, user } = useAuthStore.getState()
    if (!isAuthenticated()) {
      throw redirect({ to: '/login' })
    }
    if (user?.role !== 'SuperAdmin') {
      throw redirect({ to: '/' })
    }
  },
})

const adminDashboardRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/admin',
  component: AdminDashboard,
})

const adminTenantsRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/admin/tenants',
  component: TenantsPage,
})

const adminTenantDetailRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/admin/tenants/$id',
  component: TenantDetailPage,
})

const adminPlansRoute = createRoute({
  getParentRoute: () => adminRoute,
  path: '/admin/plans',
  component: PlansPage,
})

// ── Kitchen shell (full-screen, no sidebar) ──────────────────────────────────

const kitchenShellRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'kitchen-shell',
  component: () => <Outlet />,
  beforeLoad: () => {
    if (!useAuthStore.getState().isAuthenticated()) {
      throw redirect({ to: '/login' })
    }
  },
})

const restaurantKitchenRoute = createRoute({
  getParentRoute: () => kitchenShellRoute,
  path: '/restaurant/kitchen',
  component: KitchenPage,
})

const routeTree = rootRoute.addChildren([
  loginRoute,
  appRoute.addChildren([
    dashboardRoute,
    posRoute,
    productsRoute,
    inventoryRoute,
    customersRoute,
    salesRoute,
    purchasingRoute,
    financeRoute,
    restaurantRoute,
    hotelRoute,
    hotelContractsRoute,
    gamingRoute,
    settingsRoute,
    usersRoute,
    branchesRoute,
    stockCountRoute,
    stockCountDetailRoute,
    zatcaSettingsRoute,
    reportsRoute,
  ]),
  adminRoute.addChildren([
    adminDashboardRoute,
    adminTenantsRoute,
    adminTenantDetailRoute,
    adminPlansRoute,
  ]),
  kitchenShellRoute.addChildren([restaurantKitchenRoute]),
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
