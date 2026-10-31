import { useState } from 'react'
import { AlertTriangle, CloudOff, RefreshCw, Trash2 } from 'lucide-react'
import { ConfirmModal } from '@/components/ui/Modal'
import { toast } from '@/components/ui/Toast'
import { useAuthStore } from '@/stores/authStore'
import { discardSale, syncOfflineSales, useOfflineSales, type QueuedSale } from '@/lib/offlineSales'
import { formatCurrency } from '@/lib/utils'

export function OfflineBanner() {
  const { branchId, tenantId } = useAuthStore()
  const { online, pending, syncing } = useOfflineSales(tenantId, branchId)
  const [discarding, setDiscarding] = useState<QueuedSale | null>(null)
  const rejected = pending.filter((s) => s.lastError)

  if (online && pending.length === 0) return null

  const syncNow = async () => {
    const { synced, failed } = await syncOfflineSales(tenantId)
    if (synced) toast.success(`تمت مزامنة ${synced.toLocaleString('ar-SA')} عملية`)
    if (failed) toast.error(`رفض الخادم ${failed.toLocaleString('ar-SA')} عملية`, 'راجعها في الشريط أعلى الشاشة')
  }

  return (
    <div role="status" className={`border-b px-4 py-2 text-sm print:hidden ${online ? 'border-warning/30 bg-warning/10 text-warning' : 'border-danger/30 bg-danger/10 text-danger'}`}>
      <div className="flex flex-wrap items-center gap-3">
        <CloudOff className="h-4 w-4 shrink-0" />
        <span className="flex-1">
          {online ? 'عاد الاتصال.' : 'لا يوجد اتصال بالإنترنت. استمر في البيع: المبيعات تُحفظ على هذا الجهاز.'}
          {pending.length > 0 && (
            <>
              {' '}
              <span className="font-semibold tabular-nums">{pending.length.toLocaleString('ar-SA')}</span> عملية بانتظار المزامنة
              (<span className="tabular-nums">{formatCurrency(pending.reduce((s, x) => s + x.total, 0))}</span>). لا تمسح بيانات المتصفح.
            </>
          )}
        </span>
        {online && pending.length > 0 && (
          <button
            type="button"
            onClick={() => void syncNow()}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-current/30 px-3 py-1 text-xs font-semibold disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin motion-reduce:animate-none' : ''}`} />
            {syncing ? 'جارٍ المزامنة…' : 'مزامنة الآن'}
          </button>
        )}
      </div>
      {rejected.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs">
          {rejected.map((s) => (
            <li key={s.clientReference} className="flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1">
                عملية {new Date(s.queuedAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })} ·{' '}
                {formatCurrency(s.total)} رُفضت: {s.lastError}
              </span>
              <button type="button" onClick={() => setDiscarding(s)} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-danger/10" aria-label="حذف العملية المرفوضة">
                <Trash2 className="h-3 w-3" />
                حذف
              </button>
            </li>
          ))}
        </ul>
      )}
      <ConfirmModal
        open={!!discarding}
        onClose={() => setDiscarding(null)}
        onConfirm={() => {
          if (discarding) discardSale(discarding.clientReference)
          setDiscarding(null)
        }}
        title="حذف عملية لم تُسجَّل"
        message={discarding ? `هذه العملية (${formatCurrency(discarding.total)}) رفضها الخادم ولن تُسجَّل في المبيعات. احذفها فقط بعد تسجيلها يدوياً أو التأكد أنها خاطئة.` : ''}
        confirmLabel="حذف"
        confirmVariant="danger"
      />
    </div>
  )
}
