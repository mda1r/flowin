import { apiClient } from './client'

export interface ZatcaSettingsResponse {
  id: string
  sellerName: string
  vatRegistrationNumber: string
  isPhase2Enabled: boolean
  hasCertificate: boolean
  certificateExpiryDate: string | null
  invoiceCounter: number
  updatedAt: string
}

export interface ZatcaInvoiceResponse {
  id: string
  orderId: string
  invoiceNumber: string
  invoiceDate: string
  sellerName: string
  sellerVatNumber: string
  subtotalAmount: number
  taxAmount: number
  totalAmount: number
  currency: string
  qrCodeBase64: string
  xmlContent: string
  phase: 1 | 2
  createdAt: string
}

export interface SaveZatcaSettingsRequest {
  sellerName: string
  vatRegistrationNumber: string
  isPhase2Enabled: boolean
  certificateBase64?: string | null
  certificateExpiryDate?: string | null
}

// How the store's receipts look: logo, contact lines, notes and the receipt printer's paper width.
export interface ReceiptSettings {
  logoPath: string | null
  phone: string | null
  address: string | null
  headerNote: string | null
  footerNote: string | null
  paperWidthMm: 58 | 80
  showPoweredBy: boolean
}

export const zatcaApi = {
  getSettings: () =>
    apiClient.get<ZatcaSettingsResponse>('/api/v1/zatca/settings'),

  saveSettings: (data: SaveZatcaSettingsRequest) =>
    apiClient.put<ZatcaSettingsResponse>('/api/v1/zatca/settings', data),

  getInvoice: (branchId: string, orderId: string) =>
    apiClient.get<ZatcaInvoiceResponse>(`/api/v1/branches/${branchId}/orders/${orderId}/zatca-invoice`),

  getReceiptSettings: () => apiClient.get<ReceiptSettings>('/api/v1/zatca/receipt-settings'),

  saveReceiptSettings: (data: ReceiptSettings) =>
    apiClient.put<ReceiptSettings>('/api/v1/zatca/receipt-settings', data),

  downloadXmlUrl: (branchId: string, orderId: string) =>
    `/api/v1/branches/${branchId}/orders/${orderId}/zatca-invoice/xml`,
}
