import { isAxiosError } from 'axios'
import { ar } from '@/i18n/ar'
import { en } from '@/i18n/en'
import { activeLang } from '@/lib/locale'

const CODE_MESSAGES: Record<string, string> = {
  'Inventory.MaterialCodeExists': 'يوجد مادة أخرى بنفس الكود',
  'Inventory.MaterialNotFound': 'المادة غير موجودة',
  'Inventory.CategoryNameExists': 'يوجد تصنيف بنفس الاسم',
  'Inventory.CategoryHasItems': 'لا يمكن حذف تصنيف يحتوي على مواد، انقل المواد أو احذفها أولاً',
  'Inventory.CategoryNotFound': 'التصنيف غير موجود',
  'Catalog.SkuAlreadyExists': 'الرمز (SKU) مستخدم لمنتج آخر',
  'Catalog.BarcodeAlreadyExists': 'الباركود مستخدم لمنتج آخر',
  'Catalog.LastActiveVariant': 'لا يمكن إيقاف آخر نوع نشط، أوقف المنتج بدلاً منه',
  'Catalog.ProductInactive': 'المنتج موقوف، فعّله أولاً',
  'Catalog.CategoryNameExists': 'يوجد تصنيف بنفس الاسم',
  'Inventory.StockCountOpenExists': 'يوجد جرد مفتوح لهذا الفرع، أكمله أو ألغِه أولاً',
  'Inventory.StockCountNoItems': 'لا توجد أصناف في مخزون هذا الفرع لجردها',
  'Inventory.StockCountNotInProgress': 'هذا الجرد لم يعد مفتوحاً',
  'Inventory.StockCountAlreadyCompleted': 'هذا الجرد مكتمل ولا يمكن إلغاؤه',
  'Customer.EmailTaken': 'يوجد عميل آخر بنفس البريد الإلكتروني',
  'Customer.InsufficientLoyaltyPoints': 'رصيد النقاط لا يكفي',
  'Organization.BranchAlreadyExists': 'يوجد فرع آخر بنفس الاسم',
  'Organization.CannotDeactivateMainBranch': 'لا يمكن تعطيل الفرع الرئيسي، عيّن فرعاً آخر كرئيسي أولاً',
  'Organization.MainBranchMustBeActive': 'فعّل الفرع أولاً قبل تعيينه كرئيسي',
}

// Turns an API failure (ProblemDetails / ValidationProblemDetails) into one readable line in the UI language.
// Known ErrorOr codes are translated; the server's own text is used only when the code is unknown.
export function apiErrorMessage(err: unknown, fallback?: string): string {
  const lang = activeLang()
  const t = (lang === 'ar' ? ar : en).errors
  // Codes not yet in the translation tables keep their Arabic text on an Arabic screen.
  const known = (code: string): string | undefined => t.codes[code] ?? (lang === 'ar' ? CODE_MESSAGES[code] : undefined)
  if (!isAxiosError(err)) return fallback ?? t.generic
  if (!err.response) return t.network
  const data = err.response.data as { title?: string; detail?: string; message?: string; errors?: Record<string, string[]> } | undefined
  const titleText = data?.title ? known(data.title) : undefined
  if (titleText) return titleText
  // Validation problems are keyed by code for domain errors and by property name for FluentValidation.
  const knownField = data?.errors ? Object.keys(data.errors).find((k) => known(k)) : undefined
  if (knownField) return known(knownField)!
  const firstValidation = data?.errors ? Object.values(data.errors).flat()[0] : undefined
  if (firstValidation) return firstValidation
  if (data?.detail) return data.detail
  // { code, message } bodies, e.g. 402 feature_not_available
  if (data?.message) return data.message
  if (err.response.status === 403) return t.forbidden
  if (err.response.status === 409) return t.conflict
  return fallback ?? t.generic
}
