import { useEffect, useSyncExternalStore } from 'react'
import { isAxiosError } from 'axios'
import { ordersApi, type CheckoutPayload } from '@/api/orders'
import { apiErrorMessage } from '@/lib/apiError'

// Sales rung up while the connection is down, kept on this device until the server confirms them.
// Each carries the till's clientReference, so resending one that already reached the server is harmless.
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
}

const STORAGE_KEY = 'flowin-offline-sales'
const listeners = new Set<() => void>()
// The last raw value read, so the parsed list keeps one reference until storage really changes.
let cachedRaw: string | null | undefined
let cache: QueuedSale[] = []
let syncing = false

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

export const newClientReference = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
      })

const isRefreshFailure = (err: unknown) => !!err && typeof err === 'object' && 'refreshFailed' in err

// The server read the sale and refused it (bad data, conflict). Only these are shown as rejected.
export function isRejection(err: unknown) {
  if (!isAxiosError(err) || isRefreshFailure(err)) return false
  const status = err.response?.status
  return status === 400 || status === 409 || status === 422
}

// The sale may not have reached the server, or the server could not take it right now (no answer, timeout,
// 5xx from the proxy, rate limit, lapsed session): keep it on the device and retry. The clientReference
// makes a resend of a sale that did get through harmless.
export function isTransientError(err: unknown) {
  if (isRefreshFailure(err)) return true
  if (!isAxiosError(err)) return err instanceof TypeError
  const status = err.response?.status ?? 0
  return status === 0 || status === 401 || status === 408 || status === 429 || status >= 500
}

// Throws when the device cannot store the sale, so the till never claims a sale it will lose on reload.
export function queueSale(sale: Omit<QueuedSale, 'queuedAt'>) {
  const saved = update((sales) => [
    ...sales.filter((s) => s.clientReference !== sale.clientReference),
    { ...sale, queuedAt: new Date().toISOString() },
  ])
  if (!saved) throw new Error('offline-storage')
}

export function pendingSales(tenantId: string | null | undefined, branchId?: string | null) {
  return read().filter((s) => s.tenantId === tenantId && (!branchId || s.branchId === branchId))
}

// Sends queued sales one by one, oldest first. Stops at the first transient failure; a sale the server
// rejects stays queued with its error so a manager can see it instead of it vanishing.
export async function syncOfflineSales(
  tenantId: string | null | undefined,
): Promise<{ synced: number; failed: number; stalled: boolean }> {
  if (syncing || !tenantId) return { synced: 0, failed: 0, stalled: false }
  syncing = true
  listeners.forEach((l) => l())
  let synced = 0
  let failed = 0
  let stalled = false
  try {
    const run = async () => {
      for (const sale of read().filter((s) => s.tenantId === tenantId)) {
        // Another tab may have sent or discarded it in the meantime.
        if (!read().some((s) => s.clientReference === sale.clientReference)) continue
        try {
          await ordersApi.checkout(sale.branchId, sale.payload)
          update((sales) => sales.filter((s) => s.clientReference !== sale.clientReference))
          synced++
        } catch (err) {
          if (!isRejection(err)) {
            stalled = true
            break
          }
          failed++
          const lastError = apiErrorMessage(err)
          update((sales) => sales.map((s) => (s.clientReference === sale.clientReference ? { ...s, lastError } : s)))
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
let snapshot = { online: true, sales: [] as QueuedSale[], syncing: false }
function getSnapshot() {
  const online = typeof navigator === 'undefined' ? true : navigator.onLine
  const sales = read()
  if (snapshot.online !== online || snapshot.sales !== sales || snapshot.syncing !== syncing) {
    snapshot = { online, sales, syncing }
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

  return { online: state.online, pending: sales, syncing: state.syncing }
}
