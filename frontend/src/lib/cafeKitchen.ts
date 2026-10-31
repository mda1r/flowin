import { useEffect, useSyncExternalStore } from 'react'
import { restaurantApi, type OrderItemInput } from '@/api/restaurant'
import { apiErrorMessage } from '@/lib/apiError'
import { isNetworkError } from '@/lib/offlineSales'

// Cafe sales mirrored to the kitchen screen. A ticket that cannot be sent (no connection, server error) waits
// on this device and is resent until it arrives; the server ignores a ticket number it already has, so a resend
// after a lost response never makes the drink twice.
export interface CafeKitchenTicket {
  // The number printed on the customer's receipt, so the barista can call it out.
  ticketNumber: string
  tenantId: string
  branchId: string
  tableNumber: number
  items: OrderItemInput[]
  queuedAt: string
  lastError?: string
}

export const TAKEAWAY_TABLE = 99

// A drink nobody received within two hours has been made by hand or abandoned; it should not pop up late.
const TICKET_TTL_MS = 2 * 60 * 60 * 1000
const STORAGE_KEY = 'flowin-kitchen-outbox'
const listeners = new Set<() => void>()
let cache: CafeKitchenTicket[] | null = null
let flushing = false

function read(): CafeKitchenTicket[] {
  if (cache) return cache
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    cache = raw ? (JSON.parse(raw) as CafeKitchenTicket[]) : []
  } catch {
    cache = []
  }
  return cache
}

function write(next: CafeKitchenTicket[]) {
  cache = next
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* storage full: kept in memory */ }
  listeners.forEach((l) => l())
}

const sameTicket = (a: CafeKitchenTicket, b: Pick<CafeKitchenTicket, 'tenantId' | 'ticketNumber'>) =>
  a.tenantId === b.tenantId && a.ticketNumber === b.ticketNumber

// "Latte" alone is not enough to make the drink: keep the size or type unless it is the default variant.
export function kitchenItemName(productName: string, variantName?: string) {
  const name = variantName && !['Standard', 'افتراضي', productName].includes(variantName)
    ? `${productName} - ${variantName}`
    : productName
  return name.slice(0, 128)
}

export function kitchenItems(
  cart: { variantId: string; productName: string; variantName: string; quantity: number; unitPrice: number; notes: string }[],
): OrderItemInput[] {
  return cart.map((i) => ({
    menuItemId: i.variantId,
    itemName: kitchenItemName(i.productName, i.variantName),
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    notes: i.notes || undefined,
  }))
}

async function post(ticket: CafeKitchenTicket) {
  await restaurantApi.createOrder(ticket.branchId, {
    tenantId: ticket.tenantId,
    tableNumber: ticket.tableNumber,
    items: ticket.items,
    ticketNumber: ticket.ticketNumber,
  })
}

// Sends the ticket now, or keeps it for later. Resolves false when it is waiting on this device.
export async function sendKitchenTicket(ticket: Omit<CafeKitchenTicket, 'queuedAt' | 'lastError'>): Promise<boolean> {
  const full: CafeKitchenTicket = { ...ticket, queuedAt: new Date().toISOString() }
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      await post(full)
      return true
    } catch (err) {
      full.lastError = isNetworkError(err) ? undefined : apiErrorMessage(err)
    }
  }
  write([...read().filter((t) => !sameTicket(t, full)), full])
  return false
}

// Resends waiting tickets oldest first; stops at the first network failure.
export async function flushKitchenTickets(tenantId: string | null | undefined): Promise<{ sent: number; failed: number }> {
  if (flushing || !tenantId) return { sent: 0, failed: 0 }
  flushing = true
  let sent = 0
  let failed = 0
  try {
    const cutoff = Date.now() - TICKET_TTL_MS
    const expired = read().filter((t) => t.tenantId === tenantId && new Date(t.queuedAt).getTime() < cutoff)
    if (expired.length > 0) write(read().filter((t) => !expired.includes(t)))

    for (const ticket of read().filter((t) => t.tenantId === tenantId)) {
      try {
        await post(ticket)
        write(read().filter((t) => !sameTicket(t, ticket)))
        sent++
      } catch (err) {
        if (isNetworkError(err)) break
        failed++
        write(read().map((t) => (sameTicket(t, ticket) ? { ...t, lastError: apiErrorMessage(err) } : t)))
      }
    }
  } finally {
    flushing = false
    listeners.forEach((l) => l())
  }
  return { sent, failed }
}

export function discardKitchenTicket(ticket: Pick<CafeKitchenTicket, 'tenantId' | 'ticketNumber'>) {
  write(read().filter((t) => !sameTicket(t, ticket)))
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  window.addEventListener('online', l)
  return () => {
    listeners.delete(l)
    window.removeEventListener('online', l)
  }
}

let snapshot = { online: true, tickets: [] as CafeKitchenTicket[], flushing: false }
function getSnapshot() {
  const online = typeof navigator === 'undefined' ? true : navigator.onLine
  const tickets = read()
  if (snapshot.online !== online || snapshot.tickets !== tickets || snapshot.flushing !== flushing) {
    snapshot = { online, tickets, flushing }
  }
  return snapshot
}

// Tickets waiting for this branch; retried when the connection returns and every 20 seconds while any wait.
export function useKitchenOutbox(tenantId: string | null | undefined, branchId?: string | null) {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const mine = state.tickets.filter((t) => t.tenantId === tenantId && (!branchId || t.branchId === branchId))

  useEffect(() => {
    if (!state.online || mine.length === 0) return
    void flushKitchenTickets(tenantId)
    const id = window.setInterval(() => void flushKitchenTickets(tenantId), 20_000)
    return () => window.clearInterval(id)
  }, [state.online, mine.length, tenantId])

  return { pending: mine, flushing: state.flushing }
}
