// The name the barista calls out at pickup. Mirrors RestaurantOrder.CallNameMaxLength on the server.
export const CALL_NAME_MAX = 40

// Compound first names that only make sense with the next word: عبد الله, أبو خالد.
const JOINED_PREFIXES = new Set(['عبد', 'عبدال', 'أبو', 'ابو', 'أم', 'ام'])

// A loyalty customer's first name, which is what gets called out and shown on the pickup screen;
// the full name stays on the receipt only.
export function callNameFrom(fullName: string | null | undefined) {
  const words = (fullName ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ''
  const first = JOINED_PREFIXES.has(words[0]) && words.length > 1 ? `${words[0]} ${words[1]}` : words[0]
  return first.slice(0, CALL_NAME_MAX)
}
