const storageKey = (tenantId: string) => `nexus_user_permissions_${tenantId}`

export function saveUserPermissions(tenantId: string, userId: string, routes: string[]): void {
  const all = readAllPermissions(tenantId)
  all[userId] = routes
  try { localStorage.setItem(storageKey(tenantId), JSON.stringify(all)) } catch { /* storage full */ }
}

export function getUserPermissions(tenantId: string, userId: string): string[] | null {
  return readAllPermissions(tenantId)[userId] ?? null
}

function readAllPermissions(tenantId: string): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(storageKey(tenantId))
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}
