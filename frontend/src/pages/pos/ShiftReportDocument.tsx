import { FlowinLogo } from '@/components/brand/Brand'
import { formatCurrency } from '@/lib/utils'
import { useReceiptSettings, useSellerIdentity } from '@/lib/receipt'
import { useVat } from '@/lib/vat'
import type { OrderResponse, ShiftResponse } from '@/types/api'

export const n = (v: number) => v.toLocaleString('ar-SA')

// "3 س 20 د", or "2 يوم 4 س" for shifts left open past a day.
export function shiftDuration(fromIso: string, toIso?: string | null) {
  const ms = (toIso ? new Date(toIso).getTime() : Date.now()) - new Date(fromIso).getTime()
  const mins = Math.max(0, Math.floor(ms / 60_000))
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  return d > 0 ? `${n(d)} يوم ${n(h)} س` : `${n(h)} س ${n(m)} د`
}

// The drawer: what should be there (float + cash taken − cash handed back) against what was counted.
export function reconcile(s: ShiftResponse) {
  const expectedCash = s.expectedCash ?? s.openingCash + s.totalCashSales - (s.totalCashRefunds ?? 0)
  return {
    expectedCash,
    countedCash: s.closingCash,
    cashVariance: s.cashVariance ?? (s.closingCash != null ? s.closingCash - expectedCash : null),
    countedCard: s.closingCardCount,
    cardVariance: s.cardVariance ?? (s.closingCardCount != null ? s.closingCardCount - s.totalCardSales : null),
  }
}

export type TopProduct = { name: string; qty: number; total: number }

// Best sellers by quantity; line totals are net, so VAT is added back to show what customers paid.
export function topProductsOf(orders: OrderResponse[], limit = 5): TopProduct[] {
  const map = new Map<string, TopProduct>()
  for (const o of orders) {
    const gross = 1 + (o.taxRate ?? 0.15)
    for (const l of o.lines) {
      const e = map.get(l.productName) ?? { name: l.productName, qty: 0, total: 0 }
      e.qty += l.quantity
      e.total += l.lineTotal * gross
      map.set(l.productName, e)
    }
  }
  return [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, limit)
}

/** The printable X (mid-shift) or Z (close) report, laid out like a receipt for printElement. */
export function ShiftReportDocument({ id, shift, topProducts, refunds, isCurrent }: {
  id: string
  shift: ShiftResponse
  topProducts: TopProduct[]
  refunds?: { count: number; amount: number }
  isCurrent: boolean
}) {
  const settings = useReceiptSettings()
  const { sellerName, vatNumber } = useSellerIdentity()
  // A shop without VAT prints no VAT number or VAT line, even for a shift that still holds older taxed sales.
  const { enabled: vatOn } = useVat()
  const r = reconcile(shift)
  const row = (label: string, value: string) => (
    <div className="receipt-row"><span>{label}</span><span className="tabular-nums">{value}</span></div>
  )
  const v = (x: number | null) => (x == null ? '—' : `${x > 0 ? '+' : ''}${formatCurrency(x)}`)
  const digital = shift.totalDigitalSales ?? 0
  const cashRefunds = shift.totalCashRefunds ?? 0
  return (
    <div id={id} className="receipt-paper scheme-light bg-surface text-fg" data-paper={settings.paperWidthMm} dir="rtl">
      <header className="receipt-center">
        {settings.logoPath && <img src={settings.logoPath} alt="" className="receipt-logo" />}
        {sellerName && <p className="receipt-store">{sellerName}</p>}
        {vatOn && vatNumber && <p className="receipt-small">الرقم الضريبي: {vatNumber}</p>}
      </header>
      <hr className="receipt-rule" />
      <div className="receipt-center">
        <p className="receipt-title">{isCurrent ? 'تقرير منتصف الشفت (X)' : 'تقرير إقفال الشفت (Z)'}</p>
        <p className="receipt-small">{shift.cashierName}</p>
        <p className="receipt-small">
          {new Date(shift.openedAt).toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' })}
          {shift.closedAt && ` — ${new Date(shift.closedAt).toLocaleString('ar-SA', { timeStyle: 'short' })}`}
        </p>
        <p className="receipt-small">المدة: {shiftDuration(shift.openedAt, shift.closedAt)}</p>
        {shift.closedByName && <p className="receipt-small">أغلقه: {shift.closedByName}</p>}
      </div>
      <hr className="receipt-rule" />
      <div className="receipt-totals">
        {row('عدد الفواتير', n(shift.totalOrders))}
        {row('مبيعات نقدية', formatCurrency(shift.totalCashSales))}
        {row('مبيعات بطاقة', formatCurrency(shift.totalCardSales))}
        {digital > 0 && row('دفع رقمي وأخرى', formatCurrency(digital))}
        {refunds && refunds.count > 0 && row(`المرتجعات (${n(refunds.count)})`, `−${formatCurrency(refunds.amount)}`)}
        {vatOn && row('ضريبة القيمة المضافة', formatCurrency(shift.totalTax))}
        <div className="receipt-row receipt-total"><span>إجمالي المبيعات</span><span className="tabular-nums">{formatCurrency(shift.totalSales)}</span></div>
      </div>
      <hr className="receipt-rule" />
      <p className="receipt-title">مطابقة الدرج</p>
      <div className="receipt-totals">
        {row('عهدة الافتتاح', formatCurrency(shift.openingCash))}
        {cashRefunds > 0 && row('مرتجعات نقدية', `−${formatCurrency(cashRefunds)}`)}
        {row('النقد المتوقع', formatCurrency(r.expectedCash))}
        {row('النقد المعدود', r.countedCash != null ? formatCurrency(r.countedCash) : '—')}
        {row('فرق النقد', v(r.cashVariance))}
        {row('البطاقات المسجلة', r.countedCard != null ? formatCurrency(r.countedCard) : '—')}
        {row('فرق البطاقات', v(r.cardVariance))}
      </div>
      {topProducts.length > 0 && (
        <>
          <hr className="receipt-rule" />
          <p className="receipt-title">الأكثر مبيعاً</p>
          <div className="receipt-totals">
            {topProducts.map((p) => row(`${p.name} ×${n(p.qty)}`, formatCurrency(p.total)))}
          </div>
        </>
      )}
      {shift.notes && <p className="receipt-note">ملاحظة: {shift.notes}</p>}
      <hr className="receipt-rule" />
      <p className="receipt-small receipt-center">طُبع {new Date().toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' })}</p>
      <p className="receipt-small receipt-center" style={{ marginTop: '0.8rem' }}>توقيع الكاشير ____________</p>
      {settings.showPoweredBy && <div className="receipt-powered"><FlowinLogo tone="mono" className="h-3" /></div>}
    </div>
  )
}
