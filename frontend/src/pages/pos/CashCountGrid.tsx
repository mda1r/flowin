import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/Input'
import { cn, formatCurrency } from '@/lib/utils'
import { intlLocale } from '@/lib/locale'

// Saudi riyal notes and coins a cashier counts by; halalas go in one amount.
const DENOMINATIONS = [500, 200, 100, 50, 10, 5, 1] as const

export type CashCount = { pieces: Record<number, string>; halalas: string }

export const emptyCashCount = (): CashCount => ({ pieces: {}, halalas: '' })

const pieces = (v: string | undefined) => Math.max(0, Math.floor(Number(v) || 0))

export function cashCountTotal(c: CashCount) {
  const notes = DENOMINATIONS.reduce((s, d) => s + d * pieces(c.pieces[d]), 0)
  return Math.round((notes + Math.max(0, Number(c.halalas) || 0)) * 100) / 100
}

/** Count the drawer by note and coin; the total adds up as the cashier types. */
export function CashCountGrid({ value, onChange }: { value: CashCount; onChange: (next: CashCount) => void }) {
  const setPieces = (d: number, v: string) => onChange({ ...value, pieces: { ...value.pieces, [d]: v.replace(/[^\d]/g, '') } })
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {DENOMINATIONS.map((d) => {
          const count = pieces(value.pieces[d])
          return (
            <label key={d} className="rounded-lg bg-surface-2 px-2.5 py-2">
              <span className="flex items-baseline justify-between gap-1 text-xs text-muted">
                <span className="font-semibold text-fg tabular-nums">{d.toLocaleString(intlLocale())} ر.س</span>
                {count > 0 && <span className="tabular-nums">{formatCurrency(d * count)}</span>}
              </span>
              <input
                type="text"
                inputMode="numeric"
                className="input mt-1 h-8 w-full text-center tabular-nums"
                placeholder="0"
                value={value.pieces[d] ?? ''}
                onChange={(e) => setPieces(d, e.target.value)}
                aria-label={`عدد فئة ${d} ريال`}
              />
            </label>
          )
        })}
        <label className="rounded-lg bg-surface-2 px-2.5 py-2">
          <span className="text-xs font-semibold text-fg">هللات (ر.س)</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            className="input mt-1 h-8 w-full text-center tabular-nums"
            placeholder="0.00"
            value={value.halalas}
            onChange={(e) => onChange({ ...value, halalas: e.target.value })}
            aria-label="مجموع الهللات بالريال"
          />
        </label>
      </div>
      <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
        <span className="text-muted">مجموع العدّ</span>
        <span className="font-bold tabular-nums text-fg">{formatCurrency(cashCountTotal(value))}</span>
      </div>
    </div>
  )
}

/**
 * The counted-cash input: by note and coin (default) or one typed total. Reports the amount, or null
 * while nothing has been entered; a typed total may be negative, so the caller can refuse it.
 */
export function CashCountField({ label, onChange, autoFocus }: { label: string; onChange: (amount: number | null) => void; autoFocus?: boolean }) {
  const [mode, setMode] = useState<'grid' | 'total'>('grid')
  const [count, setCount] = useState(emptyCashCount)
  const [total, setTotal] = useState('')
  const report = useRef(onChange)
  report.current = onChange

  const entered = mode === 'grid'
    ? Object.values(count.pieces).some((v) => v !== '') || count.halalas !== ''
    : total.trim() !== ''
  const amount = mode === 'grid' ? cashCountTotal(count) : Number(total) || 0
  useEffect(() => { report.current(entered ? amount : null) }, [entered, amount])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-fg">{label}</span>
        <div className="flex gap-1 rounded-lg bg-surface-2 p-0.5 text-xs" role="tablist" aria-label="طريقة العدّ">
          {([['grid', 'بالفئات'], ['total', 'المجموع']] as const).map(([k, text]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={mode === k}
              onClick={() => setMode(k)}
              className={cn('rounded-md px-2.5 py-1 font-medium transition-colors', mode === k ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg')}
            >
              {text}
            </button>
          ))}
        </div>
      </div>
      {mode === 'grid' ? (
        <CashCountGrid value={count} onChange={setCount} />
      ) : (
        <Input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          placeholder="0.00"
          value={total}
          onChange={(e) => setTotal(e.target.value)}
          error={Number(total) < 0 ? 'المبلغ لا يمكن أن يكون سالباً' : undefined}
          aria-label={label}
          autoFocus={autoFocus}
        />
      )}
    </div>
  )
}
