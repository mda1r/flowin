// How a sold line is named on every screen and printout: "لاتيه - كبير" when the size matters, just the
// product when the variant is the default one. Keep this list in sync with ItemName in the Restaurant
// module's KitchenTicketRequestedRestaurantHandler, which names the kitchen ticket the same way.
const PLAIN_VARIANT_NAMES = ['افتراضي', 'Standard', 'Default']

/** True when the variant adds nothing to the name: empty, a default label, or the product's own name. */
export function isPlainVariant(variantName: string | null | undefined, productName: string): boolean {
  const variant = (variantName ?? '').trim()
  return variant.length === 0 || PLAIN_VARIANT_NAMES.includes(variant) || variant === productName.trim()
}

/** "منتج - حجم", or just the product name for a plain variant. */
export function lineDisplayName(productName: string, variantName: string | null | undefined): string {
  const product = productName.trim()
  return isPlainVariant(variantName, product) ? product : `${product} - ${(variantName ?? '').trim()}`
}
