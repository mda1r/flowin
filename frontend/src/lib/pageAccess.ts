import type { UserProfile } from '@/types/api'

// Pages a limited user can always open: their own account settings.
const ALWAYS_OPEN = new Set(['/settings'])

// Screens reached from another page rather than the menu: open when one of these pages is allowed.
const REACHED_FROM: Record<string, string[]> = {
  '/cafe/ready': ['/pos', '/cafe/kitchen'],
}

/** The user's page list, or null when they see every page their role allows (owners and managers always do). */
export function pageLimit(user: UserProfile | null | undefined): Set<string> | null {
  if (!user || user.role === 'Owner' || user.role === 'Manager' || user.role === 'SuperAdmin') return null
  return user.allowedPages ? new Set(user.allowedPages) : null
}

/** "/stock-counts/abc" belongs to "/stock-counts"; "/" only to itself. */
function pageOf(pathname: string, page: string): boolean {
  if (page === '/') return pathname === '/'
  return pathname === page || pathname.startsWith(page + '/')
}

export function canOpenPath(pathname: string, limit: Set<string> | null): boolean {
  if (!limit) return true
  if (ALWAYS_OPEN.has(pathname)) return true
  const via = Object.entries(REACHED_FROM).find(([screen]) => pageOf(pathname, screen))
  if (via) return via[1].some((p) => limit.has(p))
  return [...limit].some((page) => pageOf(pathname, page))
}
