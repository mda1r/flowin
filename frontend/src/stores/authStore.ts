import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserProfile } from '@/types/api'

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: UserProfile | null
  tenantId: string | null
  branchId: string | null
  setTokens: (accessToken: string, refreshToken: string) => void
  setUser: (user: UserProfile) => void
  setActiveBranch: (branchId: string) => void
  logout: () => void
  isAuthenticated: () => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      tenantId: null,
      branchId: null,

      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }),

      setUser: (user) =>
        set({ user, tenantId: user.tenantId, branchId: user.branchId }),

      setActiveBranch: (branchId) => set({ branchId }),

      logout: () =>
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          tenantId: null,
          branchId: null,
        }),

      isAuthenticated: () => !!get().accessToken,
    }),
    {
      name: 'flowin-auth',
      partialize: (s) => ({
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        user: s.user,
        tenantId: s.tenantId,
        branchId: s.branchId,
      }),
    },
  ),
)
