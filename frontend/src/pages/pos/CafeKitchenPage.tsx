import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChefHat, Clock, CheckCircle, Loader2, X, WifiOff, ArrowRight, RotateCcw } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/i18n'
import { restaurantApi } from '@/api/restaurant'
import type { RestaurantOrderResponse } from '@/types/api'
import { cn } from '@/lib/utils'
import { invoiceNo } from '@/lib/invoiceNumber'
import { TAKEAWAY_TABLE } from '@/lib/kitchenTables'
import { useKitchenSound, useNewOrderAlert, useNow } from '@/lib/kitchenSound'
import { KitchenSoundToggle } from '@/components/kitchen/KitchenSoundToggle'
import { toast } from '@/components/ui/Toast'
import { apiErrorMessage } from '@/lib/apiError'

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

function elapsed(ts: string, now: number, t: { kitchen: { seconds: string; minutes: string } }) {
  const diff = Math.max(0, Math.floor((now - new Date(ts).getTime()) / 1000))
  if (diff < 60) return `${diff} ${t.kitchen.seconds}`
  return `${Math.floor(diff / 60)} ${t.kitchen.minutes}`
}

function TicketCard({
  order,
  now,
  onPreparing,
  onReady,
  onReturn,
  onDismiss,
}: {
  order: RestaurantOrderResponse
  now: number
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
  const isTakeaway = order.tableNumber === TAKEAWAY_TABLE
  // Cafe tickets carry the sale's invoice number, so the kitchen calls out the number printed on the receipt.
  const ticketNo = order.kitchenOnly && order.sourceOrderId
    ? invoiceNo({ id: order.sourceOrderId, number: order.ticketNumber })
    : order.id.slice(-4).toUpperCase()

  return (
    <div className={cn('scheme-light relative flex flex-col rounded-2xl border-2 p-4 text-fg shadow-md', cfg.card, cfg.border)}>
      {/* Header */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-bold', cfg.color)}>
            {cfg.label}
          </span>
          <span className="text-3xl font-black tabular-nums leading-none text-fg" aria-label={`${t.kitchen.order} ${ticketNo}`}>
            #{ticketNo}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-xs text-muted">
            <Clock className="h-3 w-3" />
            {elapsed(order.createdAt, now, t)}
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
        ) : order.tableNumber > 0 ? (
          <span className="inline-flex items-center rounded-lg bg-warning/10 px-2 py-0.5 text-sm font-bold text-warning dark:bg-warning/15">
            {t.kitchen.table} {order.tableNumber}
          </span>
        ) : (
          <span className="inline-flex items-center rounded-lg bg-surface-2 px-2 py-0.5 text-sm font-bold text-muted">
            {t.kitchen.noTable}
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

  const { data: orders = [], isError, isSuccess } = useQuery({
    queryKey: ['kitchen', 'orders', branchId],
    queryFn: () =>
      branchId
        ? restaurantApi.listKitchenOrders(branchId).then((r) => r.data)
        : Promise.resolve([]),
    enabled: !!branchId,
    refetchInterval: 5_000,
    refetchIntervalInBackground: true,
  })

  const now = useNow(5_000)
  const sound = useKitchenSound()
  // The barista faces the machine, not the screen: ring for every newly arrived ticket.
  useNewOrderAlert(isSuccess ? orders.map((o) => o.id) : undefined, () => sound.play(3))

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ['kitchen', 'orders', branchId] })
  // Another screen may have moved the ticket already: say why and show the board as it is now.
  const failed = (err: unknown) => {
    toast.error(apiErrorMessage(err))
    void invalidate()
  }

  const preparingMut = useMutation({
    mutationFn: (orderId: string) =>
      branchId ? restaurantApi.sendToKitchen(branchId, orderId) : Promise.reject(),
    onSuccess: invalidate,
  })

  const readyMut = useMutation({
    mutationFn: (orderId: string) =>
      branchId ? restaurantApi.markOrderReady(branchId, orderId) : Promise.reject(),
    onSuccess: invalidate,
    onError: failed,
  })

  const returnMut = useMutation({
    mutationFn: (orderId: string) =>
      branchId ? restaurantApi.returnToKitchen(branchId, orderId) : Promise.reject(),
    onSuccess: invalidate,
    onError: failed,
  })

  const dismissMut = useMutation({
    mutationFn: (orderId: string) =>
      branchId ? restaurantApi.serveOrder(branchId, orderId) : Promise.reject(),
    onSuccess: invalidate,
    onError: failed,
  })

  const pending   = orders.filter((o) => o.status === 'Pending')
  const preparing = orders.filter((o) => o.status === 'InKitchen')
  const ready     = orders.filter((o) => o.status === 'Ready')

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
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border bg-surface px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
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
            {orders.filter((o) => o.status !== 'Ready').length} طلب نشط
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {isError && (
            <span className="flex items-center gap-1 text-xs text-danger">
              <WifiOff className="h-3.5 w-3.5" />
              {t.kitchen.connectionError}
            </span>
          )}
          <KitchenSoundToggle enabled={sound.enabled} muted={sound.muted} onToggle={sound.toggleMute} supported={sound.supported} />
          <p className="hidden text-xs text-muted sm:block">يتحدث كل 5 ثوانٍ</p>
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
                    now={now}
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
