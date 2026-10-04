import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import type { UserProfile } from '@/types/api'

interface AuthState {
  user: UserProfile | null
  tenantId: string | null
  branchId: string | null
  isLoading: boolean
  setUser: (user: UserProfile) => void
  setActiveBranch: (branchId: string) => void
  logout: () => Promise<void>
  isAuthenticated: () => boolean
  loadFromStorage: () => Promise<void>
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  tenantId: null,
  branchId: null,
  isLoading: true,

  setUser: (user) =>
    set({
      user,
      tenantId: user.tenantId ?? null,
      branchId: user.branchId ?? null,
    }),

  setActiveBranch: (branchId) =>
    set((state) => ({
      branchId,
      user: state.user ? { ...state.user, branchId } : null,
    })),

  logout: async () => {
    await SecureStore.deleteItemAsync('accessToken')
    await SecureStore.deleteItemAsync('refreshToken')
    await SecureStore.deleteItemAsync('user')
    set({ user: null, tenantId: null, branchId: null })
  },

  isAuthenticated: () => !!get().user,

  loadFromStorage: async () => {
    try {
      const userJson = await SecureStore.getItemAsync('user')
      if (userJson) {
        const user: UserProfile = JSON.parse(userJson)
        set({ user, tenantId: user.tenantId ?? null, branchId: user.branchId ?? null })
      }
    } finally {
      set({ isLoading: false })
    }
  },
}))

export async function persistUser(user: UserProfile) {
  await SecureStore.setItemAsync('user', JSON.stringify(user))
}
