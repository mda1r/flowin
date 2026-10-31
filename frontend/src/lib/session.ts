import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/stores/authStore'
import { useCartStore } from '@/stores/cartStore'
import { useHeldCartsStore } from '@/stores/heldCartsStore'

// Signs out on a shared till: revokes the refresh token on the server, then wipes everything the
// next cashier could otherwise see (cached queries, the open cart, held carts). Queued offline
// sales are kept; they are tied to their tenant and sync when that store signs in again.
export function useSignOut() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useCallback(() => {
    const { refreshToken, logout } = useAuthStore.getState()
    // Fire-and-forget: an offline till must still be able to sign out.
    if (refreshToken) authApi.logout(refreshToken).catch(() => {})

    useCartStore.getState().clear()
    useHeldCartsStore.getState().clear()
    logout()
    // Cleared once the pages are gone, so nothing still mounted refetches into the emptied cache.
    void navigate({ to: '/login', replace: true }).finally(() => queryClient.clear())
  }, [queryClient, navigate])
}
