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
  // The page sending right now (its lease is still running), or null.
  sendingRunnerId?: string | null
}

export interface WhatsAppSettings {
  configured: boolean
  phoneNumberId: string
  tokenHint?: string | null
  templateName: string
  languageCode: string
  hasImageHeader: boolean
  includeNameVariable: boolean
  businessAccountId: string
  // The approved template's body ({{1}}, {{2}}…) from the last connection check.
  templateBody?: string | null
}

export interface WhatsAppSettingsUpdate extends Omit<WhatsAppSettings, 'configured' | 'tokenHint' | 'templateBody'> {
  // Blank keeps the token already saved.
  accessToken?: string
}

export type WhatsAppCheckStatus = 'Ok' | 'Warning' | 'Failed'

export interface WhatsAppCheck {
  ok: boolean
  displayPhoneNumber?: string | null
  templateBody?: string | null
  items: { label: string; status: WhatsAppCheckStatus; detail: string }[]
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

  sendBatch: (tenantId: string, id: string, runnerId: string) =>
    apiClient.post<Campaign>(`${base(tenantId)}/campaigns/${id}/send-batch`, { runnerId }).then((r) => r.data),

  releaseSending: (tenantId: string, id: string, runnerId: string) =>
    apiClient.post<void>(`${base(tenantId)}/campaigns/${id}/release`, { runnerId }).then(() => undefined),

  retryFailed: (tenantId: string, id: string) =>
    apiClient.post<Campaign>(`${base(tenantId)}/campaigns/${id}/retry-failed`).then((r) => r.data),

  markSent: (tenantId: string, id: string, recipientId: string) =>
    apiClient.post<Campaign>(`${base(tenantId)}/campaigns/${id}/recipients/${recipientId}/sent`).then((r) => r.data),

  whatsApp: (tenantId: string) => apiClient.get<WhatsAppSettings>(`${base(tenantId)}/whatsapp`).then((r) => r.data),

  updateWhatsApp: (tenantId: string, data: WhatsAppSettingsUpdate) =>
    apiClient.put<WhatsAppSettings>(`${base(tenantId)}/whatsapp`, data).then((r) => r.data),

  checkWhatsApp: (tenantId: string) =>
    apiClient.post<WhatsAppCheck>(`${base(tenantId)}/whatsapp/check`).then((r) => r.data),

  testWhatsApp: (tenantId: string, data: { phone: string; name?: string; message?: string; imageId?: string }) =>
    apiClient.post<{ phone: string; messageId?: string | null }>(`${base(tenantId)}/whatsapp/test`, data).then((r) => r.data),
}

// The offer as it travels inside a template variable: one line, no runs of spaces (same rule as the server).
export function templateText(text: string) {
  return text.trim().replace(/\s*[\r\n\t]+\s*/g, ' · ').replace(/ {2,}/g, ' ')
}

// The template body with its {{n}} variables filled in, as the customer reads it.
export function fillTemplate(body: string, values: string[]) {
  return body.replace(/\{\{\s*(\d+)\s*\}\}/g, (match, n: string) => values[Number(n) - 1] ?? match)
}

// The message as one customer reads it in a chat opened from a link; the image travels as a link under the text.
export function personalizedMessage(message: string, name: string, imageUrl?: string) {
  const text = message.split('{الاسم}').join(name)
  return imageUrl ? `${text}\n\n${imageUrl}` : text
}
