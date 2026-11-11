import { ArrowDown, ArrowUp } from 'lucide-react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { cn, formatCurrency } from '@/lib/utils'
import { fmtNum } from '@/lib/locale'
import { useI18n } from '@/i18n'
import type { ExpenseCategory } from '@/types/api'
import { pctChange, type BreakEven, type IncomeStatement } from './financeMath'

const pct = (n: number) => fmtNum(Math.round(n))

function Title({ children, note }: { children: React.ReactNode; note?: React.ReactNode }) {
  return (
    <CardHeader className="px-4 sm:px-6">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-fg">{children}</h2>
        {note && <p className="mt-0.5 text-xs text-muted">{note}</p>}
      </div>
    </CardHeader>
  )
}

/** Placeholder body while figures load or after they fail; never zeros in their place. */
export function CardState({ loading, error }: { loading: boolean; error?: string | null }) {
  if (error) return <p className="text-sm text-muted">{error}</p>
  if (!loading) return null
  return (
    <div className="space-y-3" aria-hidden>
      {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-4" />)}
    </div>
  )
}

// ── Income statement ─────────────────────────────────────────────────────────

function Row({ label, value, sign, strong, tone, sub, indent }: {
  label: React.ReactNode
  value: number
  sign?: '−' | '='
  strong?: boolean
  tone?: 'success' | 'danger'
  sub?: React.ReactNode
  indent?: boolean
}) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3 py-2', strong && 'border-t border-border', indent && 'ps-5 py-1')}>
      <div className="min-w-0">
        <span className={cn('text-sm', strong ? 'font-semibold text-fg' : indent ? 'text-muted' : 'text-fg')}>
          {sign && <span className="me-1.5 inline-block w-3 text-muted" aria-hidden>{sign}</span>}
          {label}
        </span>
        {sub && <span className="ms-2 text-xs text-muted">{sub}</span>}
      </div>
      <span
        className={cn(
          'shrink-0 tabular-nums',
          strong ? 'text-base font-semibold' : 'text-sm',
          indent ? 'text-muted' : 'text-fg',
          tone === 'success' && 'text-success',
          tone === 'danger' && 'text-danger',
        )}
      >
        {formatCurrency(value)}
      </span>
    </div>
  )
}

export function IncomeStatementCard({ statement, byCategory, loading, error, className }: {
  statement: IncomeStatement | null
  byCategory: { category: ExpenseCategory; total: number }[]
  loading: boolean
  error: string | null
  className?: string
}) {
  const { t } = useI18n()
  const s = statement
  return (
    <Card className={className}>
      <Title note={t.finance.statementNote}>{t.finance.statement}</Title>
      <CardBody className="px-4 py-3 sm:px-6">
        {!s ? (
          <CardState loading={loading} error={error} />
        ) : (
          <div>
            <Row label={t.finance.salesExVat} value={s.sales} />
            {s.returns > 0 && <Row sign="−" label={t.finance.returnsExVat} value={s.returns} />}
            <Row sign="=" strong label={t.finance.netSales} value={s.netSales} />
            <Row sign="−" label={t.finance.cogs} value={s.cogs} />
            <Row
              sign="="
              strong
              label={t.finance.grossProfit}
              value={s.grossProfit}
              tone={s.grossProfit < 0 ? 'danger' : undefined}
              sub={s.grossMargin !== null ? t.finance.grossMargin.replace('{n}', pct(s.grossMargin)) : undefined}
            />
            <Row sign="−" label={t.finance.expensesApproved} value={s.expenses} />
            {byCategory.map((c) => (
              <Row key={c.category} indent label={t.finance.categoryNames[c.category] ?? c.category} value={c.total} />
            ))}
            <Row
              sign="="
              strong
              label={s.netProfit < 0 ? t.finance.netLoss : t.finance.netProfit}
              value={Math.abs(s.netProfit)}
              tone={s.netProfit < 0 ? 'danger' : 'success'}
              sub={s.netMargin !== null ? t.finance.netMargin.replace('{n}', pct(s.netMargin)) : undefined}
            />
          </div>
        )}
      </CardBody>
    </Card>
  )
}

// ── Month on month ───────────────────────────────────────────────────────────

/** % change with an arrow; green when the move is good for the shop, red when bad. */
export function Change({ current, previous, upIsGood }: { current: number; previous: number; upIsGood: boolean }) {
  const change = pctChange(current, previous)
  if (change === null || !isFinite(change)) return <span className="text-muted">—</span>
  const rounded = Math.round(change)
  const percent = (n: number) => fmtNum(n / 100, { style: 'percent', maximumFractionDigits: 0 })
  if (rounded === 0) return <span className="tabular-nums text-muted">{percent(0)}</span>
  const up = rounded > 0
  const good = up === upIsGood
  const Icon = up ? ArrowUp : ArrowDown
  return (
    <span className={cn('inline-flex items-center gap-0.5 tabular-nums font-medium', good ? 'text-success' : 'text-danger')}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {percent(Math.abs(rounded))}
    </span>
  )
}

export interface ComparisonFigures {
  netSales: number
  expenses: number
  netProfit: number
}

export function ComparisonCard({ current, previous, sameDays, loading, error }: {
  current: ComparisonFigures | null
  previous: ComparisonFigures | null
  /** Viewing the running month: both sides are cut to days 1..sameDays. */
  sameDays: number | null
  loading: boolean
  error: string | null
}) {
  const { t } = useI18n()
  const rows: { label: string; key: keyof ComparisonFigures; upIsGood: boolean }[] = [
    { label: t.finance.netSales, key: 'netSales', upIsGood: true },
    { label: t.finance.expensesApproved, key: 'expenses', upIsGood: false },
    { label: t.finance.netProfit, key: 'netProfit', upIsGood: true },
  ]
  return (
    <Card>
      <Title note={sameDays ? t.finance.comparisonSameDays.replace('{d}', fmtNum(sameDays)) : undefined}>
        {t.finance.comparison}
      </Title>
      <CardBody className="px-4 py-3 sm:px-6">
        {!current || !previous ? (
          <CardState loading={loading} error={error} />
        ) : (
          <table className="w-full text-sm tabular-nums">
            <thead>
              <tr className="text-xs text-muted">
                <th className="py-1.5 text-start font-medium"><span className="sr-only">{t.finance.category}</span></th>
                <th className="whitespace-nowrap py-1.5 ps-3 text-end font-medium">{t.finance.thisMonth}</th>
                <th className="whitespace-nowrap py-1.5 ps-3 text-end font-medium">{t.finance.lastMonth}</th>
                <th className="whitespace-nowrap py-1.5 ps-3 text-end font-medium">{t.finance.change}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.key}>
                  <td className="py-2 pe-2 text-fg">{r.label}</td>
                  <td className={cn('py-2 ps-3 text-end font-semibold', r.key === 'netProfit' && current.netProfit < 0 ? 'text-danger' : 'text-fg')}>
                    {fmtNum(Math.round(current[r.key]))}
                  </td>
                  <td className="py-2 ps-3 text-end text-muted">{fmtNum(Math.round(previous[r.key]))}</td>
                  <td className="whitespace-nowrap py-2 ps-3 text-end">
                    <Change current={current[r.key]} previous={previous[r.key]} upIsGood={r.upIsGood} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardBody>
    </Card>
  )
}

// ── Break-even ───────────────────────────────────────────────────────────────

export function BreakEvenCard({ result, fixed, fromLastMonth, netSales, expenses, daysSoFar, loading, error }: {
  result: BreakEven | null
  fixed: number
  fromLastMonth: boolean
  netSales: number
  expenses: number
  /** Days of the month that have passed (the whole month for past months). */
  daysSoFar: number
  loading: boolean
  error: string | null
}) {
  const { t } = useI18n()
  const message = result && result.kind !== 'ok'
    ? { noFixed: t.finance.breakEvenNoFixed, noSales: t.finance.breakEvenNoSales, negativeMargin: t.finance.breakEvenNegative }[result.kind]
    : null
  const avgDaily = daysSoFar > 0 ? netSales / daysSoFar : 0
  const covered = result?.kind === 'ok' && avgDaily >= result.daily
  const progress = result?.kind === 'ok' && result.daily > 0 ? Math.min(100, (avgDaily / result.daily) * 100) : 0

  return (
    <Card>
      <Title note={t.finance.fixedCostsHint}>{t.finance.breakEven}</Title>
      <CardBody className="space-y-3 px-4 py-4 sm:px-6">
        {!result ? (
          <CardState loading={loading} error={error} />
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-muted">{t.finance.fixedCosts}</span>
              <span className="font-semibold tabular-nums text-fg">{formatCurrency(fixed)}</span>
            </div>
            {fromLastMonth && <p className="text-xs text-muted">{t.finance.breakEvenLastMonth}</p>}
            {result.kind === 'ok' ? (
              <>
                <p className="text-base font-semibold leading-snug text-fg">
                  {t.finance.breakEvenDaily.replace('{amount}', formatCurrency(Math.ceil(result.daily)))}
                </p>
                <p className="text-xs text-muted">
                  {t.finance.breakEvenMonthly
                    .replace('{amount}', formatCurrency(Math.ceil(result.monthly)))
                    .replace('{n}', pct(result.margin))}
                </p>
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-muted">{t.finance.avgDailySales.replace('{amount}', formatCurrency(avgDaily))}</span>
                    <Badge variant={covered ? 'green' : 'yellow'}>{covered ? t.finance.covered : t.finance.notCovered}</Badge>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                    <div className={cn('h-full rounded-full', covered ? 'bg-success' : 'bg-warning')} style={{ width: `${progress}%` }} />
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted">{message}</p>
            )}
            {netSales > 0 && (
              <p className="border-t border-border pt-3 text-sm text-fg">
                {t.finance.expensesShare.replace('{n}', pct((expenses / netSales) * 100))}
              </p>
            )}
          </>
        )}
      </CardBody>
    </Card>
  )
}

// ── Six-month trend ──────────────────────────────────────────────────────────

export interface TrendPoint {
  month: string
  label: string
  sales: number | null
  expenses: number | null
}

export function TrendCard({ points, loading, error }: { points: TrendPoint[]; loading: boolean; error: string | null }) {
  const { t } = useI18n()
  const ready = points.length > 0 && points.every((p) => p.sales !== null && p.expenses !== null)
  const max = Math.max(1, ...points.flatMap((p) => [p.sales ?? 0, p.expenses ?? 0]))
  const height = (v: number | null) => `${Math.max(v ? 2 : 0, ((v ?? 0) / max) * 100)}%`

  return (
    <Card>
      <Title note={t.finance.trendNote}>{t.finance.trend}</Title>
      <CardBody className="px-4 py-4 sm:px-6">
        {!ready ? (
          <CardState loading={loading} error={error} />
        ) : (
          <>
            <div className="mb-3 flex flex-wrap gap-4 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-brand" />{t.finance.trendSales}</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-warning" />{t.finance.trendExpenses}</span>
            </div>
            <ol className="grid grid-cols-6 gap-2">
              {points.map((p) => (
                <li key={p.month} className="flex min-w-0 flex-col items-center gap-1.5">
                  <div
                    className="flex h-32 w-full items-end justify-center gap-1"
                    role="img"
                    aria-label={`${p.label}: ${t.finance.trendSales} ${formatCurrency(p.sales ?? 0)}, ${t.finance.trendExpenses} ${formatCurrency(p.expenses ?? 0)}`}
                  >
                    <div className="w-1/3 max-w-5 rounded-t bg-brand" style={{ height: height(p.sales) }} title={formatCurrency(p.sales ?? 0)} />
                    <div className="w-1/3 max-w-5 rounded-t bg-warning" style={{ height: height(p.expenses) }} title={formatCurrency(p.expenses ?? 0)} />
                  </div>
                  <span className="w-full truncate text-center text-[11px] text-muted">{p.label}</span>
                  <span className="w-full truncate text-center text-[11px] font-medium tabular-nums text-fg">
                    {fmtNum(Math.round(p.sales ?? 0), { notation: 'compact', maximumFractionDigits: 1 })}
                  </span>
                </li>
              ))}
            </ol>
          </>
        )}
      </CardBody>
    </Card>
  )
}
