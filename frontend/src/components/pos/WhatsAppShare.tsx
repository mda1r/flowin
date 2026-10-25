import { useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { normalizePhoneForWhatsApp, whatsAppUrl } from '@/lib/whatsapp'

// Opens WhatsApp with the receipt text addressed to the customer; the cashier still presses send there.
export function WhatsAppShare({ message, defaultPhone }: { message: string; defaultPhone?: string }) {
  const [phone, setPhone] = useState(defaultPhone ?? '')
  const normalized = normalizePhoneForWhatsApp(phone)
  const showError = phone.trim().length >= 4 && !normalized

  return (
    <div className="space-y-1.5 print:hidden">
      <div className="flex gap-2">
        <input
          type="tel"
          inputMode="tel"
          dir="ltr"
          className="input min-w-0 flex-1 text-sm"
          placeholder="05XXXXXXXX"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          aria-label="جوال العميل لإرسال الفاتورة"
          aria-invalid={showError}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && normalized) {
              e.preventDefault()
              window.open(whatsAppUrl(normalized, message), '_blank', 'noopener,noreferrer')
            }
          }}
        />
        <a
          href={normalized ? whatsAppUrl(normalized, message) : undefined}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={!normalized}
          onClick={(e) => { if (!normalized) e.preventDefault() }}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-white transition-colors ${
            normalized ? 'bg-[#1F9D55] hover:bg-[#17803F]' : 'cursor-not-allowed bg-[#1F9D55]/40'
          }`}
        >
          <MessageCircle className="h-4 w-4" />
          واتساب
        </a>
      </div>
      {showError && <p className="text-xs text-danger">رقم غير صالح. مثال: 0512345678</p>}
    </div>
  )
}
