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
let cache: QueuedSale[] | null = null
let syncing = false

function read(): QueuedSale[] {
  if (cache) return cache
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    cache = raw ? (JSON.parse(raw) as QueuedSale[]) : []
  } catch {
    cache = []
  }
  return cache
}

function write(next: QueuedSale[]) {
  cache = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Storage full or blocked: the queue still lives in memory for this page.
  }
  listeners.forEach((l) => l())
}

export const newClientReference = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
      })

// No response at all (offline, DNS, timeout) — as opposed to the server rejecting the sale.
export const isNetworkError = (err: unknown) =>
  isAxiosError(err) ? !err.response : err instanceof TypeError

export function queueSale(sale: Omit<QueuedSale, 'queuedAt'>) {
  const others = read().filter((s) => s.clientReference !== sale.clientReference)
  write([...others, { ...sale, queuedAt: new Date().toISOString() }])
}

export function pendingSales(tenantId: string | null | undefined, branchId?: string | null) {
  return read().filter((s) => s.tenantId === tenantId && (!branchId || s.branchId === branchId))
}

// Sends queued sales one by one, oldest first. Stops at the first network failure; a sale the server
// rejects stays queued with its error so a manager can see it instead of it vanishing.
export async function syncOfflineSales(tenantId: string | null | undefined): Promise<{ synced: number; failed: number }> {
  if (syncing || !tenantId) return { synced: 0, failed: 0 }
  syncing = true
  let synced = 0
  let failed = 0
  try {
    for (const sale of read().filter((s) => s.tenantId === tenantId)) {
      try {
        await ordersApi.checkout(sale.branchId, sale.payload)
        write(read().filter((s) => s.clientReference !== sale.clientReference))
        synced++
      } catch (err) {
        if (isNetworkError(err)) break
        failed++
        write(read().map((s) => (s.clientReference === sale.clientReference ? { ...s, lastError: apiErrorMessage(err) } : s)))
      }
    }
  } finally {
    syncing = false
    listeners.forEach((l) => l())
  }
  return { synced, failed }
}

export function discardSale(clientReference: string) {
  write(read().filter((s) => s.clientReference !== clientReference))
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  window.addEventListener('online', l)
  window.addEventListener('offline', l)
  return () => {
    listeners.delete(l)
    window.removeEventListener('online', l)
    window.removeEventListener('offline', l)
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
