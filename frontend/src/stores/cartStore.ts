import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { safeLocalStorage } from '@/lib/safeStorage'

// A cashier discount: a percentage, or a fixed amount in riyals with VAT included (as the shelf prices are).
export interface CartDiscount {
  type: 'Percentage' | 'Fixed'
  value: number
}

export interface CartLine {
  variantId: string
  productName: string
  variantName: string
  unitPrice: number
  costPrice: number
  quantity: number
  discount?: CartDiscount | null
}

interface CartDraft {
  lines: CartLine[]
  discount: CartDiscount | null
}

interface CartState {
  // tenant:branch the cart belongs to; the cart of every scope is kept so a reload or re-login brings it back.
  scope: string | null
  drafts: Record<string, CartDraft>
  lines: CartLine[]
  discount: CartDiscount | null
  customerId: string | null
  notes: string
  setScope: (scope: string | null) => void
  addLine: (line: Omit<CartLine, 'quantity'>, quantity?: number) => void
  removeLine: (variantId: string) => void
  updateQuantity: (variantId: string, quantity: number) => void
  setLineDiscount: (variantId: string, discount: CartDiscount | null) => void
  setDiscount: (discount: CartDiscount | null) => void
  replace: (lines: CartLine[], discount?: CartDiscount | null) => void
  setCustomer: (customerId: string | null) => void
  setNotes: (notes: string) => void
  clear: () => void
  subtotal: () => number
  taxAmount: (rate?: number) => number
  total: (rate?: number) => number
}

const TAX_RATE = 0.15

// Applies a change to the active cart and mirrors it into the saved draft of its scope.
function commit(state: CartState, next: CartDraft): Partial<CartState> {
  if (!state.scope) return next
  const drafts = { ...state.drafts }
  if (next.lines.length === 0 && !next.discount) delete drafts[state.scope]
  else drafts[state.scope] = next
  return { ...next, drafts }
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      scope: null,
      drafts: {},
      lines: [],
      discount: null,
      customerId: null,
      notes: '',

      setScope: (scope) =>
        set((state) => {
          if (state.scope === scope) return {}
          const draft = scope ? state.drafts[scope] : undefined
          return { scope, lines: draft?.lines ?? [], discount: draft?.discount ?? null }
        }),

      addLine: (line, quantity = 1) =>
        set((state) => {
          const existing = state.lines.find((l) => l.variantId === line.variantId)
          const lines = existing
            ? state.lines.map((l) =>
                l.variantId === line.variantId ? { ...l, quantity: l.quantity + quantity } : l,
              )
            : [...state.lines, { ...line, quantity }]
          return commit(state, { lines, discount: state.discount })
        }),

      removeLine: (variantId) =>
        set((state) => commit(state, {
          lines: state.lines.filter((l) => l.variantId !== variantId),
          discount: state.discount,
        })),

      updateQuantity: (variantId, quantity) =>
        set((state) => commit(state, {
          lines:
            quantity <= 0
              ? state.lines.filter((l) => l.variantId !== variantId)
              : state.lines.map((l) => (l.variantId === variantId ? { ...l, quantity } : l)),
          discount: state.discount,
        })),

      setLineDiscount: (variantId, discount) =>
        set((state) => commit(state, {
          lines: state.lines.map((l) => (l.variantId === variantId ? { ...l, discount } : l)),
          discount: state.discount,
        })),

      setDiscount: (discount) => set((state) => commit(state, { lines: state.lines, discount })),

      replace: (lines, discount = null) => set((state) => commit(state, { lines: [...lines], discount })),

      setCustomer: (customerId) => set({ customerId }),
      setNotes: (notes) => set({ notes }),
      clear: () => set((state) => ({ ...commit(state, { lines: [], discount: null }), customerId: null, notes: '' })),

      subtotal: () => {
        const { lines } = get()
        const raw = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0)
        return Math.round(raw * 100) / 100
      },

      taxAmount: (rate = TAX_RATE) => {
        const subtotal = get().subtotal()
        return Math.round(subtotal * rate * 100) / 100
      },

      total: (rate = TAX_RATE) => {
        const subtotal = get().subtotal()
        const tax = get().taxAmount(rate)
        return Math.round((subtotal + tax) * 100) / 100
      },
    }),
    {
      name: 'flowin-retail-cart',
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: (s) => ({ drafts: s.drafts }),
    },
  ),
)
