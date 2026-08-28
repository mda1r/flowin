import { apiClient } from './client'

// ── Response types ────────────────────────────────────────────────────────────

export interface TaxPeriodResponse {
  id: string
  startDate: string
  endDate: string
  status: string
  notes: string | null
  createdAt: string
  closedAt: string | null
}

export interface TaxOverviewResponse {
  periodId: string
  startDate: string
  endDate: string
  periodStatus: string
  totalOutputVat: number
  totalInputVat: number
  netVatPayable: number
  totalSalesBase: number
  totalPurchasesBase: number
  saleTransactionCount: number
  purchaseInvoiceCount: number
  openAnomalyCount: number
  taxReadinessScore: number
}

export interface TaxLedgerEntryResponse {
  id: string
  entryType: string
  transactionType: string
  referenceId: string | null
  referenceType: string | null
  baseAmount: number
  taxAmount: number
  taxRate: number
  effectiveDate: string
  createdAt: string
}

export interface TaxLedgerResult {
  items: TaxLedgerEntryResponse[]
  totalCount: number
  page: number
  pageSize: number
}

export interface TaxAnomalyResponse {
  id: string
  ruleCode: string
  severity: string
  title: string
  description: string
  transactionRef: string | null
  detectedAt: string
  isResolved: boolean
  resolvedAt: string | null
}

export interface VatReturnResponse {
  periodId: string
  startDate: string
  endDate: string
  box1StandardRatedSales: number
  box1OutputVat: number
  box2ZeroRatedSales: number
  box3ExemptSales: number
  box6StandardRatedPurchases: number
  box6InputVat: number
  box7ZeroRatedPurchases: number
  box8ExemptPurchases: number
  box9TotalOutputVat: number
  box10TotalInputVat: number
  box11NetVatDue: number
  status: string
}

export interface TaxExpenseInvoiceResponse {
  id: string
  periodId: string | null
  supplierName: string
  supplierVatNumber: string | null
  invoiceNumber: string
  invoiceDate: string
  baseAmount: number
  taxAmount: number
  taxRate: number
  currency: string
  notes: string | null
  createdAt: string
}

// ── Request types ─────────────────────────────────────────────────────────────

export interface CreateTaxPeriodRequest {
  startDate: string
  endDate: string
  notes?: string | null
}

export interface RecordExpenseInvoiceRequest {
  periodId?: string | null
  supplierName: string
  supplierVatNumber?: string | null
  invoiceNumber: string
  invoiceDate: string
  baseAmount: number
  taxAmount: number
  taxRate: number
  currency: string
  notes?: string | null
}

// ── API functions ─────────────────────────────────────────────────────────────

export const taxApi = {
  listPeriods: (): Promise<TaxPeriodResponse[]> =>
    apiClient.get('/api/v1/tax/periods').then((r) => r.data),

  createPeriod: (request: CreateTaxPeriodRequest): Promise<TaxPeriodResponse> =>
    apiClient.post('/api/v1/tax/periods', request).then((r) => r.data),

  closePeriod: (periodId: string): Promise<TaxPeriodResponse> =>
    apiClient.put(`/api/v1/tax/periods/${periodId}/close`).then((r) => r.data),

  getOverview: (periodId: string): Promise<TaxOverviewResponse> =>
    apiClient.get('/api/v1/tax/overview', { params: { periodId } }).then((r) => r.data),

  getLedger: (periodId: string, page = 1, pageSize = 50): Promise<TaxLedgerResult> =>
    apiClient.get('/api/v1/tax/ledger', { params: { periodId, page, pageSize } }).then((r) => r.data),

  refreshLedger: (periodId: string): Promise<number> =>
    apiClient.post('/api/v1/tax/ledger/refresh', null, { params: { periodId } }).then((r) => r.data),

  getAnomalies: (periodId: string, includeResolved = false): Promise<TaxAnomalyResponse[]> =>
    apiClient.get('/api/v1/tax/anomalies', { params: { periodId, includeResolved } }).then((r) => r.data),

  scanAnomalies: (periodId: string): Promise<number> =>
    apiClient.post('/api/v1/tax/anomalies/scan', null, { params: { periodId } }).then((r) => r.data),

  getVatReturn: (periodId: string): Promise<VatReturnResponse> =>
    apiClient.get('/api/v1/tax/vat-return', { params: { periodId } }).then((r) => r.data),

  listExpenses: (periodId?: string): Promise<TaxExpenseInvoiceResponse[]> =>
    apiClient.get('/api/v1/tax/expenses', { params: periodId ? { periodId } : undefined }).then((r) => r.data),

  recordExpense: (request: RecordExpenseInvoiceRequest): Promise<TaxExpenseInvoiceResponse> =>
    apiClient.post('/api/v1/tax/expenses', request).then((r) => r.data),

  deleteExpense: (invoiceId: string): Promise<void> =>
    apiClient.delete(`/api/v1/tax/expenses/${invoiceId}`).then((r) => r.data),

  aiChat: (message: string, periodId?: string | null): Promise<string> =>
    apiClient.post('/api/v1/tax/ai/chat', { message, periodId: periodId ?? null }).then((r) => r.data),
}
