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

export const zatcaApi = {
  getSettings: () =>
    apiClient.get<ZatcaSettingsResponse>('/api/v1/zatca/settings'),

  saveSettings: (data: SaveZatcaSettingsRequest) =>
    apiClient.put<ZatcaSettingsResponse>('/api/v1/zatca/settings', data),

  getInvoice: (branchId: string, orderId: string) =>
    apiClient.get<ZatcaInvoiceResponse>(`/api/v1/branches/${branchId}/orders/${orderId}/zatca-invoice`),

  downloadXmlUrl: (branchId: string, orderId: string) =>
    `/api/v1/branches/${branchId}/orders/${orderId}/zatca-invoice/xml`,
}
