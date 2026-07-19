import { useQuery } from '@tanstack/react-query'
import {
  TrendingUp,
  ShoppingCart,
  Users,
  DollarSign,
  Package,
  ArrowUpRight,
  AlertTriangle,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { ordersApi } from '@/api/orders'
import { customersApi } from '@/api/customers'
import { inventoryApi } from '@/api/inventory'

interface StatCardProps {
  title: string
  value: string
  change?: number
  icon: React.ReactNode
  color: string
}

function StatCard({ title, value, change, icon, color }: StatCardProps) {
  return (
    <Card>
      <CardBody className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
          {change !== undefined && (
            <div className="mt-1 flex items-center gap-1 text-xs font-medium text-green-600">
              <ArrowUpRight className="h-3 w-3" />
              {Math.abs(change)}%
            </div>
          )}
        </div>
        <div className={`rounded-xl p-3 ${color}`}>{icon}</div>
      </CardBody>
    </Card>
  )
}

export function DashboardPage() {
  const { branchId, tenantId } = useAuthStore()

  const { data: recentOrders } = useQuery({
    queryKey: ['orders', branchId, 'recent'],
    queryFn: () => ordersApi.listOrders(branchId!, { status: 'Completed', pageSize: 5 }),
    enabled: !!branchId,
  })

  const { data: customers } = useQuery({
    queryKey: ['customers', tenantId],
    queryFn: () => customersApi.list(tenantId!),
    enabled: !!tenantId,
  })

  const { data: alertsData } = useQuery({
    queryKey: ['inventory-alerts', branchId],
    queryFn: () => inventoryApi.getAlerts(branchId!),
    enabled: !!branchId,
    refetchInterval: 300_000,
  })

  const orders = recentOrders?.data ?? []
  const todayRevenue = orders.reduce((s, o) => s + o.totalAmount, 0)
  const alerts = alertsData?.data

  const nearExpiryCount = (alerts?.expired.length ?? 0) + (alerts?.expiringSoon.length ?? 0)
  const lowStockCount = alerts?.lowStock.length ?? 0
  const hasAlerts = nearExpiryCount > 0 || lowStockCount > 0

  return (
    <div>
      <PageHeader title="لوحة التحكم" description="نظرة عامة على أداء عملك" />
      <div className="p-6">

        {/* Persistent Alert Banner */}
        {hasAlerts && (
          <a
            href="/inventory"
            className="mb-6 flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-orange-800 transition-colors hover:bg-orange-100 dark:border-orange-800 dark:bg-orange-900/20 dark:text-orange-300 dark:hover:bg-orange-900/30"
          >
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span className="flex-1 text-sm font-medium">
              {nearExpiryCount > 0 && (
                <span>
                  ⚠️ {nearExpiryCount} {nearExpiryCount === 1 ? 'منتج ينتهي صلاحيته' : 'منتجات تنتهي صلاحيتها'} خلال 7 أيام
                </span>
              )}
              {nearExpiryCount > 0 && lowStockCount > 0 && <span className="mx-2">—</span>}
              {lowStockCount > 0 && (
                <span>
                  {lowStockCount} {lowStockCount === 1 ? 'منتج مخزون منخفض' : 'منتجات مخزون منخفض'}
                </span>
              )}
            </span>
            <span className="shrink-0 text-xs underline">عرض المخزون ←</span>
          </a>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="إيرادات اليوم"
            value={formatCurrency(todayRevenue)}
            change={12.5}
            icon={<DollarSign className="h-5 w-5 text-blue-600" />}
            color="bg-blue-50 dark:bg-blue-900/30"
          />
          <StatCard
            title="طلبات اليوم"
            value={String(orders.length)}
            change={8.2}
            icon={<ShoppingCart className="h-5 w-5 text-purple-600" />}
            color="bg-purple-50 dark:bg-purple-900/30"
          />
          <StatCard
            title="إجمالي العملاء"
            value={String(customers?.data?.length ?? 0)}
            change={3.1}
            icon={<Users className="h-5 w-5 text-green-600" />}
            color="bg-green-50 dark:bg-green-900/30"
          />
          <StatCard
            title="متوسط قيمة الطلب"
            value={formatCurrency(orders.length > 0 ? todayRevenue / orders.length : 0)}
            icon={<TrendingUp className="h-5 w-5 text-orange-600" />}
            color="bg-orange-50 dark:bg-orange-900/30"
          />
        </div>

        {/* Inventory Alerts Widget */}
        {hasAlerts && (
          <div className="mt-6">
            <Card>
              <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-800">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  تنبيهات المخزون
                </h2>
                <a href="/inventory" className="text-xs text-blue-600 hover:underline dark:text-blue-400">
                  عرض الكل
                </a>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {alerts?.expired.slice(0, 3).map((a) => (
                  <a
                    key={a.stockItemId}
                    href="/inventory"
                    className="flex items-center justify-between px-6 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/40">
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {a.variantId}
                        </p>
                        <p className="text-xs text-gray-500">منتهية الصلاحية · الكمية: {a.quantity}</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
                      منتهية
                    </span>
                  </a>
                ))}
                {alerts?.expiringSoon.slice(0, 3).map((a) => (
                  <a
                    key={a.stockItemId}
                    href="/inventory"
                    className="flex items-center justify-between px-6 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/40">
                        <AlertTriangle className="h-4 w-4 text-orange-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {a.variantId}
                        </p>
                        <p className="text-xs text-gray-500">
                          تنتهي خلال {a.daysUntilExpiry} أيام · الكمية: {a.quantity}
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
                      قريبًا
                    </span>
                  </a>
                ))}
                {alerts?.lowStock.slice(0, 3).map((a) => (
                  <a
                    key={a.stockItemId}
                    href="/inventory"
                    className="flex items-center justify-between px-6 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/40">
                        <Package className="h-4 w-4 text-yellow-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {a.variantId}
                        </p>
                        <p className="text-xs text-gray-500">
                          الكمية: {a.quantity} · حد الطلب: {a.reorderPoint}
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300">
                      منخفض
                    </span>
                  </a>
                ))}
              </div>
            </Card>
          </div>
        )}

        <div className="mt-6">
          <Card>
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-800">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                آخر الطلبات المكتملة
              </h2>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {orders.length === 0 ? (
                <p className="px-6 py-10 text-center text-sm text-gray-400">لا توجد طلبات</p>
              ) : (
                orders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between px-6 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {order.id.slice(0, 8).toUpperCase()}
                      </p>
                      <p className="text-xs text-gray-500">{order.lines.length} منتج</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {formatCurrency(order.totalAmount)}
                      </p>
                      <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
                        مكتمل
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: 'بيع جديد', icon: <ShoppingCart className="h-6 w-6" />, to: '/pos', color: 'text-blue-600' },
            { label: 'إضافة منتج', icon: <Package className="h-6 w-6" />, to: '/products', color: 'text-purple-600' },
            { label: 'إضافة عميل', icon: <Users className="h-6 w-6" />, to: '/customers', color: 'text-green-600' },
            { label: 'تسجيل مصروف', icon: <DollarSign className="h-6 w-6" />, to: '/finance', color: 'text-orange-600' },
          ].map((action) => (
            <a
              key={action.label}
              href={action.to}
              className="flex flex-col items-center gap-3 rounded-xl border border-gray-200 bg-white p-5 text-center transition-all hover:border-blue-200 hover:shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:hover:border-blue-800"
            >
              <div className={action.color}>{action.icon}</div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {action.label}
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
