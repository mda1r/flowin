import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Gift, Search, UserRound, X } from 'lucide-react'
import { customersApi } from '@/api/customers'
import { useAuthStore } from '@/stores/authStore'
import { cn, formatCurrency } from '@/lib/utils'
import { pointsEarned, pointsValue } from '@/lib/loyalty'
import type { CustomerResponse, LoyaltySettings } from '@/types/api'

interface LoyaltyPanelProps {
  customer: CustomerResponse | null
  onCustomerChange: (customer: CustomerResponse | null) => void
  redeemPoints: number
  onRedeemPointsChange: (points: number) => void
  maxRedeemable: number
  payable: number
  rules: LoyaltySettings
}

export function LoyaltyPanel({
  customer,
  onCustomerChange,
  redeemPoints,
  onRedeemPointsChange,
  maxRedeemable,
  payable,
  rules,
}: LoyaltyPanelProps) {
  const { tenantId } = useAuthStore()
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(query.trim()), 250)
    return () => window.clearTimeout(id)
  }, [query])

  const { data, isFetching } = useQuery({
    queryKey: ['pos-customer-search', tenantId, debounced],
    queryFn: () => customersApi.list(tenantId!, { search: debounced, pageSize: 5 }),
    enabled: !!tenantId && !customer && debounced.length >= 2,
  })
  const results: CustomerResponse[] = data?.data ?? []

  if (!customer) {
    return (
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          className="input ps-9 text-sm"
          placeholder="عميل الولاء: ابحث بالاسم أو الجوال"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="بحث عن عميل"
        />
        {debounced.length >= 2 && (
          <ul className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-border bg-surface shadow-md">
            {isFetching && results.length === 0 ? (
              <li className="px-3 py-2 text-xs text-muted">جاري البحث…</li>
            ) : results.length === 0 ? (
              <li className="px-3 py-2 text-xs text-muted">لا يوجد عميل بهذا الاسم أو الرقم</li>
            ) : (
              results.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-start text-sm hover:bg-surface-2"
                    onClick={() => {
                      onCustomerChange(c)
                      onRedeemPointsChange(0)
                      setQuery('')
                    }}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-fg">{c.name}</span>
                      {c.phone && <span className="block text-xs text-muted" dir="ltr">{c.phone}</span>}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-brand">{c.loyaltyPoints.toLocaleString('ar-SA')} نقطة</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    )
  }

  const using = redeemPoints > 0
  return (
    <div className="space-y-2 rounded-xl border border-border bg-surface-2/60 p-3">
      <div className="flex items-center gap-2">
        <UserRound className="h-4 w-4 shrink-0 text-muted" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{customer.name}</span>
        {rules.enabled && (
          <span className="shrink-0 text-xs tabular-nums text-brand">{customer.loyaltyPoints.toLocaleString('ar-SA')} نقطة</span>
        )}
        <button
          type="button"
          onClick={() => {
            onCustomerChange(null)
            onRedeemPointsChange(0)
          }}
          className="rounded-md p-1 text-muted hover:bg-surface hover:text-fg"
          aria-label="إزالة العميل"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {maxRedeemable > 0 && (
        <button
          type="button"
          onClick={() => onRedeemPointsChange(using ? 0 : maxRedeemable)}
          aria-pressed={using}
          className={cn(
            'flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
            using ? 'border-brand bg-brand-soft text-brand' : 'border-border bg-surface text-fg hover:bg-surface-2',
          )}
        >
          <span className="flex items-center gap-2">
            <Gift className="h-4 w-4" />
            {using ? `استبدال ${redeemPoints.toLocaleString('ar-SA')} نقطة` : 'استبدال النقاط'}
          </span>
          <span className="tabular-nums">−{formatCurrency(pointsValue(using ? redeemPoints : maxRedeemable, rules))}</span>
        </button>
      )}

      {rules.enabled && maxRedeemable === 0 && customer.loyaltyPoints > 0 && customer.loyaltyPoints < rules.minRedeemPoints && (
        <p className="text-xs text-muted">
          يبدأ الاستبدال من <span className="tabular-nums text-fg">{rules.minRedeemPoints.toLocaleString('ar-SA')}</span> نقطة
        </p>
      )}

      {rules.enabled && (
        <p className="text-xs text-muted">
          سيكسب العميل <span className="tabular-nums text-fg">{pointsEarned(payable, rules).toLocaleString('ar-SA')}</span> نقطة من هذه الفاتورة
        </p>
      )}
    </div>
  )
}
