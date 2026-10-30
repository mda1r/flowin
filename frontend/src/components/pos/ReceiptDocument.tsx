import type { ReactNode } from 'react'
import type { ReceiptSettings } from '@/api/zatca'
import { ZatcaQr } from '@/components/pos/ZatcaQr'
import { FlowinLogo } from '@/components/brand/Brand'
import { formatCurrency } from '@/lib/utils'

export interface ReceiptLine {
  key: string
  name: string
  quantity: number
  total: number
  detail?: string
}

export interface ReceiptDocumentProps {
  id: string
  settings: ReceiptSettings
  sellerName: string
  vatNumber?: string
  invoiceNo: string
  issuedAt: string
  lines: ReceiptLine[]
  subtotal: number
  tax: number
  total: number
  discount?: number
  loyalty?: { amount: number; points: number }
  paymentLabel: string
  tendered?: number
  customer?: { name: string; pointsEarned?: number }
  /** A short status under the header: table number, takeaway, refunded, provisional number. */
  badge?: ReactNode
  qr: string
}

const n = (v: number) => v.toLocaleString('ar-SA')

/* One receipt for every till and the invoices page. It is laid out for a thermal roll: centred header,
   dashed rules, two-column rows and a large ZATCA QR. On screen it is a white slip; printElement copies it
   to a page exactly the paper's width and the slip's height. */
export function ReceiptDocument(p: ReceiptDocumentProps) {
  const { settings: s } = p
  const change = p.tendered != null && p.tendered > p.total ? p.tendered - p.total : 0
  return (
    <div id={p.id} className="receipt-paper scheme-light bg-surface text-fg" data-paper={s.paperWidthMm} dir="rtl">
      <header className="receipt-center">
        {s.logoPath && <img src={s.logoPath} alt="" className="receipt-logo" />}
        {p.sellerName && <p className="receipt-store">{p.sellerName}</p>}
        {s.address && <p className="receipt-small">{s.address}</p>}
        {s.phone && <p className="receipt-small" dir="ltr">{s.phone}</p>}
        {p.vatNumber && <p className="receipt-small">الرقم الضريبي: <span className="tabular-nums">{p.vatNumber}</span></p>}
        {s.headerNote && <p className="receipt-note">{s.headerNote}</p>}
      </header>

      <hr className="receipt-rule" />

      <div className="receipt-center">
        <p className="receipt-title">فاتورة ضريبية مبسطة</p>
        <p className="receipt-small tabular-nums" dir="ltr">#{p.invoiceNo}</p>
        <p className="receipt-small">
          {new Date(p.issuedAt).toLocaleString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </p>
        {p.badge && <div className="receipt-badge">{p.badge}</div>}
      </div>

      <hr className="receipt-rule" />

      <ul className="receipt-lines">
        {p.lines.map((l) => (
          <li key={l.key}>
            <div className="receipt-row">
              <span>
                {l.name}
                {l.quantity !== 1 && <span className="receipt-qty"> ×{n(l.quantity)}</span>}
              </span>
              <span className="tabular-nums">{formatCurrency(l.total)}</span>
            </div>
            {l.detail && <p className="receipt-small">{l.detail}</p>}
          </li>
        ))}
      </ul>

      <hr className="receipt-rule" />

      {/* Line prices include VAT; discounts come off them, then the total is split into net + VAT. */}
      <div className="receipt-totals">
        {!!p.discount && <div className="receipt-row"><span>الخصم</span><span className="tabular-nums">−{formatCurrency(p.discount)}</span></div>}
        {p.loyalty && p.loyalty.amount > 0 && (
          <div className="receipt-row"><span>نقاط الولاء ({n(p.loyalty.points)} نقطة)</span><span className="tabular-nums">−{formatCurrency(p.loyalty.amount)}</span></div>
        )}
        <div className="receipt-row"><span>المجموع قبل الضريبة</span><span className="tabular-nums">{formatCurrency(p.subtotal)}</span></div>
        <div className="receipt-row"><span>ضريبة القيمة المضافة 15%</span><span className="tabular-nums">{formatCurrency(p.tax)}</span></div>
        <div className="receipt-row receipt-total"><span>الإجمالي</span><span className="tabular-nums">{formatCurrency(p.total)}</span></div>
      </div>

      <hr className="receipt-rule" />

      <div className="receipt-totals">
        <div className="receipt-row"><span>طريقة الدفع</span><span>{p.paymentLabel}</span></div>
        {change > 0 && (
          <>
            <div className="receipt-row"><span>المستلم</span><span className="tabular-nums">{formatCurrency(p.tendered!)}</span></div>
            <div className="receipt-row"><span>الباقي</span><span className="tabular-nums">{formatCurrency(change)}</span></div>
          </>
        )}
        {p.customer && (
          <div className="receipt-row">
            <span>{p.customer.name}</span>
            {p.customer.pointsEarned !== undefined && <span className="tabular-nums">+{n(p.customer.pointsEarned)} نقطة</span>}
          </div>
        )}
      </div>

      <div className="receipt-qr">
        <ZatcaQr value={p.qr} size={132} label="رمز الفاتورة الضريبية (زاتكا)" />
        <p className="receipt-small">امسح الرمز للتحقق من الفاتورة</p>
      </div>

      {s.footerNote && <p className="receipt-note receipt-center">{s.footerNote}</p>}

      {s.showPoweredBy && (
        <div className="receipt-powered">
          <FlowinLogo tone="mono" className="h-3" />
        </div>
      )}
    </div>
  )
}
