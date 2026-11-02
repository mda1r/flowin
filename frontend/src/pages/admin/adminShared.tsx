import type { BusinessType, TenantWithSubscriptionResponse } from '@/types/api'
import type { Translations } from '@/i18n/en'
import { Badge } from '@/components/ui/Badge'
import { fmtDate } from '@/lib/locale'

// Where a tenant stands, as one answer: every tenant is in exactly one state, so the counts add up to the total.
export type TenantState = 'active' | 'expiring' | 'upcoming' | 'expired' | 'noPlan' | 'suspended'

// A paid period ending within this many days needs a renewal call.
export const EXPIRING_DAYS = 14

export function tenantState(tenant: TenantWithSubscriptionResponse): TenantState {
  if (!tenant.isActive) return 'suspended'
  const sub = tenant.activeSubscription
  if (!sub) return 'noPlan'
  // A subscription dated to start later is stored as Trial.
  if (sub.status === 'Trial') return 'upcoming'
  if (sub.status !== 'Active' || sub.daysRemaining < 0) return 'expired'
  return sub.daysRemaining <= EXPIRING_DAYS ? 'expiring' : 'active'
}

export const isPaying = (state: TenantState) => state === 'active' || state === 'expiring'

// Most urgent first: lost revenue, then revenue about to be lost, then accounts never set up.
export const STATE_ORDER: TenantState[] = ['expired', 'expiring', 'noPlan', 'suspended', 'upcoming', 'active']

export const STATE_BADGE: Record<TenantState, 'green' | 'yellow' | 'blue' | 'red' | 'gray'> = {
  active: 'green',
  expiring: 'yellow',
  upcoming: 'blue',
  expired: 'red',
  noPlan: 'gray',
  suspended: 'red',
}

// Bar and dot colours for the status breakdown, from the same semantic tokens as the badges.
export const STATE_FILL: Record<TenantState, string> = {
  active: 'bg-success',
  expiring: 'bg-warning',
  upcoming: 'bg-info',
  expired: 'bg-danger',
  noPlan: 'bg-muted/40',
  suspended: 'bg-danger/50',
}

export function StateBadge({ state, t }: { state: TenantState; t: Translations }) {
  return <Badge variant={STATE_BADGE[state]}>{t.admin.ui.states[state]}</Badge>
}

/** One line under the status saying what it means for this tenant ("Ends in 5 days", "Ended 3 days ago"). */
export function stateDetail(tenant: TenantWithSubscriptionResponse, state: TenantState, t: Translations): string {
  const sub = tenant.activeSubscription
  const ui = t.admin.ui
  switch (state) {
    case 'suspended':
      return ui.suspendedHint
    case 'noPlan':
      return ui.noPlanHint
    case 'upcoming':
      return sub ? ui.startsOn.replace('{date}', fmtDate(sub.startDate)) : ''
    case 'expired':
      return sub && sub.daysRemaining < 0 ? ui.endedAgo.replace('{n}', String(-sub.daysRemaining)) : ''
    default:
      if (!sub) return ''
      return sub.daysRemaining === 0 ? ui.endsToday : ui.daysLeft.replace('{n}', String(sub.daysRemaining))
  }
}

export const BUSINESS_TYPES: BusinessType[] = ['Cafe', 'Restaurant', 'Supermarket', 'Retail', 'Hotel', 'Gaming']

export function businessLabel(type: BusinessType, t: Translations): string {
  const b = t.admin.dashboard.business
  return {
    Retail: b.retail,
    Supermarket: b.supermarket,
    Restaurant: b.restaurant,
    Hotel: b.hotel,
    Gaming: b.gaming,
    Cafe: b.cafe,
  }[type]
}

// The business type is a category, not a state: a neutral chip with a small coloured dot.
const BUSINESS_DOT: Record<BusinessType, string> = {
  Cafe: 'bg-warning',
  Restaurant: 'bg-danger',
  Supermarket: 'bg-success',
  Retail: 'bg-muted',
  Hotel: 'bg-info',
  Gaming: 'bg-brand',
}

export function BusinessChip({ type, t }: { type: BusinessType | undefined; t: Translations }) {
  if (!type) return null
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-fg">
      <span className={`h-1.5 w-1.5 rounded-full ${BUSINESS_DOT[type]}`} aria-hidden="true" />
      {businessLabel(type, t)}
    </span>
  )
}

export const fill = (text: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce((s, [k, v]) => s.replace(`{${k}}`, String(v)), text)
