import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Banknote, CheckCircle2, CreditCard } from 'lucide-react'
import { gamingApi } from '@/api/gaming'
import { useAuthStore } from '@/stores/authStore'
import { toast } from '@/components/ui/Toast'
import { apiErrorMessage } from '@/lib/apiError'
import { formatCurrency } from '@/lib/utils'
import type { GameSessionBillResponse } from '@/types/api'

// Takes payment for an ended session; the server records it as a sale in the open shift and in ZATCA.
export function SessionPayButtons({ bill, onPaid }: { bill: GameSessionBillResponse; onPaid: (bill: GameSessionBillResponse) => void }) {
  const { branchId } = useAuthStore()
  const qc = useQueryClient()

  const pay = useMutation({
    mutationFn: (method: 'Cash' | 'Card') => gamingApi.paySession(branchId!, bill.sessionId, method),
    onSuccess: ({ data }) => {
      void qc.invalidateQueries({ queryKey: ['daily-close'] })
      toast.success('تم تسجيل الدفع', `${formatCurrency(data.totalAmount)} · ${data.paymentMethod === 'Card' ? 'بطاقة' : 'نقداً'} · أضيفت للشفت`)
      onPaid(data)
    },
    onError: (err) => toast.error('تعذّر تسجيل الدفع', `${apiErrorMessage(err)} · يمكنك المحاولة مرة أخرى`),
  })

  if (bill.paidAt) {
    return (
      <p className="flex items-center justify-center gap-2 rounded-xl bg-success/10 py-2.5 text-sm font-semibold text-success">
        <CheckCircle2 className="h-4 w-4" />
        مدفوعة · {bill.paymentMethod === 'Card' ? 'بطاقة' : 'نقداً'}
      </p>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        onClick={() => pay.mutate('Cash')}
        disabled={pay.isPending}
        className="flex items-center justify-center gap-2 rounded-xl bg-brand py-2.5 text-sm font-bold text-brand-fg transition-colors hover:bg-brand/90 disabled:opacity-50"
      >
        <Banknote className="h-4 w-4" />
        دفع نقداً
      </button>
      <button
        type="button"
        onClick={() => pay.mutate('Card')}
        disabled={pay.isPending}
        className="flex items-center justify-center gap-2 rounded-xl border border-brand py-2.5 text-sm font-bold text-brand transition-colors hover:bg-brand-soft disabled:opacity-50"
      >
        <CreditCard className="h-4 w-4" />
        دفع بطاقة
      </button>
    </div>
  )
}
