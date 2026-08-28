import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { ClipboardList, Plus } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { stockCountApi } from '@/api/stockCounts'
import { inventoryApi } from '@/api/inventory'
import { catalogApi } from '@/api/catalog'
import { useAuthStore } from '@/stores/authStore'
import { toast } from '@/components/ui/Toast'
import { useI18n } from '@/i18n'
import type { StockCountType } from '@/types/api'

const STATUS_STYLES: Record<string, string> = {
  InProgress: 'bg-blue-50 text-blue-700',
  Completed: 'bg-emerald-50 text-emerald-700',
  Cancelled: 'bg-gray-100 text-gray-500',
}

const today = () => new Date().toISOString().slice(0, 10)

export function StockCountPage() {
  const navigate = useNavigate()
  const { branchId: branchIdRaw, tenantId } = useAuthStore()
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

  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    type: 'Monthly' as StockCountType,
    periodStart: today(),
    periodEnd: today(),
    notes: '',
  })

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['stock-counts', branchId],
    queryFn: () => stockCountApi.listSessions(branchId).then(r => r.data),
    enabled: !!branchId,
  })

  const { data: stockItems } = useQuery({
    queryKey: ['stock-items-all', branchId],
    queryFn: () => inventoryApi.listItems(branchId).then(r => r.data),
    enabled: showCreate && !!branchId,
  })

  const { data: products } = useQuery({
    queryKey: ['products-all'],
    queryFn: () => catalogApi.listProducts(tenantId!, { pageSize: 500 }).then(r => r.data),
    enabled: showCreate && !!tenantId,
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const variantCostMap = new Map<string, number>()
      for (const product of products ?? []) {
        for (const variant of product.variants) {
          variantCostMap.set(variant.id, variant.costPrice)
        }
      }

      const items = (stockItems ?? []).map(si => ({
        stockItemId: si.id,
        variantId: si.variantId,
        systemQuantity: si.quantity,
        unitCost: variantCostMap.get(si.variantId) ?? 0,
      }))

      return stockCountApi.createSession(branchId, {
        type: form.type,
        periodStart: form.periodStart + 'T00:00:00Z',
        periodEnd: form.periodEnd + 'T23:59:59Z',
        notes: form.notes.trim() || undefined,
        items,
      })
    },
    onSuccess: res => {
      toast.success(t.stockCount.createSuccess)
      queryClient.invalidateQueries({ queryKey: ['stock-counts', branchId] })
      setShowCreate(false)
      void navigate({ to: '/stock-counts/$sessionId', params: { sessionId: res.data.id } })
    },
    onError: () => toast.error(t.stockCount.createFailed),
  })

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={t.stockCount.title}
        description={t.stockCount.description}
        action={
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            {t.stockCount.newCount}
          </Button>
        }
      />

      {isLoading ? (
        <div className="py-16 text-center text-sm text-gray-400">{t.common.loading}</div>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-gray-400">
          <ClipboardList className="h-14 w-14 opacity-25" />
          <p className="text-base">{t.stockCount.noSessions}</p>
          <Button variant="secondary" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            {t.stockCount.startFirst}
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm" dir="rtl">
            <thead className="bg-gray-50">
              <tr>
                {[
                  t.stockCount.type,
                  t.stockCount.period,
                  t.stockCount.status,
                  t.stockCount.totalItems,
                  t.stockCount.discrepancies,
                  t.stockCount.systemValue,
                  t.common.date,
                ].map(h => (
                  <th key={h} className="px-4 py-3 text-right font-medium text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sessions.map(session => (
                <tr
                  key={session.id}
                  className="cursor-pointer transition-colors hover:bg-gray-50"
                  onClick={() => void navigate({ to: '/stock-counts/$sessionId', params: { sessionId: session.id } })}
                >
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {TYPE_LABELS[session.type] ?? session.type}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {new Date(session.periodStart).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US')}
                    {' – '}
                    {new Date(session.periodEnd).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US')}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[session.status] ?? ''}`}>
                      {STATUS_LABELS[session.status] ?? session.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 tabular-nums">
                    {session.countedItems} / {session.totalItems}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {session.discrepancyCount > 0
                      ? <span className="font-medium text-amber-600">{session.discrepancyCount}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 tabular-nums">
                    {session.totalSystemValue.toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-US', { minimumFractionDigits: 2 })} {t.common.sar}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {new Date(session.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title={t.stockCount.newCount}>
        <div className="flex flex-col gap-4" dir="rtl">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">{t.stockCount.type}</label>
            <div className="grid grid-cols-2 gap-2">
              {(['Daily', 'Monthly', 'Quarterly', 'TaxAudit'] as const).map(typeKey => (
                <button
                  key={typeKey}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, type: typeKey }))}
                  className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-all ${
                    form.type === typeKey
                      ? 'border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_8%,white)] text-[var(--accent)]'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {TYPE_LABELS[typeKey]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t.stockCount.periodFrom}</label>
              <Input
                type="date"
                value={form.periodStart}
                onChange={e => setForm(f => ({ ...f, periodStart: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t.stockCount.periodTo}</label>
              <Input
                type="date"
                value={form.periodEnd}
                onChange={e => setForm(f => ({ ...f, periodEnd: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t.stockCount.notes}</label>
            <Input
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="أي ملاحظات للجرد..."
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
            <Button variant="secondary" onClick={() => setShowCreate(false)}>{t.common.cancel}</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !form.periodStart || !form.periodEnd}
            >
              {createMutation.isPending ? t.common.loading : t.stockCount.newCount}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
