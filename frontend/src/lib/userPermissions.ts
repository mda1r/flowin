const STORAGE_KEY = 'nexus_user_permissions'

export function saveUserPermissions(userId: string, routes: string[]): void {
  const all = readAllPermissions()
  all[userId] = routes
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(all)) } catch { /* storage full */ }
}

export function getUserPermissions(userId: string): string[] | null {
  return readAllPermissions()[userId] ?? null
}

function readAllPermissions(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}
