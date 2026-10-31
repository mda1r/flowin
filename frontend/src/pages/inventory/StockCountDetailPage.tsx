import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate, useBlocker } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Save, CheckCircle, AlertTriangle, ClipboardList, XCircle, Info } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { stockCountApi } from '@/api/stockCounts'
import { catalogApi } from '@/api/catalog'
import { useAuthStore } from '@/stores/authStore'
import { toast } from '@/components/ui/Toast'
import { logActivity } from '@/lib/activityLog'
import { apiErrorMessage } from '@/lib/apiError'
import { useI18n } from '@/i18n'
import { intlLocale } from '@/lib/locale'

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
  // Staff can enter counts; completing, auto-adjusting and cancelling are for owners and managers.
  const canManage = user?.role === 'Owner' || user?.role === 'Manager'
  const sessionKey = ['stock-count', branchId, sessionId]

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
  const [showCancel, setShowCancel] = useState(false)

  const { data: session, isLoading } = useQuery({
    queryKey: sessionKey,
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

  // The quantity on screen for an item: what was typed, otherwise what the server has.
  const effectiveCount = useCallback((stockItemId: string, saved: number | null) => {
    const raw = counts[stockItemId]
    if (raw === undefined || raw.trim() === '') return saved
    const n = Number(raw)
    return Number.isFinite(n) ? Math.max(0, n) : saved
  }, [counts])

  // Typed quantities that differ from the saved ones; only these are sent.
  const changedItems = useMemo(() => {
    if (!session || session.status !== 'InProgress') return []
    const changed: { stockItemId: string; countedQuantity: number }[] = []
    for (const item of session.items) {
      const value = effectiveCount(item.stockItemId, item.countedQuantity)
      if (value != null && value !== item.countedQuantity) {
        changed.push({ stockItemId: item.stockItemId, countedQuantity: value })
      }
    }
    return changed
  }, [session, effectiveCount])

  // Progress and discrepancies from the numbers on screen, not the last save.
  const localStats = useMemo(() => {
    const items = session?.items ?? []
    let counted = 0
    let discrepancies = 0
    for (const item of items) {
      const value = effectiveCount(item.stockItemId, item.countedQuantity)
      if (value == null) continue
      counted++
      if (value !== item.systemQuantity) discrepancies++
    }
    return { counted, discrepancies, uncounted: items.length - counted }
  }, [session, effectiveCount])

  const saveMutation = useMutation({
    mutationFn: () => stockCountApi.saveItems(branchId, sessionId, changedItems),
    onSuccess: res => {
      toast.success(t.stockCount.saveSuccess)
      queryClient.setQueryData(sessionKey, res.data)
    },
    onError: err => toast.error(apiErrorMessage(err, t.stockCount.saveFailed)),
  })

  const completeMutation = useMutation({
    // Save what is on screen first, so the count is completed (and stock adjusted) with it.
    mutationFn: async () => {
      if (changedItems.length > 0) {
        const saved = await stockCountApi.saveItems(branchId, sessionId, changedItems)
        queryClient.setQueryData(sessionKey, saved.data)
      }
      return stockCountApi.completeSession(branchId, sessionId, autoAdjust)
    },
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
      queryClient.setQueryData(sessionKey, res.data)
      queryClient.invalidateQueries({ queryKey: ['stock-counts', branchId] })
      if (autoAdjust) {
        queryClient.invalidateQueries({ queryKey: ['stock', branchId] })
        queryClient.invalidateQueries({ queryKey: ['inventory-alerts', branchId] })
      }
      setShowComplete(false)
    },
    onError: err => toast.error(apiErrorMessage(err, t.stockCount.completeFailed)),
  })

  const cancelMutation = useMutation({
    mutationFn: () => stockCountApi.cancelSession(branchId, sessionId),
    onSuccess: res => {
      logActivity(tenantId ?? '', {
        userId: user?.id ?? '',
        userName: `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(),
        userEmail: user?.email,
        category: 'stock-count',
        action: 'إلغاء الجرد',
        details: `جلسة ${sessionId.slice(0, 8)}`,
        branchId: branchId ?? undefined,
      })
      toast.success(t.stockCount.cancelSuccess)
      queryClient.setQueryData(sessionKey, res.data)
      queryClient.invalidateQueries({ queryKey: ['stock-counts', branchId] })
      setShowCancel(false)
    },
    onError: err => toast.error(apiErrorMessage(err, t.stockCount.cancelFailed)),
  })

  // Warn before leaving the page (in-app or closing the tab) while counts are unsaved.
  const isDirty = changedItems.length > 0 && !completeMutation.isPending && !cancelMutation.isPending
  const alwaysBlock = useCallback(() => true, [])
  const blocker = useBlocker({
    shouldBlockFn: alwaysBlock,
    enableBeforeUnload: true,
    disabled: !isDirty,
    withResolver: true,
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
    ? Math.round((localStats.counted / session.totalItems) * 100)
    : 0

  const locale = intlLocale(lang)

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
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

        <div className="flex flex-wrap items-center gap-2">
          {isActive && (
            <>
              {changedItems.length > 0 && (
                <span className="text-xs font-medium text-warning">
                  {t.stockCount.unsavedCount.replace('{n}', String(changedItems.length))}
                </span>
              )}
              <Button
                variant="secondary"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || changedItems.length === 0}
              >
                <Save className="h-4 w-4" />
                {saveMutation.isPending ? t.common.loading : t.stockCount.saveCounts}
              </Button>
              {canManage && (
                <>
                  <Button
                    variant="ghost"
                    onClick={() => setShowCancel(true)}
                    disabled={cancelMutation.isPending || completeMutation.isPending}
                  >
                    <XCircle className="h-4 w-4" />
                    {t.stockCount.cancelCount}
                  </Button>
                  <Button
                    onClick={() => setShowComplete(true)}
                    disabled={completeMutation.isPending || cancelMutation.isPending}
                  >
                    <CheckCircle className="h-4 w-4" />
                    {t.stockCount.complete}
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {isActive && !canManage && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-muted">
          <Info className="h-4 w-4 shrink-0 text-info" />
          {t.stockCount.managerOnly}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <SummaryCard
          label={t.stockCount.totalItems}
          value={String(session.totalItems)}
          sub={t.stockCount.product}
        />
        <SummaryCard
          label={t.stockCount.progress}
          value={`${localStats.counted} / ${session.totalItems}`}
          sub={`${progress}%`}
          accent
        />
        <SummaryCard
          label={t.stockCount.discrepancies}
          value={String(localStats.discrepancies)}
          sub={t.stockCount.discrepancies}
          warn={localStats.discrepancies > 0}
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
              const countedNum = effectiveCount(item.stockItemId, item.countedQuantity)
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
      <Modal open={showComplete && canManage} onClose={() => setShowComplete(false)} title={t.stockCount.complete}>
        <div className="flex flex-col gap-5" dir="rtl">
          <p className="text-sm text-fg">{t.stockCount.confirmComplete}</p>

          {(localStats.discrepancies > 0 || localStats.uncounted > 0) && (
            <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 p-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
              <div className="flex flex-col gap-1 text-sm text-warning">
                {localStats.discrepancies > 0 && (
                  <span>{t.stockCount.discrepancyWarning.replace('{n}', String(localStats.discrepancies))}</span>
                )}
                {localStats.uncounted > 0 && (
                  <span>{t.stockCount.uncountedWarning.replace('{n}', String(localStats.uncounted))}</span>
                )}
              </div>
            </div>
          )}

          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={autoAdjust}
              onChange={e => setAutoAdjust(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border accent-[rgb(var(--brand-ink))]"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm text-fg">{t.stockCount.autoAdjust}</span>
              <span className="text-xs text-muted">{t.stockCount.adjustHint}</span>
            </span>
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

      {/* Cancel modal */}
      <Modal open={showCancel && canManage} onClose={() => setShowCancel(false)} title={t.stockCount.cancelCount} size="sm">
        <div className="flex flex-col gap-5" dir="rtl">
          <p className="text-sm text-fg">{t.stockCount.confirmCancel}</p>
          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button variant="secondary" onClick={() => setShowCancel(false)}>{t.stockCount.keepCount}</Button>
            <Button
              variant="danger"
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? t.common.loading : t.stockCount.cancelCount}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Unsaved counts guard */}
      <Modal
        open={blocker.status === 'blocked'}
        onClose={() => blocker.reset?.()}
        title={t.stockCount.unsavedTitle}
        size="sm"
      >
        <div className="flex flex-col gap-5" dir="rtl">
          <p className="text-sm text-fg">{t.stockCount.unsavedMessage}</p>
          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button variant="secondary" onClick={() => blocker.reset?.()}>{t.stockCount.stay}</Button>
            <Button variant="danger" onClick={() => blocker.proceed?.()}>{t.stockCount.leaveWithoutSaving}</Button>
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
