const STORAGE_KEY = 'nexus_activity_logs'
const MAX_ENTRIES = 1000

export type LogCategory = 'shift' | 'inventory' | 'stock-count' | 'order' | 'user' | 'other'

export interface ActivityLogEntry {
  id: string
  timestamp: string
  userId: string
  userName: string
  category: LogCategory
  action: string
  details?: string
  branchId?: string
}

export function logActivity(entry: Omit<ActivityLogEntry, 'id' | 'timestamp'>): void {
  const logs = readLogs()
  logs.unshift({ ...entry, id: Math.random().toString(36).slice(2), timestamp: new Date().toISOString() })
  if (logs.length > MAX_ENTRIES) logs.splice(MAX_ENTRIES)
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(logs)) } catch { /* storage full */ }
}

export function readLogs(filter?: { category?: LogCategory; from?: string; to?: string }): ActivityLogEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
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

export function clearLogs(): void {
  localStorage.removeItem(STORAGE_KEY)
}
