import { isAxiosError } from 'axios'

const CODE_MESSAGES: Record<string, string> = {
  'Inventory.MaterialCodeExists': 'يوجد مادة أخرى بنفس الكود',
  'Inventory.MaterialNotFound': 'المادة غير موجودة',
  'Inventory.CategoryNameExists': 'يوجد تصنيف بنفس الاسم',
  'Inventory.CategoryHasItems': 'لا يمكن حذف تصنيف يحتوي على مواد، انقل المواد أو احذفها أولاً',
  'Inventory.CategoryNotFound': 'التصنيف غير موجود',
}

// Turns an API failure (ProblemDetails / ValidationProblemDetails) into one readable line.
export function apiErrorMessage(err: unknown, fallback = 'حدث خطأ، حاول مرة أخرى'): string {
  if (!isAxiosError(err)) return fallback
  if (!err.response) return 'تعذّر الاتصال بالخادم، تحقق من الإنترنت'
  const data = err.response.data as { title?: string; detail?: string; errors?: Record<string, string[]> } | undefined
  if (data?.title && CODE_MESSAGES[data.title]) return CODE_MESSAGES[data.title]
  const firstValidation = data?.errors ? Object.values(data.errors).flat()[0] : undefined
  if (firstValidation) return firstValidation
  if (data?.detail) return data.detail
  if (err.response.status === 403) return 'ليس لديك صلاحية لهذا الإجراء'
  if (err.response.status === 409) return 'السجل موجود مسبقاً'
  return data?.title ?? fallback
}
