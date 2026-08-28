import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, CheckCircle, XCircle } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Table } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Card } from '@/components/ui/Card'
import { financeApi } from '@/api/finance'
import { useAuthStore } from '@/stores/authStore'
import { toast } from '@/components/ui/Toast'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useI18n } from '@/i18n'
import type { ExpenseCategory, ExpenseStatus } from '@/types/api'

const categories: ExpenseCategory[] = [
  'Rent', 'Utilities', 'Salaries', 'Supplies', 'Maintenance', 'Marketing', 'Other',
]

const statusVariant: Record<ExpenseStatus, 'yellow' | 'green' | 'red'> = {
  Pending: 'yellow',
  Approved: 'green',
  Voided: 'red',
}

type FormData = {
  category: 'Rent' | 'Utilities' | 'Salaries' | 'Supplies' | 'Maintenance' | 'Marketing' | 'Other'
  amount: number
  currency: string
  description: string
  expenseDate: string
  notes?: string
}

export function FinancePage() {
  const [showModal, setShowModal] = useState(false)
  const { branchId, tenantId, user } = useAuthStore()
  const qc = useQueryClient()
  const { t } = useI18n()

  const categoryLabel: Record<ExpenseCategory, string> = {
    Rent: t.finance.categories.rent,
    Utilities: t.finance.categories.utilities,
    Salaries: t.finance.categories.salary,
    Supplies: t.finance.categories.supplies,
    Maintenance: t.finance.categories.maintenance,
    Marketing: t.finance.categories.marketing,
    Other: t.finance.categories.other,
  }

  const statusLabel: Record<ExpenseStatus, string> = {
    Pending: t.finance.status.pending,
    Approved: t.finance.status.completed,
    Voided: t.finance.status.cancelled,
  }

  const schema = z.object({
    category: z.enum(['Rent', 'Utilities', 'Salaries', 'Supplies', 'Maintenance', 'Marketing', 'Other'] as const),
    amount: z.coerce.number().positive(t.finance.amount),
    currency: z.string().min(3).max(3),
    description: z.string().min(1, t.finance.description),
    expenseDate: z.string().min(1, t.finance.date),
    notes: z.string().optional(),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['expenses', branchId],
    queryFn: () => financeApi.listExpenses(branchId!),
    enabled: !!branchId,
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { currency: 'SAR', expenseDate: new Date().toISOString().slice(0, 10) },
  })

  const create = useMutation({
    mutationFn: (formData: FormData) =>
      financeApi.createExpense(branchId!, { ...formData, tenantId: tenantId! }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses', branchId] })
      setShowModal(false)
      reset({ currency: 'SAR', expenseDate: new Date().toISOString().slice(0, 10) })
      toast.success(t.finance.created)
    },
    onError: () => toast.error(t.finance.failed),
  })

  const approve = useMutation({
    mutationFn: (expenseId: string) =>
      financeApi.approve(branchId!, expenseId, { approvedBy: user?.id ?? '' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses', branchId] })
      toast.success(t.finance.created)
    },
    onError: () => toast.error(t.finance.failed),
  })

  const voidExpense = useMutation({
    mutationFn: (expenseId: string) => financeApi.void(branchId!, expenseId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses', branchId] })
      toast.success(t.finance.status.cancelled)
    },
    onError: () => toast.error(t.finance.failed),
  })

  const expenses = data?.data ?? []
  const totalPending = expenses.filter((e) => e.status === 'Pending').reduce((s, e) => s + e.amount, 0)
  const totalApproved = expenses.filter((e) => e.status === 'Approved').reduce((s, e) => s + e.amount, 0)

  return (
    <div>
      <PageHeader
        title={t.finance.title}
        description={t.finance.subtitle}
        action={
          <Button onClick={() => setShowModal(true)}>
            <Plus className="h-4 w-4" />
            {t.finance.newTransaction}
          </Button>
        }
      />
      <div className="p-6 space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900 dark:bg-yellow-900/20">
            <p className="text-xs font-medium text-yellow-700 dark:text-yellow-400">{t.finance.status.pending}</p>
            <p className="mt-1 text-2xl font-bold text-yellow-900 dark:text-yellow-300 tabular-nums">
              {formatCurrency(totalPending)}
            </p>
          </div>
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-900/20">
            <p className="text-xs font-medium text-green-700 dark:text-green-400">{t.finance.status.completed}</p>
            <p className="mt-1 text-2xl font-bold text-green-900 dark:text-green-300 tabular-nums">
              {formatCurrency(totalApproved)}
            </p>
          </div>
        </div>

        <Card>
          <Table
            loading={isLoading}
            data={expenses}
            keyExtractor={(r) => r.id}
            emptyMessage={t.finance.noTransactions}
            columns={[
              {
                key: 'description',
                header: t.finance.description,
                render: (r) => (
                  <div>
                    <p className="font-medium">{r.description}</p>
                    <p className="text-xs text-gray-400">{categoryLabel[r.category]}</p>
                  </div>
                ),
              },
              {
                key: 'amount',
                header: t.finance.amount,
                render: (r) => (
                  <span className="font-semibold tabular-nums">
                    {formatCurrency(r.amount, r.currency)}
                  </span>
                ),
              },
              {
                key: 'expenseDate',
                header: t.finance.date,
                render: (r) => formatDate(r.expenseDate),
              },
              {
                key: 'status',
                header: t.finance.type,
                render: (r) => (
                  <Badge variant={statusVariant[r.status]}>{statusLabel[r.status]}</Badge>
                ),
              },
              {
                key: 'actions',
                header: '',
                render: (r) => (
                  <div className="flex gap-1">
                    {r.status === 'Pending' && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => { e.stopPropagation(); approve.mutate(r.id) }}
                        >
                          <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                          {t.finance.status.completed}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => { e.stopPropagation(); voidExpense.mutate(r.id) }}
                        >
                          <XCircle className="h-3.5 w-3.5 text-red-500" />
                          {t.common.cancel}
                        </Button>
                      </>
                    )}
                  </div>
                ),
              },
            ]}
          />
        </Card>
      </div>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={t.finance.newTransaction}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>{t.common.cancel}</Button>
            <Button loading={create.isPending} onClick={handleSubmit((d) => create.mutate(d))}>
              {t.common.save}
            </Button>
          </>
        }
      >
        <form className="space-y-4">
          <Select label={t.finance.category} error={errors.category?.message} {...register('category')}>
            {categories.map((c) => <option key={c} value={c}>{categoryLabel[c]}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t.finance.amount} type="number" step="0.01" error={errors.amount?.message} {...register('amount')} />
            <Input label={t.common.sar} maxLength={3} placeholder="SAR" {...register('currency')} />
          </div>
          <Input label={t.finance.description} error={errors.description?.message} {...register('description')} />
          <Input label={t.finance.date} type="date" error={errors.expenseDate?.message} {...register('expenseDate')} />
          <Input label={t.finance.notes} {...register('notes')} />
        </form>
      </Modal>
    </div>
  )
}
