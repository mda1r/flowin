// One way to write an invoice number everywhere: the store's sequential number (1, 2, 3…),
// or, for sales made before numbering existed and offline sales not yet synced, a short code from the id.
export function invoiceNo(order: { id: string; number?: number | null }) {
  return order.number ? String(order.number) : order.id.slice(-6).toUpperCase()
}

// Matches what a cashier types when searching: "1024", "#1024" or the short code.
export function matchesInvoiceNo(order: { id: string; number?: number | null }, query: string) {
  const q = query.trim().replace(/^#/, '').toLowerCase()
  if (!q) return true
  return invoiceNo(order).toLowerCase() === q || order.id.toLowerCase().includes(q)
}

// The number a kitchen ticket is called by: a cafe ticket carries its sale's invoice number, so the barista
// and the pickup screen use the number printed on the receipt; a restaurant ticket gets a short code.
export function kitchenTicketNo(order: { id: string; kitchenOnly?: boolean; sourceOrderId?: string | null; ticketNumber?: number | null }) {
  return order.kitchenOnly && order.sourceOrderId
    ? invoiceNo({ id: order.sourceOrderId, number: order.ticketNumber })
    : order.id.slice(-4).toUpperCase()
}
