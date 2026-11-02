import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { AlertTriangle, ArrowLeft, Building2, CalendarClock, CheckCircle2, LayoutDashboard, Repeat, UserPlus, Wallet } from 'lucide-react'
import { superAdminApi } from '@/api/superadmin'
import type { BusinessType, TenantWithSubscriptionResponse } from '@/types/api'
import { useI18n } from '@/i18n'
import { PageHeader } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatCurrency } from '@/lib/utils'
import { fmtDate, fmtNum } from '@/lib/locale'
import { RenewSubscriptionModal } from './RenewSubscriptionModal'
import { NewSubscriptionModal } from './NewSubscriptionModal'
import { CreateTenantModal } from './CreateTenantModal'
import {
  BUSINESS_TYPES,
  BusinessChip,
  STATE_FILL,
  STATE_ORDER,
  StateBadge,
  businessLabel,
  fill,
  isPaying,
  stateDetail,
  tenantState,
  type TenantState,
} from './adminShared'

const ATTENTION: TenantState[] = ['expired', 'expiring', 'noPlan', 'suspended']

export function AdminDashboard() {
  const { t } = useI18n()
  const ui = t.admin.ui
  const navigate = useNavigate()
  const [renewTarget, setRenewTarget] = useState<TenantWithSubscriptionResponse | null>(null)
  const [subscribeTarget, setSubscribeTarget] = useState<TenantWithSubscriptionResponse | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  // Renewal extends the end of the chain, which can be a pre-paid period after the live one.
  const renewSub = renewTarget?.renewableSubscription ?? renewTarget?.activeSubscription

  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ['admin', 'tenants'],
    queryFn: () => superAdminApi.listTenants().then((r) => r.data),
  })

  const rows = tenants.map((tenant) => ({ tenant, state: tenantState(tenant) }))
  const counts = STATE_ORDER.reduce<Record<TenantState, number>>(
    (acc, s) => ({ ...acc, [s]: rows.filter((r) => r.state === s).length }),
    {} as Record<TenantState, number>,
  )
  const paying = rows.filter((r) => isPaying(r.state))
  const mrr = paying.reduce((sum, r) => sum + (r.tenant.activeSubscription?.planPrice ?? 0), 0)
  const attention = rows
    .filter((r) => ATTENTION.includes(r.state))
    .sort((a, b) =>
      ATTENTION.indexOf(a.state) - ATTENTION.indexOf(b.state)
      || (a.tenant.activeSubscription?.daysRemaining ?? 0) - (b.tenant.activeSubscription?.daysRemaining ?? 0))

  const byType = BUSINESS_TYPES
    .map((type) => {
      const ofType = rows.filter((r) => r.tenant.businessType === type)
      const payingOfType = ofType.filter((r) => isPaying(r.state))
      return {
        type,
        total: ofType.length,
        paying: payingOfType.length,
        mrr: payingOfType.reduce((s, r) => s + (r.tenant.activeSubscription?.planPrice ?? 0), 0),
      }
    })
    .filter((x) => x.total > 0)
    .sort((a, b) => b.mrr - a.mrr || b.total - a.total)

  const recent = [...tenants].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5)

  const action = (tenant: TenantWithSubscriptionResponse, state: TenantState) => {
    if (state === 'suspended') {
      return (
        <Link to="/admin/tenants/$id" params={{ id: tenant.id }} className="text-xs font-medium text-brand-ink hover:underline">
          {ui.view}
        </Link>
      )
    }
    if (state === 'noPlan') {
      return <Button size="sm" variant="secondary" onClick={() => setSubscribeTarget(tenant)}>{ui.subscribe}</Button>
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
        icon={<LayoutDashboard className="h-5 w-5" />}
        title={t.admin.dashboard.title}
        description={ui.dashboardHint}
        action={
          <Button onClick={() => setShowCreate(true)}>
            <UserPlus className="h-4 w-4" />
            {ui.addTenant}
          </Button>
        }
      />

      <div className="space-y-6 p-4 sm:p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label={`MRR · ${t.admin.dashboard.mrr}`}
            value={isLoading ? '—' : formatCurrency(mrr)}
            hint={fill(ui.mrrHint, { n: paying.length })}
            icon={<Wallet />}
          />
          <StatCard
            label={`ARR · ${t.admin.dashboard.arr}`}
            value={isLoading ? '—' : formatCurrency(mrr * 12)}
            hint={ui.arrHint}
            icon={<CalendarClock />}
            tone="info"
          />
          <StatCard
            label={ui.payingTenants}
            value={isLoading ? '—' : fmtNum(paying.length)}
            hint={fill(ui.payingHint, { n: paying.length, total: tenants.length })}
            icon={<Building2 />}
            tone="success"
          />
          <StatCard
            label={ui.needsAttention}
            value={isLoading ? '—' : fmtNum(attention.length)}
            hint={ui.needsAttentionHint}
            icon={<AlertTriangle />}
            tone={attention.length > 0 ? 'warning' : 'neutral'}
          />
        </div>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-fg">{ui.tenantStatus}</h2>
            <span className="text-sm text-muted tabular-nums">{fill(ui.tenantsCount, { n: tenants.length })}</span>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="flex h-3 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={ui.tenantStatus}>
              {tenants.length > 0 &&
                STATE_ORDER.slice().reverse().map((s) =>
                  counts[s] > 0 ? (
                    <div key={s} className={STATE_FILL[s]} style={{ width: `${(counts[s] / tenants.length) * 100}%` }} />
                  ) : null,
                )}
            </div>
            <ul className="flex flex-wrap gap-x-8 gap-y-2">
              {STATE_ORDER.slice().reverse().map((s) => (
                <li key={s} className={`flex items-center gap-2 text-sm ${counts[s] ? '' : 'opacity-50'}`}>
                  <span className={`h-2.5 w-2.5 rounded-sm ${STATE_FILL[s]}`} aria-hidden="true" />
                  <span className="text-muted">{ui.states[s]}</span>
                  <span className="font-semibold tabular-nums text-fg">{fmtNum(counts[s] ?? 0)}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
          <Card className="xl:col-span-3">
            <CardHeader>
              <div>
                <h2 className="text-base font-semibold text-fg">{ui.needsAttention}</h2>
                <p className="mt-0.5 text-xs text-muted">{ui.needsAttentionHint}</p>
              </div>
              {attention.length > 0 && (
                <Link to="/admin/tenants" className="inline-flex items-center gap-1 text-sm font-medium text-brand-ink hover:underline">
                  {ui.viewAll}
                  <ArrowLeft className="h-4 w-4 ltr:rotate-180" />
                </Link>
              )}
            </CardHeader>
            {attention.length === 0 ? (
              <EmptyState icon={<CheckCircle2 />} title={ui.allGood} description={ui.allGoodHint} />
            ) : (
              <ul className="divide-y divide-border">
                {attention.slice(0, 8).map(({ tenant, state }) => (
                  <li key={tenant.id} className="flex flex-wrap items-center gap-3 px-6 py-3">
                    <button
                      type="button"
                      onClick={() => navigate({ to: '/admin/tenants/$id', params: { id: tenant.id } })}
                      className="min-w-0 flex-1 text-start"
                    >
                      <p className="truncate text-sm font-medium text-fg hover:underline">{tenant.name}</p>
                      <p className="truncate text-xs text-muted">
                        {stateDetail(tenant, state, t)}
                        {tenant.activeSubscription && ` · ${tenant.activeSubscription.planName}`}
                      </p>
                    </button>
                    <StateBadge state={state} t={t} />
                    {action(tenant, state)}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="xl:col-span-2">
            <CardHeader>
              <h2 className="text-base font-semibold text-fg">{ui.byType}</h2>
            </CardHeader>
            <CardBody className="space-y-4">
              {byType.length === 0 && <p className="text-sm text-muted">{t.common.noData}</p>}
              {byType.map((x) => (
                <div key={x.type} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium text-fg">{businessLabel(x.type as BusinessType, t)}</span>
                    <span className="tabular-nums text-fg">
                      {formatCurrency(x.mrr)}
                      <span className="text-xs text-muted">{ui.perMonth}</span>
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${(x.total / Math.max(1, tenants.length)) * 100}%` }} />
                  </div>
                  <p className="text-xs text-muted tabular-nums">
                    {fill(ui.tenantsCount, { n: x.total })} · {fill(ui.payingCount, { n: x.paying })}
                  </p>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-fg">{ui.recent}</h2>
            <Link to="/admin/tenants" className="inline-flex items-center gap-1 text-sm font-medium text-brand-ink hover:underline">
              {ui.allTenants}
              <ArrowLeft className="h-4 w-4 ltr:rotate-180" />
            </Link>
          </CardHeader>
          <ul className="divide-y divide-border">
            {recent.map((tenant) => {
              const state = tenantState(tenant)
              return (
                <li key={tenant.id}>
                  <Link
                    to="/admin/tenants/$id"
                    params={{ id: tenant.id }}
                    className="flex flex-wrap items-center gap-3 px-6 py-3 transition-colors hover:bg-surface-2/60"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-fg">{tenant.name}</p>
                      <p className="truncate text-xs text-muted">{fill(ui.joined, { date: fmtDate(tenant.createdAt) })}</p>
                    </div>
                    <BusinessChip type={tenant.businessType} t={t} />
                    <StateBadge state={state} t={t} />
                  </Link>
                </li>
              )
            })}
          </ul>
        </Card>
      </div>

      {renewTarget && renewSub && (
        <RenewSubscriptionModal
          tenantId={renewTarget.id}
          tenantName={renewTarget.name}
          subscription={renewSub}
          onClose={() => setRenewTarget(null)}
        />
      )}
      {subscribeTarget && (
        <NewSubscriptionModal
          tenantId={subscribeTarget.id}
          tenantName={subscribeTarget.name}
          tenantBusinessType={subscribeTarget.businessType}
          currentSubscription={subscribeTarget.activeSubscription}
          onClose={() => setSubscribeTarget(null)}
        />
      )}
      {showCreate && <CreateTenantModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}
