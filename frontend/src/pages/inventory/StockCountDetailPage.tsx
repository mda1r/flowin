import { useState, useEffect } from 'react'
import { useParams, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Save, CheckCircle, AlertTriangle, ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { stockCountApi } from '@/api/stockCounts'
import { catalogApi } from '@/api/catalog'
import { useAuthStore } from '@/stores/authStore'
import { toast } from '@/components/ui/Toast'
import { logActivity } from '@/lib/activityLog'
import { useI18n } from '@/i18n'

const STATUS_STYLES: Record<string, string> = {
  InProgress: 'bg-info/10 text-info border-info/30',
  Completed: 'bg-success/10 text-success border-success/30',
  Cancelled: 'bg-surface-2 text-muted border-border',
}

export function StockCountDetailPage() {
  const { sessionId } = useParams({ strict: false }) as { sessionId: string }
  const navigate = useNavigate()
  const { user, tenantId, branchId: branchIdRaw } = useAuthStore()
  const branchId = branchIdRaw ?? ''
  const queryClient = useQueryClient()
  const { t, lang } = useI18n()

  const TYPE_LABELS: Record<string, string> = {
    Daily: t.stockCount.daily,
    Monthly: t.stockCount.monthly,
    Quarterly: t.stockCount.quarterly,
    TaxAudit: t.stockCount.taxAudit,
  }

  const STATUS_LABELS: Record<string, string> = {
    InProgress: t.stockCount.inProgress,
    Completed: t.stockCount.completed,
    Cancelled: t.stockCount.cancelled,
  }

  const [counts, setCounts] = useState<Record<string, string>>({})
  const [showComplete, setShowComplete] = useState(false)
  const [autoAdjust, setAutoAdjust] = useState(false)

  const { data: session, isLoading } = useQuery({
    queryKey: ['stock-count', branchId, sessionId],
    queryFn: () => stockCountApi.getSession(branchId, sessionId).then(r => r.data),
    enabled: !!branchId && !!sessionId,
  })

  const { data: products = [] } = useQuery({
    queryKey: ['products-all'],
    queryFn: () => catalogApi.listProducts(tenantId!, { pageSize: 500 }).then(r => r.data),
    enabled: !!tenantId,
  })

  // Build variant lookup map: variantId → { productName, variantName, sku }
  const variantMap = new Map<string, { productName: string; variantName: string; sku: string }>()
  for (const product of products) {
    for (const variant of product.variants) {
      variantMap.set(variant.id, {
        productName: product.name,
        variantName: variant.name,
        sku: variant.sku,
      })
    }
  }

  // Initialise local counts from session data when session loads
  useEffect(() => {
    if (!session) return
    const initial: Record<string, string> = {}
    for (const item of session.items) {
      if (item.countedQuantity != null) {
        initial[item.stockItemId] = String(item.countedQuantity)
      }
    }
    setCounts(initial)
  }, [session?.id])

  const saveMutation = useMutation({
    mutationFn: () => {
      const items = Object.entries(counts)
        .filter(([, v]) => v.trim() !== '')
        .map(([stockItemId, v]) => ({
          stockItemId,
          countedQuantity: Number(v),
        }))
      return stockCountApi.saveItems(branchId, sessionId, items)
    },
    onSuccess: res => {
      toast.success(t.stockCount.saveSuccess)
      queryClient.setQueryData(['stock-count', branchId, sessionId], res.data)
    },
    onError: () => toast.error(t.stockCount.saveFailed),
  })

  const completeMutation = useMutation({
    mutationFn: () => stockCountApi.completeSession(branchId, sessionId, autoAdjust),
    onSuccess: res => {
      logActivity(tenantId ?? '', {
        userId: user?.id ?? '',
        userName: `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(),
        userEmail: user?.email,
        category: 'stock-count',
        action: 'إتمام الجرد',
        details: `جلسة ${sessionId.slice(0, 8)} · ${autoAdjust ? 'مع تعديل تلقائي للمخزون' : 'بدون تعديل تلقائي'}`,
        branchId: branchId ?? undefined,
      })
      toast.success(t.stockCount.completeSuccess)
      queryClient.setQueryData(['stock-count', branchId, sessionId], res.data)
      queryClient.invalidateQueries({ queryKey: ['stock-counts', branchId] })
      setShowComplete(false)
    },
    onError: () => toast.error(t.stockCount.completeFailed),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-muted">
        {t.common.loading}
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-muted">
        <ClipboardList className="h-12 w-12 opacity-25" />
        <p>{t.common.noData}</p>
        <Button variant="secondary" onClick={() => void navigate({ to: '/stock-counts' })}>{t.stockCount.backToList}</Button>
      </div>
    )
  }

  const isActive = session.status === 'InProgress'
  const progress = session.totalItems > 0
    ? Math.round((session.countedItems / session.totalItems) * 100)
    : 0

  const locale = lang === 'ar' ? 'ar-SA' : 'en-US'

  return (
    <div className="flex flex-col gap-6 p-6" dir="rtl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => void navigate({ to: '/stock-counts' })}
            className="flex items-center gap-1.5 text-sm text-muted hover:text-fg transition-colors"
          >
            <ArrowRight className="h-4 w-4 rotate-180" />
            {t.stockCount.title}
          </button>
          <span className="text-muted/50">/</span>
          <span className="text-sm font-medium text-fg">{TYPE_LABELS[session.type] ?? session.type}</span>
          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[session.status] ?? ''}`}>
            {STATUS_LABELS[session.status] ?? session.status}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isActive && (
            <>
              <Button
                variant="secondary"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
              >
                <Save className="h-4 w-4" />
                {saveMutation.isPending ? t.common.loading : t.stockCount.saveCounts}
              </Button>
              <Button
                onClick={() => setShowComplete(true)}
                disabled={completeMutation.isPending}
              >
                <CheckCircle className="h-4 w-4" />
                {t.stockCount.complete}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <SummaryCard
          label={t.stockCount.totalItems}
          value={String(session.totalItems)}
          sub={t.stockCount.product}
        />
        <SummaryCard
          label={t.stockCount.progress}
          value={`${session.countedItems} / ${session.totalItems}`}
          sub={`${progress}%`}
          accent
        />
        <SummaryCard
          label={t.stockCount.discrepancies}
          value={String(session.discrepancyCount)}
          sub={t.stockCount.discrepancies}
          warn={session.discrepancyCount > 0}
        />
        <SummaryCard
          label={t.stockCount.systemValue}
          value={`${session.totalSystemValue.toLocaleString(locale, { minimumFractionDigits: 2 })} ${t.common.sar}`}
          sub={session.status === 'Completed'
            ? `${t.stockCount.countedValue}: ${session.totalCountedValue.toLocaleString(locale, { minimumFractionDigits: 2 })} ${t.common.sar}`
            : undefined}
        />
      </div>

      {/* Progress bar */}
      <div>
        <div className="mb-1 flex justify-between text-xs text-muted">
          <span>{t.stockCount.progress}</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-brand transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Items table */}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-surface-2">
            <tr>
              <th className="px-4 py-3 text-right font-medium text-muted">{t.stockCount.product}</th>
              <th className="px-4 py-3 text-right font-medium text-muted">SKU</th>
              <th className="px-4 py-3 text-right font-medium text-muted tabular-nums">{t.stockCount.systemQty}</th>
              <th className="px-4 py-3 text-right font-medium text-muted">{t.stockCount.countedQty}</th>
              <th className="px-4 py-3 text-right font-medium text-muted tabular-nums">{t.stockCount.difference}</th>
              <th className="px-4 py-3 text-right font-medium text-muted tabular-nums">{t.stockCount.unitCost}</th>
              <th className="px-4 py-3 text-right font-medium text-muted tabular-nums">{t.stockCount.value}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {session.items.map(item => {
              const info = variantMap.get(item.variantId)
              const rawVal = counts[item.stockItemId]
              const countedNum = rawVal !== undefined && rawVal.trim() !== '' ? Number(rawVal) : item.countedQuantity
              const diff = countedNum != null ? countedNum - item.systemQuantity : null
              const hasDiscrepancy = diff != null && diff !== 0
              const isCounted = rawVal !== undefined || item.countedQuantity != null

              return (
                <tr
                  key={item.id}
                  className={hasDiscrepancy ? 'bg-warning/10' : ''}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-fg">{info?.productName ?? '—'}</div>
                    <div className="text-xs text-muted">{info?.variantName ?? ''}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted tabular-nums">{info?.sku ?? '—'}</td>
                  <td className="px-4 py-3 tabular-nums text-fg">{item.systemQuantity}</td>
                  <td className="px-4 py-3">
                    {isActive ? (
                      <input
                        type="number"
                        min={0}
                        step="0.001"
                        value={rawVal ?? (item.countedQuantity != null ? String(item.countedQuantity) : '')}
                        onChange={e => setCounts(prev => ({ ...prev, [item.stockItemId]: e.target.value }))}
                        placeholder="أدخل الكمية"
                        className={`w-28 rounded-lg border px-2.5 py-1.5 text-sm tabular-nums outline-none transition-all
                          focus:ring-2 focus:ring-brand/20 focus:border-brand
                          ${isCounted ? 'border-border' : 'border-dashed border-border bg-surface-2'}
                          ${hasDiscrepancy ? 'border-warning bg-warning/10' : ''}`}
                      />
                    ) : (
                      <span className="tabular-nums text-fg">
                        {item.countedQuantity ?? <span className="text-muted/50">—</span>}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {diff != null ? (
                      <span className={
                        diff > 0 ? 'text-success font-medium' :
                        diff < 0 ? 'text-danger font-medium' :
                        'text-muted'
                      }>
                        {diff > 0 ? '+' : ''}{diff.toFixed(3)}
                      </span>
                    ) : (
                      <span className="text-muted/50">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-muted">
                    {item.unitCost.toLocaleString(locale, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-muted">
                    {item.systemValue.toLocaleString(locale, { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Tax audit summary (visible when type = TaxAudit) */}
      {session.type === 'TaxAudit' && session.status === 'Completed' && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-5">
          <h3 className="mb-3 font-semibold text-warning">ملخص التدقيق الضريبي</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-warning">{t.stockCount.countedValue}</div>
              <div className="mt-1 text-xl font-bold text-warning tabular-nums">
                {session.totalCountedValue.toLocaleString(locale, { minimumFractionDigits: 2 })} {t.common.sar}
              </div>
            </div>
            <div>
              <div className="text-warning">{t.stockCount.taxAmount}</div>
              <div className="mt-1 text-xl font-bold text-warning tabular-nums">
                {session.totalTaxAmount.toLocaleString(locale, { minimumFractionDigits: 2 })} {t.common.sar}
              </div>
            </div>
            <div>
              <div className="text-warning">الإجمالي شامل الضريبة</div>
              <div className="mt-1 text-xl font-bold text-warning tabular-nums">
                {(session.totalCountedValue + session.totalTaxAmount).toLocaleString(locale, { minimumFractionDigits: 2 })} {t.common.sar}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Complete modal */}
      <Modal open={showComplete} onClose={() => setShowComplete(false)} title={t.stockCount.complete}>
        <div className="flex flex-col gap-5" dir="rtl">
          {session.discrepancyCount > 0 && (
            <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 p-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
              <div className="text-sm text-warning">
                {t.stockCount.confirmComplete}
              </div>
            </div>
          )}

          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={autoAdjust}
              onChange={e => setAutoAdjust(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-[rgb(var(--brand-ink))]"
            />
            <span className="text-sm text-fg">{t.stockCount.autoAdjust}</span>
          </label>

          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button variant="secondary" onClick={() => setShowComplete(false)}>{t.common.cancel}</Button>
            <Button
              onClick={() => completeMutation.mutate()}
              disabled={completeMutation.isPending}
            >
              {completeMutation.isPending ? t.common.loading : t.stockCount.complete}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  sub,
  accent,
  warn,
}: {
  label: string
  value: string
  sub?: string
  accent?: boolean
  warn?: boolean
}) {
  return (
    <div className={`rounded-xl border p-4 ${
      accent ? 'border-[color-mix(in_srgb,var(--accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--accent)_5%,white)]' :
      warn ? 'border-warning/30 bg-warning/10' :
      'border-border bg-surface'
    }`}>
      <div className="text-xs text-muted">{label}</div>
      <div className={`mt-1 text-xl font-bold tabular-nums ${
        accent ? 'text-brand-ink' :
        warn ? 'text-warning' :
        'text-fg'
      }`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  )
}
