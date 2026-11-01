import { useEffect, useSyncExternalStore } from 'react'
import { isAxiosError } from 'axios'
import { ordersApi, type CheckoutPayload } from '@/api/orders'
import { apiErrorMessage } from '@/lib/apiError'

// Sales rung up while the connection is down, kept on this device until the server confirms them.
// Each carries the till's clientReference, so resending one that already reached the server is harmless.
// The payload is replayed exactly as the till built it, add-on option ids included.
export interface QueuedSale {
  clientReference: string
  // Synced only while a user of this same tenant is signed in, so a shared device never posts one store's sales into another.
  tenantId: string
  branchId: string
  payload: CheckoutPayload
  total: number
  itemCount: number
  queuedAt: string
  lastError?: string
  // Server errors (5xx) this sale hit while other sales went through, so the fault is with this sale, not an outage.
  serverFailures?: number
}

const STORAGE_KEY = 'flowin-offline-sales'
const listeners = new Set<() => void>()
// The last raw value read, so the parsed list keeps one reference until storage really changes.
let cachedRaw: string | null | undefined
let cache: QueuedSale[] = []
let syncing = false
// The last sync could not reach the server, or a sale was just queued because the server did not take it.
let stalledNow = false
// After this many runs where only this sale fails with a server error, it is shown to the manager instead of retried silently.
const MAX_SERVER_FAILURES = 3

// Always reads storage afresh: another tab (the retail and cafe POS, or the same page twice) may have
// queued or synced a sale since, and writing back a stale copy would wipe that sale.
function read(): QueuedSale[] {
  let raw: string | null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
  } catch {
    return cache
  }
  if (raw === cachedRaw) return cache
  cachedRaw = raw
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : []
    cache = Array.isArray(parsed) ? (parsed as QueuedSale[]) : []
  } catch {
    cache = []
  }
  return cache
}

// False when storage is full or blocked: nothing was kept, so the caller must not treat the sale as saved.
function write(next: QueuedSale[]): boolean {
  const raw = JSON.stringify(next)
  try {
    localStorage.setItem(STORAGE_KEY, raw)
  } catch {
    return false
  }
  cachedRaw = raw
  cache = next
  listeners.forEach((l) => l())
  return true
}

// Read and write in one synchronous step, on the latest copy in storage.
const update = (change: (sales: QueuedSale[]) => QueuedSale[]) => write(change(read()))

// The manager PIN only approves a discount live; a sale that syncs later is reviewed by the manager instead,
// so the PIN is never kept on the device.
export function withoutApprovalPin<T extends { approvalPin?: string }>(payload: T): T {
  if (!('approvalPin' in payload)) return payload
  const copy = { ...payload }
  delete copy.approvalPin
  return copy
}

// Sales queued by an earlier build may still hold a PIN: drop it once, as soon as this module loads.
try {
  const queued = read()
  if (queued.some((s) => s.payload && 'approvalPin' in s.payload)) {
    write(queued.map((s) => (s.payload ? { ...s, payload: withoutApprovalPin(s.payload) } : s)))
  }
} catch {
  // Storage is blocked, so there is nothing stored to clean.
}

export const newClientReference = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
      })

const isRefreshFailure = (err: unknown) => !!err && typeof err === 'object' && 'refreshFailed' in err

// The sale may not have reached the server, or the server could not take it right now (no answer, timeout,
// 5xx from the proxy, rate limit, lapsed session): keep it on the device and retry. The clientReference
// makes a resend of a sale that did get through harmless.
export function isTransientError(err: unknown) {
  if (isRefreshFailure(err)) return true
  if (!isAxiosError(err)) return err instanceof TypeError
  const status = err.response?.status ?? 0
  return status === 0 || status === 401 || status === 408 || status === 429 || status >= 500
}

// The server answered with its own failure (5xx), as opposed to no answer at all.
const isServerError = (err: unknown) => isAxiosError(err) && !isRefreshFailure(err) && (err.response?.status ?? 0) >= 500

// Copy for a sale just kept on the device: with the internet up, it is the server that is not answering.
export function savedOnDeviceMessage(): [string, string] {
  return typeof navigator !== 'undefined' && navigator.onLine
    ? ['حُفظت العملية على الجهاز', 'الخادم لا يستجيب، وستُرسل تلقائياً']
    : ['حُفظت العملية دون اتصال', 'ستُسجَّل تلقائياً عند عودة الإنترنت']
}

// Throws when the device cannot store the sale, so the till never claims a sale it will lose on reload.
export function queueSale(sale: Omit<QueuedSale, 'queuedAt'>) {
  const saved = update((sales) => [
    ...sales.filter((s) => s.clientReference !== sale.clientReference),
    { ...sale, payload: withoutApprovalPin(sale.payload), queuedAt: new Date().toISOString() },
  ])
  if (!saved) throw new Error('offline-storage')
  // Queued while online: the server did not take it, so the banner should not say the connection is fine.
  if (typeof navigator === 'undefined' || navigator.onLine) setStalled(true)
}

function setStalled(next: boolean) {
  if (stalledNow === next) return
  stalledNow = next
  listeners.forEach((l) => l())
}

export function pendingSales(tenantId: string | null | undefined, branchId?: string | null) {
  return read().filter((s) => s.tenantId === tenantId && (!branchId || s.branchId === branchId))
}

// Sends queued sales one by one, oldest first. Stops at the first transient failure; a sale the server
// refuses (any other answer: 400, 403, 404, 409...) stays queued with its error so a manager can see it
// instead of it vanishing, and the rest carry on. A server error on one sale skips past it once per run:
// if the next sale gets through the fault is that sale's, and after a few such runs it is shown as failed;
// if the next one fails too, the server is down and the run stops.
export async function syncOfflineSales(
  tenantId: string | null | undefined,
): Promise<{ synced: number; failed: number; stalled: boolean }> {
  if (syncing || !tenantId) return { synced: 0, failed: 0, stalled: false }
  syncing = true
  listeners.forEach((l) => l())
  let synced = 0
  let failed = 0
  let stalled = false
  let ran = false
  const patch = (ref: string, change: (s: QueuedSale) => QueuedSale) =>
    update((sales) => sales.map((s) => (s.clientReference === ref ? change(s) : s)))
  try {
    const run = async () => {
      ran = true
      // The sale skipped this run after a server error, with that error.
      let skipped: { ref: string; err: unknown } | null = null
      // The server answered this sale properly, so a skipped sale's server error was its own.
      const serverAnswered = () => {
        if (!skipped) return
        const { ref, err } = skipped
        skipped = null
        stalled = false
        patch(ref, (s) => {
          const serverFailures = (s.serverFailures ?? 0) + 1
          return serverFailures >= MAX_SERVER_FAILURES ? { ...s, serverFailures, lastError: apiErrorMessage(err) } : { ...s, serverFailures }
        })
      }
      for (const sale of read().filter((s) => s.tenantId === tenantId)) {
        // Another tab may have sent or discarded it in the meantime.
        if (!read().some((s) => s.clientReference === sale.clientReference)) continue
        try {
          await ordersApi.checkout(sale.branchId, sale.payload)
          update((sales) => sales.filter((s) => s.clientReference !== sale.clientReference))
          synced++
          serverAnswered()
        } catch (err) {
          if (isServerError(err) && !skipped) {
            skipped = { ref: sale.clientReference, err }
            stalled = true
            continue
          }
          if (isTransientError(err)) {
            stalled = true
            break
          }
          failed++
          serverAnswered()
          const lastError = apiErrorMessage(err)
          patch(sale.clientReference, (s) => ({ ...s, lastError }))
        }
      }
    }
    // One tab at a time, so two open tills don't post the same sales side by side.
    if (typeof navigator !== 'undefined' && navigator.locks) {
      await navigator.locks.request('flowin-offline-sync', { ifAvailable: true }, async (lock) => {
        if (lock) await run()
      })
    } else {
      await run()
    }
  } finally {
    syncing = false
    // A run skipped because another tab holds the lock says nothing about the server.
    if (ran) stalledNow = stalled
    listeners.forEach((l) => l())
  }
  return { synced, failed, stalled }
}

export function discardSale(clientReference: string) {
  update((sales) => sales.filter((s) => s.clientReference !== clientReference))
}

const subscribe = (l: () => void) => {
  // Another tab changed the queue: re-render with what is in storage now.
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) l()
  }
  listeners.add(l)
  window.addEventListener('online', l)
  window.addEventListener('offline', l)
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(l)
    window.removeEventListener('online', l)
    window.removeEventListener('offline', l)
    window.removeEventListener('storage', onStorage)
  }
}

// Snapshot must be referentially stable between renders for useSyncExternalStore.
let snapshot = { online: true, sales: [] as QueuedSale[], syncing: false, stalled: false }
function getSnapshot() {
  const online = typeof navigator === 'undefined' ? true : navigator.onLine
  const sales = read()
  if (snapshot.online !== online || snapshot.sales !== sales || snapshot.syncing !== syncing || snapshot.stalled !== stalledNow) {
    snapshot = { online, sales, syncing, stalled: stalledNow }
  }
  return snapshot
}

export function useOfflineSales(tenantId: string | null | undefined, branchId?: string | null) {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const mine = state.sales.filter((s) => s.tenantId === tenantId)
  const sales = branchId ? mine.filter((s) => s.branchId === branchId) : mine

  // Retry when the connection comes back, and every 30 seconds while anything is waiting.
  useEffect(() => {
    if (!state.online || mine.length === 0) return
    void syncOfflineSales(tenantId)
    const id = window.setInterval(() => void syncOfflineSales(tenantId), 30_000)
    return () => window.clearInterval(id)
  }, [state.online, mine.length, tenantId])

  return { online: state.online, pending: sales, syncing: state.syncing, stalled: state.stalled }
}
