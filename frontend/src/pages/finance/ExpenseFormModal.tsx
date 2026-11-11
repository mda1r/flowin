import { useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { toast } from '@/components/ui/Toast'
import { financeApi } from '@/api/finance'
import { apiErrorMessage } from '@/lib/apiError'
import { localYmd } from '@/lib/dates'
import { useI18n } from '@/i18n'
import type { ExpenseCategory, ExpenseResponse } from '@/types/api'

// Every server ExpenseCategory, most used first.
export const EXPENSE_CATEGORIES = [
  'Rent', 'Wages', 'Utilities', 'Supplies', 'GovernmentFees', 'Subscriptions', 'DeliveryCommissions',
  'BankFees', 'Maintenance', 'Marketing', 'Equipment', 'Insurance', 'Transport', 'Other',
] as const satisfies readonly ExpenseCategory[]

const schema = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
  amount: z.coerce.number().positive(),
  description: z.string().trim().min(1).max(512),
  // No future dates: the expense would land in a month that is not shown yet.
  expenseDate: z.string().min(1).refine((d) => d <= localYmd(), 'future'),
  notes: z.string().max(1024).optional(),
  approveNow: z.boolean(),
})

type FormData = z.infer<typeof schema>

interface Props {
  open: boolean
  onClose: () => void
  branchId: string
  /** Edit this pending expense; create a new one when absent. */
  expense?: ExpenseResponse | null
  /** May approve (Owner/Manager/Accountant): offers "approve now", on by default. */
  canApprove: boolean
  defaultDate: string
  onSaved: (expense: ExpenseResponse) => void
}

export function ExpenseFormModal({ open, onClose, branchId, expense, canApprove, defaultDate, onSaved }: Props) {
  const { t } = useI18n()
  const editing = !!expense

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  // Fresh values every time the dialog opens.
  useEffect(() => {
    if (!open) return
    reset(expense
      ? {
          category: expense.category,
          amount: expense.amount,
          description: expense.description,
          expenseDate: expense.expenseDate,
          notes: expense.notes ?? '',
          approveNow: false,
        }
      : { category: 'Rent', description: '', expenseDate: defaultDate || localYmd(), notes: '', approveNow: canApprove })
  }, [open, expense, canApprove, defaultDate, reset])

  const save = useMutation({
    mutationFn: async ({ approveNow, notes, ...data }: FormData) => {
      const body = { ...data, notes: notes?.trim() || undefined }
      const res = expense
        ? await financeApi.updateExpense(branchId, expense.id, body)
        : await financeApi.createExpense(branchId, { ...body, approveNow: canApprove && approveNow })
      return res.data
    },
    onSuccess: (saved) => {
      toast.success(editing ? t.finance.updated : saved.status === 'Approved' ? t.finance.savedApproved : t.finance.savedPending)
      onSaved(saved)
    },
    onError: (err) => toast.error(apiErrorMessage(err, t.finance.failed)),
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? t.finance.editExpense : t.finance.newExpense}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t.common.cancel}</Button>
          <Button loading={save.isPending} onClick={handleSubmit((d) => save.mutate(d))}>
            {t.common.save}
          </Button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit((d) => save.mutate(d))}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label={`${t.finance.amount} (${t.common.sar})`}
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            error={errors.amount && t.finance.amountRequired}
            {...register('amount')}
          />
          <Input
            label={t.finance.date}
            type="date"
            max={localYmd()}
            error={errors.expenseDate && (errors.expenseDate.message === 'future' ? t.finance.dateFuture : t.finance.dateRequired)}
            {...register('expenseDate')}
          />
        </div>
        <Select label={t.finance.category} {...register('category')}>
          {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{t.finance.categoryNames[c]}</option>)}
        </Select>
        <Input label={t.finance.description} maxLength={512} error={errors.description && t.finance.descriptionRequired} {...register('description')} />
        <Input label={t.finance.notesOptional} maxLength={1024} {...register('notes')} />
        {!editing && canApprove && (
          <label className="flex items-start gap-3 rounded-lg border border-border bg-surface-2/50 p-3">
            <input type="checkbox" className="mt-0.5 h-4 w-4 rounded" {...register('approveNow')} />
            <span>
              <span className="block text-sm font-medium text-fg">{t.finance.approveNow}</span>
              <span className="block text-xs text-muted">{t.finance.approveNowHint}</span>
            </span>
          </label>
        )}
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  )
}
