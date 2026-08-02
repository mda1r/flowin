import type { BusinessType } from '@/types/api'

export const BUSINESS_TYPE_ROUTES: Record<BusinessType, string[]> = {
  Hotel:       ['/', '/pos', '/customers', '/sales', '/reports', '/finance', '/hotel', '/hotel/contracts', '/settings/zatca', '/users', '/branches', '/activity-logs'],
  Gaming:      ['/', '/pos', '/customers', '/sales', '/reports', '/finance', '/gaming', '/settings/zatca', '/users', '/branches', '/activity-logs'],
  Restaurant:  ['/', '/pos', '/customers', '/sales', '/reports', '/finance', '/restaurant', '/settings/zatca', '/users', '/branches', '/activity-logs'],
  Supermarket: ['/', '/pos', '/products', '/inventory', '/stock-counts', '/customers', '/sales', '/reports', '/purchasing', '/finance', '/settings/zatca', '/users', '/branches', '/activity-logs'],
  Retail:      ['/', '/pos', '/products', '/inventory', '/stock-counts', '/customers', '/sales', '/reports', '/purchasing', '/finance', '/settings/zatca', '/users', '/branches', '/activity-logs'],
  Cafe:        ['/', '/pos', '/products', '/customers', '/sales', '/reports', '/finance', '/settings/zatca', '/users', '/branches', '/activity-logs'],
}
