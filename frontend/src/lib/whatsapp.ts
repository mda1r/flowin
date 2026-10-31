// Normalizes a phone typed at the till to wa.me's international digits form.
// Saudi mobiles: 05XXXXXXXX, 5XXXXXXXX, +9665XXXXXXXX or 009665XXXXXXXX → 9665XXXXXXXX.
// Other international numbers are accepted when written with + or 00.
export function normalizePhoneForWhatsApp(input: string): string | null {
  const raw = input.trim()
  const international = raw.startsWith('+') || raw.startsWith('00')
  let digits = raw.replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)

  if (/^05\d{8}$/.test(digits)) return `966${digits.slice(1)}`
  if (/^5\d{8}$/.test(digits)) return `966${digits}`
  if (/^9665\d{8}$/.test(digits)) return digits
  if (international && /^\d{8,15}$/.test(digits)) return digits
  return null
}

export interface ReceiptMessage {
  storeName: string
  invoiceNo: string
  date: string
  items: { name: string; quantity: number; total: number }[]
  discount?: number
  vat: number
  vatIncluded?: boolean
  total: number
  payment: string
}

const sar = (n: number) => `${n.toFixed(2)} ر.س`

// Keeps the wa.me link well under browser URL limits on very long invoices.
const MAX_ITEMS = 25

export function buildReceiptMessage(r: ReceiptMessage): string {
  const lines = [
    `*${r.storeName}*`,
    `فاتورة رقم ${r.invoiceNo}`,
    r.date,
    '',
    ...r.items.slice(0, MAX_ITEMS).map((i) => `• ${i.name} × ${i.quantity}: ${sar(i.total)}`),
    ...(r.items.length > MAX_ITEMS ? [`• و${r.items.length - MAX_ITEMS} أصناف أخرى`] : []),
    '',
  ]
  if (r.discount) lines.push(`الخصم: −${sar(r.discount)}`)
  lines.push(`${r.vatIncluded ? 'منها ضريبة القيمة المضافة' : 'ضريبة القيمة المضافة'}: ${sar(r.vat)}`, `*الإجمالي: ${sar(r.total)}*`, `الدفع: ${r.payment}`, '', 'شكراً لزيارتكم')
  return lines.join('\n')
}

export const whatsAppUrl = (phone: string, text: string) =>
  `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
