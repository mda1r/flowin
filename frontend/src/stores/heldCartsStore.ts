import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { safeLocalStorage } from '@/lib/safeStorage'
import type { CartDiscount, CartLine } from './cartStore'

export interface HeldCart {
  id: string
  // tenant:branch the cart was held in; the till only lists its own.
  scope: string
  lines: CartLine[]
  discount?: CartDiscount | null
  note: string
  heldAt: string
}

interface HeldCartsState {
  carts: HeldCart[]
  hold: (scope: string, lines: CartLine[], note?: string, discount?: CartDiscount | null) => string
  restore: (id: string) => HeldCart | null
  dismiss: (id: string) => void
  clear: () => void
}

// A held cart nobody came back for in a week is dropped the next time something is held.
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export const useHeldCartsStore = create<HeldCartsState>()(
  persist(
    (set, get) => ({
      carts: [],

      hold: (scope, lines, note = '', discount = null) => {
        const id = Math.random().toString(36).slice(2)
        const cutoff = Date.now() - MAX_AGE_MS
        set((s) => ({
          carts: [
            ...s.carts.filter((c) => new Date(c.heldAt).getTime() >= cutoff),
            { id, scope, lines: [...lines], discount, note: note.trim(), heldAt: new Date().toISOString() },
          ],
        }))
        return id
      },

      restore: (id) => {
        const cart = get().carts.find((c) => c.id === id) ?? null
        if (cart) set((s) => ({ carts: s.carts.filter((c) => c.id !== id) }))
        return cart
      },

      dismiss: (id) => set((s) => ({ carts: s.carts.filter((c) => c.id !== id) })),

      clear: () => set({ carts: [] }),
    }),
    {
      name: 'flowin-held-carts',
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: (s) => ({ carts: s.carts }),
    },
  ),
)
