import { useQuery } from '@tanstack/react-query'
import { zatcaApi, type ReceiptSettings } from '@/api/zatca'
import { useAuthStore } from '@/stores/authStore'

export const DEFAULT_RECEIPT: ReceiptSettings = {
  logoPath: null,
  phone: null,
  address: null,
  headerNote: null,
  footerNote: null,
  paperWidthMm: 80,
  showPoweredBy: true,
}

/** The store's receipt design; every till reads it to print, defaults until the owner saves one. */
export function useReceiptSettings(): ReceiptSettings {
  const { tenantId } = useAuthStore()
  const { data } = useQuery({
    queryKey: ['receipt-settings', tenantId],
    queryFn: () => zatcaApi.getReceiptSettings().then((r) => r.data),
    enabled: !!tenantId,
    staleTime: 5 * 60_000,
  })
  return data ?? DEFAULT_RECEIPT
}

/** The seller name and VAT number the receipt and its ZATCA QR carry. */
export function useSellerIdentity() {
  const { data } = useQuery({
    queryKey: ['zatca-settings'],
    queryFn: () => zatcaApi.getSettings(),
    staleTime: 60_000,
  })
  return {
    sellerName: data?.data?.sellerName ?? '',
    vatNumber: data?.data?.vatRegistrationNumber ?? '',
  }
}
