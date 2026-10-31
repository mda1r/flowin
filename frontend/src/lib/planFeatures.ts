// Feature keys a subscription plan can grant. The backend gates endpoints on the same keys
// (src/NexusPOS.SharedKernel/Application/Services/PlanFeatures.cs), so keep both lists in sync.
export const PLAN_FEATURES: { key: string; label: string }[] = [
  { key: 'stock_count', label: 'الجرد المخزني' },
  { key: 'zatca_phase1', label: 'زاتكا المرحلة الأولى' },
  { key: 'zatca_phase2', label: 'زاتكا المرحلة الثانية' },
  { key: 'ai', label: 'المساعد الذكي' },
  { key: 'purchasing', label: 'المشتريات' },
  { key: 'crm', label: 'إدارة العملاء (CRM)' },
  { key: 'loyalty', label: 'برنامج الولاء' },
  { key: 'multi_branch', label: 'تعدد الفروع' },
  { key: 'advanced_reports', label: 'التقارير المتقدمة' },
  { key: 'api_access', label: 'واجهة برمجية (API)' },
  { key: 'ai_cashier', label: 'كاشير AI (كافيه)' },
]

// Older plans saved the AI assistant as 'ai_assistant'; the server treats it as 'ai'.
const LEGACY_KEYS: Record<string, string> = { ai_assistant: 'ai' }

export const normalizeFeatureKey = (key: string) => LEGACY_KEYS[key] ?? key

export const normalizeFeatures = (keys: string[]) => [...new Set(keys.map(normalizeFeatureKey))]
