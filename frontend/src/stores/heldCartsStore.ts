import { create } from 'zustand'
import type { CartLine } from './cartStore'

export interface HeldCart {
  id: string
  lines: CartLine[]
  note: string
  heldAt: string
}

interface HeldCartsState {
  carts: HeldCart[]
  hold: (lines: CartLine[], note?: string) => string
  restore: (id: string) => HeldCart | null
  dismiss: (id: string) => void
}

export const useHeldCartsStore = create<HeldCartsState>()((set, get) => ({
  carts: [],

  hold: (lines, note = '') => {
    const id = Math.random().toString(36).slice(2)
    set((s) => ({
      carts: [...s.carts, { id, lines: [...lines], note, heldAt: new Date().toISOString() }],
    }))
    return id
  },

  restore: (id) => {
    const cart = get().carts.find((c) => c.id === id) ?? null
    if (cart) set((s) => ({ carts: s.carts.filter((c) => c.id !== id) }))
    return cart
  },

  dismiss: (id) => set((s) => ({ carts: s.carts.filter((c) => c.id !== id) })),
}))
