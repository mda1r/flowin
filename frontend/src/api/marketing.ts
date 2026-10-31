import { apiClient } from './client'

export type CampaignChannel = 'Links' | 'Api'
export type CampaignRecipientStatus = 'Pending' | 'Sent' | 'Failed'

export interface AudienceMember {
  customerId: string
  name: string
  phone: string
}

export interface Audience {
  reachable: AudienceMember[]
  withoutConsent: number
  withoutValidPhone: number
}

export interface CampaignRecipient {
  id: string
  customerId: string
  name: string
  phone: string
  status: CampaignRecipientStatus
  error?: string | null
  sentAt?: string | null
}

export interface Campaign {
  id: string
  message: string
  imagePath?: string | null
  channel: CampaignChannel
  createdAt: string
  total: number
  sent: number
  failed: number
  recipients?: CampaignRecipient[] | null
}

export interface WhatsAppSettings {
  configured: boolean
  phoneNumberId: string
  tokenHint?: string | null
  templateName: string
  languageCode: string
  hasImageHeader: boolean
  includeNameVariable: boolean
}

export interface WhatsAppSettingsUpdate extends Omit<WhatsAppSettings, 'configured' | 'tokenHint'> {
  // Blank keeps the token already saved.
  accessToken?: string
}

const base = (tenantId: string) => `/api/v1/tenants/${tenantId}/marketing`

export const marketingApi = {
  audience: (tenantId: string) => apiClient.get<Audience>(`${base(tenantId)}/audience`).then((r) => r.data),

  uploadImage: (tenantId: string, contentType: string, base64: string) =>
    apiClient.post<{ id: string; path: string }>(`${base(tenantId)}/media`, { contentType, base64 }).then((r) => r.data),

  campaigns: (tenantId: string) => apiClient.get<Campaign[]>(`${base(tenantId)}/campaigns`).then((r) => r.data),

  campaign: (tenantId: string, id: string) => apiClient.get<Campaign>(`${base(tenantId)}/campaigns/${id}`).then((r) => r.data),

  createCampaign: (
    tenantId: string,
    data: { message: string; imageId?: string; channel: CampaignChannel; customerIds: string[] },
  ) => apiClient.post<Campaign>(`${base(tenantId)}/campaigns`, data).then((r) => r.data),

  sendBatch: (tenantId: string, id: string) =>
    apiClient.post<Campaign>(`${base(tenantId)}/campaigns/${id}/send-batch`).then((r) => r.data),

  retryFailed: (tenantId: string, id: string) =>
    apiClient.post<Campaign>(`${base(tenantId)}/campaigns/${id}/retry-failed`).then((r) => r.data),

  markSent: (tenantId: string, id: string, recipientId: string) =>
    apiClient.post<Campaign>(`${base(tenantId)}/campaigns/${id}/recipients/${recipientId}/sent`).then((r) => r.data),

  whatsApp: (tenantId: string) => apiClient.get<WhatsAppSettings>(`${base(tenantId)}/whatsapp`).then((r) => r.data),

  updateWhatsApp: (tenantId: string, data: WhatsAppSettingsUpdate) =>
    apiClient.put<WhatsAppSettings>(`${base(tenantId)}/whatsapp`, data).then((r) => r.data),
}

// The message as one customer reads it in a chat opened from a link; the image travels as a link under the text.
export function personalizedMessage(message: string, name: string, imageUrl?: string) {
  const text = message.split('{الاسم}').join(name)
  return imageUrl ? `${text}\n\n${imageUrl}` : text
}
