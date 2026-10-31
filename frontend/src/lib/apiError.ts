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

// Used only when the server sent no readable detail (a proxy error page, an empty body).
const STATUS_MESSAGES: Record<'ar' | 'en', Record<number, string>> = {
  ar: {
    401: 'انتهت الجلسة، سجّل الدخول مرة أخرى',
    404: 'العنصر المطلوب غير موجود',
    429: 'محاولات كثيرة، حاول لاحقاً',
    500: 'حدث خطأ في الخادم، حاول مرة أخرى',
  },
  en: {
    401: 'Your session has ended. Please sign in again.',
    404: 'The requested item was not found.',
    429: 'Too many attempts. Please try again later.',
    500: 'Something went wrong on the server. Please try again.',
  },
}

type Problem = { title?: string; detail?: string; message?: string; errors?: Record<string, string[]> }

// Turns an API failure (ProblemDetails / ValidationProblemDetails) into one readable line in the UI language.
// Known ErrorOr codes are translated; the title is otherwise a code or an English status name, so it is never shown.
export function apiErrorMessage(err: unknown, fallback?: string): string {
  const lang = activeLang() === 'ar' ? 'ar' : 'en'
  const t = (lang === 'ar' ? ar : en).errors
  // Codes not yet in the translation tables keep their Arabic text on an Arabic screen.
  const known = (code: string): string | undefined => t.codes[code] ?? (lang === 'ar' ? CODE_MESSAGES[code] : undefined)
  if (!isAxiosError(err)) return fallback ?? t.generic
  if (err.code === 'ERR_CANCELED') return fallback ?? t.generic
  if (err.code === 'ECONNABORTED') return lang === 'ar' ? 'انتهت مهلة الطلب، حاول مرة أخرى' : 'The request timed out. Please try again.'
  if (!err.response) return t.network
  const { status } = err.response
  const data = typeof err.response.data === 'object' ? (err.response.data as Problem | null) : null
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
  if (status === 403) return t.forbidden
  if (status === 409) return t.conflict
  const byStatus = STATUS_MESSAGES[lang][status] ?? (status >= 500 ? STATUS_MESSAGES[lang][500] : undefined)
  return byStatus ?? fallback ?? t.generic
}
