import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Minus, Plus, RotateCw, Star } from 'lucide-react'
import { customersApi, type LoyaltyTransaction, type LoyaltyTransactionKind } from '@/api/customers'
import { Button } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import { useAuthStore } from '@/stores/authStore'
import { intlLocale } from '@/lib/locale'
import { useI18n } from '@/i18n'
import { apiErrorMessage } from '@/lib/apiError'
import { cn, formatDateTime } from '@/lib/utils'
import type { CustomerResponse } from '@/types/api'

interface CustomerLoyaltyCardProps {
  customer: CustomerResponse
  canManage: boolean
  onChanged: (customer: CustomerResponse) => void
}

// The customer's points balance with its ledger, and (for owners and managers) a manual adjustment that needs a reason.
export function CustomerLoyaltyCard({ customer, canManage, onChanged }: CustomerLoyaltyCardProps) {
  const { tenantId } = useAuthStore()
  const { t, lang } = useI18n()
  const qc = useQueryClient()
  const [points, setPoints] = useState('')
  const [reason, setReason] = useState('')

  const { data: history = [], isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['customers', tenantId, 'loyalty-history', customer.id],
    queryFn: () => customersApi.loyaltyHistory(tenantId!, customer.id),
    enabled: !!tenantId,
  })

  const adjust = useMutation({
    mutationFn: (direction: 'add' | 'remove') => {
      const data = { points: Number(points), reason: reason.trim() }
      return direction === 'add'
        ? customersApi.addLoyaltyPoints(tenantId!, customer.id, data)
        : customersApi.redeemLoyaltyPoints(tenantId!, customer.id, data)
    },
    onSuccess: ({ data }) => {
      qc.invalidateQueries({ queryKey: ['customers', tenantId] })
      setPoints('')
      setReason('')
      onChanged(data)
      toast.success(t.customers.pointsAdjusted)
    },
    onError: (err) => toast.error(apiErrorMessage(err)),
  })

  const amount = Number(points)
  const validAmount = Number.isInteger(amount) && amount > 0
  const submit = (direction: 'add' | 'remove') => {
    if (!validAmount) return
    if (!reason.trim()) {
      toast.error(t.customers.reasonRequired)
      return
    }
    adjust.mutate(direction)
  }

  const kindLabel: Record<LoyaltyTransactionKind, string> = {
    Earn: t.customers.kindEarn,
    Redeem: t.customers.kindRedeem,
    Adjust: t.customers.kindAdjust,
    Reverse: t.customers.kindReverse,
  }
  const locale = intlLocale(lang)

  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface-2/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-fg">{t.customers.pointsHistory}</p>
        <span className="flex items-center gap-1.5 text-sm font-semibold tabular-nums text-fg">
          <Star className="h-4 w-4 text-warning" />
          {customer.loyaltyPoints}
        </span>
      </div>

      {canManage && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              placeholder={t.customers.pointsAmount}
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              className="input w-28 text-sm"
              aria-label={t.customers.pointsAmount}
            />
            <input
              type="text"
              maxLength={256}
              placeholder={t.customers.reason}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="input min-w-0 flex-1 text-sm"
              aria-label={t.customers.reason}
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={!validAmount || adjust.isPending}
              onClick={() => submit('add')}
            >
              <Plus className="h-3.5 w-3.5" />
              {t.customers.addPoints}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={!validAmount || adjust.isPending || amount > customer.loyaltyPoints}
              onClick={() => submit('remove')}
            >
              <Minus className="h-3.5 w-3.5" />
              {t.customers.removePoints}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="h-10 animate-pulse rounded-lg bg-border" />
      ) : isError ? (
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 text-xs text-danger">{apiErrorMessage(error)}</p>
          <Button type="button" size="sm" variant="secondary" disabled={isFetching} onClick={() => refetch()}>
            <RotateCw className="h-3.5 w-3.5" />
            {t.customers.retryHistory}
          </Button>
        </div>
      ) : history.length === 0 ? (
        <p className="text-xs text-muted">{t.customers.noPointsHistory}</p>
      ) : (
        <ul className="max-h-48 divide-y divide-border overflow-y-auto">
          {history.map((row: LoyaltyTransaction) => (
            <li key={row.id} className="flex items-center justify-between gap-3 py-2 text-xs">
              <div className="min-w-0">
                <p className="font-medium text-fg">{kindLabel[row.kind] ?? row.kind}</p>
                <p className="truncate text-muted">
                  {formatDateTime(row.createdAt, locale)}
                  {row.kind !== 'Reverse' && row.reason ? ` · ${row.reason}` : ''}
                </p>
              </div>
              <span className={cn('shrink-0 font-semibold tabular-nums', row.delta > 0 ? 'text-success' : 'text-danger')} dir="ltr">
                {row.delta > 0 ? `+${row.delta}` : row.delta}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
