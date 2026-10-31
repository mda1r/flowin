import { AlertTriangle, ChefHat, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from '@/components/ui/Toast'
import { useAuthStore } from '@/stores/authStore'
import { discardKitchenTicket, flushKitchenTickets, useKitchenOutbox } from '@/lib/cafeKitchen'

// Tells the cashier which paid orders have not reached the kitchen screen yet, so the barista is never left out.
export function KitchenOutboxBanner() {
  const { branchId, tenantId } = useAuthStore()
  const { pending, flushing } = useKitchenOutbox(tenantId, branchId)

  if (pending.length === 0) return null

  const resend = async () => {
    const { sent, failed } = await flushKitchenTickets(tenantId)
    if (sent) toast.success(`وصل ${sent.toLocaleString('ar-SA')} طلب للمطبخ`)
    else if (!failed) toast.warning('لم تصل الطلبات للمطبخ بعد', 'تحقق من الاتصال، أو أبلغ المحضّر بها')
  }

  return (
    <div role="status" className="border-b border-warning/30 bg-warning/10 px-4 py-2 text-sm text-warning print:hidden">
      <div className="flex flex-wrap items-center gap-3">
        <ChefHat className="h-4 w-4 shrink-0" />
        <span className="flex-1">
          <span className="font-semibold tabular-nums">{pending.length.toLocaleString('ar-SA')}</span> طلب لم يصل لشاشة المطبخ:{' '}
          <span className="font-semibold tabular-nums">{pending.map((p) => `#${p.ticketNumber}`).join('، ')}</span>.
          يُعاد الإرسال تلقائياً، وأبلغ المحضّر بها إن تأخرت.
        </span>
        <button
          type="button"
          onClick={() => void resend()}
          disabled={flushing}
          className="inline-flex items-center gap-1.5 rounded-lg border border-current/30 px-3 py-1 text-xs font-semibold disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${flushing ? 'animate-spin motion-reduce:animate-none' : ''}`} />
          {flushing ? 'جارٍ الإرسال…' : 'إعادة الإرسال'}
        </button>
      </div>
      {pending.some((p) => p.lastError) && (
        <ul className="mt-2 space-y-1 text-xs">
          {pending.filter((p) => p.lastError).map((p) => (
            <li key={p.ticketNumber} className="flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1">#{p.ticketNumber} رُفض: {p.lastError}</span>
              <button
                type="button"
                onClick={() => discardKitchenTicket(p)}
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-warning/15"
                aria-label={`إزالة الطلب ${p.ticketNumber}`}
              >
                <Trash2 className="h-3 w-3" />
                إزالة
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
