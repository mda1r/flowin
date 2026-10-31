import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { Lock, Unlock, Clock, ShoppingBag, CreditCard, Banknote, TrendingUp, AlertTriangle, Printer, RotateCcw, Smartphone, WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react'
import { shiftsApi } from '@/api/shifts'
import { ordersApi } from '@/api/orders'
import { useOfflineSales } from '@/lib/offlineSales'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { toast } from '@/components/ui/Toast'
import { formatCurrency } from '@/lib/utils'
import { apiErrorMessage } from '@/lib/apiError'
import { printElement } from '@/lib/print'
import { logActivity } from '@/lib/activityLog'
import { useI18n } from '@/i18n'
import { CashCountField } from './CashCountGrid'
import { ShiftReportDocument, shiftDuration, topProductsOf, type TopProduct } from './ShiftReportDocument'
import type { ShiftResponse, OrderResponse } from '@/types/api'

// ── Open Shift Modal ──────────────────────────────────────────────────────────

export function OpenShiftModal({ onClose }: { onClose: () => void }) {
  const { branchId, user, tenantId } = useAuthStore()
  const qc = useQueryClient()
  const { t } = useI18n()
  const [openingCash, setOpeningCash] = useState('')
  const [loading, setLoading] = useState(false)
  const amount = Number(openingCash) || 0
  const invalid = amount < 0

  const handleOpen = async () => {
    if (invalid) return
    setLoading(true)
    try {
      await shiftsApi.open(branchId!, amount)
      qc.invalidateQueries({ queryKey: ['current-shift', branchId] })
      logActivity(tenantId ?? '', {
        userId: user?.id ?? '',
        userName: `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(),
        userEmail: user?.email,
        category: 'shift',
        action: 'فتح الشفت',
        details: `رصيد الفتح: ${amount} ر.س`,
        branchId: branchId ?? undefined,
      })
      toast.success(t.shiftGate.shiftOpen)
      onClose()
    } catch (err) {
      // Already open (another tab or device opened it): pick that shift up instead of failing.
      if (isAxiosError(err) && err.response?.status === 409) {
        await qc.invalidateQueries({ queryKey: ['current-shift', branchId] })
        toast.info('لديك شفت مفتوح بالفعل', 'تم تحميله، تابع البيع عليه.')
        onClose()
      } else {
        toast.error('تعذّر فتح الشفت', apiErrorMessage(err))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t.shiftGate.openShift}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t.common.cancel}</Button>
          <Button loading={loading} onClick={handleOpen} disabled={invalid}>{t.shiftGate.open}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted">{t.shiftGate.enterOpeningCash}</p>
        <Input
          label={t.shiftGate.openingCash}
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          value={openingCash}
          onChange={(e) => setOpeningCash(e.target.value)}
          error={invalid ? 'رصيد الفتح لا يمكن أن يكون سالباً' : undefined}
          autoFocus
        />
      </div>
    </Modal>
  )
}

// ── Close Shift Modal ─────────────────────────────────────────────────────────

export function CloseShiftModal({ shift, onClose }: { shift: ShiftResponse; onClose: () => void }) {
  const { branchId, user, tenantId } = useAuthStore()
  const qc = useQueryClient()
  const { t } = useI18n()
  const [countedCash, setCountedCash] = useState<number | null>(null)
  const [closingCard, setClosingCard] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [closed, setClosed] = useState<{ shift: ShiftResponse; topProducts: TopProduct[] } | null>(null)
  const { pending: offlinePending } = useOfflineSales(tenantId, branchId)

  // The server sums the shift's sales and cash refunds, so the preview matches what closing will store.
  const { data: live, isLoading: loadingLive, isError: liveFailed, refetch: refetchLive } = useQuery({
    queryKey: ['shift-summary', branchId, shift.id],
    queryFn: async () => (await shiftsApi.summary(branchId!, shift.id)).data,
    enabled: !!branchId,
    staleTime: 0,
    refetchInterval: closed ? false : 30_000,
  })

  const cashAmount = countedCash ?? 0
  const cardAmount = Number(closingCard) || 0
  const expectedCash = live?.expectedCash ?? null
  const cashVariance = expectedCash == null ? null : Math.round((cashAmount - expectedCash) * 100) / 100
  const cardVariance = live ? Math.round((cardAmount - live.totalCardSales) * 100) / 100 : null
  // An uncounted drawer would close as zero cash and store the whole take as a deficit; an empty one is typed as 0.
  const invalid = countedCash == null || countedCash < 0 || cardAmount < 0

  const cashierName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim()
  const printReport = (id: string) => window.setTimeout(() => printElement(document.getElementById(id)), 0)

  // The Z report prints by itself once the shift is closed.
  useEffect(() => {
    if (closed) printReport(`z-report-close-${closed.shift.id}`)
  }, [closed])

  // Leaving the result screen is what hands the till back to the lock screen.
  const finish = () => {
    if (closed) {
      qc.setQueriesData({ queryKey: ['current-shift', branchId] }, null)
      qc.invalidateQueries({ queryKey: ['current-shift', branchId] })
      qc.invalidateQueries({ queryKey: ['shift-current', branchId] })
      qc.invalidateQueries({ queryKey: ['shifts', branchId] })
      qc.invalidateQueries({ queryKey: ['shifts-open', branchId] })
    }
    onClose()
  }

  const handleClose = async () => {
    if (invalid) return
    setLoading(true)
    try {
      const { data: result } = await shiftsApi.close(branchId!, shift.id, cashAmount, cardAmount, notes.trim() || undefined)
      const cashV = result.cashVariance ?? 0
      const cardV = result.cardVariance ?? 0
      logActivity(tenantId ?? '', {
        userId: user?.id ?? '',
        userName: cashierName,
        userEmail: user?.email,
        category: 'shift',
        action: 'إغلاق الشفت',
        details: `الدخل: ${formatCurrency(result.totalCashSales)} كاش و ${formatCurrency(result.totalCardSales)} بطاقة${result.totalDigitalSales ? ` و ${formatCurrency(result.totalDigitalSales)} رقمي` : ''}، المجموع ${formatCurrency(result.totalSales)}`,
        branchId: branchId ?? undefined,
      })
      if (cashV < 0) {
        logActivity(tenantId ?? '', {
          userId: user?.id ?? '',
          userName: cashierName,
          userEmail: user?.email,
          category: 'shift',
          action: 'عجز في الصندوق',
          details: `عجز نقدي ${formatCurrency(Math.abs(cashV))} — متوقع ${formatCurrency(result.expectedCash ?? 0)} · فعلي ${formatCurrency(cashAmount)}`,
          branchId: branchId ?? undefined,
        })
      }
      if (cardV < 0) {
        logActivity(tenantId ?? '', {
          userId: user?.id ?? '',
          userName: cashierName,
          userEmail: user?.email,
          category: 'shift',
          action: 'عجز في البطاقة',
          details: `عجز بطاقة ${formatCurrency(Math.abs(cardV))} — متوقع ${formatCurrency(result.totalCardSales)} · فعلي ${formatCurrency(cardAmount)}`,
          branchId: branchId ?? undefined,
        })
      }
      // Best sellers for the Z report; the report still prints without them if this fails.
      let topProducts: TopProduct[] = []
      try {
        const { data } = await ordersApi.listOrders(branchId!, { status: 'Completed', from: result.openedAt, to: result.closedAt ?? undefined, pageSize: 500 })
        topProducts = topProductsOf((Array.isArray(data) ? data : []) as OrderResponse[])
      } catch { /* optional */ }
      toast.success(t.shiftGate.shiftClosed)
      setClosed({ shift: result, topProducts })
    } catch (err) {
      toast.error('تعذّر إغلاق الشفت', apiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  if (closed) {
    const s = closed.shift
    return (
      <Modal
        open
        onClose={finish}
        title={t.shiftGate.shiftClosed}
        footer={
          <>
            <Button variant="secondary" onClick={() => printReport(`z-report-close-${s.id}`)} className="gap-1">
              <Printer className="h-4 w-4" />
              طباعة تقرير Z
            </Button>
            <Button onClick={finish}>تم</Button>
          </>
        }
      >
        <div className="space-y-4" dir="rtl">
          <div className="flex flex-col items-center gap-2 text-center">
            <CheckCircle2 className="h-10 w-10 text-success" />
            <p className="text-sm text-muted">
              {shiftDuration(s.openedAt, s.closedAt)} · {s.totalOrders.toLocaleString('ar-SA')} فاتورة · {formatCurrency(s.totalSales)}
            </p>
          </div>
          <VarianceBadge label={t.shiftGate.cashCount} variance={s.cashVariance ?? 0} />
          <VarianceBadge label={t.shiftGate.cardCount} variance={s.cardVariance ?? 0} />
          <p className="text-center text-xs text-muted">يُطبع تقرير الإقفال تلقائياً، وأعد الطباعة إن لم تخرج الورقة.</p>
        </div>
        <div className="hidden">
          <ShiftReportDocument id={`z-report-close-${s.id}`} shift={s} topProducts={closed.topProducts} isCurrent={false} />
        </div>
      </Modal>
    )
  }

  const hasVariance = (countedCash != null && cashVariance != null && cashVariance !== 0)
    || (closingCard !== '' && cardVariance != null && cardVariance !== 0)
  const digital = live?.totalDigitalSales ?? 0
  const cashRefunds = live?.totalCashRefunds ?? 0
  const money = (v: number | undefined) => (v == null ? '—' : formatCurrency(v))

  return (
    <Modal
      open
      onClose={onClose}
      title={t.shiftGate.closeShift}
      footer={
        <div className="flex w-full flex-col gap-2">
          {hasVariance && (
            <div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger dark:border-danger/60 dark:bg-danger/15">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>{t.shiftGate.confirmClose}</span>
            </div>
          )}
          {offlinePending.length > 0 && (
            <p className="text-xs text-warning">
              {offlinePending.length.toLocaleString('ar-SA')} عملية محفوظة دون اتصال لم تُزامن بعد. انتظر عودة الإنترنت قبل إغلاق الشفت حتى تدخل في حسابه.
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>{t.common.cancel}</Button>
            <Button variant="secondary" onClick={() => printReport(`x-report-${shift.id}`)} disabled={!live} className="gap-1">
              <Printer className="h-4 w-4" />
              {t.common.print}
            </Button>
            <Button variant="danger" loading={loading} onClick={handleClose} disabled={offlinePending.length > 0 || invalid}>
              <Lock className="h-4 w-4" />
              {t.shiftGate.close}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4" dir="rtl">
        {liveFailed && (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
            <span>تعذّر جلب أرقام الشفت. الإغلاق يحسبها على الخادم على أي حال.</span>
            <button type="button" className="font-semibold hover:underline" onClick={() => void refetchLive()}>إعادة المحاولة</button>
          </div>
        )}

        {/* summary cards: figures come from the server, not a capped page of orders */}
        <div className="grid grid-cols-2 gap-3">
          <SummaryCard icon={<ShoppingBag className="h-4 w-4" />} label="إجمالي الطلبات" value={live ? live.totalOrders.toLocaleString('ar-SA') : '—'} loading={loadingLive} />
          <SummaryCard icon={<TrendingUp className="h-4 w-4" />} label={t.shiftGate.totalSales} value={money(live?.totalSales)} loading={loadingLive} />
          <SummaryCard icon={<Banknote className="h-4 w-4" />} label={t.shiftGate.cashSales} value={money(live?.totalCashSales)} loading={loadingLive} />
          <SummaryCard icon={<CreditCard className="h-4 w-4" />} label={t.shiftGate.cardSales} value={money(live?.totalCardSales)} loading={loadingLive} />
          {digital > 0 && <SummaryCard icon={<Smartphone className="h-4 w-4" />} label="دفع رقمي وأخرى" value={formatCurrency(digital)} />}
          {cashRefunds > 0 && <SummaryCard icon={<RotateCcw className="h-4 w-4" />} label="مرتجعات نقدية" value={`−${formatCurrency(cashRefunds)}`} />}
          <SummaryCard icon={<Clock className="h-4 w-4" />} label="مدة الشفت" value={shiftDuration(shift.openedAt)} />
          <SummaryCard icon={<Banknote className="h-4 w-4" />} label={t.shiftGate.openingCash} value={formatCurrency(shift.openingCash)} />
        </div>

        {/* cash section */}
        <div className="space-y-3 rounded-xl border border-border p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">
              {t.shiftGate.expectedCash}
              {cashRefunds > 0 && <span className="ms-1 text-xs">(بعد المرتجعات النقدية)</span>}
            </span>
            <span className="font-bold tabular-nums">{expectedCash == null ? '—' : formatCurrency(expectedCash)}</span>
          </div>
          <CashCountField label={t.shiftGate.closingCash} onChange={setCountedCash} autoFocus />
          {countedCash != null && cashVariance != null && (
            <VarianceBadge label={t.shiftGate.cashCount} variance={cashVariance} />
          )}
        </div>

        {/* card section */}
        <div className="space-y-2 rounded-xl border border-border p-3">
          <p className="text-xs font-medium text-muted">{t.shiftGate.cardCount}</p>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">{t.shiftGate.expectedCard}</span>
            <span className="font-bold tabular-nums">{money(live?.totalCardSales)}</span>
          </div>
          <Input
            label={t.shiftGate.cardCount}
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={closingCard}
            onChange={(e) => setClosingCard(e.target.value)}
            error={cardAmount < 0 ? 'المبلغ لا يمكن أن يكون سالباً' : undefined}
          />
          {closingCard !== '' && cardVariance != null && (
            <VarianceBadge label={t.shiftGate.cardCount} variance={cardVariance} />
          )}
        </div>

        <Input
          label="ملاحظات (اختياري)"
          placeholder="أي ملاحظات على الشفت..."
          value={notes}
          maxLength={1000}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      {live && (
        <div className="hidden">
          <ShiftReportDocument id={`x-report-${shift.id}`} shift={live} topProducts={[]} isCurrent />
        </div>
      )}
    </Modal>
  )
}

export function VarianceBadge({ label, variance }: { label: string; variance: number }) {
  const { t } = useI18n()
  const exact = Math.abs(variance) < 0.005
  return (
    <div className={`flex items-center gap-2 rounded-lg p-2.5 text-sm font-medium ${
      exact
        ? 'bg-success/10 text-success dark:bg-success/15 dark:text-success'
        : 'bg-danger/10 text-danger dark:bg-danger/15 dark:text-danger'
    }`}>
      {!exact && <AlertTriangle className="h-4 w-4 shrink-0" />}
      <span>
        {exact
          ? `${label} ${t.shiftGate.balanced}`
          : variance > 0
          ? `${t.shiftGate.surplus} ${label}: ${formatCurrency(variance)}`
          : `${t.shiftGate.deficit} ${label}: ${formatCurrency(Math.abs(variance))}`}
      </span>
    </div>
  )
}

function SummaryCard({ icon, label, value, loading }: { icon: React.ReactNode; label: string; value: string; loading?: boolean }) {
  return (
    <div className="rounded-lg bg-surface-2 p-3">
      <div className="mb-1 flex items-center gap-1.5 text-muted">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      {loading ? <div className="skeleton h-5 w-20" /> : <p className="font-semibold text-fg tabular-nums">{value}</p>}
    </div>
  )
}

// ── Shift Lock Screen ─────────────────────────────────────────────────────────

function ShiftLockScreen({ onOpen }: { onOpen: () => void }) {
  const { t } = useI18n()
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-surface-2">
        <Lock className="h-9 w-9 text-muted" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-fg">{t.shiftGate.locked}</h2>
        <p className="mt-1 text-sm text-muted">{t.shiftGate.startShiftToBegin}</p>
      </div>
      <Button onClick={onOpen} className="gap-2">
        <Unlock className="h-4 w-4" />
        {t.shiftGate.openShift}
      </Button>
    </div>
  )
}

// Shown instead of the lock screen when the shift could not be checked and none is known yet.
function ShiftUnavailable({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 p-8 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-warning/10">
        <WifiOff className="h-9 w-9 text-warning" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-fg">تعذّر التحقق من الشفت</h2>
        <p className="mt-1 text-sm text-muted">تحقق من الاتصال ثم أعد المحاولة.</p>
      </div>
      <Button onClick={onRetry} loading={retrying} className="gap-2">
        <RefreshCw className="h-4 w-4" />
        إعادة المحاولة
      </Button>
    </div>
  )
}

// ── Shift Badge (shown in POS header) ────────────────────────────────────────

export function ShiftBadge({ shift, onCloseShift }: { shift: ShiftResponse; onCloseShift: () => void }) {
  const { t, lang } = useI18n()
  const openedAt = new Date(shift.openedAt)
  const timeStr = openedAt.toLocaleTimeString(lang === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 rounded-lg bg-success/10 px-3 py-1.5 text-sm dark:bg-success/15">
        <div className="h-2 w-2 animate-pulse rounded-full bg-success" />
        <span className="font-medium text-success">{t.shiftGate.shiftOpen}</span>
        <span className="text-success/70">{t.shiftGate.openedAt} {timeStr}</span>
      </div>
      <Button size="sm" variant="danger" onClick={onCloseShift} className="gap-1">
        <Lock className="h-3.5 w-3.5" />
        {t.shiftGate.closeShift}
      </Button>
    </div>
  )
}

// ── Main ShiftGate Export ─────────────────────────────────────────────────────

// The last known shift per user and branch, so a dropped connection or a server error does not lock a till
// that has an open shift (sales keep going through the offline queue).
const shiftCacheKey = (tenantId: string | null, userId: string | undefined, branchId: string | null) =>
  `flowin:shift:${tenantId ?? ''}:${userId ?? ''}:${branchId ?? ''}`

function readCachedShift(key: string): ShiftResponse | null | undefined {
  try {
    const raw = localStorage.getItem(key)
    return raw == null ? undefined : (JSON.parse(raw) as ShiftResponse | null)
  } catch {
    return undefined
  }
}

function writeCachedShift(key: string, shift: ShiftResponse | null) {
  try { localStorage.setItem(key, JSON.stringify(shift)) } catch { /* storage unavailable */ }
}

export function useShift() {
  const { branchId, tenantId, user } = useAuthStore()
  const cacheKey = shiftCacheKey(tenantId, user?.id, branchId)

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['current-shift', branchId, user?.id],
    queryFn: async () => {
      const res = await shiftsApi.getCurrent(branchId!)
      // Only "204 No Content" means no open shift; any failure throws and the last known shift stays.
      const shift = res.status === 204 || !res.data ? null : res.data
      writeCachedShift(cacheKey, shift)
      return shift
    },
    initialData: () => readCachedShift(cacheKey),
    initialDataUpdatedAt: 0,
    enabled: !!branchId,
    staleTime: 30_000,
    retry: 1,
  })

  return { shift: data ?? null, isLoading, isError, isFetching, refetch }
}

/**
 * Wraps POS content: shows a lock screen when no shift is open.
 * Shift controls (badge + open/close modals) are managed externally via
 * useShift() + ShiftBadge + OpenShiftModal / CloseShiftModal exports.
 */
export function ShiftGate({
  children,
  onOpenShift,
}: {
  children: React.ReactNode
  onOpenShift: () => void
}) {
  const { shift, isLoading, isError, isFetching, refetch } = useShift()

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-brand" />
      </div>
    )
  }

  if (!shift) {
    return isError
      ? <ShiftUnavailable onRetry={() => void refetch()} retrying={isFetching} />
      : <ShiftLockScreen onOpen={onOpenShift} />
  }

  return (
    <>
      {isError && (
        <div role="status" className="flex shrink-0 items-center justify-between gap-3 border-b border-warning/30 bg-warning/10 px-4 py-2 text-xs text-warning">
          <span className="flex items-center gap-2">
            <WifiOff className="h-3.5 w-3.5 shrink-0" />
            تعذّر تحديث حالة الشفت، والبيع مستمر على آخر شفت معروف.
          </span>
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1 font-semibold hover:underline disabled:opacity-60"
          >
            <RefreshCw className={isFetching ? 'h-3.5 w-3.5 animate-spin motion-reduce:animate-none' : 'h-3.5 w-3.5'} />
            إعادة المحاولة
          </button>
        </div>
      )}
      {children}
    </>
  )
}
