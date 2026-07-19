import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { superAdminApi } from '@/api/superadmin'
import { toast } from '@/components/ui/Toast'

interface Props {
  tenantId: string
  tenantName: string
  tenantBusinessType?: string
  onClose: () => void
}

export function NewSubscriptionModal({ tenantId, tenantName, tenantBusinessType, onClose }: Props) {
  const qc = useQueryClient()
  const [planId, setPlanId] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [expiryDate, setExpiryDate] = useState(
    new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  )
  const [notes, setNotes] = useState('')

  const { data: plans = [] } = useQuery({
    queryKey: ['admin', 'plans'],
    queryFn: () => superAdminApi.listPlans().then((r) => r.data),
  })

  const mutation = useMutation({
    mutationFn: () =>
      superAdminApi.createSubscription(tenantId, {
        planId,
        startDate: new Date(startDate).toISOString(),
        expiryDate: new Date(expiryDate).toISOString(),
        notes: notes || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'tenants'] })
      qc.invalidateQueries({ queryKey: ['admin', 'tenant', tenantId] })
      toast.success('تم إنشاء الاشتراك بنجاح', '')
      onClose()
    },
    onError: () => {
      toast.error('فشل في إنشاء الاشتراك', 'الرجاء المحاولة مرة أخرى')
    },
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      dir="rtl"
    >
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-white">اشتراك جديد</h2>
            <p className="text-xs text-slate-400 mt-0.5">{tenantName}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <div className="space-y-4 p-6">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-300">
              خطة الاشتراك
            </label>
            <select
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="">-- اختر خطة --</option>
              {plans
                .filter((p) => p.isActive && (!tenantBusinessType || p.businessType === tenantBusinessType))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.price.toLocaleString('ar-SA')} ر.س / شهر
                  </option>
                ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-300">
                تاريخ البداية
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-300">
                تاريخ الانتهاء
              </label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-300">
              ملاحظات (اختياري)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="أي ملاحظات خاصة بهذا الاشتراك..."
              className="w-full resize-none rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 border-t border-slate-700 px-6 py-4">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors"
          >
            إلغاء
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!planId || mutation.isPending}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {mutation.isPending ? 'جاري الحفظ...' : 'حفظ الاشتراك'}
          </button>
        </div>
      </div>
    </div>
  )
}
