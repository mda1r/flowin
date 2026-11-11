import { isAxiosError } from 'axios'
import { useAuthStore } from '@/stores/authStore'
import { SAUDI_VAT_RATE } from '@/lib/zatca'
import { authApi } from '@/api/auth'

// Whether this shop charges VAT. A shop that is not VAT-registered switches it off on the ZATCA page: it then sells
// at its listed prices with no tax, and no screen, receipt or report shows anything about VAT until it is back on.
// The server owns the setting (it refuses a sale priced under the other one); the app learns it from /auth/me.

/** Read outside React (price maths, receipts). Every shop charges VAT unless the server said otherwise. */
export const isVatEnabled = () => useAuthStore.getState().user?.vatEnabled !== false

/** 0.15, or 0 for a shop without VAT. */
export const vatRate = () => (isVatEnabled() ? SAUDI_VAT_RATE : 0)

/** The same, as a hook, so a screen redraws when the owner switches it. */
export function useVat() {
  const enabled = useAuthStore((s) => s.user?.vatEnabled !== false)
  return { enabled, rate: enabled ? SAUDI_VAT_RATE : 0 }
}

/** A sale the server refused because the owner switched VAT meanwhile (409 POS.TaxSettingChanged): reload the
 *  setting so the till re-prices the cart and the cashier only has to press pay again. Other errors are ignored. */
export function refreshVatAfter(err: unknown) {
  if (!isAxiosError(err) || (err.response?.data as { title?: string } | undefined)?.title !== 'POS.TaxSettingChanged') return
  authApi.me().then(({ data }) => {
    const { user, setUser } = useAuthStore.getState()
    if (user) setUser({ ...user, vatEnabled: data.vatEnabled })
  }).catch(() => {})
}
