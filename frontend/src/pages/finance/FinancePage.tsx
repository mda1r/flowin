import { useMemo, useRef, useState } from 'react'
import { useQuery, useQueries, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import {
  Plus, CheckCircle, XCircle, ChevronLeft, ChevronRight, Download, TrendingUp, TrendingDown,
  Receipt, Clock, Pencil, Copy, AlertTriangle, Wallet,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Input'
import { Table } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { ConfirmModal } from '@/components/ui/Modal'
import { Card } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/StatCard'
import { toast } from '@/components/ui/Toast'
import { financeApi, type ExpenseFilters } from '@/api/finance'
import { salesApi } from '@/api/sales'
import { ordersApi } from '@/api/orders'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency, formatDate } from '@/lib/utils'
import { fmtDate, fmtNum } from '@/lib/locale'
import { apiErrorMessage } from '@/lib/apiError'
import { downloadCsv } from '@/lib/csv'
import { localDaysToUtcRange, localYmd } from '@/lib/dates'
import { useI18n } from '@/i18n'
import { summarize } from '@/pages/reports/reportMath'
import type { ExpenseResponse, ExpenseStatus } from '@/types/api'
import { ExpenseFormModal, EXPENSE_CATEGORIES } from './ExpenseFormModal'
import { CopyFixedModal } from './CopyFixedModal'
import { BreakEvenCard, ComparisonCard, IncomeStatementCard, TrendCard, type TrendPoint } from './FinanceInsights'
import {
  breakEven, daysInMonth, fixedCosts, incomeStatement, monthRange, ordersInDays, returnsInDays,
  salesByMonth, sameDayIn, shiftMonth,
} from './financeMath'

const statuses: ExpenseStatus[] = ['Pending', 'Approved', 'Voided']

const statusVariant: Record<ExpenseStatus, 'yellow' | 'green' | 'red'> = {
  Pending: 'yellow',
  Approved: 'green',
  Voided: 'red',
}

// Roles the server lets approve, void and edit expenses (policy OwnerManagerOrAccountant).
const APPROVER_ROLES = ['Owner', 'Manager', 'Accountant']

const PAGE_SIZE = 20

const summaryQuery = (branchId: string | null | undefined, from: string, to: string) => ({
  queryKey: ['expenses', branchId, 'summary', from, to] as const,
  queryFn: () => financeApi.getSummary(branchId!, from, to).then((r) => r.data),
  enabled: !!branchId,
})

/** Sales, returns and cost of goods for whole local days, fetched and summed exactly like the Reports page. */
function usePeriodReport(branchId: string | null | undefined, from: string, to: string) {
  // Same keys and shapes as ReportsPage, so the two pages share the cache.
  const orders = useQuery({
    queryKey: ['reports', branchId, from, to],
    queryFn: () => salesApi.listAllCompletedOrders(branchId!, from, to).then(({ orders, truncated }) => ({ data: orders, truncated })),
    enabled: !!branchId,
  })
  const returns = useQuery({
    queryKey: ['reports-returns', branchId, from, to],
    queryFn: () => ordersApi.listReturns(branchId!, localDaysToUtcRange(from, to)),
    enabled: !!branchId,
  })
  const report = useMemo(() => {
    if (!orders.data || !returns.data) return null
    const o = ordersInDays(orders.data.data ?? [], from, to)
    const rawReturns = returns.data.data
    const r = returnsInDays(Array.isArray(rawReturns) ? rawReturns : [], from, to)
    return summarize(o, r)
  }, [orders.data, returns.data, from, to])
  return {
    report,
    truncated: !!orders.data?.truncated,
    isLoading: orders.isLoading || returns.isLoading,
    isError: orders.isError || returns.isError,
  }
}

export function FinancePage() {
  const today = localYmd()
  const [month, setMonth] = useState(() => today.slice(0, 7))
  const [category, setCategory] = useState<ExpenseResponse['category'] | ''>('')
  const [status, setStatus] = useState<ExpenseStatus | ''>('')
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ExpenseResponse | null>(null)
  const [copyOpen, setCopyOpen] = useState(false)
  const [voidingId, setVoidingId] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const { branchId, user } = useAuthStore()
  const canManage = APPROVER_ROLES.includes(user?.role ?? '')
  const qc = useQueryClient()
  const { t } = useI18n()

  const categoryLabel = (c: ExpenseResponse['category']) => t.finance.categoryNames[c] ?? c
  const statusLabel = (s: ExpenseStatus) => t.finance.statusNames[s] ?? s
  const monthLabel = (m: string, style: 'long' | 'short' = 'long') => {
    const [y, mo] = m.split('-').map(Number)
    return fmtDate(new Date(y, mo - 1, 1), style === 'long' ? { month: 'long', year: 'numeric' } : { month: 'short' })
  }

  // ── Periods ────────────────────────────────────────────────────────────────
  const { from, to } = monthRange(month)
  const days = daysInMonth(month)
  const prevMonth = shiftMonth(month, -1)
  const prevFull = monthRange(prevMonth)
  // While the month is running, compare like with like: days 1..today of both months.
  const running = month === today.slice(0, 7)
  const cutDay = running ? Number(today.slice(8, 10)) : null
  const curCmpTo = running ? today : to
  const prevCmpTo = running ? sameDayIn(prevMonth, today) : prevFull.to
  const daysSoFar = month < today.slice(0, 7) ? days : cutDay ?? 0
  const trendMonths = useMemo(() => [5, 4, 3, 2, 1, 0].map((n) => shiftMonth(month, -n)), [month])

  // ── Data ───────────────────────────────────────────────────────────────────
  const cur = usePeriodReport(branchId, from, to)
  const prev = usePeriodReport(branchId, prevFull.from, prevCmpTo)

  const summaryQ = useQuery(summaryQuery(branchId, from, to))
  const curCmpQ = useQuery(summaryQuery(branchId, from, curCmpTo))
  const prevCmpQ = useQuery(summaryQuery(branchId, prevFull.from, prevCmpTo))
  const trendSummaries = useQueries({
    queries: trendMonths.map((m) => {
      const r = monthRange(m)
      return summaryQuery(branchId, r.from, r.to)
    }),
  })
  const trendSalesQ = useQuery({
    queryKey: ['sales-summary-range', branchId, monthRange(trendMonths[0]).from, to],
    queryFn: () => salesApi.getSummary(branchId!, monthRange(trendMonths[0]).from, to).then((r) => r.data),
    enabled: !!branchId,
  })

  const filters: ExpenseFilters = {
    dateFrom: from,
    dateTo: to,
    category: category || undefined,
    status: status || undefined,
  }

  const { data: listData, isLoading: listLoading } = useQuery({
    queryKey: ['expenses', branchId, 'list', filters, page],
    queryFn: () => financeApi.listExpenses(branchId!, { ...filters, page, pageSize: PAGE_SIZE }),
    enabled: !!branchId,
    placeholderData: keepPreviousData,
  })

  // ── Figures ────────────────────────────────────────────────────────────────
  const summary = summaryQ.data
  const statement = cur.report && summary ? incomeStatement(cur.report, summary.approved.total) : null
  const salesFailed = cur.isError ? t.finance.salesFailed : null
  const statementError = salesFailed ?? (summaryQ.isError ? t.finance.summaryFailed : null)

  const comparison = cur.report && prev.report && curCmpQ.data && prevCmpQ.data
    ? {
        current: {
          netSales: cur.report.netSales,
          expenses: curCmpQ.data.approved.total,
          netProfit: cur.report.grossProfit - curCmpQ.data.approved.total,
        },
        previous: {
          netSales: prev.report.netSales,
          expenses: prevCmpQ.data.approved.total,
          netProfit: prev.report.grossProfit - prevCmpQ.data.approved.total,
        },
      }
    : null
  const comparisonError = cur.isError || prev.isError
    ? t.finance.salesFailed
    : curCmpQ.isError || prevCmpQ.isError ? t.finance.summaryFailed : null

  // Break-even on this month's fixed costs; early in the month they may not be booked yet, so fall back to last month's.
  const prevFullSummary = trendSummaries[4]?.data
  const fixedThisMonth = fixedCosts(summary)
  const fromLastMonth = fixedThisMonth === 0 && fixedCosts(prevFullSummary) > 0
  const fixed = fromLastMonth ? fixedCosts(prevFullSummary) : fixedThisMonth
  const breakEvenResult = statement ? breakEven(fixed, statement.grossMargin, days) : null

  const trendSales = trendSalesQ.data ? salesByMonth(trendSalesQ.data) : null
  // Months whose orders are already loaded use the order-based figure, so the bar matches the statement.
  const exactSales = (m: string) =>
    m === month && statement ? statement.netSales
      : m === prevMonth && !running && prev.report ? prev.report.netSales
        : undefined
  const trendPoints: TrendPoint[] = trendMonths.map((m, i) => ({
    month: m,
    label: monthLabel(m, 'short'),
    sales: trendSales ? exactSales(m) ?? trendSales.get(m) ?? 0 : null,
    expenses: trendSummaries[i]?.data ? trendSummaries[i].data!.approved.total : null,
  }))
  const trendError = trendSalesQ.isError ? t.finance.salesFailed : trendSummaries.some((q) => q.isError) ? t.finance.summaryFailed : null

  const noCostPrices = !!statement && statement.netSales > 0 && statement.cogs <= 0

  // Never show zeros in place of figures that have not arrived.
  const failed = <span className="text-sm font-normal text-muted">{statementError}</span>
  const kpi = (value: number | undefined, tone?: 'success' | 'danger') =>
    statementError ? failed : value === undefined ? '…' : (
      <span className={tone === 'danger' ? 'text-danger' : tone === 'success' ? 'text-success' : undefined}>{formatCurrency(value)}</span>
    )
  const pctText = (n: number | null | undefined) => (n === null || n === undefined ? '' : fmtNum(Math.round(n)))

  // Row count for the active filters, from the server's category × status totals.
  const filteredCount = (summary?.groups ?? [])
    .filter((g) => (!category || g.category === category) && (!status || g.status === status))
    .reduce((s, g) => s + g.count, 0)
  const pageCount = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE))

  // ── Actions ────────────────────────────────────────────────────────────────
  const refresh = () => qc.invalidateQueries({ queryKey: ['expenses', branchId] })
  const onError = (err: unknown) => toast.error(apiErrorMessage(err, t.finance.failed))

  const changeMonth = (delta: number) => {
    setMonth((m) => shiftMonth(m, delta))
    setPage(1)
  }

  const openCreate = () => { setEditing(null); setFormOpen(true) }
  const openEdit = (expense: ExpenseResponse) => { setEditing(expense); setFormOpen(true) }

  const onSaved = (saved: ExpenseResponse) => {
    refresh()
    // Jump to the month the expense is booked in so it is visible straight away.
    if (saved.expenseDate.slice(0, 7) !== month) {
      setMonth(saved.expenseDate.slice(0, 7))
      setPage(1)
    }
    setFormOpen(false)
    setEditing(null)
  }

  const showPending = () => {
    setStatus('Pending')
    setPage(1)
    listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

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
      setVoidingId(null)
      refresh()
      toast.success(t.finance.voidedToast)
    },
    onError: (err) => {
      setVoidingId(null)
      onError(err)
    },
  })

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
        [t.finance.date, t.finance.description, t.finance.category, t.finance.amount, t.finance.statusLabel, t.finance.notes],
        rows.map((r) => [
          r.expenseDate, r.description, categoryLabel(r.category),
          r.amount.toFixed(2), statusLabel(r.status), r.notes ?? '',
        ]),
      )
    } catch (err) {
      onError(err)
    } finally {
      setExporting(false)
    }
  }

  const expenses = listData?.data ?? []

  return (
    <div className="min-w-0">
      <PageHeader
        title={t.finance.title}
        description={t.finance.pageSubtitle}
        icon={<Wallet className="h-5 w-5" />}
        action={
          <>
            {canManage && (
              <Button variant="secondary" onClick={() => setCopyOpen(true)}>
                <Copy className="h-4 w-4" />
                {t.finance.copyFixed}
              </Button>
            )}
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              {t.finance.newExpense}
            </Button>
          </>
        }
      />
      <div className="space-y-6 p-4 sm:p-6">
        {/* Period */}
        <div className="flex items-center gap-1 self-start rounded-lg border border-border bg-surface p-1 w-fit">
          <Button size="sm" variant="ghost" aria-label={t.finance.prevMonth} onClick={() => changeMonth(-1)}>
            <ChevronRight className="h-4 w-4 ltr:rotate-180" />
          </Button>
          <span className="min-w-32 text-center text-sm font-semibold text-fg">{monthLabel(month)}</span>
          <Button size="sm" variant="ghost" aria-label={t.finance.nextMonth} disabled={month >= today.slice(0, 7)} onClick={() => changeMonth(1)}>
            <ChevronLeft className="h-4 w-4 ltr:rotate-180" />
          </Button>
        </div>

        {(cur.truncated || noCostPrices) && (
          <div className="space-y-2">
            {cur.truncated && <Notice>{t.finance.truncatedWarning}</Notice>}
            {noCostPrices && <Notice>{t.finance.noCostWarning}</Notice>}
          </div>
        )}

        {/* Headline figures */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label={t.finance.netSales}
            value={kpi(statement?.netSales)}
            hint={cur.report ? t.finance.ordersCount.replace('{n}', fmtNum(cur.report.orders)) : undefined}
            icon={<TrendingUp />}
            tone="brand"
          />
          <StatCard
            label={t.finance.grossProfit}
            value={kpi(statement?.grossProfit, statement && statement.grossProfit < 0 ? 'danger' : undefined)}
            hint={statement?.grossMargin != null ? t.finance.grossMargin.replace('{n}', pctText(statement.grossMargin)) : undefined}
            icon={<Wallet />}
            tone="info"
          />
          <StatCard
            label={t.finance.expensesApproved}
            value={kpi(statement?.expenses)}
            hint={summary ? t.finance.approvedCount.replace('{n}', fmtNum(summary.approved.count)) : undefined}
            icon={<Receipt />}
            tone="warning"
          />
          <StatCard
            label={statement && statement.netProfit < 0 ? t.finance.netLoss : t.finance.netProfit}
            value={kpi(statement ? Math.abs(statement.netProfit) : undefined, statement ? (statement.netProfit < 0 ? 'danger' : 'success') : undefined)}
            hint={statement?.netMargin != null ? t.finance.netMargin.replace('{n}', pctText(statement.netMargin)) : undefined}
            icon={statement && statement.netProfit < 0 ? <TrendingDown /> : <TrendingUp />}
            tone={statement && statement.netProfit < 0 ? 'danger' : 'success'}
          />
        </div>

        {summary && summary.pending.count > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
            <Clock className="h-4 w-4 shrink-0 text-warning" aria-hidden />
            <span className="min-w-0 flex-1 text-fg">
              {t.finance.pendingBanner
                .replace('{n}', fmtNum(summary.pending.count))
                .replace('{amount}', formatCurrency(summary.pending.total))}
            </span>
            <Button size="sm" variant="secondary" onClick={showPending}>{t.finance.showPending}</Button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <IncomeStatementCard
            className="self-start"
            statement={statement}
            byCategory={summary?.byCategory ?? []}
            loading={cur.isLoading || summaryQ.isLoading}
            error={statementError}
          />
          <div className="space-y-6">
            <BreakEvenCard
              result={breakEvenResult}
              fixed={fixed}
              fromLastMonth={fromLastMonth}
              netSales={statement?.netSales ?? 0}
              expenses={statement?.expenses ?? 0}
              daysSoFar={daysSoFar}
              loading={cur.isLoading || summaryQ.isLoading}
              error={statementError}
            />
            <ComparisonCard
              current={comparison?.current ?? null}
              previous={comparison?.previous ?? null}
              sameDays={cutDay}
              loading={!comparisonError}
              error={comparisonError}
            />
          </div>
        </div>

        <TrendCard points={trendPoints} loading={!trendError} error={trendError} />

        {/* Expenses */}
        <div ref={listRef} className="scroll-mt-4">
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-end gap-3 border-b border-border px-4 py-3">
              <div className="w-full sm:w-52">
                <Select
                  aria-label={t.finance.category}
                  value={category}
                  onChange={(e) => { setCategory(e.target.value as ExpenseResponse['category'] | ''); setPage(1) }}
                >
                  <option value="">{t.finance.allCategories}</option>
                  {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}
                </Select>
              </div>
              <div className="w-full sm:w-44">
                <Select
                  aria-label={t.finance.statusLabel}
                  value={status}
                  onChange={(e) => { setStatus(e.target.value as ExpenseStatus | ''); setPage(1) }}
                >
                  <option value="">{t.finance.allStatuses}</option>
                  {statuses.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
                </Select>
              </div>
              <Button variant="secondary" className="w-full sm:ms-auto sm:w-auto" loading={exporting} onClick={exportCsv}>
                <Download className="h-4 w-4" />
                {t.finance.exportCsv}
              </Button>
            </div>
            <Table
              loading={listLoading}
              data={expenses}
              keyExtractor={(r) => r.id}
              emptyMessage={t.finance.noTransactions}
              columns={[
                {
                  key: 'description',
                  header: t.finance.description,
                  className: 'min-w-40',
                  render: (r) => (
                    <div className="min-w-0">
                      <p className="font-medium">{r.description}</p>
                      <p className="text-xs text-muted">
                        {categoryLabel(r.category)}
                        <span className="sm:hidden"> · {formatDate(r.expenseDate)}</span>
                      </p>
                      {r.notes && <p className="mt-0.5 line-clamp-1 text-xs text-muted">{r.notes}</p>}
                    </div>
                  ),
                },
                {
                  key: 'amount',
                  header: t.finance.amount,
                  className: 'whitespace-nowrap',
                  render: (r) => <span className="font-semibold tabular-nums">{formatCurrency(r.amount, r.currency || 'SAR')}</span>,
                },
                {
                  key: 'expenseDate',
                  header: t.finance.date,
                  className: 'hidden whitespace-nowrap sm:table-cell',
                  headerClassName: 'hidden sm:table-cell',
                  render: (r) => formatDate(r.expenseDate),
                },
                {
                  key: 'status',
                  header: t.finance.statusLabel,
                  render: (r) => <Badge variant={statusVariant[r.status]}>{statusLabel(r.status)}</Badge>,
                },
                {
                  key: 'actions',
                  header: '',
                  render: (r) => canManage && r.status !== 'Voided' ? (
                    <div className="flex justify-end gap-1">
                      {r.status === 'Pending' && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={t.finance.approve}
                            title={t.finance.approve}
                            disabled={approve.isPending}
                            onClick={(e) => { e.stopPropagation(); approve.mutate(r.id) }}
                          >
                            <CheckCircle className="h-3.5 w-3.5 text-success" />
                            <span className="hidden md:inline">{t.finance.approve}</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={t.finance.edit}
                            title={t.finance.edit}
                            onClick={(e) => { e.stopPropagation(); openEdit(r) }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span className="hidden md:inline">{t.finance.edit}</span>
                          </Button>
                        </>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={t.finance.voidAction}
                        title={t.finance.voidAction}
                        disabled={voidExpense.isPending}
                        onClick={(e) => { e.stopPropagation(); setVoidingId(r.id) }}
                      >
                        <XCircle className="h-3.5 w-3.5 text-danger" />
                        <span className="hidden md:inline">{t.finance.voidAction}</span>
                      </Button>
                    </div>
                  ) : null,
                },
              ]}
            />
            {pageCount > 1 && (
              <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm">
                <Button size="sm" variant="secondary" aria-label={t.finance.prevPage} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronRight className="h-4 w-4 ltr:rotate-180" />
                </Button>
                <span className="text-muted tabular-nums">
                  {t.finance.pageOf.replace('{page}', fmtNum(page)).replace('{pages}', fmtNum(pageCount))}
                </span>
                <Button size="sm" variant="secondary" aria-label={t.finance.nextPage} disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>
                  <ChevronLeft className="h-4 w-4 ltr:rotate-180" />
                </Button>
              </div>
            )}
          </Card>
        </div>
      </div>

      <ConfirmModal
        open={!!voidingId}
        onClose={() => setVoidingId(null)}
        onConfirm={() => { if (voidingId) voidExpense.mutate(voidingId) }}
        title={t.finance.voidTitle}
        message={t.finance.voidConfirm}
        confirmLabel={t.finance.voidAction}
        confirmVariant="danger"
        loading={voidExpense.isPending}
      />

      {branchId && (
        <ExpenseFormModal
          open={formOpen}
          onClose={() => { setFormOpen(false); setEditing(null) }}
          branchId={branchId}
          expense={editing}
          canApprove={canManage}
          defaultDate={running ? today : from}
          onSaved={onSaved}
        />
      )}

      {branchId && canManage && (
        <CopyFixedModal
          open={copyOpen}
          onClose={() => setCopyOpen(false)}
          branchId={branchId}
          month={month}
          monthLabel={(m) => monthLabel(m)}
          onDone={() => { setCopyOpen(false); refresh() }}
        />
      )}
    </div>
  )
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-fg">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
      <p className="min-w-0">{children}</p>
    </div>
  )
}
