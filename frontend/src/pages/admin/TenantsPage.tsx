import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { Building2, PauseCircle, PlayCircle, Plus, Repeat, Search, Trash2, UserPlus } from 'lucide-react'
import { superAdminApi } from '@/api/superadmin'
import type { BusinessType, TenantWithSubscriptionResponse } from '@/types/api'
import { toast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/layout/PageHeader'
import { apiErrorMessage } from '@/lib/apiError'
import { cn, formatCurrency, normalizeArabic } from '@/lib/utils'
import { fmtDate, fmtNum } from '@/lib/locale'
import { useI18n } from '@/i18n'
import { NewSubscriptionModal } from './NewSubscriptionModal'
import { CreateTenantModal } from './CreateTenantModal'
import { RenewSubscriptionModal } from './RenewSubscriptionModal'
import { SuspendTenantModal } from './SuspendTenantModal'
import {
  BUSINESS_TYPES,
  BusinessChip,
  STATE_FILL,
  STATE_ORDER,
  StateBadge,
  businessLabel,
  fill,
  stateDetail,
  tenantState,
  type TenantState,
} from './adminShared'

const iconBtn = 'rounded-lg p-2 text-muted transition-colors hover:bg-surface-2 hover:text-fg'

export function TenantsPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { t } = useI18n()
  const ui = t.admin.ui
  const [search, setSearch] = useState('')
  const [stateFilter, setStateFilter] = useState<TenantState | 'all'>('all')
  const [typeFilter, setTypeFilter] = useState<BusinessType | 'all'>('all')
  const [showCreateTenant, setShowCreateTenant] = useState(false)
  const [subscribeTarget, setSubscribeTarget] = useState<TenantWithSubscriptionResponse | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TenantWithSubscriptionResponse | null>(null)
  const [renewTarget, setRenewTarget] = useState<TenantWithSubscriptionResponse | null>(null)
  const [suspendTarget, setSuspendTarget] = useState<TenantWithSubscriptionResponse | null>(null)
  // Renewal extends the end of the chain, which can be a pre-paid period after the live one.
  const renewSub = renewTarget?.renewableSubscription ?? renewTarget?.activeSubscription

  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ['admin', 'tenants'],
    queryFn: () => superAdminApi.listTenants().then((r) => r.data),
  })

  const activateMut = useMutation({
    mutationFn: (ten: TenantWithSubscriptionResponse) => superAdminApi.activateTenant(ten.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'tenants'] })
      toast.success(ui.activated)
    },
    onError: (err) => toast.error(ui.actionFailed, apiErrorMessage(err)),
  })

  const deleteMut = useMutation({
    mutationFn: (ten: TenantWithSubscriptionResponse) => superAdminApi.deleteTenant(ten.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'tenants'] })
      toast.success(ui.deleted)
      setDeleteTarget(null)
    },
    onError: (err) => toast.error(ui.actionFailed, apiErrorMessage(err)),
  })

  const rows = tenants.map((tenant) => ({ tenant, state: tenantState(tenant) }))
  const ofType = rows.filter((r) => typeFilter === 'all' || r.tenant.businessType === typeFilter)
  const term = normalizeArabic(search.trim().toLowerCase())
  const filtered = ofType
    .filter((r) => stateFilter === 'all' || r.state === stateFilter)
    .filter(({ tenant }) =>
      !term
      || normalizeArabic(tenant.name.toLowerCase()).includes(term)
      || tenant.adminEmail.toLowerCase().includes(term)
      || tenant.subdomain.toLowerCase().includes(term))
    .sort((a, b) => STATE_ORDER.indexOf(a.state) - STATE_ORDER.indexOf(b.state) || a.tenant.name.localeCompare(b.tenant.name))
  const countOf = (s: TenantState) => ofType.filter((r) => r.state === s).length
  const filtering = stateFilter !== 'all' || typeFilter !== 'all' || term.length > 0

  const primaryAction = (tenant: TenantWithSubscriptionResponse, state: TenantState) => {
    if (state === 'suspended') {
      return (
        <Button size="sm" variant="secondary" loading={activateMut.isPending && activateMut.variables?.id === tenant.id} onClick={() => activateMut.mutate(tenant)}>
          <PlayCircle className="h-3.5 w-3.5" />
          {ui.activate}
        </Button>
      )
    }
    if (state === 'noPlan') {
      return (
        <Button size="sm" variant="secondary" onClick={() => setSubscribeTarget(tenant)}>
          <Plus className="h-3.5 w-3.5" />
          {ui.subscribe}
        </Button>
      )
    }
    return (
      <Button size="sm" variant="secondary" onClick={() => setRenewTarget(tenant)}>
        <Repeat className="h-3.5 w-3.5" />
        {ui.renew}
      </Button>
    )
  }

  return (
    <div>
      <PageHeader
        icon={<Building2 className="h-5 w-5" />}
        title={t.admin.tenants.title}
        description={fill(ui.registered, { n: tenants.length })}
        action={
          <Button onClick={() => setShowCreateTenant(true)}>
            <UserPlus className="h-4 w-4" />
            {ui.addTenant}
          </Button>
        }
      />

      <div className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.admin.tenants.searchPlaceholder}
              aria-label={t.admin.tenants.searchPlaceholder}
              className="input ps-10"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as BusinessType | 'all')}
            aria-label={t.admin.tenants.businessType}
            className="input lg:w-48"
          >
            <option value="all">{ui.allTypes}</option>
            {BUSINESS_TYPES.map((type) => (
              <option key={type} value={type}>{businessLabel(type, t)}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label={t.admin.tenants.status}>
          {(['all', ...STATE_ORDER] as const).map((s) => {
            const n = s === 'all' ? ofType.length : countOf(s)
            if (s !== 'all' && n === 0) return null
            const on = stateFilter === s
            return (
              <button
                key={s}
                type="button"
                onClick={() => setStateFilter(s)}
                aria-pressed={on}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors',
                  on ? 'border-brand bg-brand-soft font-medium text-brand-ink' : 'border-border bg-surface text-muted hover:text-fg',
                )}
              >
                {s !== 'all' && <span className={`h-2 w-2 rounded-full ${STATE_FILL[s]}`} aria-hidden="true" />}
                {s === 'all' ? ui.all : ui.states[s]}
                <span className="tabular-nums text-xs opacity-80">{fmtNum(n)}</span>
              </button>
            )
          })}
        </div>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="border-b border-border bg-surface-2/60">
                  {[t.admin.tenants.name, t.admin.tenants.businessType, t.admin.tenants.plan, t.admin.tenants.status, t.admin.tenants.expires, ''].map((h, i) => (
                    <th key={i} className="whitespace-nowrap px-4 py-3 text-start text-xs font-semibold text-muted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 6 }).map((__, j) => (
                          <td key={j} className="px-4 py-4">
                            <div className="h-4 animate-pulse rounded bg-surface-2" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : filtered.map(({ tenant, state }) => {
                      const sub = tenant.activeSubscription
                      return (
                        <tr
                          key={tenant.id}
                          onClick={() => navigate({ to: '/admin/tenants/$id', params: { id: tenant.id } })}
                          className={cn('cursor-pointer transition-colors hover:bg-surface-2/50', state === 'suspended' && 'text-muted')}
                        >
                          <td className="max-w-[18rem] px-4 py-3">
                            <Link
                              to="/admin/tenants/$id"
                              params={{ id: tenant.id }}
                              onClick={(e) => e.stopPropagation()}
                              className="block truncate font-medium text-fg hover:underline"
                            >
                              {tenant.name}
                            </Link>
                            <p className="truncate text-xs text-muted" dir="ltr">
                              {tenant.adminEmail} · {tenant.subdomain}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <BusinessChip type={tenant.businessType} t={t} />
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            {sub ? (
                              <>
                                <p className="text-fg">{sub.planName}</p>
                                <p className="text-xs text-muted">
                                  {formatCurrency(sub.planPrice)}
                                  {ui.perMonth}
                                </p>
                              </>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <StateBadge state={state} t={t} />
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            {sub ? (
                              <>
                                <p className="text-fg">{fmtDate(sub.expiryDate)}</p>
                                <p className={cn('text-xs', state === 'expiring' ? 'text-warning' : state === 'expired' ? 'text-danger' : 'text-muted')}>
                                  {stateDetail(tenant, state, t)}
                                </p>
                              </>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              {primaryAction(tenant, state)}
                              {state !== 'noPlan' && state !== 'suspended' && (
                                <button
                                  type="button"
                                  onClick={() => setSubscribeTarget(tenant)}
                                  className={iconBtn}
                                  title={t.admin.subscription.newSubscription}
                                  aria-label={`${t.admin.subscription.newSubscription}: ${tenant.name}`}
                                >
                                  <Plus className="h-4 w-4" />
                                </button>
                              )}
                              {state !== 'suspended' && (
                                <button
                                  type="button"
                                  onClick={() => setSuspendTarget(tenant)}
                                  className={cn(iconBtn, 'hover:text-warning')}
                                  title={t.admin.tenants.suspend}
                                  aria-label={`${t.admin.tenants.suspend}: ${tenant.name}`}
                                >
                                  <PauseCircle className="h-4 w-4" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(tenant)}
                                className={cn(iconBtn, 'hover:text-danger')}
                                title={t.admin.tenants.delete}
                                aria-label={`${t.admin.tenants.delete}: ${tenant.name}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
              </tbody>
            </table>
          </div>
          {!isLoading && filtered.length === 0 && (
            <EmptyState
              icon={<Search />}
              title={tenants.length === 0 ? t.common.noData : ui.noMatch}
              action={
                filtering ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSearch('')
                      setStateFilter('all')
                      setTypeFilter('all')
                    }}
                  >
                    {ui.clearFilters}
                  </Button>
                ) : undefined
              }
            />
          )}
        </Card>
      </div>

      {subscribeTarget && (
        <NewSubscriptionModal
          tenantId={subscribeTarget.id}
          tenantName={subscribeTarget.name}
          tenantBusinessType={subscribeTarget.businessType}
          currentSubscription={subscribeTarget.activeSubscription}
          onClose={() => setSubscribeTarget(null)}
        />
      )}

      {renewTarget && renewSub && (
        <RenewSubscriptionModal
          tenantId={renewTarget.id}
          tenantName={renewTarget.name}
          subscription={renewSub}
          onClose={() => setRenewTarget(null)}
        />
      )}

      {suspendTarget && (
        <SuspendTenantModal tenantId={suspendTarget.id} tenantName={suspendTarget.name} onClose={() => setSuspendTarget(null)} />
      )}

      {showCreateTenant && <CreateTenantModal onClose={() => setShowCreateTenant(false)} />}

      {deleteTarget && (
        <Modal
          open
          onClose={() => setDeleteTarget(null)}
          title={ui.deleteTitle}
          footer={
            <>
              <Button variant="secondary" onClick={() => setDeleteTarget(null)}>{t.common.cancel}</Button>
              <Button variant="danger" loading={deleteMut.isPending} onClick={() => deleteMut.mutate(deleteTarget)}>
                {t.common.delete}
              </Button>
            </>
          }
        >
          <div className="space-y-3 text-sm">
            <p className="text-fg">{fill(ui.deleteConfirm, { name: deleteTarget.name })}</p>
            <p className="text-muted" dir="ltr">{deleteTarget.adminEmail}</p>
          </div>
        </Modal>
      )}
    </div>
  )
}
