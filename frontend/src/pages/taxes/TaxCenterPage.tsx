import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Calculator,
  LayoutDashboard,
  FileText,
  ShoppingBag,
  AlertTriangle,
  RefreshCw,
  BookOpen,
  CalendarDays,
  ChevronDown,
  Lock,
  ServerCrash,
  Plus,
  Trash2,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  ScanLine,
  X,
  Sparkles,
} from 'lucide-react'
import { useI18n } from '@/i18n'
import { isAxiosError } from 'axios'
import { useAuthStore } from '@/stores/authStore'
import { aiCashierApi } from '@/api/aiCashier'
import {
  taxApi,
  TaxPeriodResponse,
  TaxOverviewResponse,
  TaxLedgerResult,
  TaxAnomalyResponse,
  VatReturnResponse,
  TaxExpenseInvoiceResponse,
} from '@/api/tax'
import { TaxAiDrawer } from '@/components/tax/TaxAiDrawer'

// ── Types ─────────────────────────────────────────────────────────────────────

type TabKey = 'overview' | 'vatReturn' | 'purchases' | 'issues' | 'ledger'

// ── Formatters ────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-SA', { year: 'numeric', month: 'short', day: 'numeric' })
}

// ── UI Primitives ─────────────────────────────────────────────────────────────

function TabSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)]" />
        ))}
      </div>
      <div className="h-64 rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)]" />
    </div>
  )
}

interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description: string
  action?: React.ReactNode
}

function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div
        className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{ background: 'color-mix(in srgb, var(--accent) 10%, transparent)', color: 'var(--accent)' }}
      >
        {icon}
      </div>
      <h3 className="mb-2 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
      <p className="mb-6 max-w-sm text-sm" style={{ color: 'var(--text-secondary)' }}>{description}</p>
      {action}
    </div>
  )
}

function ErrorState({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
        <ServerCrash className="h-7 w-7" />
      </div>
      <h3 className="mb-2 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Failed to load</h3>
      <p className="max-w-sm text-sm" style={{ color: 'var(--text-secondary)' }}>
        {message ?? 'An error occurred while loading tax data.'}
      </p>
    </div>
  )
}

function PermissionDeniedState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
        <Lock className="h-7 w-7" />
      </div>
      <h3 className="mb-2 text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Access Restricted</h3>
      <p className="max-w-sm text-sm" style={{ color: 'var(--text-secondary)' }}>
        You don't have permission to view tax data. Contact your account owner.
      </p>
    </div>
  )
}

function NoPeriodState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <EmptyState
      icon={<CalendarDays className="h-8 w-8" />}
      title="No Tax Period Selected"
      description="Create a tax period to start tracking VAT obligations, reviewing transactions, and preparing your VAT return."
      action={
        <button
          onClick={onCreateClick}
          className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ background: 'var(--accent)' }}
        >
          <Plus className="h-4 w-4" />
          Create Tax Period
        </button>
      }
    />
  )
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string
  value: string
  sub?: string
  icon: React.ReactNode
  color?: string
  badge?: React.ReactNode
}

function KpiCard({ label, value, sub, icon, color = 'var(--accent)', badge }: KpiCardProps) {
  return (
    <div
      className="flex flex-col gap-3 rounded-xl border p-5"
      style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
          {label}
        </span>
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}
        >
          {icon}
        </div>
      </div>
      <div className="flex items-end justify-between">
        <span className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>{value}</span>
        {badge}
      </div>
      {sub && <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{sub}</span>}
    </div>
  )
}

// ── Readiness Badge ───────────────────────────────────────────────────────────

function ReadinessBadge({ score }: { score: number }) {
  const color = score >= 80 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444'
  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color }}
    >
      {score}%
    </span>
  )
}

// ── Severity Badge ────────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, { bg: string; text: string }> = {
    error:   { bg: '#ef444420', text: '#ef4444' },
    warning: { bg: '#f59e0b20', text: '#f59e0b' },
    info:    { bg: '#3b82f620', text: '#3b82f6' },
  }
  const style = map[severity] ?? { bg: '#6b728020', text: '#6b7280' }
  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs font-semibold capitalize"
      style={{ background: style.bg, color: style.text }}
    >
      {severity}
    </span>
  )
}

// ── Period Status Badge ───────────────────────────────────────────────────────

function PeriodStatusBadge({ status }: { status: string }) {
  const isOpen = status === 'open'
  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs font-semibold capitalize"
      style={{
        background: isOpen ? '#22c55e20' : '#6b728020',
        color: isOpen ? '#22c55e' : '#9ca3af',
      }}
    >
      {status}
    </span>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className="relative w-full max-w-md rounded-2xl border p-6 shadow-2xl"
        style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-black/10">
            <X className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Create Period Modal ───────────────────────────────────────────────────────

const createPeriodSchema = z.object({
  startDate: z.string().min(1, 'Required'),
  endDate: z.string().min(1, 'Required'),
  notes: z.string().optional(),
})
type CreatePeriodForm = z.infer<typeof createPeriodSchema>

function CreatePeriodModal({ onClose, onCreated }: { onClose: () => void; onCreated: (p: TaxPeriodResponse) => void }) {
  const qc = useQueryClient()
  const { register, handleSubmit, formState: { errors } } = useForm<CreatePeriodForm>({
    resolver: zodResolver(createPeriodSchema),
  })

  const createMutation = useMutation({
    mutationFn: (data: CreatePeriodForm) => taxApi.createPeriod(data),
    onSuccess: (period) => {
      qc.invalidateQueries({ queryKey: ['tax', 'periods'] })
      onCreated(period)
    },
  })

  function onSubmit(data: CreatePeriodForm) {
    createMutation.mutate(data)
  }

  const inputStyle = {
    background: 'var(--input-bg, var(--card-bg))',
    borderColor: 'var(--card-border)',
    color: 'var(--text-primary)',
  }

  return (
    <Modal title="Create Tax Period" onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            Start Date
          </label>
          <input
            type="date"
            {...register('startDate')}
            className="w-full rounded-xl border px-3 py-2 text-sm"
            style={inputStyle}
          />
          {errors.startDate && <p className="mt-1 text-xs text-red-500">{errors.startDate.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            End Date
          </label>
          <input
            type="date"
            {...register('endDate')}
            className="w-full rounded-xl border px-3 py-2 text-sm"
            style={inputStyle}
          />
          {errors.endDate && <p className="mt-1 text-xs text-red-500">{errors.endDate.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            Notes (optional)
          </label>
          <input
            type="text"
            {...register('notes')}
            className="w-full rounded-xl border px-3 py-2 text-sm"
            style={inputStyle}
            placeholder="e.g. Q1 2025"
          />
        </div>
        {createMutation.error && (
          <p className="text-xs text-red-500">
            {isAxiosError(createMutation.error)
              ? (createMutation.error.response?.data?.detail ?? 'Failed to create period. Please try again.')
              : 'Failed to create period. Please try again.'}
          </p>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            style={{ background: 'var(--accent)' }}
          >
            {createMutation.isPending ? 'Creating…' : 'Create Period'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── Record Expense Modal ──────────────────────────────────────────────────────

const expenseSchema = z.object({
  supplierName: z.string().min(1, 'Required'),
  supplierVatNumber: z.string().optional(),
  invoiceNumber: z.string().min(1, 'Required'),
  invoiceDate: z.string().min(1, 'Required'),
  baseAmount: z.coerce.number().positive('Must be > 0'),
  taxAmount: z.coerce.number().min(0),
  taxRate: z.coerce.number().min(0).max(1),
  currency: z.string().min(1, 'Required'),
  notes: z.string().optional(),
})
type ExpenseForm = z.infer<typeof expenseSchema>

function RecordExpenseModal({
  periodId,
  onClose,
}: {
  periodId: string
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { register, handleSubmit, formState: { errors } } = useForm<ExpenseForm>({
    resolver: zodResolver(expenseSchema),
    defaultValues: { taxRate: 0.15, currency: 'SAR' },
  })

  const mutation = useMutation({
    mutationFn: (data: ExpenseForm) =>
      taxApi.recordExpense({ ...data, periodId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tax', 'expenses'] })
      onClose()
    },
  })

  const inputCls = 'w-full rounded-xl border px-3 py-2 text-sm'
  const inputStyle = {
    background: 'var(--input-bg, var(--card-bg))',
    borderColor: 'var(--card-border)',
    color: 'var(--text-primary)',
  }

  return (
    <Modal title="Record Expense Invoice" onClose={onClose}>
      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Supplier Name</label>
            <input type="text" {...register('supplierName')} className={inputCls} style={inputStyle} />
            {errors.supplierName && <p className="mt-1 text-xs text-red-500">{errors.supplierName.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Supplier VAT No.</label>
            <input type="text" {...register('supplierVatNumber')} className={inputCls} style={inputStyle} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Invoice No.</label>
            <input type="text" {...register('invoiceNumber')} className={inputCls} style={inputStyle} />
            {errors.invoiceNumber && <p className="mt-1 text-xs text-red-500">{errors.invoiceNumber.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Invoice Date</label>
            <input type="date" {...register('invoiceDate')} className={inputCls} style={inputStyle} />
            {errors.invoiceDate && <p className="mt-1 text-xs text-red-500">{errors.invoiceDate.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Currency</label>
            <input type="text" {...register('currency')} className={inputCls} style={inputStyle} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Base Amount</label>
            <input type="number" step="0.01" {...register('baseAmount')} className={inputCls} style={inputStyle} />
            {errors.baseAmount && <p className="mt-1 text-xs text-red-500">{errors.baseAmount.message}</p>}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Tax Amount</label>
            <input type="number" step="0.01" {...register('taxAmount')} className={inputCls} style={inputStyle} />
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Notes</label>
            <input type="text" {...register('notes')} className={inputCls} style={inputStyle} />
          </div>
        </div>
        {mutation.error && <p className="text-xs text-red-500">Failed to record invoice. Please try again.</p>}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            style={{ background: 'var(--accent)' }}
          >
            {mutation.isPending ? 'Saving…' : 'Save Invoice'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── Tab: Overview ─────────────────────────────────────────────────────────────

function OverviewTab({
  periodId,
  onCreatePeriod,
  permDenied,
}: {
  periodId: string | null
  onCreatePeriod: () => void
  permDenied?: boolean
}) {
  const { data, isLoading, error } = useQuery<TaxOverviewResponse>({
    queryKey: ['tax', 'overview', periodId],
    queryFn: () => taxApi.getOverview(periodId!),
    enabled: !!periodId,
  })

  if (permDenied) return <PermissionDeniedState />
  if (!periodId) return <NoPeriodState onCreateClick={onCreatePeriod} />
  if (isLoading) return <TabSkeleton />
  if (error || !data) return <ErrorState />

  const netColor = data.netVatPayable >= 0 ? '#ef4444' : '#22c55e'

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Output VAT"
          value={`SAR ${fmt(data.totalOutputVat)}`}
          sub={`${data.saleTransactionCount} transactions`}
          icon={<TrendingUp className="h-4 w-4" />}
          color="#ef4444"
        />
        <KpiCard
          label="Input VAT (Claimable)"
          value={`SAR ${fmt(data.totalInputVat)}`}
          sub={`${data.purchaseInvoiceCount} invoices`}
          icon={<TrendingDown className="h-4 w-4" />}
          color="#22c55e"
        />
        <KpiCard
          label="Net VAT Due"
          value={`SAR ${fmt(Math.abs(data.netVatPayable))}`}
          sub={data.netVatPayable >= 0 ? 'Payable to ZATCA' : 'Refundable'}
          icon={<Minus className="h-4 w-4" />}
          color={netColor}
        />
        <KpiCard
          label="Tax Readiness"
          value={`${data.taxReadinessScore}/100`}
          sub={`${data.openAnomalyCount} open issues`}
          icon={<CheckCircle className="h-4 w-4" />}
          color="#3b82f6"
          badge={<ReadinessBadge score={data.taxReadinessScore} />}
        />
      </div>

      <div
        className="rounded-xl border p-5"
        style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
      >
        <h3 className="mb-4 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Period Summary</h3>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4">
          {[
            ['Total Sales (Base)', `SAR ${fmt(data.totalSalesBase)}`],
            ['Total Purchases (Base)', `SAR ${fmt(data.totalPurchasesBase)}`],
            ['Output VAT Collected', `SAR ${fmt(data.totalOutputVat)}`],
            ['Input VAT Claimable', `SAR ${fmt(data.totalInputVat)}`],
          ].map(([l, v]) => (
            <div key={l}>
              <dt className="text-xs" style={{ color: 'var(--text-secondary)' }}>{l}</dt>
              <dd className="mt-1 text-sm font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}

// ── Tab: VAT Return ───────────────────────────────────────────────────────────

function VatReturnTab({
  periodId,
  onCreatePeriod,
}: {
  periodId: string | null
  onCreatePeriod: () => void
}) {
  const { data, isLoading, error } = useQuery<VatReturnResponse>({
    queryKey: ['tax', 'vat-return', periodId],
    queryFn: () => taxApi.getVatReturn(periodId!),
    enabled: !!periodId,
  })

  if (!periodId) return <NoPeriodState onCreateClick={onCreatePeriod} />
  if (isLoading) return <TabSkeleton />
  if (error || !data) return <ErrorState />

  const boxes = [
    { label: 'Box 1 – Standard-rated sales (15%)', value: data.box1StandardRatedSales, vat: data.box1OutputVat },
    { label: 'Box 2 – Zero-rated sales', value: data.box2ZeroRatedSales, vat: null },
    { label: 'Box 3 – Exempt sales', value: data.box3ExemptSales, vat: null },
    { label: 'Box 6 – Standard-rated purchases (15%)', value: data.box6StandardRatedPurchases, vat: data.box6InputVat },
    { label: 'Box 7 – Zero-rated purchases', value: data.box7ZeroRatedPurchases, vat: null },
    { label: 'Box 8 – Exempt purchases', value: data.box8ExemptPurchases, vat: null },
  ]

  return (
    <div className="space-y-4">
      <div
        className="rounded-xl border"
        style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
      >
        <div className="border-b px-5 py-4" style={{ borderColor: 'var(--card-border)' }}>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>ZATCA Form 15 — VAT Return</h3>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
            {fmtDate(data.startDate)} – {fmtDate(data.endDate)}
          </p>
        </div>
        <div className="divide-y" style={{ borderColor: 'var(--card-border)' }}>
          {boxes.map((b) => (
            <div key={b.label} className="flex items-center justify-between px-5 py-3">
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{b.label}</span>
              <div className="text-right">
                <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                  SAR {fmt(b.value)}
                </span>
                {b.vat !== null && (
                  <div className="text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                    VAT: SAR {fmt(b.vat)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        <div
          className="flex items-center justify-between rounded-b-xl px-5 py-4"
          style={{ background: 'color-mix(in srgb, var(--accent) 8%, transparent)' }}
        >
          <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            Box 11 – Net VAT Due
          </span>
          <span
            className="text-lg font-bold tabular-nums"
            style={{ color: data.box11NetVatDue >= 0 ? '#ef4444' : '#22c55e' }}
          >
            SAR {fmt(Math.abs(data.box11NetVatDue))}
            <span className="ml-1.5 text-xs font-normal">
              {data.box11NetVatDue >= 0 ? 'Payable' : 'Refundable'}
            </span>
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Tab: Purchases ────────────────────────────────────────────────────────────

function PurchasesTab({
  periodId,
  onCreatePeriod,
}: {
  periodId: string | null
  onCreatePeriod: () => void
}) {
  const [showModal, setShowModal] = useState(false)
  const qc = useQueryClient()

  const { data: expenses = [], isLoading, error } = useQuery<TaxExpenseInvoiceResponse[]>({
    queryKey: ['tax', 'expenses', periodId],
    queryFn: () => taxApi.listExpenses(periodId ?? undefined),
    enabled: true,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => taxApi.deleteExpense(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tax', 'expenses'] }),
  })

  if (!periodId) return <NoPeriodState onCreateClick={onCreatePeriod} />
  if (isLoading) return <TabSkeleton />
  if (error) return <ErrorState />

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Expense Invoices ({expenses.length})
          </h3>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white"
            style={{ background: 'var(--accent)' }}
          >
            <Plus className="h-4 w-4" />
            Add Invoice
          </button>
        </div>

        {expenses.length === 0 ? (
          <EmptyState
            icon={<ShoppingBag className="h-8 w-8" />}
            title="No Expense Invoices"
            description="Add supplier invoices to claim input VAT deductions."
            action={
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-white"
                style={{ background: 'var(--accent)' }}
              >
                <Plus className="h-4 w-4" />
                Add Invoice
              </button>
            }
          />
        ) : (
          <div
            className="overflow-hidden rounded-xl border"
            style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'var(--card-border)' }}>
                    {['Supplier', 'Invoice No.', 'Date', 'Base', 'VAT', 'Currency', ''].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--card-border)' }}>
                  {expenses.map((e) => (
                    <tr key={e.id}>
                      <td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>
                        <div className="font-medium">{e.supplierName}</div>
                        {e.supplierVatNumber && (
                          <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{e.supplierVatNumber}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{e.invoiceNumber}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{fmtDate(e.invoiceDate)}</td>
                      <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--text-primary)' }}>SAR {fmt(e.baseAmount)}</td>
                      <td className="px-4 py-3 tabular-nums" style={{ color: '#22c55e' }}>SAR {fmt(e.taxAmount)}</td>
                      <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{e.currency}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => deleteMutation.mutate(e.id)}
                          disabled={deleteMutation.isPending}
                          className="rounded-lg p-1 hover:bg-red-500/10 text-red-500 disabled:opacity-40"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showModal && periodId && (
        <RecordExpenseModal periodId={periodId} onClose={() => setShowModal(false)} />
      )}
    </>
  )
}

// ── Tab: Issues ───────────────────────────────────────────────────────────────

function IssuesTab({
  periodId,
  onCreatePeriod,
}: {
  periodId: string | null
  onCreatePeriod: () => void
}) {
  const qc = useQueryClient()
  const [includeResolved, setIncludeResolved] = useState(false)

  const { data: anomalies = [], isLoading, error } = useQuery<TaxAnomalyResponse[]>({
    queryKey: ['tax', 'anomalies', periodId, includeResolved],
    queryFn: () => taxApi.getAnomalies(periodId!, includeResolved),
    enabled: !!periodId,
  })

  const scanMutation = useMutation({
    mutationFn: () => taxApi.scanAnomalies(periodId!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tax', 'anomalies'] }),
  })

  if (!periodId) return <NoPeriodState onCreateClick={onCreatePeriod} />
  if (isLoading) return <TabSkeleton />
  if (error) return <ErrorState />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Issues ({anomalies.length})
          </h3>
          <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
            <input
              type="checkbox"
              checked={includeResolved}
              onChange={(e) => setIncludeResolved(e.target.checked)}
              className="rounded"
            />
            Show resolved
          </label>
        </div>
        <button
          onClick={() => scanMutation.mutate()}
          disabled={scanMutation.isPending}
          className="flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium disabled:opacity-60"
          style={{ borderColor: 'var(--card-border)', color: 'var(--text-primary)', background: 'var(--card-bg)' }}
        >
          <ScanLine className="h-4 w-4" />
          {scanMutation.isPending ? 'Scanning…' : 'Scan for Issues'}
        </button>
      </div>

      {anomalies.length === 0 ? (
        <EmptyState
          icon={<AlertTriangle className="h-8 w-8" />}
          title="No Issues Found"
          description="Great news — no tax anomalies detected for this period."
        />
      ) : (
        <div className="space-y-3">
          {anomalies.map((a) => (
            <div
              key={a.id}
              className="rounded-xl border p-4"
              style={{
                background: 'var(--card-bg)',
                borderColor: 'var(--card-border)',
                opacity: a.isResolved ? 0.6 : 1,
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <SeverityBadge severity={a.severity} />
                    <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>{a.ruleCode}</span>
                    {a.isResolved && (
                      <span className="text-xs text-green-500 flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" /> Resolved
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{a.title}</p>
                  <p className="mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>{a.description}</p>
                  {a.transactionRef && (
                    <p className="mt-1 text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
                      Ref: {a.transactionRef}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {fmtDate(a.detectedAt)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Tab: Ledger ───────────────────────────────────────────────────────────────

function LedgerTab({
  periodId,
  onCreatePeriod,
}: {
  periodId: string | null
  onCreatePeriod: () => void
}) {
  const [page, setPage] = useState(1)
  const qc = useQueryClient()

  const { data, isLoading, error } = useQuery<TaxLedgerResult>({
    queryKey: ['tax', 'ledger', periodId, page],
    queryFn: () => taxApi.getLedger(periodId!, page),
    enabled: !!periodId,
  })

  const refreshMutation = useMutation({
    mutationFn: () => taxApi.refreshLedger(periodId!),
    onSuccess: () => {
      setPage(1)
      qc.invalidateQueries({ queryKey: ['tax', 'ledger'] })
      qc.invalidateQueries({ queryKey: ['tax', 'overview'] })
    },
  })

  if (!periodId) return <NoPeriodState onCreateClick={onCreatePeriod} />
  if (isLoading) return <TabSkeleton />
  if (error || !data) return <ErrorState />

  const totalPages = Math.ceil(data.totalCount / data.pageSize)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Tax Ledger ({data.totalCount} entries)
        </h3>
        <button
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
          className="flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium disabled:opacity-60"
          style={{ borderColor: 'var(--card-border)', color: 'var(--text-primary)', background: 'var(--card-bg)' }}
        >
          <RefreshCw className={`h-4 w-4 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
          {refreshMutation.isPending ? 'Importing…' : 'Import Sales'}
        </button>
      </div>

      {data.items.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-8 w-8" />}
          title="No Ledger Entries"
          description="Use 'Import Sales' to pull completed sales into the tax ledger, or add expense invoices."
        />
      ) : (
        <>
          <div
            className="overflow-hidden rounded-xl border"
            style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'var(--card-border)' }}>
                    {['Type', 'Transaction', 'Date', 'Base Amount', 'Tax Amount', 'Rate'].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--card-border)' }}>
                  {data.items.map((e) => (
                    <tr key={e.id}>
                      <td className="px-4 py-3">
                        <span
                          className="rounded-full px-2 py-0.5 text-xs font-semibold capitalize"
                          style={{
                            background: e.entryType === 'output' ? '#ef444415' : '#22c55e15',
                            color: e.entryType === 'output' ? '#ef4444' : '#22c55e',
                          }}
                        >
                          {e.entryType}
                        </span>
                      </td>
                      <td className="px-4 py-3 capitalize" style={{ color: 'var(--text-secondary)' }}>
                        {e.transactionType.replace(/([A-Z])/g, ' $1').trim()}
                      </td>
                      <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{fmtDate(e.effectiveDate)}</td>
                      <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--text-primary)' }}>SAR {fmt(e.baseAmount)}</td>
                      <td
                        className="px-4 py-3 tabular-nums"
                        style={{ color: e.entryType === 'output' ? '#ef4444' : '#22c55e' }}
                      >
                        SAR {fmt(e.taxAmount)}
                      </td>
                      <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                        {(e.taxRate * 100).toFixed(0)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span style={{ color: 'var(--text-secondary)' }}>
                Page {data.page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={data.page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded-xl border px-3 py-1.5 text-xs font-medium disabled:opacity-40"
                  style={{ borderColor: 'var(--card-border)', color: 'var(--text-primary)', background: 'var(--card-bg)' }}
                >
                  Previous
                </button>
                <button
                  disabled={data.page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-xl border px-3 py-1.5 text-xs font-medium disabled:opacity-40"
                  style={{ borderColor: 'var(--card-border)', color: 'var(--text-primary)', background: 'var(--card-bg)' }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Period Selector ───────────────────────────────────────────────────────────

function PeriodSelector({
  periods,
  selectedId,
  onChange,
  onCreateClick,
}: {
  periods: TaxPeriodResponse[]
  selectedId: string | null
  onChange: (id: string) => void
  onCreateClick: () => void
}) {
  const [open, setOpen] = useState(false)
  const selected = periods.find((p) => p.id === selectedId)

  return (
    <div className="relative flex items-center gap-2">
      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors"
          style={{
            background: 'var(--card-bg)',
            borderColor: 'var(--card-border)',
            color: 'var(--text-primary)',
          }}
        >
          <CalendarDays className="h-4 w-4" style={{ color: 'var(--accent)' }} />
          <span>
            {selected
              ? `${fmtDate(selected.startDate)} – ${fmtDate(selected.endDate)}`
              : 'Select Period'}
          </span>
          {selected && <PeriodStatusBadge status={selected.status} />}
          <ChevronDown className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
        </button>

        {open && (
          <div
            className="absolute right-0 top-full z-20 mt-1 w-72 rounded-xl border shadow-lg"
            style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
          >
            {periods.length === 0 ? (
              <div className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>No periods yet</div>
            ) : (
              <div className="max-h-60 overflow-y-auto divide-y" style={{ borderColor: 'var(--card-border)' }}>
                {periods.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { onChange(p.id); setOpen(false) }}
                    className="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-black/5"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    <span>{fmtDate(p.startDate)} – {fmtDate(p.endDate)}</span>
                    <PeriodStatusBadge status={p.status} />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <button
        onClick={onCreateClick}
        className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-white"
        style={{ background: 'var(--accent)' }}
      >
        <Plus className="h-4 w-4" />
        New Period
      </button>
    </div>
  )
}

// ── Tab definitions ───────────────────────────────────────────────────────────

type TabLabelKey = 'overview' | 'vatReturn' | 'purchases' | 'issues' | 'ledger'

interface TabDef {
  key: TabKey
  labelKey: TabLabelKey
  icon: React.ReactNode
}

const TABS: TabDef[] = [
  { key: 'overview',  labelKey: 'overview',  icon: <LayoutDashboard className="h-4 w-4" /> },
  { key: 'vatReturn', labelKey: 'vatReturn',  icon: <FileText className="h-4 w-4" /> },
  { key: 'purchases', labelKey: 'purchases',  icon: <ShoppingBag className="h-4 w-4" /> },
  { key: 'issues',    labelKey: 'issues',     icon: <AlertTriangle className="h-4 w-4" /> },
  { key: 'ledger',    labelKey: 'ledger',     icon: <BookOpen className="h-4 w-4" /> },
]

// ── TaxCenterPage ─────────────────────────────────────────────────────────────

export function TaxCenterPage() {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const [showCreatePeriod, setShowCreatePeriod] = useState(false)
  const [showAi, setShowAi] = useState(false)
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null)
  const branchId = useAuthStore((s) => s.branchId)

  const { data: aiFeature } = useQuery({
    queryKey: ['ai-available', branchId],
    queryFn: () => branchId ? aiCashierApi.isAvailable(branchId) : Promise.resolve({ available: false }),
    enabled: !!branchId,
  })
  const aiAvailable = aiFeature?.available ?? false

  const { data: periods = [], isLoading: periodsLoading } = useQuery<TaxPeriodResponse[]>({
    queryKey: ['tax', 'periods'],
    queryFn: () => taxApi.listPeriods(),
  })

  function handlePeriodCreated(p: TaxPeriodResponse) {
    setSelectedPeriodId(p.id)
    setShowCreatePeriod(false)
  }

  const tabProps = { periodId: selectedPeriodId, onCreatePeriod: () => setShowCreatePeriod(true) }

  return (
    <div className="flex h-full flex-col">
      {/* Page header */}
      <div
        className="flex shrink-0 flex-col gap-4 border-b px-6 pb-0 pt-6 sm:flex-row sm:items-start sm:justify-between"
        style={{ borderColor: 'var(--card-border)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'color-mix(in srgb, var(--accent) 12%, transparent)', color: 'var(--accent)' }}
          >
            <Calculator className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {t.taxes.title}
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {t.taxes.subtitle}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 pb-4">
          {periodsLoading ? (
            <div className="h-10 w-48 animate-pulse rounded-xl" style={{ background: 'var(--card-bg)' }} />
          ) : (
            <PeriodSelector
              periods={periods}
              selectedId={selectedPeriodId}
              onChange={setSelectedPeriodId}
              onCreateClick={() => setShowCreatePeriod(true)}
            />
          )}
          {aiAvailable && (
            <button
              onClick={() => setShowAi(true)}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ background: 'var(--accent)' }}
              title="المستشار الضريبي الذكي"
            >
              <Sparkles className="h-4 w-4" />
              ضريبي AI
            </button>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div
        className="shrink-0 overflow-x-auto border-b"
        style={{ borderColor: 'var(--card-border)' }}
      >
        <nav className="flex min-w-max px-6">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors"
                style={{
                  borderColor: isActive ? 'var(--accent)' : 'transparent',
                  color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                }}
              >
                {tab.icon}
                {t.taxes.tabs[tab.labelKey]}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {activeTab === 'overview'  && <OverviewTab  {...tabProps} />}
        {activeTab === 'vatReturn' && <VatReturnTab {...tabProps} />}
        {activeTab === 'purchases' && <PurchasesTab {...tabProps} />}
        {activeTab === 'issues'    && <IssuesTab    {...tabProps} />}
        {activeTab === 'ledger'    && <LedgerTab    {...tabProps} />}
      </div>

      {showCreatePeriod && (
        <CreatePeriodModal
          onClose={() => setShowCreatePeriod(false)}
          onCreated={handlePeriodCreated}
        />
      )}

      <TaxAiDrawer
        open={showAi}
        onClose={() => setShowAi(false)}
        periodId={selectedPeriodId}
      />
    </div>
  )
}
