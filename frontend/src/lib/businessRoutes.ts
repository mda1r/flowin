import type { BusinessType } from '@/types/api'

export const BUSINESS_TYPE_ROUTES: Record<BusinessType, string[]> = {
  Hotel:       ['/', '/pos', '/customers', '/sales', '/reports', '/finance', '/hotel', '/hotel/contracts', '/settings/zatca', '/users', '/branches', '/activity-logs', '/shifts'],
  Gaming:      ['/', '/pos', '/customers', '/sales', '/reports', '/finance', '/gaming', '/settings/zatca', '/users', '/branches', '/activity-logs', '/shifts'],
  Restaurant:  ['/', '/pos', '/customers', '/sales', '/reports', '/finance', '/restaurant', '/settings/zatca', '/users', '/branches', '/activity-logs', '/shifts'],
  Supermarket: ['/', '/pos', '/products', '/inventory', '/stock-counts', '/customers', '/sales', '/reports', '/purchasing', '/finance', '/settings/zatca', '/users', '/branches', '/activity-logs', '/shifts'],
  Retail:      ['/', '/pos', '/products', '/inventory', '/stock-counts', '/customers', '/sales', '/reports', '/purchasing', '/finance', '/settings/zatca', '/users', '/branches', '/activity-logs', '/shifts'],
  Cafe:        ['/', '/pos', '/products', '/customers', '/sales', '/reports', '/finance', '/cafe/kitchen', '/settings/zatca', '/users', '/branches', '/activity-logs', '/shifts'],
}
