import { isAxiosError } from 'axios'

const CODE_MESSAGES: Record<string, string> = {
  'Inventory.MaterialCodeExists': 'يوجد مادة أخرى بنفس الكود',
  'Inventory.MaterialNotFound': 'المادة غير موجودة',
  'Inventory.CategoryNameExists': 'يوجد تصنيف بنفس الاسم',
  'Inventory.CategoryHasItems': 'لا يمكن حذف تصنيف يحتوي على مواد، انقل المواد أو احذفها أولاً',
  'Inventory.CategoryNotFound': 'التصنيف غير موجود',
}

// Used only when the server sent no readable detail (a proxy error page, an empty body).
const STATUS_MESSAGES: Record<number, string> = {
  401: 'انتهت الجلسة، سجّل الدخول مرة أخرى',
  403: 'ليس لديك صلاحية لهذا الإجراء',
  404: 'العنصر المطلوب غير موجود',
  409: 'السجل موجود مسبقاً',
  429: 'محاولات كثيرة، حاول لاحقاً',
}

type Problem = { title?: string; detail?: string; errors?: Record<string, string[]> }

// Turns an API failure (ProblemDetails / ValidationProblemDetails) into one readable line.
// The title is a code ("Catalog.ProductNotFound") or an English status name, so it is never shown.
export function apiErrorMessage(err: unknown, fallback = 'حدث خطأ، حاول مرة أخرى'): string {
  if (!isAxiosError(err)) return fallback
  if (err.code === 'ERR_CANCELED') return fallback
  if (err.code === 'ECONNABORTED') return 'انتهت مهلة الطلب، حاول مرة أخرى'
  if (!err.response) return 'تعذّر الاتصال بالخادم، تحقق من الإنترنت'
  const { status } = err.response
  const data = typeof err.response.data === 'object' ? (err.response.data as Problem | null) : null
  if (data?.title && CODE_MESSAGES[data.title]) return CODE_MESSAGES[data.title]
  const firstValidation = data?.errors ? Object.values(data.errors).flat()[0] : undefined
  if (firstValidation) return firstValidation
  if (data?.detail) return data.detail
  if (STATUS_MESSAGES[status]) return STATUS_MESSAGES[status]
  if (status >= 500) return 'حدث خطأ في الخادم، حاول مرة أخرى'
  return fallback
}
