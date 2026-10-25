import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Clock, CheckCircle, ChefHat } from 'lucide-react'
import { restaurantApi } from '@/api/restaurant'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import type { RestaurantOrderResponse, OrderItemStatus } from '@/types/api'

// ── Helpers ───────────────────────────────────────────────────────────────────

function minutesSince(isoDate: string): number {
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / 60000)
}

function timeColor(minutes: number): string {
  if (minutes < 10) return 'text-success'
  if (minutes < 20) return 'text-warning'
  return 'text-danger'
}

function timeBorderColor(minutes: number): string {
  if (minutes < 10) return 'border-success'
  if (minutes < 20) return 'border-warning'
  return 'border-danger'
}

function itemStatusLabel(status: OrderItemStatus, t: { kitchen: { ready: string; preparing: string } }): string {
  if (status === 'Ready') return t.kitchen.ready
  if (status === 'Preparing') return t.kitchen.preparing
  return 'انتظار'
}

// ── Sound alert ───────────────────────────────────────────────────────────────

function beep(ctx: AudioContext) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.type = 'square'
  osc.frequency.setValueAtTime(880, ctx.currentTime)
  gain.gain.setValueAtTime(0.3, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + 0.4)
}

// ── Order Card ────────────────────────────────────────────────────────────────

function OrderCard({
  order,
  onItemReady,
  onOrderReady,
  onSendToKitchen,
}: {
  order: RestaurantOrderResponse
  branchId?: string
  onItemReady: (orderId: string, itemId: string) => void
  onOrderReady: (orderId: string) => void
  onSendToKitchen?: (orderId: string) => void
}) {
  const { t } = useI18n()
  const minutes = minutesSince(order.createdAt)
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
        <div>
          <span className="text-4xl font-black text-fg">#{order.tableNumber}</span>
          <p className="text-xs text-muted">{t.kitchen.table}</p>
        </div>
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
  const audioCtxRef = useRef<AudioContext | null>(null)
  const prevOrderIdsRef = useRef<Set<string>>(new Set())
  const [initialized, setInitialized] = useState(false)

  // Initialize audio context on first user interaction
  useEffect(() => {
    const init = () => {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
      setInitialized(true)
      document.removeEventListener('click', init)
    }
    document.addEventListener('click', init)
    return () => document.removeEventListener('click', init)
  }, [])

  const { data: ordersData } = useQuery({
    queryKey: ['restaurant-orders-kitchen', branchId],
    queryFn: () => restaurantApi.listActiveOrders(branchId!),
    enabled: !!branchId,
    refetchInterval: 10000,
  })

  const orders = ordersData?.data ?? []

  // Sound alert for new orders
  useEffect(() => {
    if (!ordersData) return
    const currentIds = new Set(orders.map((o) => o.id))
    const isNew = orders.some((o) => !prevOrderIdsRef.current.has(o.id))
    if (isNew && prevOrderIdsRef.current.size > 0 && audioCtxRef.current) {
      beep(audioCtxRef.current)
    }
    prevOrderIdsRef.current = currentIds
  }, [orders, ordersData])

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
    <div className="scheme-dark min-h-screen bg-bg text-fg" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <ChefHat className="h-7 w-7 text-warning" />
          <h1 className="text-xl font-bold">{t.kitchen.title}</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted">
            {new Date().toLocaleTimeString(lang === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
          </div>
          {!initialized && (
            <span className="rounded-full bg-surface-2 px-3 py-1 text-xs text-muted">
              انقر لتفعيل التنبيهات الصوتية
            </span>
          )}
          <div className="flex gap-3 text-xs text-muted">
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
      <div className="grid h-[calc(100vh-73px)] grid-cols-3 divide-x divide-border" style={{ direction: 'rtl' }}>
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
