import type { BusinessType } from '@/types/api'

export const BUSINESS_TYPE_ROUTES: Record<BusinessType, string[]> = {
  Hotel:       ['/', '/pos', '/customers', '/campaigns', '/sales', '/reports', '/finance', '/taxes', '/hotel', '/hotel/contracts', '/settings/zatca', '/users', '/branches', '/activity-logs', '/products', '/inventory', '/stock-counts'],
  Gaming:      ['/', '/pos', '/products', '/cafe/kitchen', '/purchasing', '/customers', '/campaigns', '/sales', '/reports', '/finance', '/taxes', '/gaming', '/stock-materials', '/settings/zatca', '/users', '/branches', '/activity-logs', '/shifts', '/daily-close', '/invoices'],
  Restaurant:  ['/', '/pos', '/customers', '/campaigns', '/sales', '/reports', '/finance', '/taxes', '/restaurant', '/stock-materials', '/purchasing', '/settings/zatca', '/users', '/branches', '/activity-logs', '/shifts', '/daily-close', '/invoices'],
  Supermarket: ['/', '/pos', '/products', '/inventory', '/stock-counts', '/stock-materials', '/customers', '/campaigns', '/sales', '/reports', '/purchasing', '/finance', '/taxes', '/settings/zatca', '/users', '/branches', '/activity-logs', '/shifts', '/daily-close', '/invoices'],
  Retail:      ['/', '/pos', '/products', '/inventory', '/stock-counts', '/customers', '/campaigns', '/sales', '/reports', '/purchasing', '/finance', '/taxes', '/settings/zatca', '/users', '/branches', '/activity-logs', '/shifts', '/daily-close', '/invoices'],
  Cafe:        ['/', '/pos', '/products', '/inventory', '/stock-counts', '/stock-materials', '/purchasing', '/customers', '/campaigns', '/sales', '/reports', '/finance', '/taxes', '/cafe/kitchen', '/settings/zatca', '/users', '/branches', '/activity-logs', '/shifts', '/daily-close', '/invoices'],
}
