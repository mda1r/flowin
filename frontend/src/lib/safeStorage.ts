import type { StateStorage } from 'zustand/middleware'

// localStorage that never throws: private windows, blocked site data or a full quota just mean nothing is kept.
export const safeLocalStorage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name)
    } catch {
      return null
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value)
    } catch {
      // Storage full or blocked: the state still lives in memory for this page.
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name)
    } catch {
      // Nothing to clean up.
    }
  },
}

// Carts belong to one store and one branch, so a shared device never shows another branch's sale.
export const cartScope = (tenantId?: string | null, branchId?: string | null) =>
  tenantId && branchId ? `${tenantId}:${branchId}` : null
