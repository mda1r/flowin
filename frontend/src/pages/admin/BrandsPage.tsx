import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Search, Plus, Eye, Layers } from 'lucide-react'
import { isAxiosError } from 'axios'
import { brandsApi } from '@/api/brands'
import type { BrandResponse, CreateBrandRequest } from '@/api/brands'
import { useI18n } from '@/i18n'
import { toast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-emerald-900/60 text-emerald-300',
    suspended: 'bg-amber-900/60 text-amber-300',
    archived: 'bg-slate-700 text-slate-400',
  }
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${colors[status.toLowerCase()] ?? 'bg-slate-700 text-slate-400'}`}>
      {status}
    </span>
  )
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
      toast.success('Brand created')
      qc.invalidateQueries({ queryKey: ['brands'] })
      onClose()
      setForm({ nameAr: '', nameEn: '', code: '', notes: '' })
    },
    onError: (error) => {
      const msg = isAxiosError(error) ? (error.response?.data?.detail ?? 'Failed to create brand') : 'Failed to create brand'
      toast.error(msg)
    },
  })

  return (
    <Modal open={open} onClose={onClose} title={t.admin.brands.create}>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">
            {t.admin.brands.nameAr}
          </label>
          <input
            value={form.nameAr}
            onChange={(e) => setForm((f) => ({ ...f, nameAr: e.target.value }))}
            className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-white outline-none ring-1 ring-slate-700 focus:ring-blue-500"
            dir="rtl"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">
            {t.admin.brands.nameEn}
          </label>
          <input
            value={form.nameEn}
            onChange={(e) => setForm((f) => ({ ...f, nameEn: e.target.value }))}
            className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-white outline-none ring-1 ring-slate-700 focus:ring-blue-500"
            dir="ltr"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">
            {t.admin.brands.code}
          </label>
          <input
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
            className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-white font-mono uppercase outline-none ring-1 ring-slate-700 focus:ring-blue-500"
            dir="ltr"
            placeholder="e.g. ACME"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">
            {t.admin.brands.notes}
          </label>
          <textarea
            value={form.notes ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={3}
            className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-white outline-none ring-1 ring-slate-700 focus:ring-blue-500 resize-none"
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600/20">
            <Layers className="h-5 w-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">{t.admin.brands.title}</h1>
            <p className="text-xs text-slate-400">{total} brand{total !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" />
          {t.admin.brands.new}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder={t.admin.brands.search}
            className="w-full rounded-lg bg-slate-800 pl-9 pr-3 py-2 text-sm text-white outline-none ring-1 ring-slate-700 focus:ring-blue-500"
            dir="ltr"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-white outline-none ring-1 ring-slate-700 focus:ring-blue-500"
        >
          <option value="">All statuses</option>
          <option value="active">{t.admin.brands.statuses.active}</option>
          <option value="suspended">{t.admin.brands.statuses.suspended}</option>
          <option value="archived">{t.admin.brands.statuses.archived}</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-xs font-medium text-slate-500">
              <th className="px-4 py-3 text-right">{t.admin.brands.nameAr} / {t.admin.brands.nameEn}</th>
              <th className="px-4 py-3 text-right">{t.admin.brands.code}</th>
              <th className="px-4 py-3 text-right">{t.admin.brands.memberCount}</th>
              <th className="px-4 py-3 text-right">{t.admin.brands.status}</th>
              <th className="px-4 py-3 text-right">{t.admin.brands.createdAt}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 rounded bg-slate-800 animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              : items.map((brand: BrandResponse) => (
                  <tr key={brand.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-white">{brand.nameAr}</p>
                      <p className="text-xs text-slate-400" dir="ltr">{brand.nameEn}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-300">{brand.code}</td>
                    <td className="px-4 py-3 text-slate-300 tabular-nums">{brand.memberCount}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={brand.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {new Date(brand.createdAt).toLocaleDateString('ar-SA')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to="/admin/brands/$id"
                        params={{ id: brand.id }}
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        {t.admin.brands.overview}
                      </Link>
                    </td>
                  </tr>
                ))}
            {!isLoading && items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                  No brands found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>{total} total</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg px-3 py-1.5 hover:bg-slate-800 disabled:opacity-40"
            >
              ‹
            </button>
            <span>
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-lg px-3 py-1.5 hover:bg-slate-800 disabled:opacity-40"
            >
              ›
            </button>
          </div>
        </div>
      )}

      <CreateBrandModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  )
}
