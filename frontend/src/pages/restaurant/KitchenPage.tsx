import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Clock, CheckCircle, ChefHat } from 'lucide-react'
import { restaurantApi } from '@/api/restaurant'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import type { RestaurantOrderResponse, OrderItemStatus } from '@/types/api'
import { TAKEAWAY_TABLE } from '@/lib/kitchenTables'
import { useKitchenSound, useNewOrderAlert, useNow } from '@/lib/kitchenSound'
import { KitchenSoundToggle } from '@/components/kitchen/KitchenSoundToggle'
import { minutesSince, timeBorderColor, timeColor } from '@/lib/kitchenTime'

// ── Helpers ───────────────────────────────────────────────────────────────────

// A pending order nobody has picked up for this long rings again, once a minute, until someone does.
const REMIND_AFTER_MINUTES = 3
const REMIND_EVERY_MS = 60_000

function itemStatusLabel(status: OrderItemStatus, t: { kitchen: { ready: string; preparing: string } }): string {
  if (status === 'Ready') return t.kitchen.ready
  if (status === 'Preparing') return t.kitchen.preparing
  return 'انتظار'
}

// ── Order Card ────────────────────────────────────────────────────────────────

function OrderCard({
  order,
  now,
  onItemReady,
  onOrderReady,
  onSendToKitchen,
}: {
  order: RestaurantOrderResponse
  now: number
  branchId?: string
  onItemReady: (orderId: string, itemId: string) => void
  onOrderReady: (orderId: string) => void
  onSendToKitchen?: (orderId: string) => void
}) {
  const { t } = useI18n()
  const minutes = minutesSince(order.createdAt, now)
  const allReady = order.items.every((i) => i.status === 'Ready')

  return (
    <div
      className={cn(
        'scheme-light rounded-2xl border-2 p-4 text-fg shadow-md transition-all',
        order.status === 'Ready' ? 'border-brand bg-brand-soft' : cn('bg-surface', timeBorderColor(minutes)),
      )}
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        {order.ticketNumber ? (
          // A cafe sale: the number on the customer's receipt is what staff call out.
          <div>
            <span className="text-4xl font-black tabular-nums text-fg">#{order.ticketNumber}</span>
            <p className="text-xs text-muted">
              {order.tableNumber === TAKEAWAY_TABLE ? t.kitchen.takeaway : `${t.kitchen.table} ${order.tableNumber}`}
            </p>
          </div>
        ) : (
          <div>
            <span className="text-4xl font-black text-fg">#{order.tableNumber}</span>
            <p className="text-xs text-muted">{t.kitchen.table}</p>
          </div>
        )}
        <div className={cn('text-right', timeColor(minutes))}>
          <div className="flex items-center gap-1.5 justify-end">
            <Clock className="h-4 w-4" />
            <span className="text-lg font-bold">{minutes} {t.kitchen.minutes}</span>
          </div>
          {order.notes && (
            <p className="mt-1 text-xs text-muted max-w-[120px] text-right">
              {order.notes}
            </p>
          )}
        </div>
      </div>

      {/* Items */}
      <ul className="mb-4 space-y-2">
        {order.items.map((item) => (
          <li key={item.id} className="flex items-center gap-2">
            <button
              onClick={() => item.status !== 'Ready' && onItemReady(order.id, item.id)}
              className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors',
                item.status === 'Ready'
                  ? 'border-success bg-success text-white'
                  : 'border-border bg-surface-2 hover:border-success',
              )}
              disabled={item.status === 'Ready'}
            >
              {item.status === 'Ready' && <CheckCircle className="h-3.5 w-3.5" />}
            </button>
            <div className="flex-1 min-w-0">
              <span className={cn(
                'text-sm font-medium',
                item.status === 'Ready' ? 'text-muted line-through' : 'text-fg',
              )}>
                {item.quantity}× {item.itemName}
              </span>
              {item.notes && (
                <p className="text-xs text-warning">{item.notes}</p>
              )}
            </div>
            <span className={cn(
              'text-xs',
              item.status === 'Ready' ? 'text-success' :
              item.status === 'Preparing' ? 'text-info' : 'text-muted',
            )}>
              {itemStatusLabel(item.status, t)}
            </span>
          </li>
        ))}
      </ul>

      {/* Send to Kitchen button — Pending orders */}
      {order.status === 'Pending' && onSendToKitchen && (
        <button
          onClick={() => onSendToKitchen(order.id)}
          className="w-full rounded-xl bg-fg py-2 text-sm font-bold text-surface transition-all hover:bg-fg/90"
        >
          {t.kitchen.sendToKitchen}
        </button>
      )}

      {/* Ready button */}
      {order.status === 'InKitchen' && (
        <button
          onClick={() => onOrderReady(order.id)}
          className={cn(
            'w-full rounded-xl py-2 text-sm font-bold transition-all',
            allReady
              ? 'bg-brand text-brand-fg hover:bg-brand/90'
              : 'bg-border text-muted hover:bg-muted/30',
          )}
        >
          {allReady ? t.kitchen.markReady : 'الطلب جاهز'}
        </button>
      )}

      {order.status === 'Ready' && (
        <div className="w-full rounded-xl bg-brand py-2 text-center text-sm font-bold text-brand-fg">
          ✓ جاهز للتقديم
        </div>
      )}
    </div>
  )
}

// ── Kitchen Page ──────────────────────────────────────────────────────────────

export function KitchenPage() {
  const { branchId } = useAuthStore()
  const qc = useQueryClient()
  const { t, lang } = useI18n()
  const sound = useKitchenSound()
  const now = useNow(15_000)

  const { data: ordersData } = useQuery({
    queryKey: ['restaurant-orders-kitchen', branchId],
    queryFn: () => restaurantApi.listKitchenOrders(branchId!),
    enabled: !!branchId,
    refetchInterval: 10000,
    // A kitchen tab left behind another window must keep polling, or new orders never ring.
    refetchIntervalInBackground: true,
  })

  const orders = ordersData?.data ?? []

  // Ring for orders that were not on the last poll; the first load only records the board, even when it is empty.
  useNewOrderAlert(ordersData ? orders.map((o) => o.id) : undefined, () => sound.play(3))

  const overdue = orders.filter(
    (o) => o.status === 'Pending' && minutesSince(o.createdAt, now) >= REMIND_AFTER_MINUTES,
  )
  const hasOverdue = overdue.length > 0

  // Keep reminding while an order sits untouched in the pending column.
  useEffect(() => {
    if (!hasOverdue) return
    const id = window.setInterval(() => sound.play(2), REMIND_EVERY_MS)
    return () => window.clearInterval(id)
  }, [hasOverdue, sound.play])

  const markItemReadyMutation = useMutation({
    mutationFn: ({ orderId, itemId }: { orderId: string; itemId: string }) =>
      restaurantApi.markItemReady(branchId!, orderId, itemId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['restaurant-orders-kitchen', branchId] }),
  })

  const markOrderReadyMutation = useMutation({
    mutationFn: (orderId: string) => restaurantApi.markOrderReady(branchId!, orderId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['restaurant-orders-kitchen', branchId] }),
  })

  const sendToKitchenMutation = useMutation({
    mutationFn: (orderId: string) => restaurantApi.sendToKitchen(branchId!, orderId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['restaurant-orders-kitchen', branchId] }),
  })

  const pendingOrders = orders.filter((o) => o.status === 'Pending')
  const inKitchenOrders = orders.filter((o) => o.status === 'InKitchen')
  const readyOrders = orders.filter((o) => o.status === 'Ready')

  return (
    <div className="scheme-dark flex h-screen flex-col bg-bg text-fg" dir="rtl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <ChefHat className="h-7 w-7 text-warning" />
          <h1 className="text-xl font-bold">{t.kitchen.title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <div className="text-sm tabular-nums text-muted">
            {new Date(now).toLocaleTimeString(lang === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
          </div>
          {hasOverdue && (
            <span className="rounded-full bg-danger/15 px-3 py-1 text-xs font-bold text-danger">
              {t.kitchen.waitingLong.replace('{n}', String(Math.max(...overdue.map((o) => minutesSince(o.createdAt, now)))))}
            </span>
          )}
          <KitchenSoundToggle enabled={sound.enabled} muted={sound.muted} onToggle={sound.toggleMute} supported={sound.supported} />
          <div className="hidden gap-3 text-xs text-muted sm:flex">
            <span>
              <span className="inline-block h-2 w-2 rounded-full bg-warning ml-1" />
              قيد الانتظار: {pendingOrders.length}
            </span>
            <span>
              <span className="inline-block h-2 w-2 rounded-full bg-info ml-1" />
              تحضير: {inKitchenOrders.length}
            </span>
            <span>
              <span className="inline-block h-2 w-2 rounded-full bg-success ml-1" />
              {t.kitchen.ready}: {readyOrders.length}
            </span>
          </div>
        </div>
      </div>

      {/* Columns */}
      <div className="grid min-h-0 flex-1 grid-cols-3 divide-x divide-border" style={{ direction: 'rtl' }}>
        {/* قيد الانتظار */}
        <div className="flex flex-col overflow-hidden">
          <div className="border-b border-border bg-warning/10 px-4 py-3">
            <h2 className="font-bold text-warning">قيد الانتظار</h2>
            <p className="text-xs text-muted">{pendingOrders.length} طلب</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {pendingOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                now={now}
                branchId={branchId!}
                onItemReady={(orderId, itemId) =>
                  markItemReadyMutation.mutate({ orderId, itemId })}
                onOrderReady={(orderId) => markOrderReadyMutation.mutate(orderId)}
                onSendToKitchen={(orderId) => sendToKitchenMutation.mutate(orderId)}
              />
            ))}
            {pendingOrders.length === 0 && (
              <p className="py-12 text-center text-sm text-muted">{t.kitchen.noOrders}</p>
            )}
          </div>
        </div>

        {/* قيد التحضير */}
        <div className="flex flex-col overflow-hidden">
          <div className="border-b border-border bg-info/10 px-4 py-3">
            <h2 className="font-bold text-info">قيد التحضير</h2>
            <p className="text-xs text-muted">{inKitchenOrders.length} طلب</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {inKitchenOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                now={now}
                branchId={branchId!}
                onItemReady={(orderId, itemId) =>
                  markItemReadyMutation.mutate({ orderId, itemId })}
                onOrderReady={(orderId) => markOrderReadyMutation.mutate(orderId)}
              />
            ))}
            {inKitchenOrders.length === 0 && (
              <p className="py-12 text-center text-sm text-muted">{t.kitchen.noOrders}</p>
            )}
          </div>
        </div>

        {/* جاهز */}
        <div className="flex flex-col overflow-hidden">
          <div className="border-b border-border bg-success/10 px-4 py-3">
            <h2 className="font-bold text-success">{t.kitchen.ready}</h2>
            <p className="text-xs text-muted">{readyOrders.length} طلب</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {readyOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                now={now}
                branchId={branchId!}
                onItemReady={(orderId, itemId) =>
                  markItemReadyMutation.mutate({ orderId, itemId })}
                onOrderReady={(orderId) => markOrderReadyMutation.mutate(orderId)}
              />
            ))}
            {readyOrders.length === 0 && (
              <p className="py-12 text-center text-sm text-muted">{t.kitchen.noOrders}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
