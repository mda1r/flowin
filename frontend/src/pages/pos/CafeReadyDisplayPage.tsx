import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Coffee, Megaphone, WifiOff } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/i18n'
import { restaurantApi } from '@/api/restaurant'
import type { RestaurantOrderResponse } from '@/types/api'
import { cn } from '@/lib/utils'
import { kitchenTicketNo } from '@/lib/invoiceNumber'
import { useKitchenSound, useNow } from '@/lib/kitchenSound'
import { KitchenSoundToggle } from '@/components/kitchen/KitchenSoundToggle'

// The pickup-counter TV: read-only, it shows who is being prepared and who can collect. Customers only see
// the name the barista calls out (or the receipt number), never the items or the bill.

// A ready order leaves the screen once it is served, or after this long if nobody marked it served.
const READY_ON_SCREEN_MS = 10 * 60_000
// How long a newly ready order stands out.
const HIGHLIGHT_MS = 20_000

// When this screen first saw each order as ready; announced is false for orders already ready when it opened.
type ReadySeen = { since: number; announced: boolean }

function byCreated(a: RestaurantOrderResponse, b: RestaurantOrderResponse) {
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
}

function CallTile({ order, ready, highlight }: { order: RestaurantOrderResponse; ready: boolean; highlight: boolean }) {
  const number = kitchenTicketNo(order)
  const name = order.callName?.trim()
  return (
    <li
      className={cn(
        'flex min-w-0 flex-col items-center justify-center rounded-3xl border-2 px-4 py-5 text-center',
        !ready && 'border-border bg-surface text-fg',
        ready && !highlight && 'border-brand bg-brand-soft text-brand-ink',
        ready && highlight && 'border-brand bg-brand text-brand-fg shadow-lg motion-safe:animate-pulse',
      )}
    >
      <span
        className={cn(
          'w-full break-words font-black leading-tight',
          name ? (ready ? 'text-4xl lg:text-6xl' : 'text-3xl lg:text-5xl') : 'whitespace-nowrap tabular-nums text-4xl lg:text-6xl',
        )}
        dir={name ? undefined : 'ltr'}
      >
        {name ? <bdi>{name}</bdi> : `#${number}`}
      </span>
      {/* Two people with the same name tell their cups apart by the receipt number. */}
      {name && (
        <span className={cn('mt-1 text-lg font-bold tabular-nums lg:text-2xl', highlight ? 'text-brand-fg/80' : 'text-muted')} dir="ltr">
          #{number}
        </span>
      )}
    </li>
  )
}

export function CafeReadyDisplayPage() {
  const { branchId } = useAuthStore()
  const { t } = useI18n()

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

  // Kept across polls: an order that goes back to preparing is forgotten, so it chimes again when it is ready.
  const [readySeen, setReadySeen] = useState<ReadonlyMap<string, ReadySeen>>(() => new Map())
  const readySeenRef = useRef<ReadonlyMap<string, ReadySeen> | null>(null)

  useEffect(() => {
    if (!isSuccess) return
    const prev = readySeenRef.current
    const at = Date.now()
    let arrived = false
    const next = new Map<string, ReadySeen>()
    for (const order of orders) {
      if (order.status !== 'Ready') continue
      const known = prev?.get(order.id)
      if (known) {
        next.set(order.id, known)
      } else {
        // Orders already ready when the screen opens are shown quietly.
        next.set(order.id, { since: at, announced: prev !== null })
        if (prev !== null) arrived = true
      }
    }
    readySeenRef.current = next
    setReadySeen(next)
    if (arrived) sound.play(2)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataUpdatedAt, isSuccess])

  const preparing = orders
    .filter((o) => o.status === 'Pending' || o.status === 'InKitchen')
    .sort(byCreated)
  // Newest ready first, so the name just called is at the top.
  const ready = orders
    .filter((o) => o.status === 'Ready')
    .map((o) => ({ order: o, seen: readySeen.get(o.id) }))
    .filter(({ seen }) => !seen || now - seen.since < READY_ON_SCREEN_MS)
    .sort((a, b) => (b.seen?.since ?? 0) - (a.seen?.since ?? 0) || byCreated(a.order, b.order))

  return (
    <div className="scheme-dark flex h-screen flex-col overflow-hidden bg-bg text-fg">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <Megaphone className="h-6 w-6 text-brand-ink" />
          <h1 className="text-xl font-black text-fg">{t.kitchen.readyBoard}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {isError && (
            <span className="flex items-center gap-1 text-xs text-danger">
              <WifiOff className="h-3.5 w-3.5" />
              {t.kitchen.connectionError}
            </span>
          )}
          <KitchenSoundToggle enabled={sound.enabled} muted={sound.muted} onToggle={sound.toggleMute} supported={sound.supported} />
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-2">
        <section className="flex min-h-0 flex-col border-b border-border md:border-b-0 md:border-e" aria-live="polite">
          <h2 className="flex items-center justify-between gap-2 border-b border-border px-5 py-4 text-2xl font-black text-fg lg:text-4xl">
            {t.kitchen.inProgress}
            {preparing.length > 0 && (
              <span className="rounded-full bg-surface-2 px-3 py-0.5 text-lg font-bold tabular-nums text-muted lg:text-2xl">
                {preparing.length}
              </span>
            )}
          </h2>
          {preparing.length === 0 ? (
            <p className="flex flex-1 items-center justify-center gap-2 p-8 text-xl text-muted">
              <Coffee className="h-6 w-6" />
              {t.kitchen.nothingInProgress}
            </p>
          ) : (
            <ul className="grid flex-1 auto-rows-min grid-cols-2 gap-3 overflow-hidden p-4 xl:grid-cols-3">
              {preparing.map((order) => (
                <CallTile key={order.id} order={order} ready={false} highlight={false} />
              ))}
            </ul>
          )}
        </section>

        <section className="flex min-h-0 flex-col bg-brand-soft/30" aria-live="assertive">
          <h2 className="flex items-center justify-between gap-2 border-b border-border px-5 py-4 text-2xl font-black text-brand-ink lg:text-4xl">
            {t.kitchen.readyForPickup}
            {ready.length > 0 && (
              <span className="rounded-full bg-brand px-3 py-0.5 text-lg font-bold tabular-nums text-brand-fg lg:text-2xl">
                {ready.length}
              </span>
            )}
          </h2>
          {ready.length === 0 ? (
            <p className="flex flex-1 items-center justify-center p-8 text-xl text-muted">{t.kitchen.nothingReady}</p>
          ) : (
            <ul className="grid flex-1 auto-rows-min grid-cols-1 gap-4 overflow-hidden p-4 lg:grid-cols-2">
              {ready.map(({ order, seen }) => (
                <CallTile
                  key={order.id}
                  order={order}
                  ready
                  highlight={!!seen?.announced && now - seen.since < HIGHLIGHT_MS}
                />
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}
