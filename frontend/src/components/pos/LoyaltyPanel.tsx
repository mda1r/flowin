import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Gift, Search, UserPlus, UserRound, X } from 'lucide-react'
import { customersApi } from '@/api/customers'
import { useAuthStore } from '@/stores/authStore'
import { cn, formatCurrency, normalizeArabic } from '@/lib/utils'
import { pointsEarned, pointsValue } from '@/lib/loyalty'
import { normalizePhoneForWhatsApp, toAsciiDigits } from '@/lib/whatsapp'
import { apiErrorMessage } from '@/lib/apiError'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { toast } from '@/components/ui/Toast'
import { useI18n } from '@/i18n'
import type { CustomerResponse, LoyaltySettings } from '@/types/api'
import { intlLocale } from '@/lib/locale'

interface LoyaltyPanelProps {
  customer: CustomerResponse | null
  onCustomerChange: (customer: CustomerResponse | null) => void
  redeemPoints: number
  onRedeemPointsChange: (points: number) => void
  maxRedeemable: number
  // What the customer pays after the order discount and the points used: the server earns points on this.
  earnBase: number
  rules: LoyaltySettings
}

// A search made only of digits and phone punctuation, in any digit set: it prefills the phone of a new customer.
const looksLikePhone = (text: string) => /^[\d\s+()-]+$/.test(toAsciiDigits(text)) && /\d/.test(toAsciiDigits(text))

// The one result Enter should pick: the only one, or the only one whose phone or name is exactly what was typed.
function exactMatch(results: CustomerResponse[], term: string): CustomerResponse | null {
  if (results.length === 1) return results[0]
  const phone = normalizePhoneForWhatsApp(term)
  const byPhone = phone ? results.filter((c) => c.phone && normalizePhoneForWhatsApp(c.phone) === phone) : []
  if (byPhone.length === 1) return byPhone[0]
  const name = normalizeArabic(term.trim()).toLowerCase()
  const byName = results.filter((c) => normalizeArabic(c.name.trim()).toLowerCase() === name)
  return byName.length === 1 ? byName[0] : null
}

const subscribeOnline = (onChange: () => void) => {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}
const useOnline = () => useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true)

interface NewCustomer {
  name: string
  phone: string
  birthday: string
  optIn: boolean
}

export function LoyaltyPanel({
  customer,
  onCustomerChange,
  redeemPoints,
  onRedeemPointsChange,
  maxRedeemable,
  earnBase,
  rules,
}: LoyaltyPanelProps) {
  const { tenantId } = useAuthStore()
  const { t } = useI18n()
  const qc = useQueryClient()
  const online = useOnline()
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  // Enter pressed before the debounced search caught up: pick once that search answers.
  const pendingEnter = useRef<string | null>(null)
  const [draft, setDraft] = useState<NewCustomer | null>(null)

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(query.trim()), 250)
    return () => window.clearTimeout(id)
  }, [query])

  const { data, isFetching } = useQuery({
    queryKey: ['pos-customer-search', tenantId, debounced],
    queryFn: () => customersApi.list(tenantId!, { search: debounced, pageSize: 5 }),
    enabled: !!tenantId && !customer && debounced.length >= 2,
  })
  const results: CustomerResponse[] = data?.data ?? []

  const pick = (c: CustomerResponse) => {
    onCustomerChange(c)
    onRedeemPointsChange(0)
    setQuery('')
    setDebounced('')
    pendingEnter.current = null
  }

  useEffect(() => {
    const term = pendingEnter.current
    if (!term || term !== debounced || isFetching || !data) return
    pendingEnter.current = null
    const match = exactMatch(data.data, term)
    if (match) pick(match)
    // pick is recreated each render; the search answering is what matters here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, isFetching, debounced])

  const create = useMutation({
    mutationFn: (d: NewCustomer) =>
      customersApi
        .create(tenantId!, {
          name: d.name.trim(),
          phone: d.phone.trim() || undefined,
          dateOfBirth: d.birthday || undefined,
          marketingOptIn: d.optIn,
        })
        .then((r) => r.data),
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ['customers', tenantId] })
      qc.invalidateQueries({ queryKey: ['pos-customer-search', tenantId] })
      setDraft(null)
      pick(c)
      toast.success(t.customers.quickAdded.replace('{name}', c.name))
    },
    onError: (err) => toast.error(apiErrorMessage(err, t.customers.failed)),
  })

  const openNewCustomer = () => {
    const term = query.trim()
    const phone = looksLikePhone(term)
    setDraft({ name: phone ? '' : term, phone: phone ? toAsciiDigits(term) : '', birthday: '', optIn: false })
  }

  const draftPhoneInvalid = !!draft && draft.phone.trim() !== '' && !normalizePhoneForWhatsApp(draft.phone)
  const canSave = !!draft && draft.name.trim() !== '' && !draftPhoneInvalid && online
  const today = new Date().toISOString().slice(0, 10)

  const newCustomerModal =
    draft &&
    createPortal(
      <Modal
        open
        onClose={() => { if (!create.isPending) setDraft(null) }}
        title={t.customers.newCustomer}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDraft(null)} disabled={create.isPending}>
              {t.common.cancel}
            </Button>
            <Button type="submit" form="pos-new-customer" loading={create.isPending} disabled={!canSave}>
              {t.common.save}
            </Button>
          </>
        }
      >
        <form
          id="pos-new-customer"
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (canSave) create.mutate(draft)
          }}
        >
          <Input
            label={t.customers.name}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            data-autofocus={draft.name === '' ? true : undefined}
            maxLength={256}
            required
          />
          <Input
            label={t.customers.phone}
            type="tel"
            inputMode="tel"
            dir="ltr"
            placeholder="05XXXXXXXX"
            value={draft.phone}
            onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
            error={draftPhoneInvalid ? t.customers.phoneInvalid : undefined}
            data-autofocus={draft.name !== '' ? true : undefined}
            maxLength={32}
          />
          <Input
            label={`${t.customers.birthday} (${t.common.optional})`}
            type="date"
            max={today}
            value={draft.birthday}
            onChange={(e) => setDraft({ ...draft, birthday: e.target.value })}
          />
          <label className="flex items-start gap-2.5 rounded-xl border border-border bg-surface-2/60 px-3 py-2.5 text-sm text-fg">
            <input
              type="checkbox"
              className="mt-0.5 accent-[rgb(var(--brand-ink))]"
              checked={draft.optIn}
              onChange={(e) => setDraft({ ...draft, optIn: e.target.checked })}
            />
            <span>
              {t.customers.whatsAppOptIn}
              <span className="block text-xs text-muted">{t.customers.optInHint}</span>
            </span>
          </label>
          {!online && <p className="text-xs text-warning">{t.customers.needsInternet}</p>}
        </form>
      </Modal>,
      document.body,
    )

  if (!customer) {
    return (
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          className="input ps-9 text-sm"
          placeholder="عميل الولاء: ابحث بالاسم أو الجوال"
          value={query}
          onChange={(e) => {
            pendingEnter.current = null
            setQuery(e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            const term = query.trim()
            if (term.length < 2) return
            e.preventDefault()
            if (term === debounced && !isFetching && data) {
              const match = exactMatch(results, term)
              if (match) pick(match)
            } else {
              pendingEnter.current = term
              setDebounced(term)
            }
          }}
          aria-label="بحث عن عميل"
          title={t.customers.enterToPick}
        />
        {debounced.length >= 2 && (
          <ul className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-border bg-surface shadow-md">
            {isFetching && results.length === 0 ? (
              <li className="px-3 py-2 text-xs text-muted">جاري البحث…</li>
            ) : results.length === 0 ? (
              <li className="space-y-1.5 px-3 py-2">
                <p className="text-xs text-muted">لا يوجد عميل بهذا الاسم أو الرقم</p>
                <button
                  type="button"
                  onClick={openNewCustomer}
                  disabled={!online}
                  className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-brand/40 bg-brand-soft px-3 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <UserPlus className="h-4 w-4" />
                  {t.customers.quickAdd}
                </button>
                {!online && <p className="text-xs text-muted">{t.customers.needsInternet}</p>}
              </li>
            ) : (
              results.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-start text-sm hover:bg-surface-2"
                    onClick={() => pick(c)}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-fg">{c.name}</span>
                      {c.phone && <span className="block text-xs text-muted" dir="ltr">{c.phone}</span>}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-brand-ink">{c.loyaltyPoints.toLocaleString(intlLocale())} نقطة</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
        {newCustomerModal}
      </div>
    )
  }

  const using = redeemPoints > 0
  return (
    <div className="space-y-2 rounded-xl border border-border bg-surface-2/60 p-3">
      <div className="flex items-center gap-2">
        <UserRound className="h-4 w-4 shrink-0 text-muted" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{customer.name}</span>
        {rules.enabled && (
          <span className="shrink-0 text-xs tabular-nums text-brand-ink">{customer.loyaltyPoints.toLocaleString(intlLocale())} نقطة</span>
        )}
        <button
          type="button"
          onClick={() => {
            onCustomerChange(null)
            onRedeemPointsChange(0)
          }}
          className="rounded-md p-1 text-muted hover:bg-surface hover:text-fg"
          aria-label="إزالة العميل"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {maxRedeemable > 0 && (
        <button
          type="button"
          onClick={() => onRedeemPointsChange(using ? 0 : maxRedeemable)}
          aria-pressed={using}
          className={cn(
            'flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
            using ? 'border-brand bg-brand-soft text-brand-ink' : 'border-border bg-surface text-fg hover:bg-surface-2',
          )}
        >
          <span className="flex items-center gap-2">
            <Gift className="h-4 w-4" />
            {using ? `استبدال ${redeemPoints.toLocaleString(intlLocale())} نقطة` : 'استبدال النقاط'}
          </span>
          <span className="tabular-nums">−{formatCurrency(pointsValue(using ? redeemPoints : maxRedeemable, rules))}</span>
        </button>
      )}

      {rules.enabled && maxRedeemable === 0 && customer.loyaltyPoints > 0 && customer.loyaltyPoints < rules.minRedeemPoints && (
        <p className="text-xs text-muted">
          يبدأ الاستبدال من <span className="tabular-nums text-fg">{rules.minRedeemPoints.toLocaleString(intlLocale())}</span> نقطة
        </p>
      )}

      {rules.enabled && (
        <p className="text-xs text-muted">
          سيكسب العميل <span className="tabular-nums text-fg">{pointsEarned(earnBase, rules).toLocaleString(intlLocale())}</span> نقطة من هذه الفاتورة
        </p>
      )}
    </div>
  )
}
