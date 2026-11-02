import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Search, Plus, Eye, Layers } from 'lucide-react'
import { brandsApi } from '@/api/brands'
import type { BrandResponse, CreateBrandRequest } from '@/api/brands'
import { useI18n } from '@/i18n'
import { toast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/layout/PageHeader'
import { apiErrorMessage } from '@/lib/apiError'
import { fmtDate } from '@/lib/locale'
import { fill } from './adminShared'

export function BrandStatusBadge({ status }: { status: string }) {
  const { t } = useI18n()
  const key = status.toLowerCase() as keyof typeof t.admin.brands.statuses
  const variant = key === 'active' ? 'green' : key === 'suspended' ? 'yellow' : 'gray'
  return <Badge variant={variant}>{t.admin.brands.statuses[key] ?? status}</Badge>
}

interface CreateBrandModalProps {
  open: boolean
  onClose: () => void
}

function CreateBrandModal({ open, onClose }: CreateBrandModalProps) {
  const { t } = useI18n()
  const qc = useQueryClient()
  const [form, setForm] = useState<CreateBrandRequest>({
    nameAr: '',
    nameEn: '',
    code: '',
    notes: '',
  })

  const mutation = useMutation({
    mutationFn: () => brandsApi.create(form),
    onSuccess: () => {
      toast.success(t.admin.ui.brandCreated)
      qc.invalidateQueries({ queryKey: ['brands'] })
      onClose()
      setForm({ nameAr: '', nameEn: '', code: '', notes: '' })
    },
    onError: (error) => toast.error(t.admin.ui.brandCreateFailed, apiErrorMessage(error)),
  })

  return (
    <Modal open={open} onClose={onClose} title={t.admin.brands.create}>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">
            {t.admin.brands.nameAr}
          </label>
          <input
            value={form.nameAr}
            onChange={(e) => setForm((f) => ({ ...f, nameAr: e.target.value }))}
            className="w-full rounded-lg bg-surface-2 px-3 py-2 text-sm text-fg outline-none ring-1 ring-border focus:ring-info/40"
            dir="rtl"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">
            {t.admin.brands.nameEn}
          </label>
          <input
            value={form.nameEn}
            onChange={(e) => setForm((f) => ({ ...f, nameEn: e.target.value }))}
            className="w-full rounded-lg bg-surface-2 px-3 py-2 text-sm text-fg outline-none ring-1 ring-border focus:ring-info/40"
            dir="ltr"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">
            {t.admin.brands.code}
          </label>
          <input
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
            className="w-full rounded-lg bg-surface-2 px-3 py-2 text-sm text-fg font-mono uppercase outline-none ring-1 ring-border focus:ring-info/40"
            dir="ltr"
            placeholder={t.admin.ui.codePlaceholder}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted">
            {t.admin.brands.notes}
          </label>
          <textarea
            value={form.notes ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={3}
            className="w-full rounded-lg bg-surface-2 px-3 py-2 text-sm text-fg outline-none ring-1 ring-border focus:ring-info/40 resize-none"
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose}>
            {t.admin.brands.cancel}
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!form.nameAr || !form.nameEn || !form.code || mutation.isPending}
          >
            {mutation.isPending ? '…' : t.admin.brands.create}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export function BrandsPage() {
  const { t } = useI18n()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['brands', { search, status: statusFilter, page }],
    queryFn: () =>
      brandsApi.list({
        search: search || undefined,
        status: statusFilter || undefined,
        page,
        pageSize: 20,
      }),
  })

  const items = data?.items ?? []
  const total = data?.totalCount ?? 0
  const totalPages = Math.max(1, Math.ceil(total / 20))

  return (
    <div>
      <PageHeader
        icon={<Layers className="h-5 w-5" />}
        title={t.admin.brands.title}
        description={fill(t.admin.ui.brandsCount, { n: total })}
        action={
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            {t.admin.brands.new}
          </Button>
        }
      />

      <div className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder={t.admin.brands.search}
              aria-label={t.admin.brands.search}
              className="input ps-10"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
            aria-label={t.admin.brands.status}
            className="input sm:w-48"
          >
            <option value="">{t.admin.ui.allStatuses}</option>
            <option value="active">{t.admin.brands.statuses.active}</option>
            <option value="suspended">{t.admin.brands.statuses.suspended}</option>
            <option value="archived">{t.admin.brands.statuses.archived}</option>
          </select>
        </div>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="border-b border-border bg-surface-2/60 text-xs font-semibold text-muted">
                  <th className="whitespace-nowrap px-4 py-3 text-start">{t.admin.brands.title}</th>
                  <th className="whitespace-nowrap px-4 py-3 text-start">{t.admin.brands.code}</th>
                  <th className="whitespace-nowrap px-4 py-3 text-start">{t.admin.brands.memberCount}</th>
                  <th className="whitespace-nowrap px-4 py-3 text-start">{t.admin.brands.status}</th>
                  <th className="whitespace-nowrap px-4 py-3 text-start">{t.admin.brands.createdAt}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 6 }).map((__, j) => (
                          <td key={j} className="px-4 py-4">
                            <div className="h-4 animate-pulse rounded bg-surface-2" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : items.map((brand: BrandResponse) => (
                      <tr key={brand.id} className="transition-colors hover:bg-surface-2/50">
                        <td className="px-4 py-3">
                          <Link to="/admin/brands/$id" params={{ id: brand.id }} className="font-medium text-fg hover:underline">
                            {brand.nameAr}
                          </Link>
                          <p className="text-xs text-muted" dir="ltr">{brand.nameEn}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-md bg-surface-2 px-2 py-0.5 font-mono text-xs text-fg" dir="ltr">{brand.code}</span>
                        </td>
                        <td className="px-4 py-3 text-fg">{brand.memberCount}</td>
                        <td className="px-4 py-3">
                          <BrandStatusBadge status={brand.status} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted">{fmtDate(brand.createdAt)}</td>
                        <td className="px-4 py-3 text-end">
                          <Link
                            to="/admin/brands/$id"
                            params={{ id: brand.id }}
                            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-brand-ink hover:bg-brand-soft"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            {t.admin.brands.overview}
                          </Link>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
          {!isLoading && items.length === 0 && (
            <EmptyState
              icon={<Layers />}
              title={t.admin.ui.noBrands}
              description={t.admin.ui.noBrandsHint}
              action={
                <Button size="sm" onClick={() => setShowCreate(true)}>
                  <Plus className="h-4 w-4" />
                  {t.admin.brands.new}
                </Button>
              }
            />
          )}
        </Card>

        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-muted">
            <span>{fill(t.admin.ui.pageOf, { page, total: totalPages })}</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                {t.admin.ui.previous}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                {t.admin.ui.next}
              </Button>
            </div>
          </div>
        )}
      </div>

      <CreateBrandModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  )
}
