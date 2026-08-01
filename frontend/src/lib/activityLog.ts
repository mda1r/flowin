const storageKey = (tenantId: string) => `nexus_activity_logs_${tenantId}`
const MAX_ENTRIES = 1000

export type LogCategory = 'shift' | 'inventory' | 'stock-count' | 'order' | 'user' | 'other'

export interface ActivityLogEntry {
  id: string
  timestamp: string
  userId: string
  userName: string
  userEmail?: string
  category: LogCategory
  action: string
  details?: string
  branchId?: string
}

/** Returns a displayable name, falling back to email then userId prefix */
export function resolveDisplayName(entry: Pick<ActivityLogEntry, 'userName' | 'userEmail' | 'userId'>): string {
  if (entry.userName && entry.userName.trim()) return entry.userName.trim()
  if (entry.userEmail) return entry.userEmail.split('@')[0]
  return entry.userId.slice(0, 8)
}

export function logActivity(tenantId: string, entry: Omit<ActivityLogEntry, 'id' | 'timestamp'>): void {
  const key = storageKey(tenantId)
  const logs = readLogs(tenantId)
  logs.unshift({ ...entry, id: Math.random().toString(36).slice(2), timestamp: new Date().toISOString() })
  if (logs.length > MAX_ENTRIES) logs.splice(MAX_ENTRIES)
  try { localStorage.setItem(key, JSON.stringify(logs)) } catch { /* storage full */ }
}

export function readLogs(tenantId: string, filter?: { category?: LogCategory; from?: string; to?: string }): ActivityLogEntry[] {
  try {
    const raw = localStorage.getItem(storageKey(tenantId))
    if (!raw) return []
    let logs: ActivityLogEntry[] = JSON.parse(raw)
    if (filter?.category) logs = logs.filter((l) => l.category === filter.category)
    if (filter?.from) logs = logs.filter((l) => l.timestamp >= filter.from!)
    if (filter?.to) logs = logs.filter((l) => l.timestamp <= filter.to! + 'T23:59:59Z')
    return logs
  } catch {
    return []
  }
}

export function clearLogs(tenantId: string): void {
  localStorage.removeItem(storageKey(tenantId))
}
