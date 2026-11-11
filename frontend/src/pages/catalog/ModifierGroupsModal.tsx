import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Pencil, Plus, Power, Trash2 } from 'lucide-react'
import { catalogApi, type ModifierGroupPayload } from '@/api/catalog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Modal, ConfirmModal } from '@/components/ui/Modal'
import { toast } from '@/components/ui/Toast'
import { apiErrorMessage } from '@/lib/apiError'
import { netOfVat } from '@/lib/pricing'
import { toAsciiDigits } from '@/lib/whatsapp'
import { vatRate } from '@/lib/vat'
import { cn, formatCurrency } from '@/lib/utils'
import { useI18n } from '@/i18n'
import { localName } from '@/lib/localName'
import type { ModifierGroupResponse } from '@/types/api'

// The server keeps option prices net of VAT; the owner types and reads them VAT included, like shelf prices.
const grossOf = (net: number) => Math.round(net * (1 + vatRate()) * 100) / 100
const netOf = (gross: number) => Math.round(netOfVat(gross) * 10000) / 10000
// Accepts Arabic-Indic digits and the Arabic decimal mark; blank means free.
const parsePrice = (text: string) => {
  const clean = toAsciiDigits(text.trim()).replace(/[٫,]/g, '.')
  return clean === '' ? 0 : Number(clean)
}

const MAX_SELECT = 50

type OptionRow = {
  key: string
  id?: string
  name: string
  nameEn: string
  gross: string
  // The stored net price and how it was shown, so an untouched price is sent back exactly as it was.
  net?: number
  shownGross?: string
  isActive: boolean
}

type Draft = {
  id?: string
  name: string
  nameEn: string
  isRequired: boolean
  minSelect: number
  maxSelect: number
  sortOrder: number
  options: OptionRow[]
}

let rowSeq = 0
const newRow = (): OptionRow => ({ key: `new-${++rowSeq}`, name: '', nameEn: '', gross: '', isActive: true })

const toDraft = (g: ModifierGroupResponse): Draft => ({
  id: g.id,
  name: g.name,
  nameEn: g.nameEn ?? '',
  isRequired: g.isRequired,
  minSelect: g.minSelect,
  maxSelect: g.maxSelect,
  sortOrder: g.sortOrder,
  options: [...g.options]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((o) => {
      const shown = String(grossOf(o.priceDelta))
      return { key: o.id, id: o.id, name: o.name, nameEn: o.nameEn ?? '', gross: shown, net: o.priceDelta, shownGross: shown, isActive: o.isActive }
    }),
})

// "Pick 1", "Pick 1 to 2" or "Up to 3", the way the cashier will meet the group.
export function ruleLabel(
  g: { isRequired: boolean; minSelect: number; maxSelect: number },
  p: { pickExactly: string; pickRange: string; pickUpTo: string },
) {
  if (!g.isRequired) return p.pickUpTo.replace('{n}', String(g.maxSelect))
  return g.minSelect === g.maxSelect
    ? p.pickExactly.replace('{n}', String(g.minSelect))
    : p.pickRange.replace('{min}', String(g.minSelect)).replace('{max}', String(g.maxSelect))
}

export function ModifierGroupsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, lang } = useI18n()
  const p = t.products
  const qc = useQueryClient()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [tried, setTried] = useState(false)
  const [deactivating, setDeactivating] = useState<ModifierGroupResponse | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['modifier-groups'],
    queryFn: () => catalogApi.listModifierGroups(),
    enabled: open,
  })
  const groups = data?.data ?? []

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['modifier-groups'] })
    // The product list carries each product's groups.
    qc.invalidateQueries({ queryKey: ['products'] })
  }

  const save = useMutation({
    mutationFn: (payload: { id?: string; body: ModifierGroupPayload }) =>
      payload.id ? catalogApi.updateModifierGroup(payload.id, payload.body) : catalogApi.createModifierGroup(payload.body),
    onSuccess: () => {
      refresh()
      setDraft(null)
      toast.success(p.groupSaved)
    },
    onError: (err: unknown) => toast.error(p.groupSaveFailed, apiErrorMessage(err)),
  })

  const deactivate = useMutation({
    mutationFn: (groupId: string) => catalogApi.deactivateModifierGroup(groupId),
    onSuccess: () => {
      refresh()
      setDeactivating(null)
      toast.success(p.groupDeactivated)
    },
    onError: (err: unknown) => toast.error(p.groupDeactivateFailed, apiErrorMessage(err)),
  })

  const startNew = () => {
    setTried(false)
    setDraft({ name: '', nameEn: '', isRequired: false, minSelect: 0, maxSelect: 1, sortOrder: groups.length, options: [newRow()] })
  }

  const startEdit = (g: ModifierGroupResponse) => {
    setTried(false)
    setDraft(toDraft(g))
  }

  const patch = (change: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...change } : d))
  const patchRow = (key: string, change: Partial<OptionRow>) =>
    setDraft((d) => (d ? { ...d, options: d.options.map((o) => (o.key === key ? { ...o, ...change } : o)) } : d))
  const moveRow = (index: number, by: -1 | 1) =>
    setDraft((d) => {
      if (!d) return d
      const to = index + by
      if (to < 0 || to >= d.options.length) return d
      const options = [...d.options]
      ;[options[index], options[to]] = [options[to], options[index]]
      return { ...d, options }
    })

  // The same rules the server enforces, checked here so the owner sees them before saving.
  const problemOf = (d: Draft): string | null => {
    if (!d.name.trim()) return p.groupNameRequired
    if (d.options.length === 0) return p.needOneOption
    if (d.options.some((o) => !o.name.trim())) return p.optionNameRequired
    if (d.options.some((o) => !Number.isFinite(parsePrice(o.gross)) || parsePrice(o.gross) < 0)) return p.optionPriceInvalid
    const names = d.options.map((o) => o.name.trim().toLowerCase())
    if (new Set(names).size !== names.length) return p.optionDuplicate
    if (d.minSelect > d.maxSelect) return p.minAboveMax
    if (d.options.filter((o) => o.isActive).length < d.minSelect) return p.minAboveOptions
    return null
  }

  const submit = () => {
    if (!draft) return
    setTried(true)
    if (problemOf(draft)) return
    save.mutate({
      id: draft.id,
      body: {
        name: draft.name.trim(),
        nameEn: draft.nameEn.trim(),
        isRequired: draft.isRequired,
        minSelect: draft.isRequired ? draft.minSelect : 0,
        maxSelect: draft.maxSelect,
        sortOrder: draft.sortOrder,
        options: draft.options.map((o, i) => ({
          id: o.id,
          name: o.name.trim(),
          nameEn: o.nameEn.trim(),
          priceDelta: o.net !== undefined && o.gross === o.shownGross ? o.net : netOf(parsePrice(o.gross)),
          isActive: o.isActive,
          sortOrder: i,
        })),
      },
    })
  }

  const setCount = (field: 'minSelect' | 'maxSelect', text: string) => {
    const n = Math.max(1, Math.min(MAX_SELECT, Math.floor(Number(toAsciiDigits(text)) || 0)))
    patch({ [field]: n })
  }

  const problem = draft && tried ? problemOf(draft) : null

  return (
    <>
      <Modal
        open={open}
        onClose={() => (draft ? setDraft(null) : onClose())}
        title={draft ? (draft.id ? p.editGroup : p.newGroup) : p.modifiers}
        size="xl"
        footer={
          draft ? (
            <>
              <Button variant="secondary" onClick={() => setDraft(null)}>{t.common.back}</Button>
              <Button loading={save.isPending} onClick={submit}>{t.common.save}</Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={onClose}>{t.common.close}</Button>
              <Button onClick={startNew}>
                <Plus className="h-4 w-4" />
                {p.newGroup}
              </Button>
            </>
          )
        }
      >
        {draft ? (
          <div className="space-y-4">
            <Input
              label={p.groupName}
              placeholder={p.groupNamePlaceholder}
              maxLength={100}
              value={draft.name}
              onChange={(e) => patch({ name: e.target.value })}
            />
            <Input
              label={p.groupNameEn}
              placeholder={p.groupNameEnPlaceholder}
              hint={p.nameEnHint}
              dir="ltr"
              maxLength={100}
              value={draft.nameEn}
              onChange={(e) => patch({ nameEn: e.target.value })}
            />

            <div className="flex flex-wrap items-end gap-4">
              <div className="flex rounded-lg border border-border bg-surface-2 p-1" role="group">
                {[false, true].map((req) => (
                  <button
                    key={String(req)}
                    type="button"
                    aria-pressed={draft.isRequired === req}
                    onClick={() =>
                      patch(
                        req
                          ? { isRequired: true, minSelect: Math.max(1, draft.minSelect), maxSelect: Math.max(1, draft.maxSelect) }
                          : { isRequired: false, minSelect: 0 },
                      )
                    }
                    className={cn(
                      'h-9 rounded-md px-4 text-sm font-medium transition-colors',
                      draft.isRequired === req ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg',
                    )}
                  >
                    {req ? p.groupRequired : p.groupOptional}
                  </button>
                ))}
              </div>
              {draft.isRequired && (
                <div className="w-24">
                  <Input
                    label={p.minSelect}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={MAX_SELECT}
                    value={draft.minSelect}
                    onChange={(e) => setCount('minSelect', e.target.value)}
                  />
                </div>
              )}
              <div className="w-24">
                <Input
                  label={p.maxSelect}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_SELECT}
                  value={draft.maxSelect}
                  onChange={(e) => setCount('maxSelect', e.target.value)}
                />
              </div>
              <p className="pb-2 text-sm font-medium text-fg">{ruleLabel(draft, p)}</p>
            </div>
            {draft.isRequired && <p className="-mt-2 text-xs text-muted">{p.groupRequiredHint}</p>}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-fg">{p.groupOptions}</p>
                <p className="text-xs text-muted">{p.optionPriceHint}</p>
              </div>
              {draft.options.map((o, i) => (
                <div key={o.key} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-2 p-2">
                  <input
                    className="input h-9 min-w-0 flex-1 basis-40"
                    placeholder={p.optionName}
                    aria-label={p.optionName}
                    maxLength={100}
                    value={o.name}
                    onChange={(e) => patchRow(o.key, { name: e.target.value })}
                  />
                  <input
                    className="input h-9 min-w-0 flex-1 basis-32"
                    dir="ltr"
                    placeholder={p.optionNameEn}
                    aria-label={`${p.optionName} — ${p.optionNameEn}`}
                    maxLength={100}
                    value={o.nameEn}
                    onChange={(e) => patchRow(o.key, { nameEn: e.target.value })}
                  />
                  <input
                    className="input h-9 w-24 tabular-nums"
                    dir="ltr"
                    inputMode="decimal"
                    placeholder="0"
                    aria-label={p.optionPrice}
                    value={o.gross}
                    onChange={(e) => patchRow(o.key, { gross: e.target.value })}
                  />
                  <label className="flex h-9 items-center gap-1.5 px-1 text-xs text-fg">
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={o.isActive}
                      onChange={(e) => patchRow(o.key, { isActive: e.target.checked })}
                    />
                    {p.optionActive}
                  </label>
                  <div className="flex items-center">
                    <Button size="sm" variant="ghost" className="h-9 w-9 px-0" disabled={i === 0} onClick={() => moveRow(i, -1)} aria-label={p.moveUp} title={p.moveUp}>
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-9 w-9 px-0"
                      disabled={i === draft.options.length - 1}
                      onClick={() => moveRow(i, 1)}
                      aria-label={p.moveDown}
                      title={p.moveDown}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-9 w-9 px-0"
                      onClick={() => patch({ options: draft.options.filter((x) => x.key !== o.key) })}
                      aria-label={p.removeOption}
                      title={p.removeOption}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-danger" />
                    </Button>
                  </div>
                </div>
              ))}
              <Button size="sm" variant="secondary" onClick={() => patch({ options: [...draft.options, newRow()] })}>
                <Plus className="h-3.5 w-3.5" />
                {p.addOption}
              </Button>
            </div>

            {problem && <p className="text-sm font-medium text-danger" role="alert">{problem}</p>}
          </div>
        ) : isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton h-14" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm font-medium text-fg">{p.noGroups}</p>
            <p className="mt-1 text-xs text-muted">{p.modifiersHint}</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted">{p.modifiersHint}</p>
            {groups.map((g) => {
              const active = g.options.filter((o) => o.isActive).sort((a, b) => a.sortOrder - b.sortOrder)
              return (
                <div key={g.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-fg">{localName(g, lang)}</p>
                      <Badge variant={g.isRequired ? 'yellow' : 'gray'}>{g.isRequired ? p.groupRequired : p.groupOptional}</Badge>
                      <span className="text-xs text-muted">{ruleLabel(g, p)}</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {active
                        .map((o) => `${localName(o, lang)} ${o.priceDelta > 0 ? `+${formatCurrency(grossOf(o.priceDelta))}` : `(${p.free})`}`)
                        .join(' · ')}
                    </p>
                  </div>
                  <span className="text-xs text-muted">{p.optionsCount.replace('{n}', String(g.options.length))}</span>
                  <span className="text-xs text-muted">{p.usedBy.replace('{n}', String(g.productIds.length))}</span>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => startEdit(g)} title={t.common.edit} aria-label={`${t.common.edit} ${g.name}`}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeactivating(g)} title={p.deactivateGroup} aria-label={`${p.deactivateGroup} ${g.name}`}>
                      <Power className="h-3.5 w-3.5 text-danger" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={!!deactivating}
        onClose={() => setDeactivating(null)}
        onConfirm={() => { if (deactivating) deactivate.mutate(deactivating.id) }}
        title={p.deactivateGroup}
        message={p.deactivateGroupConfirm.replace('{name}', deactivating?.name ?? '')}
        confirmLabel={p.deactivateGroup}
        confirmVariant="danger"
        loading={deactivate.isPending}
      />
    </>
  )
}
