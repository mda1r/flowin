import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, Download, Filter, AlertTriangle, Loader2, RefreshCw } from 'lucide-react'
import { activityLogsApi } from '@/api/activityLogs'
import { resolveDisplayName } from '@/lib/activityLog'
import type { LogCategory } from '@/lib/activityLog'
import type { ActivityLogResponse } from '@/types/api'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/i18n'

const CATEGORY_LABELS: Record<LogCategory, string> = {
  shift:         'الشفت',
  inventory:     'المخزون',
  'stock-count': 'الجرد',
  order:         'الطلبات',
  user:          'المستخدمون',
  other:         'أخرى',
}

const CATEGORY_COLORS: Record<LogCategory, string> = {
  shift:         'bg-info/10 text-info',
  inventory:     'bg-warning/10 text-warning dark:bg-warning/15',
  'stock-count': 'bg-brand-soft text-brand-ink dark:bg-brand/20',
  order:         'bg-success/10 text-success dark:bg-success/15',
  user:          'bg-danger/10 text-danger dark:bg-danger/15',
  other:         'bg-surface-2 text-muted',
}

function categoryLabel(cat: string): string {
  return CATEGORY_LABELS[cat as LogCategory] ?? cat
}

function categoryColor(cat: string): string {
  return CATEGORY_COLORS[cat as LogCategory] ?? CATEGORY_COLORS.other
}

function exportCsv(logs: ActivityLogResponse[], t: ReturnType<typeof useI18n>['t'], lang: string) {
  const locale = lang === 'ar' ? 'ar-SA' : 'en-US'
  const rows = [
    [
      t.activityLogs.csvColumns.date,
      t.activityLogs.csvColumns.time,
      t.activityLogs.csvColumns.user,
      t.activityLogs.csvColumns.category,
      t.activityLogs.csvColumns.action,
      t.activityLogs.csvColumns.details,
    ],
    ...logs.map((l) => {
      const d = new Date(l.timestamp)
      return [
        d.toLocaleDateString(locale),
        d.toLocaleTimeString(locale),
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
  const { t, lang } = useI18n()
  const [filterCategory, setFilterCategory] = useState<LogCategory | 'all'>('all')
  const [filterUser, setFilterUser] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['activity-logs', branchId],
    queryFn: () => activityLogsApi.list({ branchId: branchId ?? undefined, pageSize: 500 })
      .then((r) => r.data),
    staleTime: 30_000,
    enabled: !!branchId,
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
          <h1 className="flex items-center gap-2 text-2xl font-bold text-fg">
            <Activity className="h-6 w-6" style={{ color: 'var(--accent)' }} />
            {t.activityLogs.title}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {isLoading ? t.common.loading : `${logs.length} سجل`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-sm font-medium text-fg hover:bg-surface-2 disabled:opacity-40"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            تحديث
          </button>
          <button
            onClick={() => exportCsv(logs, t, lang)}
            disabled={logs.length === 0}
            className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-sm font-medium text-fg hover:bg-surface-2 disabled:opacity-40"
          >
            <Download className="h-4 w-4" />
            {t.activityLogs.exportCsv}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-surface p-4">
        <Filter className="h-4 w-4 text-muted mt-5 shrink-0" />

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted">{t.activityLogs.category}</label>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as LogCategory | 'all')}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm focus:outline-none text-fg"
          >
            <option value="all">{t.activityLogs.all}</option>
            {(Object.keys(CATEGORY_LABELS) as LogCategory[]).map((k) => (
              <option key={k} value={k}>{CATEGORY_LABELS[k]}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted">{t.activityLogs.user}</label>
          <input
            type="text"
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            placeholder={t.common.search}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm focus:outline-none text-fg"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted">من تاريخ</label>
          <input
            type="date"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm focus:outline-none text-fg"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted">إلى تاريخ</label>
          <input
            type="date"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm focus:outline-none text-fg"
          />
        </div>

        {hasFilters && (
          <button
            onClick={() => { setFilterCategory('all'); setFilterUser(''); setFilterFrom(''); setFilterTo('') }}
            className="rounded-lg px-3 py-1.5 text-sm text-muted hover:text-fg mt-5"
          >
            إعادة تعيين
          </button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-border bg-surface py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted" />
          <span className="text-muted">{t.common.loading}</span>
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-surface py-20 text-center">
          <Activity className="h-10 w-10 text-muted/50" />
          <p className="text-muted">{t.activityLogs.noLogs}</p>
          <p className="text-xs text-muted/50">
            ستظهر هنا نشاطات فتح الشفت وتعديل المخزون والجرد
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface-2">
                <tr>
                  {[
                    `${t.activityLogs.date} ${t.activityLogs.time}`,
                    t.activityLogs.user,
                    t.activityLogs.category,
                    t.activityLogs.action,
                    t.activityLogs.details,
                  ].map((h, i) => (
                    <th key={i} className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
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
                          ? 'bg-danger/10 dark:bg-danger/15 border-r-4 border-danger'
                          : 'hover:bg-surface-2 transition-colors'
                      }
                    >
                      <td className="px-4 py-3 tabular-nums text-muted whitespace-nowrap">
                        <p className="text-xs">{d.toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US')}</p>
                        <p className="text-[11px] text-muted">{d.toLocaleTimeString(lang === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-brand-fg"
                            style={{ background: isDeficit ? '#ef4444' : 'var(--accent)' }}
                          >
                            {displayName[0]?.toUpperCase() ?? '؟'}
                          </div>
                          <span className="font-medium text-fg">{displayName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${categoryColor(log.category)}`}>
                          {categoryLabel(log.category)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {isDeficit ? (
                          <span className="flex items-center gap-1.5 font-semibold text-danger">
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                            {log.action}
                          </span>
                        ) : (
                          <span className="font-medium text-fg">{log.action}</span>
                        )}
                      </td>
                      <td className={`px-4 py-3 max-w-xs truncate ${isDeficit ? 'font-medium text-danger dark:text-danger' : 'text-muted '}`}>
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
