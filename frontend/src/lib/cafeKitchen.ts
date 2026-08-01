export interface CafeKitchenTicket {
  id: string
  ticketNumber: number
  tableNumber: number | null
  orderType: 'here' | 'takeaway'
  items: { productName: string; variantName: string; quantity: number; notes: string }[]
  timestamp: string
  status: 'pending' | 'preparing' | 'ready'
}

const storageKey = (tenantId: string) => `nexus_cafe_kitchen_${tenantId}`

export function pushKitchenTicket(
  tenantId: string,
  ticket: Omit<CafeKitchenTicket, 'id' | 'timestamp' | 'status'>,
): CafeKitchenTicket {
  const all = getTickets(tenantId)
  const full: CafeKitchenTicket = {
    ...ticket,
    id: Math.random().toString(36).slice(2),
    timestamp: new Date().toISOString(),
    status: 'pending',
  }
  all.unshift(full)
  if (all.length > 50) all.splice(50)
  try { localStorage.setItem(storageKey(tenantId), JSON.stringify(all)) } catch { /* storage full */ }
  return full
}

export function getTickets(tenantId: string): CafeKitchenTicket[] {
  try {
    const raw = localStorage.getItem(storageKey(tenantId))
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function updateTicketStatus(
  tenantId: string,
  ticketId: string,
  status: CafeKitchenTicket['status'],
): void {
  const all = getTickets(tenantId).map(t => t.id === ticketId ? { ...t, status } : t)
  try { localStorage.setItem(storageKey(tenantId), JSON.stringify(all)) } catch {}
}

export function removeTicket(tenantId: string, ticketId: string): void {
  const all = getTickets(tenantId).filter(t => t.id !== ticketId)
  try { localStorage.setItem(storageKey(tenantId), JSON.stringify(all)) } catch {}
}
