import { useState } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { Plus, CheckCircle, XCircle, ChevronLeft, ChevronRight, Download, TrendingUp, TrendingDown, Receipt, Clock } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Table } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/StatCard'
import { financeApi, type ExpenseFilters } from '@/api/finance'
import { salesApi } from '@/api/sales'
import { useAuthStore } from '@/stores/authStore'
import { toast } from '@/components/ui/Toast'
import { formatCurrency, formatDate } from '@/lib/utils'
import { apiErrorMessage } from '@/lib/apiError'
import { downloadCsv } from '@/lib/csv'
import { localYmd } from '@/lib/dates'
import { useI18n } from '@/i18n'
import type { ExpenseCategory, ExpenseStatus } from '@/types/api'

// Same names as the server's ExpenseCategory enum.
const categories = [
  'Rent', 'Utilities', 'Wages', 'Supplies', 'Equipment', 'Maintenance', 'Marketing', 'Other',
] as const satisfies readonly ExpenseCategory[]

const statuses: ExpenseStatus[] = ['Pending', 'Approved', 'Voided']

const statusVariant: Record<ExpenseStatus, 'yellow' | 'green' | 'red'> = {
  Pending: 'yellow',
  Approved: 'green',
  Voided: 'red',
}

const PAGE_SIZE = 20

// 'YYYY-MM' → first and last day of that month as 'YYYY-MM-DD'.
function monthRange(month: string) {
  const [y, m] = month.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` }
}

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const schema = z.object({
  category: z.enum(categories),
  amount: z.coerce.number().positive(),
  currency: z.string().min(3).max(3),
  description: z.string().trim().min(1),
  expenseDate: z.string().min(1),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

export function FinancePage() {
  const [showModal, setShowModal] = useState(false)
  const [month, setMonth] = useState(() => localYmd().slice(0, 7))
  const [category, setCategory] = useState<ExpenseCategory | ''>('')
  const [status, setStatus] = useState<ExpenseStatus | ''>('')
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState(false)
  const { branchId, user } = useAuthStore()
  const canManage = user?.role === 'Owner' || user?.role === 'Manager'
  const qc = useQueryClient()
  const { t, lang } = useI18n()
  const locale = lang === 'ar' ? 'ar-SA-u-ca-gregory' : 'en-US'

  const categoryLabel: Record<ExpenseCategory, string> = {
    Rent: t.finance.categories.rent,
    Utilities: t.finance.categories.utilities,
    Wages: t.finance.categories.salary,
    Supplies: t.finance.categories.supplies,
    Equipment: t.finance.categories.equipment,
    Maintenance: t.finance.categories.maintenance,
    Marketing: t.finance.categories.marketing,
    Other: t.finance.categories.other,
  }

  const statusLabel: Record<ExpenseStatus, string> = {
    Pending: t.finance.status.pending,
    Approved: t.finance.status.approved,
    Voided: t.finance.status.cancelled,
  }

  const { from, to } = monthRange(month)
  const filters: ExpenseFilters = {
    dateFrom: from,
    dateTo: to,
    category: category || undefined,
    status: status || undefined,
  }

  const { data: listData, isLoading } = useQuery({
    queryKey: ['expenses', branchId, 'list', filters, page],
    queryFn: () => financeApi.listExpenses(branchId!, { ...filters, page, pageSize: PAGE_SIZE }),
    enabled: !!branchId,
    placeholderData: keepPreviousData,
  })

  const { data: summaryData } = useQuery({
    queryKey: ['expenses', branchId, 'summary', from, to],
    queryFn: () => financeApi.getSummary(branchId!, from, to),
    enabled: !!branchId,
  })

  const { data: salesData, isLoading: salesLoading } = useQuery({
    queryKey: ['sales-summary-range', branchId, from, to],
    queryFn: () => salesApi.getSummary(branchId!, from, to),
    enabled: !!branchId,
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { category: 'Rent', currency: 'SAR', expenseDate: localYmd() },
  })

  const refresh = () => qc.invalidateQueries({ queryKey: ['expenses', branchId] })
  const onError = (err: unknown) => toast.error(apiErrorMessage(err, t.finance.failed))

  const create = useMutation({
    mutationFn: (formData: FormData) => financeApi.createExpense(branchId!, formData),
    onSuccess: (_res, formData) => {
      refresh()
      // Jump to the month the expense was booked in so it is visible straight away.
      setMonth(formData.expenseDate.slice(0, 7))
      setPage(1)
      setShowModal(false)
      reset({ category: 'Rent', currency: 'SAR', expenseDate: localYmd() })
      toast.success(t.finance.created)
    },
    onError,
  })

  const approve = useMutation({
    mutationFn: (expenseId: string) => financeApi.approve(branchId!, expenseId),
    onSuccess: () => {
      refresh()
      toast.success(t.finance.approvedToast)
    },
    onError,
  })

  const voidExpense = useMutation({
    mutationFn: (expenseId: string) => financeApi.void(branchId!, expenseId),
    onSuccess: () => {
      refresh()
      toast.success(t.finance.voidedToast)
    },
    onError,
  })

  const expenses = listData?.data ?? []
  const summary = summaryData?.data
  const salesDays = salesData?.data ?? []

  // Sales are stored with VAT included; the P&L compares like with like, so take VAT out.
  const netSales = salesDays.reduce((s, d) => s + d.totalRevenue - d.totalTax, 0)
  const orderCount = salesDays.reduce((s, d) => s + d.totalOrders, 0)
  const approvedTotal = summary?.approved.total ?? 0
  const netProfit = netSales - approvedTotal
  const margin = netSales > 0 ? Math.round((netProfit / netSales) * 100) : null

  // Row count for the active filters, from the server's category × status totals.
  const filteredCount = (summary?.groups ?? [])
    .filter((g) => (!category || g.category === category) && (!status || g.status === status))
    .reduce((s, g) => s + g.count, 0)
  const pageCount = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE))

  const monthLabel = new Date(`${from}T00:00:00`).toLocaleDateString(locale, { month: 'long', year: 'numeric' })

  const changeMonth = (delta: number) => {
    setMonth((m) => shiftMonth(m, delta))
    setPage(1)
  }

  const exportCsv = async () => {
    if (!branchId) return
    setExporting(true)
    try {
      const rows = await financeApi.listAllExpenses(branchId, filters)
      if (rows.length === 0) {
        toast.error(t.finance.exportEmpty)
        return
      }
      downloadCsv(
        `expenses-${month}.csv`,
        [t.finance.date, t.finance.description, t.finance.category, t.finance.amount, t.settings.currency, t.finance.type, t.finance.notes],
        rows.map((r) => [
          r.expenseDate, r.description, categoryLabel[r.category] ?? r.category,
          r.amount.toFixed(2), r.currency, statusLabel[r.status], r.notes ?? '',
        ]),
      )
    } catch (err) {
      onError(err)
    } finally {
      setExporting(false)
    }
  }

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
        {/* Period */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-1">
            <Button size="sm" variant="ghost" aria-label={t.finance.prevMonth} onClick={() => changeMonth(-1)}>
              <ChevronRight className="h-4 w-4 ltr:rotate-180" />
            </Button>
            <span className="min-w-32 text-center text-sm font-semibold text-fg">{monthLabel}</span>
            <Button size="sm" variant="ghost" aria-label={t.finance.nextMonth} onClick={() => changeMonth(1)}>
              <ChevronLeft className="h-4 w-4 ltr:rotate-180" />
            </Button>
          </div>
          <p className="text-xs text-muted">{t.finance.pnlNote}</p>
        </div>

        {/* Profit & loss for the period */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label={t.finance.netSales}
            value={salesLoading ? '…' : formatCurrency(netSales)}
            hint={t.finance.ordersCount.replace('{n}', String(orderCount))}
            icon={<TrendingUp />}
            tone="brand"
          />
          <StatCard
            label={t.finance.totalExpenses}
            value={formatCurrency(approvedTotal)}
            hint={t.finance.approvedCount.replace('{n}', String(summary?.approved.count ?? 0))}
            icon={<Receipt />}
            tone="info"
          />
          <StatCard
            label={netProfit < 0 ? t.finance.netLoss : t.finance.netProfit}
            value={<span className={netProfit < 0 ? 'text-danger' : 'text-success'}>{formatCurrency(Math.abs(netProfit))}</span>}
            hint={margin !== null ? t.finance.margin.replace('{n}', String(margin)) : undefined}
            icon={netProfit < 0 ? <TrendingDown /> : <TrendingUp />}
            tone={netProfit < 0 ? 'danger' : 'success'}
          />
          <StatCard
            label={t.finance.awaitingApproval}
            value={formatCurrency(summary?.pending.total ?? 0)}
            hint={t.finance.pendingCount.replace('{n}', String(summary?.pending.count ?? 0))}
            icon={<Clock />}
            tone="warning"
          />
        </div>

        {/* Approved spending by category */}
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-fg">{t.finance.byCategory}</h2>
          </CardHeader>
          <CardBody>
            {summary && summary.byCategory.length > 0 ? (
              <ul className="space-y-3">
                {summary.byCategory.map((c) => {
                  const pct = approvedTotal > 0 ? (c.total / approvedTotal) * 100 : 0
                  return (
                    <li key={c.category} className="space-y-1">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-fg">{categoryLabel[c.category] ?? c.category}</span>
                        <span className="tabular-nums text-muted">
                          <span className="font-semibold text-fg">{formatCurrency(c.total)}</span>
                          {' · '}{Math.round(pct)}٪
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                        <div className="h-full rounded-full bg-brand-strong" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted">{t.finance.noApproved}</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <div className="flex flex-wrap items-end gap-3 border-b border-border px-4 py-3">
            <div className="w-44">
              <Select
                aria-label={t.finance.category}
                value={category}
                onChange={(e) => { setCategory(e.target.value as ExpenseCategory | ''); setPage(1) }}
              >
                <option value="">{t.finance.allCategories}</option>
                {categories.map((c) => <option key={c} value={c}>{categoryLabel[c]}</option>)}
              </Select>
            </div>
            <div className="w-40">
              <Select
                aria-label={t.finance.type}
                value={status}
                onChange={(e) => { setStatus(e.target.value as ExpenseStatus | ''); setPage(1) }}
              >
                <option value="">{t.finance.allStatuses}</option>
                {statuses.map((s) => <option key={s} value={s}>{statusLabel[s]}</option>)}
              </Select>
            </div>
            <Button variant="secondary" className="ms-auto" loading={exporting} onClick={exportCsv}>
              <Download className="h-4 w-4" />
              {t.finance.exportCsv}
            </Button>
          </div>
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
                    <p className="text-xs text-muted">{categoryLabel[r.category] ?? r.category}</p>
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
                render: (r) => formatDate(r.expenseDate, locale),
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
                    {canManage && r.status === 'Pending' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={approve.isPending}
                        onClick={(e) => { e.stopPropagation(); approve.mutate(r.id) }}
                      >
                        <CheckCircle className="h-3.5 w-3.5 text-success" />
                        {t.finance.approve}
                      </Button>
                    )}
                    {canManage && r.status !== 'Voided' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={voidExpense.isPending}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (window.confirm(t.finance.voidConfirm)) voidExpense.mutate(r.id)
                        }}
                      >
                        <XCircle className="h-3.5 w-3.5 text-danger" />
                        {t.finance.voidAction}
                      </Button>
                    )}
                  </div>
                ),
              },
            ]}
          />
          {pageCount > 1 && (
            <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm">
              <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronRight className="h-4 w-4 ltr:rotate-180" />
              </Button>
              <span className="text-muted tabular-nums">
                {t.finance.pageOf.replace('{page}', String(page)).replace('{pages}', String(pageCount))}
              </span>
              <Button size="sm" variant="secondary" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>
                <ChevronLeft className="h-4 w-4 ltr:rotate-180" />
              </Button>
            </div>
          )}
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
            <Input label={t.finance.amount} type="number" step="0.01" min="0" error={errors.amount && t.finance.amount} {...register('amount')} />
            <Input label={t.common.sar} maxLength={3} placeholder="SAR" {...register('currency')} />
          </div>
          <Input label={t.finance.description} error={errors.description && t.finance.description} {...register('description')} />
          <Input label={t.finance.date} type="date" error={errors.expenseDate && t.finance.date} {...register('expenseDate')} />
          <Input label={t.finance.notes} {...register('notes')} />
        </form>
      </Modal>
    </div>
  )
}
