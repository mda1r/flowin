import { isAxiosError } from 'axios'

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

// Turns an API failure (ProblemDetails / ValidationProblemDetails) into one readable line.
export function apiErrorMessage(err: unknown, fallback = 'حدث خطأ، حاول مرة أخرى'): string {
  if (!isAxiosError(err)) return fallback
  if (!err.response) return 'تعذّر الاتصال بالخادم، تحقق من الإنترنت'
  const data = err.response.data as { title?: string; detail?: string; message?: string; errors?: Record<string, string[]> } | undefined
  if (data?.title && CODE_MESSAGES[data.title]) return CODE_MESSAGES[data.title]
  const knownCode = data?.errors ? Object.keys(data.errors).find(code => CODE_MESSAGES[code]) : undefined
  if (knownCode) return CODE_MESSAGES[knownCode]
  const firstValidation = data?.errors ? Object.values(data.errors).flat()[0] : undefined
  if (firstValidation) return firstValidation
  if (data?.detail) return data.detail
  // { code, message } bodies, e.g. 402 feature_not_available
  if (data?.message) return data.message
  if (err.response.status === 403) return 'ليس لديك صلاحية لهذا الإجراء'
  if (err.response.status === 409) return 'السجل موجود مسبقاً'
  return data?.title ?? fallback
}
