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
  if (minutes < 10) return 'text-green-400'
  if (minutes < 20) return 'text-yellow-400'
  return 'text-red-400'
}

function timeBorderColor(minutes: number): string {
  if (minutes < 10) return 'border-green-600'
  if (minutes < 20) return 'border-yellow-500'
  return 'border-red-500'
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
        'rounded-2xl border-2 bg-gray-900 p-4 transition-all',
        order.status === 'Ready' ? 'border-green-500' : timeBorderColor(minutes),
      )}
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <span className="text-4xl font-black text-white">#{order.tableNumber}</span>
          <p className="text-xs text-gray-400">{t.kitchen.table}</p>
        </div>
        <div className={cn('text-right', timeColor(minutes))}>
          <div className="flex items-center gap-1.5 justify-end">
            <Clock className="h-4 w-4" />
            <span className="text-lg font-bold">{minutes} {t.kitchen.minutes}</span>
          </div>
          {order.notes && (
            <p className="mt-1 text-xs text-gray-400 max-w-[120px] text-right">
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
                  ? 'border-green-500 bg-green-500 text-white'
                  : 'border-gray-600 bg-gray-800 hover:border-green-400',
              )}
              disabled={item.status === 'Ready'}
            >
              {item.status === 'Ready' && <CheckCircle className="h-3.5 w-3.5" />}
            </button>
            <div className="flex-1 min-w-0">
              <span className={cn(
                'text-sm font-medium',
                item.status === 'Ready' ? 'text-gray-500 line-through' : 'text-white',
              )}>
                {item.quantity}× {item.itemName}
              </span>
              {item.notes && (
                <p className="text-xs text-yellow-400">{item.notes}</p>
              )}
            </div>
            <span className={cn(
              'text-xs',
              item.status === 'Ready' ? 'text-green-400' :
              item.status === 'Preparing' ? 'text-blue-400' : 'text-gray-500',
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
          className="w-full rounded-xl bg-blue-500 py-2 text-sm font-bold text-white transition-all hover:bg-blue-400"
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
              ? 'bg-green-500 text-white hover:bg-green-400'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600',
          )}
        >
          {allReady ? t.kitchen.markReady : 'الطلب جاهز'}
        </button>
      )}

      {order.status === 'Ready' && (
        <div className="w-full rounded-xl bg-green-500/20 py-2 text-center text-sm font-bold text-green-400">
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
    <div className="min-h-screen bg-gray-950 text-white" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
        <div className="flex items-center gap-3">
          <ChefHat className="h-7 w-7 text-orange-400" />
          <h1 className="text-xl font-bold">{t.kitchen.title}</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-400">
            {new Date().toLocaleTimeString(lang === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
          </div>
          {!initialized && (
            <span className="rounded-full bg-gray-800 px-3 py-1 text-xs text-gray-400">
              انقر لتفعيل التنبيهات الصوتية
            </span>
          )}
          <div className="flex gap-3 text-xs text-gray-500">
            <span>
              <span className="inline-block h-2 w-2 rounded-full bg-yellow-500 ml-1" />
              قيد الانتظار: {pendingOrders.length}
            </span>
            <span>
              <span className="inline-block h-2 w-2 rounded-full bg-blue-500 ml-1" />
              تحضير: {inKitchenOrders.length}
            </span>
            <span>
              <span className="inline-block h-2 w-2 rounded-full bg-green-500 ml-1" />
              {t.kitchen.ready}: {readyOrders.length}
            </span>
          </div>
        </div>
      </div>

      {/* Columns */}
      <div className="grid h-[calc(100vh-73px)] grid-cols-3 divide-x divide-gray-800" style={{ direction: 'rtl' }}>
        {/* قيد الانتظار */}
        <div className="flex flex-col overflow-hidden">
          <div className="border-b border-gray-800 bg-yellow-500/10 px-4 py-3">
            <h2 className="font-bold text-yellow-400">قيد الانتظار</h2>
            <p className="text-xs text-gray-500">{pendingOrders.length} طلب</p>
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
              <p className="py-12 text-center text-sm text-gray-700">{t.kitchen.noOrders}</p>
            )}
          </div>
        </div>

        {/* قيد التحضير */}
        <div className="flex flex-col overflow-hidden">
          <div className="border-b border-gray-800 bg-blue-500/10 px-4 py-3">
            <h2 className="font-bold text-blue-400">قيد التحضير</h2>
            <p className="text-xs text-gray-500">{inKitchenOrders.length} طلب</p>
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
              <p className="py-12 text-center text-sm text-gray-700">{t.kitchen.noOrders}</p>
            )}
          </div>
        </div>

        {/* جاهز */}
        <div className="flex flex-col overflow-hidden">
          <div className="border-b border-gray-800 bg-green-500/10 px-4 py-3">
            <h2 className="font-bold text-green-400">{t.kitchen.ready}</h2>
            <p className="text-xs text-gray-500">{readyOrders.length} طلب</p>
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
              <p className="py-12 text-center text-sm text-gray-700">{t.kitchen.noOrders}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
