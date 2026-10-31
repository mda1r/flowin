import { useAuthStore } from '@/stores/authStore'

// Mirrors the OwnerOrManager policy on the stock-material and recipe write endpoints.
export function useCanManageMaterials(): boolean {
  const role = useAuthStore((s) => s.user?.role)
  return role === 'Owner' || role === 'Manager'
}
