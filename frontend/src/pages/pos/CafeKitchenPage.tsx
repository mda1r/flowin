import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChefHat, Clock, CheckCircle, Loader2, X, WifiOff, ArrowRight } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/authStore'
import { restaurantApi } from '@/api/restaurant'
import type { RestaurantOrderResponse } from '@/types/api'
import { cn } from '@/lib/utils'

const STATUS_CONFIG = {
  pending:   { label: 'جديد',     color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',        border: 'border-amber-300 dark:border-amber-700' },
  preparing: { label: 'يتحضر',   color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',            border: 'border-blue-400 dark:border-blue-600' },
  ready:     { label: 'جاهز ✓',  color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', border: 'border-emerald-400 dark:border-emerald-600' },
}

type KitchenStatus = 'pending' | 'preparing' | 'ready'

function mapStatus(s: RestaurantOrderResponse['status']): KitchenStatus {
  if (s === 'Pending') return 'pending'
  if (s === 'InKitchen') return 'preparing'
  return 'ready'
}

function elapsed(ts: string) {
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (diff < 60) return `${diff} ث`
  return `${Math.floor(diff / 60)} د`
}

function TicketCard({
  order,
  onPreparing,
  onReady,
  onDismiss,
}: {
  order: RestaurantOrderResponse
  onPreparing: (id: string) => void
  onReady: (id: string) => void
  onDismiss: (id: string) => void
}) {
  const status = mapStatus(order.status)
  const cfg = STATUS_CONFIG[status]
  const isTakeaway = order.tableNumber === 99

  return (
    <div className={cn('relative flex flex-col rounded-2xl border-2 bg-white p-4 shadow-sm dark:bg-gray-900', cfg.border)}>
      {/* Header */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-bold', cfg.color)}>
            {cfg.label}
          </span>
          <span className="text-sm font-black text-gray-400">
            #{order.id.slice(-4).toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <Clock className="h-3 w-3" />
            {elapsed(order.createdAt)}
          </span>
          {status === 'ready' && (
            <button
              onClick={() => onDismiss(order.id)}
              className="rounded-full p-1 text-gray-300 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Order type */}
      <div className="mb-3">
        {isTakeaway ? (
          <span className="inline-flex items-center rounded-lg bg-blue-50 px-2 py-0.5 text-sm font-bold text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
            🛍 تيك أواي
          </span>
        ) : (
          <span className="inline-flex items-center rounded-lg bg-amber-50 px-2 py-0.5 text-sm font-bold text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
            طاولة {order.tableNumber}
          </span>
        )}
      </div>

      {/* Items */}
      <div className="flex-1 space-y-2">
        {order.items.map((item) => (
          <div key={item.id} className="border-b border-gray-100 pb-2 last:border-0 last:pb-0 dark:border-gray-800">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-semibold text-gray-900 dark:text-gray-100">{item.itemName}</p>
              <span className="text-xl font-black tabular-nums text-gray-700 dark:text-gray-300">
                ×{item.quantity}
              </span>
            </div>
            {item.notes && (
              <p className="mt-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                📝 {item.notes}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Notes */}
      {order.notes && order.notes !== 'تيك أواي' && (
        <p className="mt-2 text-xs text-gray-400">{order.notes}</p>
      )}

      {/* Action buttons */}
      <div className="mt-4 flex gap-2">
        {status === 'pending' && (
          <button
            onClick={() => onPreparing(order.id)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-500 py-2 text-sm font-bold text-white hover:bg-blue-600"
          >
            <Loader2 className="h-4 w-4" />
            يتحضر
          </button>
        )}
        {status === 'preparing' && (
          <button
            onClick={() => onReady(order.id)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-2 text-sm font-bold text-white hover:bg-emerald-600"
          >
            <CheckCircle className="h-4 w-4" />
            جاهز
          </button>
        )}
        {status === 'ready' && (
          <button
            onClick={() => onDismiss(order.id)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400"
          >
            <X className="h-4 w-4" />
            إزالة
          </button>
        )}
      </div>
    </div>
  )
}

export function CafeKitchenPage() {
  const { branchId } = useAuthStore()
  const qc = useQueryClient()
  const navigate = useNavigate()

  const { data: orders = [], isError } = useQuery({
    queryKey: ['kitchen', 'orders', branchId],
    queryFn: () =>
      branchId
        ? restaurantApi.listActiveOrders(branchId).then((r) => r.data)
        : Promise.resolve([]),
    enabled: !!branchId,
    refetchInterval: 5_000,
    refetchIntervalInBackground: true,
  })

  const kitchenOrders = orders.filter(
    (o) => o.status === 'Pending' || o.status === 'InKitchen' || o.status === 'Ready',
  )

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ['kitchen', 'orders', branchId] })

  const preparingMut = useMutation({
    mutationFn: (orderId: string) =>
      branchId ? restaurantApi.sendToKitchen(branchId, orderId) : Promise.reject(),
    onSuccess: invalidate,
  })

  const readyMut = useMutation({
    mutationFn: (orderId: string) =>
      branchId ? restaurantApi.markOrderReady(branchId, orderId) : Promise.reject(),
    onSuccess: invalidate,
  })

  const dismissMut = useMutation({
    mutationFn: (orderId: string) =>
      branchId ? restaurantApi.serveOrder(branchId, orderId) : Promise.reject(),
    onSuccess: invalidate,
  })

  const pending   = kitchenOrders.filter((o) => o.status === 'Pending')
  const preparing = kitchenOrders.filter((o) => o.status === 'InKitchen')
  const ready     = kitchenOrders.filter((o) => o.status === 'Ready')

  const columns = [
    { key: 'pending',   label: 'جديد',   count: pending.length,   items: pending,   accent: 'text-amber-500' },
    { key: 'preparing', label: 'يتحضر',  count: preparing.length, items: preparing, accent: 'text-blue-500' },
    { key: 'ready',     label: 'جاهز',   count: ready.length,     items: ready,     accent: 'text-emerald-500' },
  ]

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-950" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 bg-gray-900 px-6 py-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate({ to: '/pos' })}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
          >
            <ArrowRight className="h-4 w-4" />
            <span className="text-xs">رجوع</span>
          </button>
          <ChefHat className="h-6 w-6 text-amber-400" />
          <h1 className="text-lg font-black tracking-wide text-white">شاشة المطبخ</h1>
          <span className="rounded-full bg-amber-400/20 px-2.5 py-0.5 text-xs font-bold text-amber-400">
            {kitchenOrders.filter((o) => o.status !== 'Ready').length} طلب نشط
          </span>
        </div>
        <div className="flex items-center gap-3">
          {isError && (
            <span className="flex items-center gap-1 text-xs text-rose-400">
              <WifiOff className="h-3.5 w-3.5" />
              تعذّر الاتصال
            </span>
          )}
          <p className="text-xs text-gray-500">يتحدث كل 5 ثوانٍ</p>
        </div>
      </div>

      {/* Columns */}
      <div className="flex flex-1 gap-0 overflow-hidden">
        {columns.map((col, colIdx) => (
          <div
            key={col.key}
            className={cn(
              'flex flex-1 flex-col overflow-hidden',
              colIdx < columns.length - 1 && 'border-l border-gray-800',
            )}
          >
            {/* Column header */}
            <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
              <h2 className={cn('text-sm font-bold', col.accent)}>{col.label}</h2>
              {col.count > 0 && (
                <span className="rounded-full bg-gray-800 px-2 py-0.5 text-xs font-bold text-gray-300">
                  {col.count}
                </span>
              )}
            </div>

            {/* Cards */}
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {col.items.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-16 text-gray-700">
                  <ChefHat className="h-8 w-8" />
                  <p className="text-xs">لا يوجد</p>
                </div>
              ) : (
                col.items.map((order) => (
                  <TicketCard
                    key={order.id}
                    order={order}
                    onPreparing={(id) => preparingMut.mutate(id)}
                    onReady={(id) => readyMut.mutate(id)}
                    onDismiss={(id) => dismissMut.mutate(id)}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
