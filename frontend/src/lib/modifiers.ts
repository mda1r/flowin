import type { ProductModifierGroupResponse } from '@/types/api'
import { vatRate } from '@/lib/vat'

// A drink's add-ons on the till ("شوفان", "شوت إضافي"). The catalogue keeps each option's price net of VAT;
// the till shows and adds it with VAT, like the size price. The server prices the same options again at checkout.

/** One add-on on a cart line. priceDelta is VAT included, rounded to a halala, as the cashier saw it. */
export interface CartModifier {
  optionId: string
  name: string
  priceDelta: number
}

/** An add-on price as the till shows it: the catalogue's net price with VAT, to a halala. */
export const grossDelta = (net: number) => Math.round(net * (1 + vatRate()) * 100) / 100

/** The same add-ons in any order are the same drink, so lines compare by the sorted option ids. */
export const modifierKey = (modifiers: readonly { optionId: string }[] | undefined) =>
  (modifiers ?? []).map((m) => m.optionId).sort().join(',')

/** "شوفان · شوت إضافي", the way the kitchen ticket lists them after the size. */
export const modifierSummary = (names: readonly string[] | undefined) =>
  (names ?? []).map((n) => n.trim()).filter(Boolean).join(' · ')

/** The small line under an item on a receipt or message: its add-ons, then the customer's note. */
export function lineDetail(modifierNames: readonly string[] | undefined, notes?: string | null): string | undefined {
  const parts = [modifierSummary(modifierNames), notes?.trim() ? `ملاحظة: ${notes.trim()}` : '']
  return parts.filter(Boolean).join(' — ') || undefined
}

/** Active groups with at least one option, in the order the owner set for this product. */
export const productGroups = (groups: ProductModifierGroupResponse[] | null | undefined) =>
  (groups ?? []).filter((g) => g.options.length > 0)

/** The group's rule is met by this many picks. */
export const groupSatisfied = (group: ProductModifierGroupResponse, picked: number) =>
  picked >= (group.isRequired ? Math.max(group.minSelect, 1) : group.minSelect) && picked <= group.maxSelect

/** The picked options as cart add-ons, in the product's group order and each group's option order. */
export const pickedModifiers = (groups: ProductModifierGroupResponse[], picks: Record<string, string[]>): CartModifier[] =>
  groups.flatMap((g) =>
    g.options
      .filter((o) => picks[g.id]?.includes(o.id))
      .map((o) => ({ optionId: o.id, name: o.name, priceDelta: grossDelta(o.priceDelta) })))

// The add-ons this device picked last for each drink, so the picker opens on them. Per device, best effort.
const LAST_MODIFIERS_KEY = 'cafe-last-modifiers'

export function readLastModifiers(productId: string): string[] {
  try {
    const map = JSON.parse(localStorage.getItem(LAST_MODIFIERS_KEY) ?? '{}') as Record<string, unknown>
    const ids = map[productId]
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

export function rememberLastModifiers(productId: string, optionIds: string[]) {
  try {
    const map = JSON.parse(localStorage.getItem(LAST_MODIFIERS_KEY) ?? '{}') as Record<string, string[]>
    if (optionIds.length > 0) map[productId] = optionIds
    else delete map[productId]
    localStorage.setItem(LAST_MODIFIERS_KEY, JSON.stringify(map))
  } catch {
    // Storage blocked or full: the picker just opens with nothing picked next time.
  }
}

/** The remembered picks that are still on the menu, at most each group's maximum. */
export function initialPicks(groups: ProductModifierGroupResponse[], remembered: string[]): Record<string, string[]> {
  const picks: Record<string, string[]> = {}
  for (const g of groups) {
    picks[g.id] = g.options.filter((o) => remembered.includes(o.id)).map((o) => o.id).slice(0, g.maxSelect)
  }
  return picks
}
