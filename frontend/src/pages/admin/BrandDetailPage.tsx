import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import {
  ArrowRight,
  Users,
  Receipt,
  Layers,
  Plus,
  Trash2,
  UserPlus,
} from 'lucide-react'
import {
  brandsApi,
  type BrandMemberResponse,
  type TaxScopeResponse,
  type CreateTaxScopeRequest,
  type LinkTenantRequest,
  type AddTenantToTaxScopeRequest,
} from '@/api/brands'
import { superAdminApi } from '@/api/superadmin'
import { useI18n } from '@/i18n'
import { toast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

type Tab = 'overview' | 'members' | 'tax' | 'activity'

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

// ── Link Tenant Modal ─────────────────────────────────────────────────────────

interface LinkTenantModalProps {
  brandId: string
  open: boolean
  onClose: () => void
}

function LinkTenantModal({ brandId, open, onClose }: LinkTenantModalProps) {
  const { t } = useI18n()
  const qc = useQueryClient()
  const [form, setForm] = useState<LinkTenantRequest>({
    tenantId: '',
    branchDisplayName: '',
    branchCode: '',
  })
  const { data: tenants } = useQuery({
    queryKey: ['tenants-list'],
    queryFn: () => superAdminApi.listTenants().then((r) => r.data),
    enabled: open,
  })

  const mutation = useMutation({
    mutationFn: () => brandsApi.linkTenant(brandId, form),
    onSuccess: () => {
      toast.success('Tenant linked')
      qc.invalidateQueries({ queryKey: ['brand', brandId] })
      onClose()
      setForm({ tenantId: '', branchDisplayName: '', branchCode: '' })
    },
    onError: () => toast.error('Failed to link tenant'),
  })

  return (
    <Modal open={open} onClose={onClose} title={t.admin.brands.linkTenant}>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">
            {t.admin.brands.tenantId}
          </label>
          <select
            value={form.tenantId}
            onChange={(e) => setForm((f) => ({ ...f, tenantId: e.target.value }))}
            className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-white outline-none ring-1 ring-slate-700 focus:ring-blue-500"
          >
            <option value="">— Select tenant —</option>
            {tenants?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">
            {t.admin.brands.branchDisplayName}
          </label>
          <input
            value={form.branchDisplayName ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, branchDisplayName: e.target.value }))}
            className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-white outline-none ring-1 ring-slate-700 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">
            {t.admin.brands.branchCode}
          </label>
          <input
            value={form.branchCode ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, branchCode: e.target.value }))}
            className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-white font-mono outline-none ring-1 ring-slate-700 focus:ring-blue-500"
            dir="ltr"
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose}>{t.admin.brands.cancel}</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!form.tenantId || mutation.isPending}
          >
            {mutation.isPending ? '…' : t.admin.brands.confirm}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Create Tax Scope Modal ────────────────────────────────────────────────────

interface CreateTaxScopeModalProps {
  brandId: string
  open: boolean
  onClose: () => void
}

function CreateTaxScopeModal({ brandId, open, onClose }: CreateTaxScopeModalProps) {
  const { t } = useI18n()
  const qc = useQueryClient()
  const [form, setForm] = useState<CreateTaxScopeRequest>({
    name: '',
    vatRegistrationNumber: '',
    legalEntityName: '',
  })

  const mutation = useMutation({
    mutationFn: () => brandsApi.createTaxScope(brandId, form),
    onSuccess: () => {
      toast.success('Tax scope created')
      qc.invalidateQueries({ queryKey: ['brand', brandId] })
      onClose()
      setForm({ name: '', vatRegistrationNumber: '', legalEntityName: '' })
    },
    onError: () => toast.error('Failed to create tax scope'),
  })

  return (
    <Modal open={open} onClose={onClose} title={t.admin.brands.createTaxScope}>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">
            {t.admin.brands.scopeName}
          </label>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-white outline-none ring-1 ring-slate-700 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">
            {t.admin.brands.vatNumber}
          </label>
          <input
            value={form.vatRegistrationNumber}
            onChange={(e) =>
              setForm((f) => ({ ...f, vatRegistrationNumber: e.target.value }))
            }
            className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-white font-mono outline-none ring-1 ring-slate-700 focus:ring-blue-500"
            dir="ltr"
            placeholder="3XXXXXXXXXXXXXX"
            maxLength={15}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">
            {t.admin.brands.legalEntityName}
          </label>
          <input
            value={form.legalEntityName}
            onChange={(e) => setForm((f) => ({ ...f, legalEntityName: e.target.value }))}
            className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-white outline-none ring-1 ring-slate-700 focus:ring-blue-500"
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose}>{t.admin.brands.cancel}</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={
              !form.name ||
              !form.vatRegistrationNumber ||
              !form.legalEntityName ||
              mutation.isPending
            }
          >
            {mutation.isPending ? '…' : t.admin.brands.create}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Add Tenant to Tax Scope Modal ─────────────────────────────────────────────

interface AddToScopeModalProps {
  scopeId: string
  brandId: string
  open: boolean
  onClose: () => void
}

function AddToScopeModal({ scopeId, brandId, open, onClose }: AddToScopeModalProps) {
  const { t } = useI18n()
  const qc = useQueryClient()
  const [form, setForm] = useState<AddTenantToTaxScopeRequest>({
    tenantId: '',
    effectiveFrom: new Date().toISOString().split('T')[0],
  })
  const { data: tenants } = useQuery({
    queryKey: ['tenants-list'],
    queryFn: () => superAdminApi.listTenants().then((r) => r.data),
    enabled: open,
  })

  const mutation = useMutation({
    mutationFn: () => brandsApi.addTenantToTaxScope(scopeId, form),
    onSuccess: () => {
      toast.success('Tenant added to scope')
      qc.invalidateQueries({ queryKey: ['brand', brandId] })
      onClose()
      setForm({ tenantId: '', effectiveFrom: new Date().toISOString().split('T')[0] })
    },
    onError: () => toast.error('Failed to add tenant'),
  })

  return (
    <Modal open={open} onClose={onClose} title={t.admin.brands.addToScope}>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">
            {t.admin.brands.tenantId}
          </label>
          <select
            value={form.tenantId}
            onChange={(e) => setForm((f) => ({ ...f, tenantId: e.target.value }))}
            className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-white outline-none ring-1 ring-slate-700 focus:ring-blue-500"
          >
            <option value="">— Select tenant —</option>
            {tenants?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">
            {t.admin.brands.effectiveFrom}
          </label>
          <input
            type="date"
            value={form.effectiveFrom}
            onChange={(e) => setForm((f) => ({ ...f, effectiveFrom: e.target.value }))}
            className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-white outline-none ring-1 ring-slate-700 focus:ring-blue-500"
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose}>{t.admin.brands.cancel}</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!form.tenantId || mutation.isPending}
          >
            {mutation.isPending ? '…' : t.admin.brands.confirm}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Members Tab ───────────────────────────────────────────────────────────────

interface MembersTabProps {
  brandId: string
  members: BrandMemberResponse[]
}

function MembersTab({ brandId, members }: MembersTabProps) {
  const { t } = useI18n()
  const qc = useQueryClient()
  const [showLink, setShowLink] = useState(false)

  const unlinkMutation = useMutation({
    mutationFn: (membershipId: string) => brandsApi.unlinkTenant(membershipId),
    onSuccess: () => {
      toast.success('Tenant unlinked')
      qc.invalidateQueries({ queryKey: ['brand', brandId] })
    },
    onError: () => toast.error('Failed to unlink tenant'),
  })

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-400">{members.length} members</p>
        <Button size="sm" onClick={() => setShowLink(true)}>
          <UserPlus className="h-4 w-4" />
          {t.admin.brands.linkTenant}
        </Button>
      </div>

      {members.length === 0 ? (
        <div className="rounded-xl border border-slate-800 py-12 text-center text-slate-500">
          {t.admin.brands.noMembers}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs font-medium text-slate-500">
                <th className="px-4 py-3 text-right">Tenant</th>
                <th className="px-4 py-3 text-right">Type</th>
                <th className="px-4 py-3 text-right">Branch Code</th>
                <th className="px-4 py-3 text-right">Status</th>
                <th className="px-4 py-3 text-right">Linked</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {members.map((m: BrandMemberResponse) => (
                <tr key={m.membershipId} className="hover:bg-slate-800/40">
                  <td className="px-4 py-3">
                    <p className="font-medium text-white">{m.tenantName}</p>
                    <p className="text-xs text-slate-400">{m.tenantEmail}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">{m.businessType}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-300">
                    {m.branchCode ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={m.membershipStatus} />
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {new Date(m.linkedAt).toLocaleDateString('ar-SA')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {m.membershipStatus === 'Active' && (
                      <button
                        onClick={() => {
                          if (window.confirm(t.admin.brands.deleteConfirm)) {
                            unlinkMutation.mutate(m.membershipId)
                          }
                        }}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs text-rose-400 hover:bg-rose-900/30 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {t.admin.brands.unlinkTenant}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <LinkTenantModal brandId={brandId} open={showLink} onClose={() => setShowLink(false)} />
    </div>
  )
}

// ── Tax Tab ───────────────────────────────────────────────────────────────────

interface TaxTabProps {
  brandId: string
  scopes: TaxScopeResponse[]
}

function TaxTab({ brandId, scopes }: TaxTabProps) {
  const { t } = useI18n()
  const qc = useQueryClient()
  const [showCreateScope, setShowCreateScope] = useState(false)
  const [addToScopeId, setAddToScopeId] = useState<string | null>(null)

  const removeMutation = useMutation({
    mutationFn: (membershipId: string) => brandsApi.removeTenantFromTaxScope(membershipId),
    onSuccess: () => {
      toast.success('Tenant removed from scope')
      qc.invalidateQueries({ queryKey: ['brand', brandId] })
    },
    onError: () => toast.error('Failed to remove tenant from scope'),
  })

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-400">{scopes.length} tax scope{scopes.length !== 1 ? 's' : ''}</p>
        <Button size="sm" onClick={() => setShowCreateScope(true)}>
          <Plus className="h-4 w-4" />
          {t.admin.brands.createTaxScope}
        </Button>
      </div>

      {scopes.length === 0 ? (
        <div className="rounded-xl border border-slate-800 py-12 text-center text-slate-500">
          {t.admin.brands.noTaxScopes}
        </div>
      ) : (
        scopes.map((scope: TaxScopeResponse) => (
          <div key={scope.id} className="rounded-xl border border-slate-800 bg-slate-900">
            <div className="flex items-start justify-between p-4 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-white">{scope.name}</p>
                  {scope.isActive ? (
                    <span className="rounded-full bg-emerald-900/60 px-2 py-0.5 text-xs font-semibold text-emerald-300">
                      Active
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs font-semibold text-slate-400">
                      Inactive
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-slate-400" dir="ltr">
                  VAT: {scope.vatRegistrationNumber} · {scope.legalEntityName}
                </p>
              </div>
              <button
                onClick={() => setAddToScopeId(scope.id)}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                {t.admin.brands.addToScope}
              </button>
            </div>
            <div className="p-2">
              {scope.members.length === 0 ? (
                <p className="px-2 py-3 text-xs text-slate-500 text-center">No members in this scope</p>
              ) : (
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-slate-800">
                    {scope.members.map((m) => (
                      <tr key={m.membershipId} className="hover:bg-slate-800/40">
                        <td className="px-2 py-2 text-slate-300">{m.tenantName}</td>
                        <td className="px-2 py-2 text-slate-400" dir="ltr">
                          From {m.effectiveFrom}
                          {m.effectiveTo ? ` → ${m.effectiveTo}` : ''}
                        </td>
                        <td className="px-2 py-2 text-right">
                          {!m.effectiveTo && (
                            <button
                              onClick={() => {
                                if (window.confirm(t.admin.brands.deleteConfirm)) {
                                  removeMutation.mutate(m.membershipId)
                                }
                              }}
                              className="inline-flex items-center gap-1 rounded px-2 py-1 text-rose-400 hover:bg-rose-900/30"
                            >
                              <Trash2 className="h-3 w-3" />
                              {t.admin.brands.removeFromScope}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ))
      )}

      <CreateTaxScopeModal
        brandId={brandId}
        open={showCreateScope}
        onClose={() => setShowCreateScope(false)}
      />
      {addToScopeId && (
        <AddToScopeModal
          scopeId={addToScopeId}
          brandId={brandId}
          open={true}
          onClose={() => setAddToScopeId(null)}
        />
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function BrandDetailPage() {
  const { t } = useI18n()
  const params = useParams({ strict: false }) as { id: string }
  const brandId = params.id
  const [tab, setTab] = useState<Tab>('overview')

  const { data: brand, isLoading } = useQuery({
    queryKey: ['brand', brandId],
    queryFn: () => brandsApi.get(brandId),
  })

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'overview', label: t.admin.brands.overview, icon: Layers },
    { key: 'members', label: t.admin.brands.members, icon: Users },
    { key: 'tax', label: t.admin.brands.taxScopes, icon: Receipt },
  ]

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-10 rounded-xl bg-slate-800 animate-pulse" />
        ))}
      </div>
    )
  }

  if (!brand) {
    return (
      <div className="p-6 text-center text-slate-400">Brand not found</div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Back link */}
      <Link
        to="/admin/brands"
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
      >
        <ArrowRight className="h-4 w-4" />
        {t.admin.brands.back}
      </Link>

      {/* Brand header */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600/20">
              <Layers className="h-6 w-6 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white">{brand.nameAr}</h1>
                <span className="font-mono text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
                  {brand.code}
                </span>
              </div>
              <p className="text-sm text-slate-400" dir="ltr">{brand.nameEn}</p>
              {brand.notes && (
                <p className="mt-1 text-xs text-slate-500">{brand.notes}</p>
              )}
            </div>
          </div>
          <StatusBadge status={brand.status} />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-4 border-t border-slate-800 pt-4">
          <div>
            <p className="text-xs text-slate-500">{t.admin.brands.memberCount}</p>
            <p className="mt-0.5 text-lg font-semibold text-white tabular-nums">{brand.memberCount}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">{t.admin.brands.taxScopes}</p>
            <p className="mt-0.5 text-lg font-semibold text-white tabular-nums">
              {brand.taxScopes?.length ?? 0}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">{t.admin.brands.createdAt}</p>
            <p className="mt-0.5 text-sm font-medium text-white">
              {new Date(brand.createdAt).toLocaleDateString('ar-SA')}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-800">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === key
                ? 'border-blue-500 text-white'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview' && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-white">{t.admin.brands.overview}</h2>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-xs text-slate-500">{t.admin.brands.nameAr}</dt>
              <dd className="mt-0.5 text-white">{brand.nameAr}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">{t.admin.brands.nameEn}</dt>
              <dd className="mt-0.5 text-white" dir="ltr">{brand.nameEn}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">{t.admin.brands.code}</dt>
              <dd className="mt-0.5 font-mono text-white">{brand.code}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">{t.admin.brands.status}</dt>
              <dd className="mt-0.5"><StatusBadge status={brand.status} /></dd>
            </div>
            {brand.notes && (
              <div className="col-span-2">
                <dt className="text-xs text-slate-500">{t.admin.brands.notes}</dt>
                <dd className="mt-0.5 text-slate-300">{brand.notes}</dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {tab === 'members' && (
        <MembersTab brandId={brandId} members={brand.members ?? []} />
      )}

      {tab === 'tax' && (
        <TaxTab brandId={brandId} scopes={brand.taxScopes ?? []} />
      )}
    </div>
  )
}
