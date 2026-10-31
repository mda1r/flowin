import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Table } from '@/components/ui/Table'
import { Badge } from '@/components/ui/Badge'
import { inventoryApi } from '@/api/inventory'
import { usersApi } from '@/api/users'
import { invoiceNo } from '@/lib/invoiceNumber'
import { apiErrorMessage } from '@/lib/apiError'
import { formatDateTime } from '@/lib/utils'
import { useI18n } from '@/i18n'
import type { MovementType, StockItemResponse, StockMovementResponse } from '@/types/api'

const PAGE_SIZE = 20

const MOVEMENT_TYPES: MovementType[] = ['Receive', 'Sale', 'Return', 'Adjustment', 'TransferIn', 'TransferOut', 'WriteOff']

const TYPE_BADGE: Record<MovementType, 'green' | 'blue' | 'yellow' | 'red' | 'gray' | 'purple'> = {
  Receive: 'green',
  Return: 'blue',
  TransferIn: 'green',
  Sale: 'purple',
  TransferOut: 'gray',
  Adjustment: 'yellow',
  WriteOff: 'red',
}

const INCOMING: MovementType[] = ['Receive', 'Return', 'TransferIn']

// Signed change as the shop reads it: a sale of 3 shows −3 even when only 2 were on record.
function movementChange(m: StockMovementResponse) {
  if (m.type === 'Adjustment') return m.quantityAfter - m.quantityBefore
  return INCOMING.includes(m.type) ? m.quantity : -m.quantity
}

function formatQty(n: number) {
  return Number(n.toFixed(3)).toString()
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function StockCardModal({
  item,
  productName,
  onClose,
}: {
  item: StockItemResponse | null
  productName: string
  onClose: () => void
}) {
  const { t, lang } = useI18n()
  const [type, setType] = useState<MovementType | ''>('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)

  const branchId = item?.branchId
  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['stock-movements', branchId, item?.id, type, from, to, page],
    queryFn: () =>
      inventoryApi
        .listMovements(branchId!, item!.id, {
          type: type || undefined,
          from: from || undefined,
          to: to || undefined,
          page,
          pageSize: PAGE_SIZE,
        })
        .then((r) => r.data),
    enabled: !!item,
    placeholderData: (prev) => prev,
  })

  // Names for the "by" column; the card still works without them.
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list().then((r) => r.data),
    enabled: !!item,
    retry: false,
    staleTime: 300_000,
  })
  const userName = (id?: string | null) => {
    if (!id) return '—'
    const u = users?.find((x) => x.id === id)
    return u ? u.fullName || `${u.firstName} ${u.lastName}`.trim() : '—'
  }

  const close = () => {
    setType('')
    setFrom('')
    setTo('')
    setPage(1)
    onClose()
  }

  const rows = data?.items ?? []
  const pages = Math.max(1, Math.ceil((data?.totalCount ?? 0) / PAGE_SIZE))
  const locale = lang === 'ar' ? 'ar-SA' : 'en-US'

  const reference = (m: StockMovementResponse) => {
    if (m.type === 'Sale' && m.reference && GUID.test(m.reference)) {
      return t.inventory.invoice.replace('{n}', invoiceNo({ id: m.reference, number: m.invoiceNumber }))
    }
    return m.reference || '—'
  }

  return (
    <Modal open={!!item} onClose={close} title={`${t.inventory.stockCard} — ${productName}`} size="2xl">
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <p className="me-auto text-sm text-muted">
            {t.inventory.current}: <strong className="tabular-nums text-fg">{formatQty(item?.quantity ?? 0)}</strong>
          </p>
          <label className="text-xs text-muted">
            <span className="mb-1 block">{t.common.type}</span>
            <select
              className="input"
              value={type}
              onChange={(e) => { setType(e.target.value as MovementType | ''); setPage(1) }}
            >
              <option value="">{t.inventory.allMovements}</option>
              {MOVEMENT_TYPES.map((mt) => (
                <option key={mt} value={mt}>{t.inventory.movementTypes[mt]}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted">
            <span className="mb-1 block">{t.common.from}</span>
            <input type="date" className="input" value={from} max={to || undefined}
              onChange={(e) => { setFrom(e.target.value); setPage(1) }} />
          </label>
          <label className="text-xs text-muted">
            <span className="mb-1 block">{t.common.to}</span>
            <input type="date" className="input" value={to} min={from || undefined}
              onChange={(e) => { setTo(e.target.value); setPage(1) }} />
          </label>
        </div>

        {isError ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-border px-4 py-10 text-center">
            <p className="text-sm text-danger">{apiErrorMessage(error, t.inventory.movementsFailed)}</p>
            <Button size="sm" variant="secondary" loading={isFetching} onClick={() => refetch()}>
              {t.inventory.retry}
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border border-border">
            <Table
              loading={isLoading}
              data={rows}
              keyExtractor={(m) => m.id}
              emptyMessage={t.inventory.noMovements}
              columns={[
                {
                  key: 'date',
                  header: t.common.date,
                  render: (m) => <span className="whitespace-nowrap text-muted">{formatDateTime(m.occurredAt, locale)}</span>,
                },
                {
                  key: 'type',
                  header: t.common.type,
                  render: (m) => <Badge variant={TYPE_BADGE[m.type] ?? 'gray'}>{t.inventory.movementTypes[m.type] ?? m.type}</Badge>,
                },
                {
                  key: 'change',
                  header: t.inventory.change,
                  render: (m) => {
                    const change = movementChange(m)
                    const shortfall = m.type === 'Sale' ? m.quantity - (m.quantityBefore - m.quantityAfter) : 0
                    return (
                      <div className="flex items-center gap-2">
                        <span dir="ltr" className={`font-medium tabular-nums ${change > 0 ? 'text-success' : change < 0 ? 'text-danger' : 'text-muted'}`}>
                          {change > 0 ? '+' : ''}{formatQty(change)}
                        </span>
                        {shortfall > 0 && (
                          <span title={t.inventory.shortfallHint}>
                            <Badge variant="yellow">{t.inventory.shortfall.replace('{n}', formatQty(shortfall))}</Badge>
                          </span>
                        )}
                      </div>
                    )
                  },
                },
                {
                  key: 'balance',
                  header: t.inventory.balance,
                  render: (m) => (
                    <span className="whitespace-nowrap tabular-nums text-muted">
                      {formatQty(m.quantityBefore)} {lang === 'ar' ? '←' : '→'} <strong className="text-fg">{formatQty(m.quantityAfter)}</strong>
                    </span>
                  ),
                },
                {
                  key: 'reference',
                  header: t.common.reference,
                  render: (m) => <span className="whitespace-nowrap">{reference(m)}</span>,
                },
                {
                  key: 'notes',
                  header: t.common.notes,
                  render: (m) => <span className="text-muted">{m.notes || '—'}</span>,
                },
                {
                  key: 'by',
                  header: t.inventory.by,
                  render: (m) => <span className="whitespace-nowrap text-muted">{userName(m.userId)}</span>,
                },
              ]}
            />
          </div>
        )}

        {!isError && pages > 1 && (
          <div className="flex items-center justify-between text-sm text-muted">
            <span>{t.inventory.pageOf.replace('{page}', String(page)).replace('{pages}', String(pages))}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={page <= 1 || isFetching} onClick={() => setPage((p) => p - 1)}>
                {t.inventory.prevPage}
              </Button>
              <Button size="sm" variant="secondary" disabled={page >= pages || isFetching} onClick={() => setPage((p) => p + 1)}>
                {t.inventory.nextPage}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
