import { useState, useEffect } from 'react'
import { ChefHat, Clock, CheckCircle, Loader2, X } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { getTickets, updateTicketStatus, removeTicket } from '@/lib/cafeKitchen'
import type { CafeKitchenTicket } from '@/lib/cafeKitchen'
import { cn } from '@/lib/utils'

const STATUS_CONFIG = {
  pending:   { label: 'جديد',      color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',   border: 'border-amber-300 dark:border-amber-700' },
  preparing: { label: 'يتحضر',    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',       border: 'border-blue-400 dark:border-blue-600' },
  ready:     { label: 'جاهز ✓',   color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', border: 'border-emerald-400 dark:border-emerald-600' },
}

function elapsed(ts: string) {
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (diff < 60) return `${diff} ث`
  return `${Math.floor(diff / 60)} د`
}

function TicketCard({
  ticket,
  onStatusChange,
  onDismiss,
}: {
  ticket: CafeKitchenTicket
  onStatusChange: (id: string, s: CafeKitchenTicket['status']) => void
  onDismiss: (id: string) => void
}) {
  const cfg = STATUS_CONFIG[ticket.status]
  const [, setTick] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 10_000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className={cn('relative flex flex-col rounded-2xl border-2 bg-white p-4 shadow-sm dark:bg-gray-900', cfg.border)}>
      {/* Header */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-bold', cfg.color)}>
            {cfg.label}
          </span>
          <span className="text-sm font-black text-gray-400">#{ticket.ticketNumber}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <Clock className="h-3 w-3" />
            {elapsed(ticket.timestamp)}
          </span>
          {ticket.status === 'ready' && (
            <button
              onClick={() => onDismiss(ticket.id)}
              className="rounded-full p-1 text-gray-300 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Order type */}
      <div className="mb-3">
        {ticket.orderType === 'here' ? (
          <span className="inline-flex items-center rounded-lg bg-amber-50 px-2 py-0.5 text-sm font-bold text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
            طاولة {ticket.tableNumber}
          </span>
        ) : (
          <span className="inline-flex items-center rounded-lg bg-blue-50 px-2 py-0.5 text-sm font-bold text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
            🛍 تيك أواي
          </span>
        )}
      </div>

      {/* Items */}
      <div className="flex-1 space-y-2">
        {ticket.items.map((item, i) => (
          <div key={i} className="border-b border-gray-100 pb-2 last:border-0 last:pb-0 dark:border-gray-800">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-semibold text-gray-900 dark:text-gray-100">{item.productName}</p>
              <span className="text-xl font-black tabular-nums text-gray-700 dark:text-gray-300">×{item.quantity}</span>
            </div>
            {item.variantName && item.variantName !== 'افتراضي' && item.variantName !== item.productName && (
              <p className="text-xs text-gray-400">{item.variantName}</p>
            )}
            {item.notes && (
              <p className="mt-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                📝 {item.notes}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="mt-4 flex gap-2">
        {ticket.status === 'pending' && (
          <button
            onClick={() => onStatusChange(ticket.id, 'preparing')}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-500 py-2 text-sm font-bold text-white hover:bg-blue-600"
          >
            <Loader2 className="h-4 w-4" />
            يتحضر
          </button>
        )}
        {ticket.status === 'preparing' && (
          <button
            onClick={() => onStatusChange(ticket.id, 'ready')}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-2 text-sm font-bold text-white hover:bg-emerald-600"
          >
            <CheckCircle className="h-4 w-4" />
            جاهز
          </button>
        )}
        {ticket.status === 'ready' && (
          <button
            onClick={() => onDismiss(ticket.id)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400"
          >
            <X className="h-4 w-4" />
            إزالة
          </button>
        )}
      </div>
    </div>
  )
}

export function CafeKitchenPage() {
  const { tenantId } = useAuthStore()
  const [tickets, setTickets] = useState<CafeKitchenTicket[]>([])

  const load = () => {
    if (tenantId) setTickets(getTickets(tenantId))
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 5_000)
    return () => clearInterval(t)
  }, [tenantId])

  const handleStatusChange = (id: string, status: CafeKitchenTicket['status']) => {
    if (!tenantId) return
    updateTicketStatus(tenantId, id, status)
    load()
  }

  const handleDismiss = (id: string) => {
    if (!tenantId) return
    removeTicket(tenantId, id)
    load()
  }

  const pending   = tickets.filter((t) => t.status === 'pending')
  const preparing = tickets.filter((t) => t.status === 'preparing')
  const ready     = tickets.filter((t) => t.status === 'ready')

  const columns = [
    { key: 'pending',   label: 'جديد',    count: pending.length,   items: pending,   accent: 'text-amber-500' },
    { key: 'preparing', label: 'يتحضر',  count: preparing.length, items: preparing, accent: 'text-blue-500' },
    { key: 'ready',     label: 'جاهز',    count: ready.length,     items: ready,     accent: 'text-emerald-500' },
  ]

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-950" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 bg-gray-900 px-6 py-4">
        <div className="flex items-center gap-3">
          <ChefHat className="h-6 w-6 text-amber-400" />
          <h1 className="text-lg font-black tracking-wide text-white">شاشة المطبخ</h1>
          <span className="rounded-full bg-amber-400/20 px-2.5 py-0.5 text-xs font-bold text-amber-400">
            {tickets.filter((t) => t.status !== 'ready').length} طلب نشط
          </span>
        </div>
        <p className="text-xs text-gray-500">يتحدث كل 5 ثوانٍ</p>
      </div>

      {/* Columns */}
      <div className="flex flex-1 gap-0 overflow-hidden">
        {columns.map((col, colIdx) => (
          <div
            key={col.key}
            className={cn(
              'flex flex-1 flex-col overflow-hidden',
              colIdx < columns.length - 1 && 'border-l border-gray-800',
            )}
          >
            {/* Column header */}
            <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
              <h2 className={cn('text-sm font-bold', col.accent)}>{col.label}</h2>
              {col.count > 0 && (
                <span className="rounded-full bg-gray-800 px-2 py-0.5 text-xs font-bold text-gray-300">
                  {col.count}
                </span>
              )}
            </div>

            {/* Cards */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {col.items.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-16 text-gray-700">
                  <ChefHat className="h-8 w-8" />
                  <p className="text-xs">لا يوجد</p>
                </div>
              ) : (
                col.items.map((ticket) => (
                  <TicketCard
                    key={ticket.id}
                    ticket={ticket}
                    onStatusChange={handleStatusChange}
                    onDismiss={handleDismiss}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
