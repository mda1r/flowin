import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { toast } from '@/components/ui/Toast'
import { financeApi } from '@/api/finance'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useI18n } from '@/i18n'
import type { ExpenseResponse } from '@/types/api'
import { FIXED_CATEGORIES, monthRange, sameDayIn, shiftMonth } from './financeMath'

interface Props {
  open: boolean
  onClose: () => void
  branchId: string
  /** 'YYYY-MM' the copies are booked in; the source is the month before. */
  month: string
  monthLabel: (month: string) => string
  onDone: () => void
}

const dupKey = (e: Pick<ExpenseResponse, 'category' | 'description'>) =>
  `${e.category}|${e.description.trim().toLowerCase()}`

/** Last month's approved rent, wages, utilities… booked again for this month, approved, on the same day. */
export function CopyFixedModal({ open, onClose, branchId, month, monthLabel, onDone }: Props) {
  const { t } = useI18n()
  const source = shiftMonth(month, -1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['expenses', branchId, 'copy-fixed', month],
    queryFn: async () => {
      const src = monthRange(source)
      const dst = monthRange(month)
      const [previous, current] = await Promise.all([
        financeApi.listAllExpenses(branchId, { dateFrom: src.from, dateTo: src.to, status: 'Approved' }),
        financeApi.listAllExpenses(branchId, { dateFrom: dst.from, dateTo: dst.to }),
      ])
      const already = new Set(current.filter((e) => e.status !== 'Voided').map(dupKey))
      return previous
        .filter((e) => FIXED_CATEGORIES.includes(e.category))
        .sort((a, b) => a.expenseDate.localeCompare(b.expenseDate))
        .map((e) => ({ expense: e, date: sameDayIn(month, e.expenseDate), duplicate: already.has(dupKey(e)) }))
    },
    enabled: open,
    staleTime: 0,
  })

  const rows = useMemo(() => data ?? [], [data])

  // Tick everything that is not already in this month each time the list loads.
  useEffect(() => {
    setSelected(new Set(rows.filter((r) => !r.duplicate).map((r) => r.expense.id)))
  }, [rows])

  const chosen = rows.filter((r) => selected.has(r.expense.id))
  const total = chosen.reduce((s, r) => s + r.expense.amount, 0)

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const confirm = async () => {
    setSaving(true)
    let done = 0
    for (const { expense, date } of chosen) {
      try {
        await financeApi.createExpense(branchId, {
          category: expense.category,
          amount: expense.amount,
          description: expense.description,
          expenseDate: date,
          notes: expense.notes ?? undefined,
          approveNow: true,
        })
        done++
      } catch {
        // keep going; the count below says how many made it
      }
    }
    setSaving(false)
    if (done === chosen.length) toast.success(t.finance.copyDone.replace('{n}', String(done)))
    else toast.error(t.finance.copyPartial.replace('{n}', String(done)).replace('{total}', String(chosen.length)))
    onDone()
  }

  return (
    <Modal
      open={open}
      onClose={saving ? () => {} : onClose}
      title={t.finance.copyTitle}
      size="lg"
      footer={
        <>
          <Button variant="secondary" disabled={saving} onClick={onClose}>{t.common.cancel}</Button>
          <Button loading={saving} disabled={chosen.length === 0} onClick={confirm}>
            {t.finance.copyConfirm.replace('{n}', String(chosen.length))}
          </Button>
        </>
      }
    >
      <p className="mb-4 text-sm text-muted">
        {t.finance.copyHint.replace('{from}', monthLabel(source)).replace('{to}', monthLabel(month))}
      </p>
      {isLoading ? (
        <div className="space-y-2" aria-hidden>
          {[0, 1, 2].map((i) => <div key={i} className="skeleton h-12 rounded-lg" />)}
        </div>
      ) : isError ? (
        <p className="text-sm text-danger">{t.finance.copyLoadFailed}</p>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">{t.finance.copyNone}</p>
      ) : (
        <>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {rows.map(({ expense, date, duplicate }) => (
              <li key={expense.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5">
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0 rounded"
                    checked={selected.has(expense.id)}
                    onChange={() => toggle(expense.id)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-fg">{expense.description}</span>
                    <span className="block text-xs text-muted">
                      {t.finance.categoryNames[expense.category]} · {formatDate(date)}
                    </span>
                  </span>
                  {duplicate && <Badge variant="yellow">{t.finance.copyAlready}</Badge>}
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-fg">{formatCurrency(expense.amount)}</span>
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between px-3 text-sm">
            <span className="text-muted">{t.finance.total}</span>
            <span className="font-semibold tabular-nums text-fg">{formatCurrency(total)}</span>
          </div>
        </>
      )}
    </Modal>
  )
}
