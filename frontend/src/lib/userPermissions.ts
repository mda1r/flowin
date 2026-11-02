// Page limits used to live only in the owner's browser (so they never reached the cashier's device).
// They are on the server now; this reads what an owner set the old way so the users page can move it over once.
const storageKey = (tenantId: string) => `nexus_user_permissions_${tenantId}`

export function readLegacyPermissions(tenantId: string): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(storageKey(tenantId))
    const parsed: unknown = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string[]>) : {}
  } catch {
    return {}
  }
}

export function forgetLegacyPermission(tenantId: string, userId: string): void {
  try {
    const all = readLegacyPermissions(tenantId)
    delete all[userId]
    if (Object.keys(all).length === 0) localStorage.removeItem(storageKey(tenantId))
    else localStorage.setItem(storageKey(tenantId), JSON.stringify(all))
  } catch { /* storage blocked: nothing to move */ }
}
