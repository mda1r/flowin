import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, Download, Filter, AlertTriangle, Loader2, RefreshCw } from 'lucide-react'
import { activityLogsApi } from '@/api/activityLogs'
import { resolveDisplayName } from '@/lib/activityLog'
import type { LogCategory } from '@/lib/activityLog'
import type { ActivityLogResponse } from '@/types/api'
import { useAuthStore } from '@/stores/authStore'

const CATEGORY_LABELS: Record<LogCategory, string> = {
  shift:         'الشفت',
  inventory:     'المخزون',
  'stock-count': 'الجرد',
  order:         'الطلبات',
  user:          'المستخدمون',
  other:         'أخرى',
}

const CATEGORY_COLORS: Record<LogCategory, string> = {
  shift:         'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  inventory:     'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'stock-count': 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  order:         'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  user:          'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  other:         'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

function categoryLabel(cat: string): string {
  return CATEGORY_LABELS[cat as LogCategory] ?? cat
}

function categoryColor(cat: string): string {
  return CATEGORY_COLORS[cat as LogCategory] ?? CATEGORY_COLORS.other
}

function exportCsv(logs: ActivityLogResponse[]) {
  const rows = [
    ['التاريخ', 'الوقت', 'المستخدم', 'التصنيف', 'الإجراء', 'التفاصيل'],
    ...logs.map((l) => {
      const d = new Date(l.timestamp)
      return [
        d.toLocaleDateString('ar-SA'),
        d.toLocaleTimeString('ar-SA'),
        l.userName || l.userId,
        categoryLabel(l.category),
        l.action,
        l.details ?? '',
      ]
    }),
  ]
  const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `activity-logs-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function ActivityLogsPage() {
  const { branchId } = useAuthStore()
  const [filterCategory, setFilterCategory] = useState<LogCategory | 'all'>('all')
  const [filterUser, setFilterUser] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['activity-logs', branchId],
    queryFn: () => activityLogsApi.list({ branchId: branchId ?? undefined, pageSize: 500 })
      .then((r) => r.data),
    staleTime: 30_000,
  })

  const allLogs = data ?? []

  const logs = useMemo(() => {
    return allLogs.filter((l) => {
      if (filterCategory !== 'all' && l.category !== filterCategory) return false
      if (filterUser && !l.userName.toLowerCase().includes(filterUser.toLowerCase())) return false
      if (filterFrom && l.timestamp.slice(0, 10) < filterFrom) return false
      if (filterTo && l.timestamp.slice(0, 10) > filterTo) return false
      return true
    })
  }, [allLogs, filterCategory, filterUser, filterFrom, filterTo])

  const hasFilters = filterCategory !== 'all' || filterUser || filterFrom || filterTo

  return (
    <div className="p-6 md:p-8" dir="rtl">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
            <Activity className="h-6 w-6" style={{ color: 'var(--accent)' }} />
            سجل النشاطات
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {isLoading ? 'جاري التحميل…' : `${logs.length} سجل`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            تحديث
          </button>
          <button
            onClick={() => exportCsv(logs)}
            disabled={logs.length === 0}
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
          >
            <Download className="h-4 w-4" />
            تصدير CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-wrap items-end gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <Filter className="h-4 w-4 text-gray-400 mt-5 shrink-0" />

        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">التصنيف</label>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as LogCategory | 'all')}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          >
            <option value="all">الكل</option>
            {(Object.keys(CATEGORY_LABELS) as LogCategory[]).map((k) => (
              <option key={k} value={k}>{CATEGORY_LABELS[k]}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">المستخدم</label>
          <input
            type="text"
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            placeholder="ابحث..."
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">من تاريخ</label>
          <input
            type="date"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500">إلى تاريخ</label>
          <input
            type="date"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          />
        </div>

        {hasFilters && (
          <button
            onClick={() => { setFilterCategory('all'); setFilterUser(''); setFilterFrom(''); setFilterTo('') }}
            className="rounded-lg px-3 py-1.5 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mt-5"
          >
            إعادة تعيين
          </button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-white py-20 dark:border-gray-700 dark:bg-gray-900">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          <span className="text-gray-400">جاري تحميل السجلات…</span>
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-white py-20 text-center dark:border-gray-700 dark:bg-gray-900">
          <Activity className="h-10 w-10 text-gray-200 dark:text-gray-700" />
          <p className="text-gray-400">لا توجد سجلات</p>
          <p className="text-xs text-gray-300 dark:text-gray-600">
            ستظهر هنا نشاطات فتح الشفت وتعديل المخزون والجرد
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
                <tr>
                  {['التاريخ والوقت', 'المستخدم', 'التصنيف', 'الإجراء', 'التفاصيل'].map((h) => (
                    <th key={h} className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {logs.map((log) => {
                  const d = new Date(log.timestamp)
                  const isDeficit = log.action.includes('عجز')
                  const displayName = resolveDisplayName({
                    userName: log.userName,
                    userEmail: log.userEmail ?? undefined,
                    userId: log.userId,
                  })
                  return (
                    <tr
                      key={log.id}
                      className={
                        isDeficit
                          ? 'bg-red-50 dark:bg-red-900/15 border-r-4 border-red-500'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors'
                      }
                    >
                      <td className="px-4 py-3 tabular-nums text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        <p className="text-xs">{d.toLocaleDateString('ar-SA')}</p>
                        <p className="text-[11px] text-gray-400">{d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                            style={{ background: isDeficit ? '#ef4444' : 'var(--accent)' }}
                          >
                            {displayName[0]?.toUpperCase() ?? '؟'}
                          </div>
                          <span className="font-medium text-gray-900 dark:text-gray-100">{displayName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${categoryColor(log.category)}`}>
                          {categoryLabel(log.category)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {isDeficit ? (
                          <span className="flex items-center gap-1.5 font-semibold text-red-600 dark:text-red-400">
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                            {log.action}
                          </span>
                        ) : (
                          <span className="font-medium text-gray-900 dark:text-gray-100">{log.action}</span>
                        )}
                      </td>
                      <td className={`px-4 py-3 max-w-xs truncate ${isDeficit ? 'font-medium text-red-700 dark:text-red-300' : 'text-gray-500 dark:text-gray-400'}`}>
                        {log.details ?? '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
