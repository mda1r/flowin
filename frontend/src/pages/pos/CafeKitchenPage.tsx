import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChefHat, Clock, CheckCircle, Loader2, X, WifiOff, ArrowRight, RotateCcw } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/i18n'
import { restaurantApi } from '@/api/restaurant'
import type { RestaurantOrderResponse } from '@/types/api'
import { cn } from '@/lib/utils'

// Light cards on the graphite board, like the identity's kitchen screen: new waits in amber,
// in-progress carries a mint edge, ready turns mint.
const STATUS_STYLE = {
  pending:   { color: 'bg-warning/15 text-warning', border: 'border-warning/50', card: 'bg-surface' },
  preparing: { color: 'bg-brand-soft text-brand-ink', border: 'border-brand/60', card: 'bg-surface' },
  ready:     { color: 'bg-brand text-brand-fg', border: 'border-brand', card: 'bg-brand-soft' },
}

type KitchenStatus = 'pending' | 'preparing' | 'ready'

function mapStatus(s: RestaurantOrderResponse['status']): KitchenStatus {
  if (s === 'Pending') return 'pending'
  if (s === 'InKitchen') return 'preparing'
  return 'ready'
}

function elapsed(ts: string, t: { kitchen: { seconds: string; minutes: string } }) {
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (diff < 60) return `${diff} ${t.kitchen.seconds}`
  return `${Math.floor(diff / 60)} ${t.kitchen.minutes}`
}

function TicketCard({
  order,
  onPreparing,
  onReady,
  onReturn,
  onDismiss,
}: {
  order: RestaurantOrderResponse
  onPreparing: (id: string) => void
  onReady: (id: string) => void
  onReturn: (id: string) => void
  onDismiss: (id: string) => void
}) {
  const { t } = useI18n()
  const status = mapStatus(order.status)
  const cfg = {
    ...STATUS_STYLE[status],
    label: status === 'pending' ? t.kitchen.statusNew : status === 'preparing' ? t.kitchen.preparing : t.kitchen.ready,
  }
  const isTakeaway = order.tableNumber === 99

  return (
    <div className={cn('scheme-light relative flex flex-col rounded-2xl border-2 p-4 text-fg shadow-md', cfg.card, cfg.border)}>
      {/* Header */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-bold', cfg.color)}>
            {cfg.label}
          </span>
          <span className="text-sm font-black text-muted">
            #{order.id.slice(-4).toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-xs text-muted">
            <Clock className="h-3 w-3" />
            {elapsed(order.createdAt, t)}
          </span>
          {status === 'ready' && (
            <button
              onClick={() => onDismiss(order.id)}
              className="rounded-full p-1 text-muted hover:bg-surface-2 hover:text-muted dark:hover:bg-surface-2"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Order type */}
      <div className="mb-3">
        {isTakeaway ? (
          <span className="inline-flex items-center rounded-lg bg-info/10 px-2 py-0.5 text-sm font-bold text-info dark:bg-info/15">
            🛍 {t.kitchen.takeaway}
          </span>
        ) : (
          <span className="inline-flex items-center rounded-lg bg-warning/10 px-2 py-0.5 text-sm font-bold text-warning dark:bg-warning/15">
            {t.kitchen.table} {order.tableNumber}
          </span>
        )}
      </div>

      {/* Items */}
      <div className="flex-1 space-y-2">
        {order.items.map((item) => (
          <div key={item.id} className="border-b border-border pb-2 last:border-0 last:pb-0">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-semibold text-muted dark:text-fg">{item.itemName}</p>
              <span className="text-xl font-black tabular-nums text-muted">
                ×{item.quantity}
              </span>
            </div>
            {item.notes && (
              <p className="mt-0.5 text-xs font-medium text-warning">
                📝 {item.notes}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Notes */}
      {order.notes && order.notes !== 'تيك أواي' && (
        <p className="mt-2 text-xs text-muted">{order.notes}</p>
      )}

      {/* Action buttons */}
      <div className="mt-4 flex gap-2">
        {status === 'pending' && (
          <button
            onClick={() => onPreparing(order.id)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-info py-2 text-sm font-bold text-white hover:bg-info"
          >
            <Loader2 className="h-4 w-4" />
            {t.kitchen.preparing}
          </button>
        )}
        {status === 'preparing' && (
          <button
            onClick={() => onReady(order.id)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand py-2 text-sm font-bold text-brand-fg hover:bg-brand/90"
          >
            <CheckCircle className="h-4 w-4" />
            {t.kitchen.ready}
          </button>
        )}
        {status === 'ready' && (
          <>
            <button
              onClick={() => onReturn(order.id)}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-info/30 px-3 py-2 text-sm font-medium text-info hover:bg-info/10 dark:border-info dark:hover:bg-info/15"
              title="إرجاع للتحضير"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              onClick={() => onDismiss(order.id)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border py-2 text-sm font-medium text-muted hover:bg-surface-2"
            >
              <X className="h-4 w-4" />
              إزالة
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export function CafeKitchenPage() {
  const { branchId } = useAuthStore()
  const qc = useQueryClient()
  const { t } = useI18n()
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

  const returnMut = useMutation({
    mutationFn: (orderId: string) =>
      branchId ? restaurantApi.returnToKitchen(branchId, orderId) : Promise.reject(),
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

  // Auto-advance Pending orders straight to InKitchen — no "new" column shown.
  useEffect(() => {
    for (const order of pending) {
      if (!preparingMut.isPending) {
        preparingMut.mutate(order.id)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending.map((o) => o.id).join(',')])

  const columns = [
    { key: 'preparing', label: t.kitchen.preparing,  count: preparing.length, items: preparing, accent: 'text-fg' },
    { key: 'ready',     label: t.kitchen.ready,      count: ready.length,     items: ready,     accent: 'text-brand-ink' },
  ]

  return (
    <div className="scheme-dark flex h-screen flex-col overflow-hidden bg-bg text-fg" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-surface px-6 py-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate({ to: '/pos' })}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <ArrowRight className="h-4 w-4" />
            <span className="text-xs">{t.common.back}</span>
          </button>
          <ChefHat className="h-6 w-6 text-warning" />
          <h1 className="text-lg font-black tracking-wide text-fg">{t.kitchen.title}</h1>
          <span className="rounded-full bg-warning/20 px-2.5 py-0.5 text-xs font-bold text-warning">
            {kitchenOrders.filter((o) => o.status !== 'Ready').length} طلب نشط
          </span>
        </div>
        <div className="flex items-center gap-3">
          {isError && (
            <span className="flex items-center gap-1 text-xs text-danger">
              <WifiOff className="h-3.5 w-3.5" />
              {t.kitchen.connectionError}
            </span>
          )}
          <p className="text-xs text-muted">يتحدث كل 5 ثوانٍ</p>
        </div>
      </div>

      {/* Columns */}
      <div className="flex flex-1 gap-0 overflow-hidden">
        {columns.map((col, colIdx) => (
          <div
            key={col.key}
            className={cn(
              'flex flex-1 flex-col overflow-hidden',
              colIdx < columns.length - 1 && 'border-l border-border',
            )}
          >
            {/* Column header */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className={cn('text-sm font-bold', col.accent)}>{col.label}</h2>
              {col.count > 0 && (
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-bold text-muted">
                  {col.count}
                </span>
              )}
            </div>

            {/* Cards */}
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {col.items.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted">
                  <ChefHat className="h-8 w-8" />
                  <p className="text-xs">{t.kitchen.noOrders}</p>
                </div>
              ) : (
                col.items.map((order) => (
                  <TicketCard
                    key={order.id}
                    order={order}
                    onPreparing={(id) => preparingMut.mutate(id)}
                    onReady={(id) => readyMut.mutate(id)}
                    onReturn={(id) => returnMut.mutate(id)}
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
