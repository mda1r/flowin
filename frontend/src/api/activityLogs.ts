import { apiClient } from './client'
import type { ActivityLogResponse } from '@/types/api'

export const activityLogsApi = {
  log: (entry: {
    branchId?: string | null
    category: string
    action: string
    details?: string
    occurredAt: string
  }) => apiClient.post<ActivityLogResponse>('/api/v1/activity-logs', entry),

  list: (params?: {
    branchId?: string
    category?: string
    from?: string
    to?: string
    pageSize?: number
  }) => apiClient.get<ActivityLogResponse[]>('/api/v1/activity-logs', { params }),
}
