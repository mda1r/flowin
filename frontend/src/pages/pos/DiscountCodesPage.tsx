import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, Pencil, Plus, TicketPercent, Trash2 } from 'lucide-react'
import { restaurantApi, type DiscountCodePayload } from '@/api/restaurant'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/i18n'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { ConfirmModal, Modal } from '@/components/ui/Modal'
import { toast } from '@/components/ui/Toast'
import { apiErrorMessage } from '@/lib/apiError'
import { riyadhYmd } from '@/lib/dates'
import {
  discountCodeState,
  expiryFromYmd,
  normalizeDiscountCode,
  QUICK_PERCENTS,
  ymdFromExpiry,
  type DiscountCodeState,
} from '@/lib/discountCodes'
import { intlLocale } from '@/lib/locale'
import { cn, formatCurrency } from '@/lib/utils'
import { toAsciiDigits } from '@/lib/whatsapp'
import type { DiscountCodeResponse, DiscountCodeType } from '@/types/api'

// The owner's discount codes: a cashier types one at the till and the server applies exactly its percentage,
// with no cashier cap or manager PIN. Codes are shared by every branch of the store.
interface Draft {
  id?: string
  code: string
  label: string
  type: DiscountCodeType
  value: string
  expiry: string
  maxUses: string
  isActive: boolean
  minOrderAmount: number
}

const EMPTY_DRAFT: Draft = { code: '', label: '', type: 'Percentage', value: '10', expiry: '', maxUses: '', isActive: true, minOrderAmount: 0 }

const STATE_TONE: Record<DiscountCodeState, string> = {
  active: 'bg-success/15 text-success',
  off: 'bg-surface-2 text-muted',
  expired: 'bg-warning/15 text-warning',
  usedUp: 'bg-danger/10 text-danger',
}

const fromCode = (c: DiscountCodeResponse): Draft => ({
  id: c.id,
  code: c.code,
  label: c.label ?? '',
  type: c.type,
  value: String(c.value),
  expiry: c.expiryDate ? ymdFromExpiry(c.expiryDate) : '',
  maxUses: c.maxUses > 0 ? String(c.maxUses) : '',
  isActive: c.isActive,
  minOrderAmount: c.minOrderAmount,
})

const payloadOf = (d: Draft): DiscountCodePayload => ({
  code: normalizeDiscountCode(d.code),
  label: d.label.trim() || null,
  type: d.type,
  value: Number(toAsciiDigits(d.value)),
  minOrderAmount: d.minOrderAmount,
  maxUses: d.maxUses.trim() ? Number(toAsciiDigits(d.maxUses)) : 0,
  expiryDate: d.expiry ? expiryFromYmd(d.expiry) : null,
})

export function DiscountCodesPage() {
  const { branchId, tenantId } = useAuthStore()
  const { t } = useI18n()
  const tc = t.discountCodes
  const qc = useQueryClient()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [toDelete, setToDelete] = useState<DiscountCodeResponse | null>(null)

  const { data: codes = [], isLoading } = useQuery({
    queryKey: ['discount-codes', tenantId],
    queryFn: async () => (await restaurantApi.listDiscountCodes(branchId!)).data,
    enabled: !!branchId,
  })

  const refresh = () => qc.invalidateQueries({ queryKey: ['discount-codes', tenantId] })

  const save = useMutation({
    mutationFn: (d: Draft) =>
      d.id
        ? restaurantApi.updateDiscountCode(branchId!, d.id, { ...payloadOf(d), isActive: d.isActive })
        : restaurantApi.createDiscountCode(branchId!, payloadOf(d)),
    onSuccess: (_, d) => {
      void refresh()
      setDraft(null)
      toast.success(d.id ? tc.saved : tc.created)
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  })

  // Switching a code off or on keeps everything else as it is.
  const toggle = useMutation({
    mutationFn: (c: DiscountCodeResponse) =>
      restaurantApi.updateDiscountCode(branchId!, c.id, {
        code: c.code,
        label: c.label ?? null,
        type: c.type,
        value: c.value,
        minOrderAmount: c.minOrderAmount,
        maxUses: c.maxUses,
        expiryDate: c.expiryDate,
        isActive: !c.isActive,
      }),
    onSuccess: ({ data }) => {
      void refresh()
      toast.success(data.isActive ? tc.turnedOn : tc.turnedOff)
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  })

  const remove = useMutation({
    mutationFn: (c: DiscountCodeResponse) => restaurantApi.deleteDiscountCode(branchId!, c.id),
    onSuccess: () => {
      void refresh()
      setToDelete(null)
      toast.success(tc.deleted)
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  })

  const valueText = (c: Pick<DiscountCodeResponse, 'type' | 'value'>) =>
    c.type === 'Percentage' ? `${c.value.toLocaleString(intlLocale())}٪` : formatCurrency(c.value)

  return (
    <div>
      <PageHeader
        title={tc.title}
        description={tc.description}
        icon={<TicketPercent className="h-5 w-5" />}
        action={
          <Button onClick={() => setDraft({ ...EMPTY_DRAFT })}>
            <Plus className="h-4 w-4" />
            {tc.add}
          </Button>
        }
      />

      <div className="p-4 sm:p-6">
        <Card>
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-16" />)}
            </div>
          ) : codes.length === 0 ? (
            <EmptyState
              icon={<TicketPercent />}
              title={tc.empty}
              description={tc.emptyHint}
              action={<Button onClick={() => setDraft({ ...EMPTY_DRAFT })}><Plus className="h-4 w-4" />{tc.add}</Button>}
            />
          ) : (
            <ul className="divide-y divide-border">
              {codes.map((c) => {
                const state = discountCodeState(c)
                return (
                  <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <span className="flex h-12 min-w-[3.5rem] shrink-0 items-center justify-center rounded-xl bg-brand-soft px-2 text-base font-bold tabular-nums text-brand-ink">
                      {valueText(c)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <bdi dir="ltr" className="font-mono text-sm font-semibold text-fg">{c.code}</bdi>
                        {c.label && <span className="truncate text-sm text-muted">{c.label}</span>}
                        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', STATE_TONE[state])}>{tc[state]}</span>
                      </div>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
                        <span className="inline-flex items-center gap-1">
                          <CalendarClock className="h-3.5 w-3.5" />
                          {c.expiryDate
                            ? new Date(`${ymdFromExpiry(c.expiryDate)}T00:00:00Z`).toLocaleDateString(intlLocale(), { timeZone: 'UTC' })
                            : tc.noExpiry}
                        </span>
                        <span className="tabular-nums">
                          {c.maxUses > 0
                            ? tc.usesOf.replace('{used}', c.usedCount.toLocaleString(intlLocale())).replace('{max}', c.maxUses.toLocaleString(intlLocale()))
                            : `${tc.usedTimes.replace('{n}', c.usedCount.toLocaleString(intlLocale()))} · ${tc.unlimited}`}
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        role="switch"
                        aria-label={`${tc.activeToggle}: ${c.code}`}
                        checked={c.isActive}
                        disabled={toggle.isPending}
                        onChange={() => toggle.mutate(c)}
                        className="me-2 h-5 w-9 shrink-0 cursor-pointer accent-[rgb(var(--brand-ink))]"
                      />
                      <button
                        type="button"
                        onClick={() => setDraft(fromCode(c))}
                        aria-label={`${tc.edit}: ${c.code}`}
                        className="flex h-11 w-11 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setToDelete(c)}
                        aria-label={`${t.common.delete}: ${c.code}`}
                        className="flex h-11 w-11 items-center justify-center rounded-lg text-muted hover:bg-danger/10 hover:text-danger"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>

      {draft && (
        <CodeEditor
          draft={draft}
          saving={save.isPending}
          onChange={setDraft}
          onClose={() => setDraft(null)}
          onSave={() => save.mutate(draft)}
        />
      )}

      <ConfirmModal
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={() => toDelete && remove.mutate(toDelete)}
        title={t.common.delete}
        message={tc.deleteConfirm.replace('{code}', toDelete?.code ?? '')}
        confirmLabel={t.common.delete}
        confirmVariant="danger"
        loading={remove.isPending}
      />
    </div>
  )
}

// The same rules the server checks, so the owner sees the problem before saving.
function draftError(d: Draft, tc: ReturnType<typeof useI18n>['t']['discountCodes']): Partial<Record<'code' | 'value' | 'maxUses' | 'expiry', string>> {
  const errors: Partial<Record<'code' | 'value' | 'maxUses' | 'expiry', string>> = {}
  const code = normalizeDiscountCode(d.code)
  if (!code) errors.code = tc.codeRequired
  else if (/\s/.test(code)) errors.code = tc.codeNoSpaces
  const value = Number(toAsciiDigits(d.value))
  if (d.type === 'Percentage' ? !(value >= 1 && value <= 100) : !(value > 0)) errors.value = tc.percentRange
  if (d.maxUses.trim() && !/^\d+$/.test(toAsciiDigits(d.maxUses.trim()))) errors.maxUses = tc.maxUsesInvalid
  // A new code cannot start already expired; an existing one may keep an old date.
  if (!d.id && d.expiry && d.expiry < riyadhYmd()) errors.expiry = tc.expiryPast
  return errors
}

function CodeEditor({
  draft,
  saving,
  onChange,
  onClose,
  onSave,
}: {
  draft: Draft
  saving: boolean
  onChange: (d: Draft) => void
  onClose: () => void
  onSave: () => void
}) {
  const { t } = useI18n()
  const tc = t.discountCodes
  const [touched, setTouched] = useState(false)
  const errors = draftError(draft, tc)
  const shown = touched ? errors : {}
  const set = (patch: Partial<Draft>) => onChange({ ...draft, ...patch })
  const percent = Number(toAsciiDigits(draft.value))

  const submit = () => {
    setTouched(true)
    if (Object.keys(errors).length === 0) onSave()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={draft.id ? tc.edit : tc.add}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>{t.common.cancel}</Button>
          <Button onClick={submit} loading={saving}>{t.common.save}</Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={tc.code}
            value={draft.code}
            onChange={(e) => set({ code: e.target.value.toUpperCase() })}
            maxLength={32}
            dir="ltr"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            className="font-mono"
            placeholder="STAFF10"
            hint={tc.codeHint}
            error={shown.code}
            data-autofocus
          />
          <Input
            label={tc.label}
            value={draft.label}
            onChange={(e) => set({ label: e.target.value })}
            maxLength={40}
            placeholder={tc.labelPlaceholder}
          />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-fg">{draft.type === 'Percentage' ? tc.percent : t.restaurant.discount}</p>
          {draft.type === 'Percentage' && (
            <div className="flex flex-wrap gap-2" role="group" aria-label={tc.percent}>
              {QUICK_PERCENTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={percent === p}
                  onClick={() => set({ value: String(p) })}
                  className={cn(
                    'h-11 min-w-[3.5rem] rounded-xl border px-3 text-sm font-bold tabular-nums transition-colors',
                    percent === p ? 'border-brand bg-brand text-brand-fg' : 'border-border bg-surface text-fg hover:bg-surface-2',
                  )}
                >
                  {p.toLocaleString(intlLocale())}٪
                </button>
              ))}
            </div>
          )}
          <Input
            aria-label={draft.type === 'Percentage' ? tc.otherPercent : t.restaurant.discount}
            type="text"
            inputMode="decimal"
            value={draft.value}
            placeholder={draft.type === 'Percentage' ? tc.otherPercent : undefined}
            onChange={(e) => set({ value: toAsciiDigits(e.target.value).replace(/[^\d.]/g, '') })}
            hint={draft.type === 'Percentage' ? tc.percentHint : undefined}
            error={shown.value}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={tc.expiry}
            type="date"
            value={draft.expiry}
            min={draft.id ? undefined : riyadhYmd()}
            onChange={(e) => set({ expiry: e.target.value })}
            hint={tc.expiryHint}
            error={shown.expiry}
          />
          <Input
            label={tc.maxUses}
            type="text"
            inputMode="numeric"
            value={draft.maxUses}
            onChange={(e) => set({ maxUses: toAsciiDigits(e.target.value).replace(/\D/g, '') })}
            placeholder={tc.unlimited}
            hint={tc.maxUsesHint}
            error={shown.maxUses}
          />
        </div>

        {draft.id && (
          <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-2 px-3 py-2.5">
            <span className="text-sm font-medium text-fg">{tc.activeToggle}</span>
            <input
              type="checkbox"
              role="switch"
              aria-label={tc.activeToggle}
              checked={draft.isActive}
              onChange={(e) => set({ isActive: e.target.checked })}
              className="h-5 w-9 shrink-0 cursor-pointer accent-[rgb(var(--brand-ink))]"
            />
          </label>
        )}
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  )
}
