import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { ChefHat, Clock, CheckCircle, Circle, Coffee, X, WifiOff, ArrowRight, RotateCcw } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/i18n'
import { restaurantApi } from '@/api/restaurant'
import type { RestaurantOrderResponse } from '@/types/api'
import { cn } from '@/lib/utils'
import { invoiceNo } from '@/lib/invoiceNumber'
import { TAKEAWAY_TABLE } from '@/lib/kitchenTables'
import { useKitchenSound, useNewOrderAlert, useNow } from '@/lib/kitchenSound'
import { CAFE_TIME_LIMITS, minutesSince, timeBorderColor, timeColor } from '@/lib/kitchenTime'
import { KitchenSoundToggle } from '@/components/kitchen/KitchenSoundToggle'
import { toast } from '@/components/ui/Toast'
import { apiErrorMessage } from '@/lib/apiError'

// Light cards on the graphite board, like the identity's kitchen screen: new waits in amber,
// in-progress carries a mint edge, ready turns mint. Waiting cards take their edge from the timer instead.
const STATUS_STYLE = {
  pending:   { color: 'bg-warning/15 text-warning', card: 'bg-surface' },
  preparing: { color: 'bg-brand-soft text-brand-ink', card: 'bg-surface' },
  ready:     { color: 'bg-brand text-brand-fg', card: 'bg-brand-soft' },
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

// Oldest first, so the drink that has waited longest is always at the top of its column.
function byCreated(a: RestaurantOrderResponse, b: RestaurantOrderResponse) {
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
}

// The ticket already moved on, on another screen or by an earlier try that got through.
function alreadyMoved(err: unknown) {
  return isAxiosError(err) && err.response?.status === 409
}

function TicketCard({
  order,
  now,
  ticking,
  onPreparing,
  onItemDone,
  onReady,
  onReturn,
  onDismiss,
}: {
  order: RestaurantOrderResponse
  now: number
  ticking: ReadonlySet<string>
  onPreparing: (id: string) => void
  onItemDone: (orderId: string, itemId: string) => void
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
  const minutes = minutesSince(order.createdAt, now)
  const isTakeaway = order.tableNumber === TAKEAWAY_TABLE
  // Cafe tickets carry the sale's invoice number, so the kitchen calls out the number printed on the receipt.
  const ticketNo = order.kitchenOnly && order.sourceOrderId
    ? invoiceNo({ id: order.sourceOrderId, number: order.ticketNumber })
    : order.id.slice(-4).toUpperCase()
  // Items are ticked off one by one while the drinks are being made.
  const canTick = status === 'preparing'

  return (
    <div
      className={cn(
        'scheme-light relative flex flex-col rounded-2xl border-2 p-4 text-fg shadow-md',
        cfg.card,
        status === 'ready' ? 'border-brand' : timeBorderColor(minutes, CAFE_TIME_LIMITS),
      )}
    >
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1.5">
          <span className={cn('self-start rounded-full px-2.5 py-0.5 text-xs font-bold', cfg.color)}>
            {cfg.label}
          </span>
          <span className="text-3xl font-black tabular-nums leading-none text-fg" aria-label={`${t.kitchen.order} ${ticketNo}`}>
            #{ticketNo}
          </span>
        </div>
        <span
          className={cn(
            'flex shrink-0 items-center gap-1.5 font-black tabular-nums leading-none',
            status === 'ready' ? 'text-sm text-muted' : cn('text-2xl', timeColor(minutes, CAFE_TIME_LIMITS)),
          )}
        >
          <Clock className={status === 'ready' ? 'h-3.5 w-3.5' : 'h-5 w-5'} />
          {elapsed(order.createdAt, now, t)}
        </span>
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
      <div className="flex-1 space-y-1">
        {order.items.map((item) => {
          const done = item.status === 'Ready' || ticking.has(item.id)
          const row = (
            <>
              {canTick && (
                done
                  ? <CheckCircle className="mt-1 h-5 w-5 shrink-0 text-success" />
                  : <Circle className="mt-1 h-5 w-5 shrink-0 text-muted" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className={cn('text-lg font-bold leading-snug', done ? 'text-muted line-through' : 'text-fg')}>
                    {item.itemName}
                  </p>
                  {item.quantity > 1 && (
                    <span className="shrink-0 rounded-lg bg-brand px-2 py-0.5 text-lg font-black tabular-nums leading-tight text-brand-fg">
                      ×{item.quantity}
                    </span>
                  )}
                </div>
                {item.notes && (
                  <p className="mt-1 rounded-lg bg-warning/15 px-2 py-1 text-sm font-bold text-warning">
                    📝 {item.notes}
                  </p>
                )}
              </div>
            </>
          )
          return canTick ? (
            <button
              key={item.id}
              type="button"
              onClick={() => !done && onItemDone(order.id, item.id)}
              disabled={done}
              aria-pressed={done}
              title={t.kitchen.tapItemDone}
              className="flex w-full items-start gap-2 rounded-xl border-b border-border px-1 py-2 text-start transition-colors last:border-0 hover:bg-surface-2 disabled:hover:bg-transparent"
            >
              {row}
            </button>
          ) : (
            <div key={item.id} className="flex items-start gap-2 border-b border-border px-1 py-2 last:border-0">
              {row}
            </div>
          )
        })}
      </div>

      {/* Notes */}
      {order.notes && order.notes !== 'تيك أواي' && (
        <p className="mt-2 rounded-lg bg-warning/15 px-2 py-1 text-sm font-bold text-warning">{order.notes}</p>
      )}

      {/* Action buttons */}
      <div className="mt-4 flex gap-2">
        {status === 'pending' && (
          <button
            onClick={() => onPreparing(order.id)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-fg py-2 text-sm font-bold text-surface hover:bg-fg/90"
          >
            <Coffee className="h-4 w-4" />
            {t.kitchen.startPreparing}
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
              title={t.kitchen.returnToPrep}
              aria-label={t.kitchen.returnToPrep}
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              onClick={() => onDismiss(order.id)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border py-2 text-sm font-medium text-muted hover:bg-surface-2"
            >
              <X className="h-4 w-4" />
              {t.kitchen.dismiss}
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

  const { data: orders = [], isError, isSuccess, dataUpdatedAt } = useQuery({
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

  // Tickets being sent to the kitchen right now, so a poll never sends the same one twice
  // while every other new ticket still goes.
  const advancing = useRef(new Set<string>())

  const preparingMut = useMutation({
    mutationFn: ({ id }: { id: string; manual: boolean }) =>
      branchId ? restaurantApi.sendToKitchen(branchId, id) : Promise.reject(),
    onSuccess: invalidate,
    onError: (err, { manual }) => {
      if (alreadyMoved(err)) {
        void invalidate()
        return
      }
      // An automatic try is repeated on the next poll; only a tap gets an answer, and the card stays as it is.
      if (manual) failed(err)
    },
    onSettled: (_data, _err, { id }) => {
      advancing.current.delete(id)
    },
  })

  const advance = (id: string, manual: boolean) => {
    if (advancing.current.has(id)) return
    advancing.current.add(id)
    preparingMut.mutate({ id, manual })
  }

  const readyMut = useMutation({
    mutationFn: (orderId: string) =>
      branchId ? restaurantApi.markOrderReady(branchId, orderId) : Promise.reject(),
    onSuccess: invalidate,
    onError: failed,
  })

  // Items ticked on a ticket go to the server one after another, so the answer to the last tick sees
  // every item ready and the ticket moves to ready by itself.
  const itemQueue = useRef(new Map<string, Promise<unknown>>())
  const [ticking, setTicking] = useState<ReadonlySet<string>>(() => new Set())

  const itemMut = useMutation({
    mutationFn: ({ orderId, itemId }: { orderId: string; itemId: string }) => {
      if (!branchId) return Promise.reject()
      const previous = itemQueue.current.get(orderId) ?? Promise.resolve()
      const run = previous
        .catch(() => undefined)
        .then(() => restaurantApi.markItemReady(branchId, orderId, itemId))
      itemQueue.current.set(orderId, run)
      void run.finally(() => {
        if (itemQueue.current.get(orderId) === run) itemQueue.current.delete(orderId)
      }).catch(() => undefined)
      return run
    },
    onSuccess: async (res) => {
      const order = res.data
      if (!branchId || order.status !== 'InKitchen' || !order.items.every((i) => i.status === 'Ready')) return
      try {
        await restaurantApi.markOrderReady(branchId, order.id)
      } catch (err) {
        // Someone tapped "ready" at the same moment: the board refreshes below either way.
        if (!alreadyMoved(err)) toast.error(apiErrorMessage(err))
      }
    },
    onError: failed,
    onSettled: async (_data, _err, { itemId }) => {
      await invalidate()
      setTicking((prev) => {
        const next = new Set(prev)
        next.delete(itemId)
        return next
      })
    },
  })

  const tickItem = (orderId: string, itemId: string) => {
    if (ticking.has(itemId)) return
    setTicking((prev) => new Set(prev).add(itemId))
    itemMut.mutate({ orderId, itemId })
  }

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

  // New tickets wait in the preparing column with their own badge until the kitchen has them,
  // so a paid drink is on the board even while sending it fails.
  const active = orders.filter((o) => o.status === 'Pending' || o.status === 'InKitchen').sort(byCreated)
  const ready  = orders.filter((o) => o.status === 'Ready').sort(byCreated)

  // Move every new ticket to the kitchen, trying again on each poll until it gets there.
  useEffect(() => {
    if (!dataUpdatedAt) return
    for (const order of orders) {
      if (order.status === 'Pending') advance(order.id, false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataUpdatedAt])

  const columns = [
    { key: 'preparing', label: t.kitchen.preparing,  items: active, accent: 'text-fg' },
    { key: 'ready',     label: t.kitchen.ready,      items: ready,  accent: 'text-brand-ink' },
  ]

  return (
    <div className="scheme-dark flex h-screen flex-col overflow-hidden bg-bg text-fg">
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
            {t.kitchen.activeCount.replace('{n}', String(active.length))}
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
          <p className="hidden text-xs text-muted sm:block">{t.kitchen.autoRefresh}</p>
        </div>
      </div>

      {/* Columns */}
      <div className="flex flex-1 gap-0 overflow-hidden">
        {columns.map((col, colIdx) => (
          <div
            key={col.key}
            className={cn(
              'flex flex-1 flex-col overflow-hidden',
              colIdx < columns.length - 1 && 'border-e border-border',
            )}
          >
            {/* Column header */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className={cn('text-base font-bold', col.accent)}>{col.label}</h2>
              {col.items.length > 0 && (
                <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-sm font-bold tabular-nums text-muted">
                  {col.items.length}
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
                    ticking={ticking}
                    onPreparing={(id) => advance(id, true)}
                    onItemDone={tickItem}
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
