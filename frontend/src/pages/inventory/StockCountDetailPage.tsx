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

const TYPE_LABELS: Record<string, string> = {
  Daily: 'يومي',
  Monthly: 'شهري',
  Quarterly: 'ربع سنوي',
  TaxAudit: 'تدقيق ضريبي',
}

const STATUS_STYLES: Record<string, string> = {
  InProgress: 'bg-blue-50 text-blue-700 border-blue-200',
  Completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
}

const STATUS_LABELS: Record<string, string> = {
  InProgress: 'قيد التنفيذ',
  Completed: 'مكتمل',
  Cancelled: 'ملغي',
}

export function StockCountDetailPage() {
  const { sessionId } = useParams({ strict: false }) as { sessionId: string }
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const branchId = user?.branchId ?? ''
  const queryClient = useQueryClient()

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
    queryFn: () => catalogApi.listProducts({ pageSize: 500 }).then(r => r.data),
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
      toast.success('تم حفظ الكميات')
      queryClient.setQueryData(['stock-count', branchId, sessionId], res.data)
    },
    onError: () => toast.error('فشل حفظ الكميات'),
  })

  const completeMutation = useMutation({
    mutationFn: () => stockCountApi.completeSession(branchId, sessionId, autoAdjust),
    onSuccess: res => {
      logActivity({
        userId: user?.id ?? '',
        userName: `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(),
        userEmail: user?.email,
        category: 'stock-count',
        action: 'إتمام الجرد',
        details: `جلسة ${sessionId.slice(0, 8)} · ${autoAdjust ? 'مع تعديل تلقائي للمخزون' : 'بدون تعديل تلقائي'}`,
        branchId: branchId ?? undefined,
      })
      toast.success('تم إتمام الجرد')
      queryClient.setQueryData(['stock-count', branchId, sessionId], res.data)
      queryClient.invalidateQueries({ queryKey: ['stock-counts', branchId] })
      setShowComplete(false)
    },
    onError: () => toast.error('فشل إتمام الجرد'),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-gray-400">
        جاري التحميل...
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-gray-400">
        <ClipboardList className="h-12 w-12 opacity-25" />
        <p>لم يتم العثور على الجرد</p>
        <Button variant="secondary" onClick={() => void navigate({ to: '/stock-counts' })}>العودة</Button>
      </div>
    )
  }

  const isActive = session.status === 'InProgress'
  const progress = session.totalItems > 0
    ? Math.round((session.countedItems / session.totalItems) * 100)
    : 0

  return (
    <div className="flex flex-col gap-6 p-6" dir="rtl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => void navigate({ to: '/stock-counts' })}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ArrowRight className="h-4 w-4 rotate-180" />
            الجرد
          </button>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-medium text-gray-800">{TYPE_LABELS[session.type] ?? session.type}</span>
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
                {saveMutation.isPending ? 'جاري الحفظ...' : 'حفظ الكميات'}
              </Button>
              <Button
                onClick={() => setShowComplete(true)}
                disabled={completeMutation.isPending}
              >
                <CheckCircle className="h-4 w-4" />
                إتمام الجرد
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <SummaryCard
          label="إجمالي العناصر"
          value={String(session.totalItems)}
          sub="منتج"
        />
        <SummaryCard
          label="التقدم"
          value={`${session.countedItems} / ${session.totalItems}`}
          sub={`${progress}%`}
          accent
        />
        <SummaryCard
          label="الفروقات"
          value={String(session.discrepancyCount)}
          sub="فرق في الكمية"
          warn={session.discrepancyCount > 0}
        />
        <SummaryCard
          label="قيمة النظام"
          value={`${session.totalSystemValue.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س`}
          sub={session.status === 'Completed'
            ? `مجود: ${session.totalCountedValue.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س`
            : undefined}
        />
      </div>

      {/* Progress bar */}
      <div>
        <div className="mb-1 flex justify-between text-xs text-gray-500">
          <span>تقدم الجرد</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Items table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-right font-medium text-gray-600">المنتج</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">SKU</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600 tabular-nums">كمية النظام</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">الكمية المجودة</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600 tabular-nums">الفرق</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600 tabular-nums">سعر الوحدة</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600 tabular-nums">القيمة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
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
                  className={hasDiscrepancy ? 'bg-amber-50/60' : ''}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{info?.productName ?? '—'}</div>
                    <div className="text-xs text-gray-400">{info?.variantName ?? ''}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 tabular-nums">{info?.sku ?? '—'}</td>
                  <td className="px-4 py-3 tabular-nums text-gray-700">{item.systemQuantity}</td>
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
                          focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)]
                          ${isCounted ? 'border-gray-300' : 'border-dashed border-gray-300 bg-gray-50'}
                          ${hasDiscrepancy ? 'border-amber-400 bg-amber-50' : ''}`}
                      />
                    ) : (
                      <span className="tabular-nums text-gray-700">
                        {item.countedQuantity ?? <span className="text-gray-300">—</span>}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {diff != null ? (
                      <span className={
                        diff > 0 ? 'text-emerald-600 font-medium' :
                        diff < 0 ? 'text-red-600 font-medium' :
                        'text-gray-400'
                      }>
                        {diff > 0 ? '+' : ''}{diff.toFixed(3)}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-gray-600">
                    {item.unitCost.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-gray-600">
                    {item.systemValue.toLocaleString('ar-SA', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Tax audit summary (visible when type = TaxAudit) */}
      {session.type === 'TaxAudit' && session.status === 'Completed' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h3 className="mb-3 font-semibold text-amber-900">ملخص التدقيق الضريبي</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-amber-700">قيمة المخزون المجود</div>
              <div className="mt-1 text-xl font-bold text-amber-900 tabular-nums">
                {session.totalCountedValue.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س
              </div>
            </div>
            <div>
              <div className="text-amber-700">ضريبة القيمة المضافة (15%)</div>
              <div className="mt-1 text-xl font-bold text-amber-900 tabular-nums">
                {session.totalTaxAmount.toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س
              </div>
            </div>
            <div>
              <div className="text-amber-700">الإجمالي شامل الضريبة</div>
              <div className="mt-1 text-xl font-bold text-amber-900 tabular-nums">
                {(session.totalCountedValue + session.totalTaxAmount).toLocaleString('ar-SA', { minimumFractionDigits: 2 })} ر.س
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Complete modal */}
      <Modal open={showComplete} onClose={() => setShowComplete(false)} title="إتمام الجرد">
        <div className="flex flex-col gap-5" dir="rtl">
          {session.discrepancyCount > 0 && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
              <div className="text-sm text-amber-800">
                يوجد <strong>{session.discrepancyCount}</strong> فرق في الكميات. هل تريد ضبط المخزون تلقائياً؟
              </div>
            </div>
          )}

          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={autoAdjust}
              onChange={e => setAutoAdjust(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 accent-[var(--accent)]"
            />
            <span className="text-sm text-gray-700">ضبط المخزون تلقائياً وفق الكميات المجودة</span>
          </label>

          <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
            <Button variant="secondary" onClick={() => setShowComplete(false)}>إلغاء</Button>
            <Button
              onClick={() => completeMutation.mutate()}
              disabled={completeMutation.isPending}
            >
              {completeMutation.isPending ? 'جاري الإتمام...' : 'إتمام الجرد'}
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
      warn ? 'border-amber-200 bg-amber-50' :
      'border-gray-200 bg-white'
    }`}>
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`mt-1 text-xl font-bold tabular-nums ${
        accent ? 'text-[var(--accent)]' :
        warn ? 'text-amber-700' :
        'text-gray-900'
      }`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-gray-400">{sub}</div>}
    </div>
  )
}
