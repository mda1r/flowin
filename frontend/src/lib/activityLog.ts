import { activityLogsApi } from '@/api/activityLogs'

const storageKey = (tenantId: string) => `nexus_activity_logs_${tenantId}`
const MAX_ENTRIES = 200

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
  const occurredAt = new Date().toISOString()
  const id = Math.random().toString(36).slice(2)

  // Persist to localStorage immediately (instant, offline-safe)
  const key = storageKey(tenantId)
  const logs = readLocalLogs(tenantId)
  logs.unshift({ ...entry, id, timestamp: occurredAt })
  if (logs.length > MAX_ENTRIES) logs.splice(MAX_ENTRIES)
  try { localStorage.setItem(key, JSON.stringify(logs)) } catch { /* storage full */ }

  // Fire-and-forget to backend (permanent persistence)
  activityLogsApi.log({
    branchId: entry.branchId ?? null,
    category: entry.category,
    action: entry.action,
    details: entry.details,
    occurredAt,
  }).catch(() => { /* backend unavailable — localStorage already saved */ })
}

function readLocalLogs(tenantId: string): ActivityLogEntry[] {
  try {
    const raw = localStorage.getItem(storageKey(tenantId))
    return raw ? (JSON.parse(raw) as ActivityLogEntry[]) : []
  } catch {
    return []
  }
}

export function clearLogs(tenantId: string): void {
  localStorage.removeItem(storageKey(tenantId))
}
