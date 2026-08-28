import type { BusinessType } from '@/types/api'

export const BUSINESS_TYPE_ROUTES: Record<BusinessType, string[]> = {
  Hotel:       ['/', '/pos', '/customers', '/sales', '/reports', '/finance', '/taxes', '/hotel', '/hotel/contracts', '/settings/zatca', '/users', '/branches', '/activity-logs', '/products', '/inventory', '/stock-counts'],
  Gaming:      ['/', '/pos', '/customers', '/sales', '/reports', '/finance', '/taxes', '/gaming', '/settings/zatca', '/users', '/branches', '/activity-logs', '/shifts', '/invoices'],
  Restaurant:  ['/', '/pos', '/customers', '/sales', '/reports', '/finance', '/taxes', '/restaurant', '/settings/zatca', '/users', '/branches', '/activity-logs', '/shifts', '/invoices'],
  Supermarket: ['/', '/pos', '/products', '/inventory', '/stock-counts', '/customers', '/sales', '/reports', '/purchasing', '/finance', '/taxes', '/settings/zatca', '/users', '/branches', '/activity-logs', '/shifts', '/invoices'],
  Retail:      ['/', '/pos', '/products', '/inventory', '/stock-counts', '/customers', '/sales', '/reports', '/purchasing', '/finance', '/taxes', '/settings/zatca', '/users', '/branches', '/activity-logs', '/shifts', '/invoices'],
  Cafe:        ['/', '/pos', '/products', '/inventory', '/stock-counts', '/customers', '/sales', '/reports', '/finance', '/taxes', '/cafe/kitchen', '/settings/zatca', '/users', '/branches', '/activity-logs', '/shifts', '/invoices'],
}
