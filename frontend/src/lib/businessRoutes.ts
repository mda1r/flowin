import type { BusinessType } from '@/types/api'

export const BUSINESS_TYPE_ROUTES: Record<BusinessType, string[]> = {
  Hotel:       ['/', '/pos', '/customers', '/sales', '/reports', '/finance', '/hotel', '/hotel/contracts', '/settings/zatca', '/users', '/branches', '/activity-logs', '/products', '/inventory', '/stock-counts'],
  Gaming:      ['/', '/pos', '/customers', '/sales', '/reports', '/finance', '/gaming', '/settings/zatca', '/users', '/branches', '/activity-logs', '/shifts', '/invoices'],
  Restaurant:  ['/', '/pos', '/customers', '/sales', '/reports', '/finance', '/restaurant', '/settings/zatca', '/users', '/branches', '/activity-logs', '/shifts', '/invoices'],
  Supermarket: ['/', '/pos', '/products', '/inventory', '/stock-counts', '/customers', '/sales', '/reports', '/purchasing', '/finance', '/settings/zatca', '/users', '/branches', '/activity-logs', '/shifts', '/invoices'],
  Retail:      ['/', '/pos', '/products', '/inventory', '/stock-counts', '/customers', '/sales', '/reports', '/purchasing', '/finance', '/settings/zatca', '/users', '/branches', '/activity-logs', '/shifts', '/invoices'],
  Cafe:        ['/', '/pos', '/products', '/inventory', '/stock-counts', '/customers', '/sales', '/reports', '/finance', '/cafe/kitchen', '/settings/zatca', '/users', '/branches', '/activity-logs', '/shifts', '/invoices'],
}
