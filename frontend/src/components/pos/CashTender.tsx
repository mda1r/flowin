import { cn, formatCurrency } from '@/lib/utils'

const NOTES = [50, 100, 200, 500]

// Up to four likely amounts a customer hands over: the bill rounded up to common steps, then Saudi notes.
export function suggestedCashAmounts(total: number): number[] {
  if (total <= 0) return []
  const roundedUp = [5, 10, 50, 100, 500].map((step) => Math.ceil(total / step) * step)
  const candidates = [...roundedUp, ...NOTES, Math.ceil(total / 500) * 500 + 500]
  return [...new Set(candidates)].filter((v) => v > total + 0.001).sort((a, b) => a - b).slice(0, 4)
}

interface CashTenderProps {
  total: number
  value: string
  onChange: (value: string) => void
  autoFocus?: boolean
  compact?: boolean
}

export function CashTender({ total, value, onChange, autoFocus, compact }: CashTenderProps) {
  const tendered = parseFloat(value)
  const hasValue = value !== '' && !Number.isNaN(tendered)
  const change = hasValue ? Math.round((tendered - total) * 100) / 100 : 0
  const exact = total.toFixed(2)

  return (
    <div className="space-y-2">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-fg">المبلغ المستلم</span>
        <input
          type="number"
          inputMode="decimal"
          min={total}
          step="0.01"
          placeholder={exact}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input-3d w-full tabular-nums"
          autoFocus={autoFocus}
        />
      </label>

      <div className={cn('grid gap-1.5', compact ? 'grid-cols-3' : 'grid-cols-5')}>
        <button
          type="button"
          onClick={() => onChange(exact)}
          className={cn(
            'rounded-lg border px-2 py-2 text-xs font-semibold transition-colors',
            value === exact ? 'border-brand bg-brand-soft text-brand' : 'border-border bg-surface text-fg hover:bg-surface-2',
          )}
        >
          بالضبط
        </button>
        {suggestedCashAmounts(total).map((amount) => (
          <button
            key={amount}
            type="button"
            onClick={() => onChange(String(amount))}
            className={cn(
              'rounded-lg border px-2 py-2 text-sm font-semibold tabular-nums transition-colors',
              hasValue && tendered === amount ? 'border-brand bg-brand-soft text-brand' : 'border-border bg-surface text-fg hover:bg-surface-2',
            )}
          >
            {amount}
          </button>
        ))}
      </div>

      {hasValue && (
        change >= 0 ? (
          <div className="flex items-baseline justify-between rounded-xl bg-success/10 px-4 py-2.5" aria-live="polite">
            <span className="text-sm font-medium text-success">الباقي للعميل</span>
            <span className="text-2xl font-bold tabular-nums text-success">{formatCurrency(change)}</span>
          </div>
        ) : (
          <div role="alert" className="flex items-baseline justify-between rounded-xl bg-danger/10 px-4 py-2.5">
            <span className="text-sm font-medium text-danger">المبلغ ناقص</span>
            <span className="text-xl font-bold tabular-nums text-danger">{formatCurrency(-change)}</span>
          </div>
        )
      )}
    </div>
  )
}
