import { ReceiptDocument, type ReceiptLine } from '@/components/pos/ReceiptDocument'
import { formatMinutes } from '@/components/gaming/Packages'
import { invoiceNo } from '@/lib/invoiceNumber'
import { paymentLabel } from '@/lib/orderReceipt'
import { useReceiptSettings, useSellerIdentity } from '@/lib/receipt'
import { formatCurrency } from '@/lib/utils'
import { useVat } from '@/lib/vat'
import { generateZatcaQr } from '@/lib/zatca'
import type { GameSessionBillResponse } from '@/types/api'

const r2 = (v: number) => Math.round(v * 100) / 100

// The package and its overtime as separate lines, or one line for an hourly session. Prices include VAT.
function sessionLines(bill: GameSessionBillResponse): ReceiptLine[] {
  const rate = `${formatCurrency(bill.ratePerHour)} / ساعة`
  if (bill.packageName && bill.packagePrice != null) {
    const lines: ReceiptLine[] = [
      { key: 'package', name: `باقة ${bill.packageName}`, quantity: 1, total: bill.packagePrice, detail: bill.stationName },
    ]
    const overtime = bill.overtimeMinutes ?? 0
    if (overtime > 0) {
      lines.push({
        key: 'overtime',
        name: 'وقت إضافي',
        quantity: 1,
        total: r2(bill.totalAmount - bill.packagePrice),
        detail: `${formatMinutes(Math.round(overtime))} × ${rate}`,
      })
    }
    return lines
  }
  return [
    {
      key: 'session',
      name: `جلسة لعب - ${bill.stationName}`,
      quantity: 1,
      total: r2(bill.totalAmount),
      detail: `${formatMinutes(Math.round(bill.actualDurationMinutes))} × ${rate}`,
    },
  ]
}

/* A paid session as a simplified tax invoice: the same slip every till prints, numbered like the sale POS
   recorded for it. The total includes VAT and is split into net + 15% VAT. The bill carries no tax of its own,
   so the shop's setting decides (the server records the session's sale at that rate): without VAT it is a plain
   invoice at the listed price, with no VAT rows, VAT number or QR. */
export function SessionReceipt({ id, bill }: { id: string; bill: GameSessionBillResponse }) {
  const settings = useReceiptSettings()
  const { sellerName, vatNumber } = useSellerIdentity()
  const { enabled: vat, rate } = useVat()
  const total = r2(bill.totalAmount)
  const subtotal = r2(total / (1 + rate))
  const tax = r2(total - subtotal)
  const issuedAt = bill.paidAt ?? bill.endTime

  return (
    <ReceiptDocument
      id={id}
      settings={settings}
      sellerName={sellerName}
      vatNumber={vatNumber}
      invoiceNo={invoiceNo({ id: bill.sessionId, number: bill.invoiceNumber })}
      issuedAt={issuedAt}
      lines={sessionLines(bill)}
      subtotal={subtotal}
      tax={tax}
      total={total}
      vat={vat}
      paymentLabel={paymentLabel(bill.paymentMethod)}
      customer={bill.playerName ? { name: `اللاعب: ${bill.playerName}` } : undefined}
      qr={vat ? generateZatcaQr({ sellerName: sellerName || 'مركز ألعاب', vatNumber, timestamp: issuedAt, totalWithVat: total, vatAmount: tax }) : undefined}
    />
  )
}
