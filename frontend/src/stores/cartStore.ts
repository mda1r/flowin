import { create } from 'zustand'

export interface CartLine {
  variantId: string
  productName: string
  variantName: string
  unitPrice: number
  quantity: number
}

interface CartState {
  lines: CartLine[]
  customerId: string | null
  notes: string
  addLine: (line: Omit<CartLine, 'quantity'>, quantity?: number) => void
  removeLine: (variantId: string) => void
  updateQuantity: (variantId: string, quantity: number) => void
  setCustomer: (customerId: string | null) => void
  setNotes: (notes: string) => void
  clear: () => void
  subtotal: () => number
  taxAmount: (rate?: number) => number
  total: (rate?: number) => number
}

const TAX_RATE = 0.15

export const useCartStore = create<CartState>()((set, get) => ({
  lines: [],
  customerId: null,
  notes: '',

  addLine: (line, quantity = 1) =>
    set((state) => {
      const existing = state.lines.find((l) => l.variantId === line.variantId)
      if (existing) {
        return {
          lines: state.lines.map((l) =>
            l.variantId === line.variantId
              ? { ...l, quantity: l.quantity + quantity }
              : l,
          ),
        }
      }
      return {
        lines: [...state.lines, { ...line, quantity }],
      }
    }),

  removeLine: (variantId) =>
    set((state) => ({
      lines: state.lines.filter((l) => l.variantId !== variantId),
    })),

  updateQuantity: (variantId, quantity) =>
    set((state) => ({
      lines:
        quantity <= 0
          ? state.lines.filter((l) => l.variantId !== variantId)
          : state.lines.map((l) =>
              l.variantId === variantId ? { ...l, quantity } : l,
            ),
    })),

  setCustomer: (customerId) => set({ customerId }),
  setNotes: (notes) => set({ notes }),
  clear: () => set({ lines: [], customerId: null, notes: '' }),

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
}))
