import { isAxiosError } from 'axios'
import { apiErrorMessage } from '@/lib/apiError'

const RESTAURANT_MESSAGES: Record<string, string> = {
  'MenuItem.NotFound': 'أحد الأصناف لم يعد في القائمة، حدّث الصفحة',
  'MenuItem.Unavailable': 'أحد الأصناف غير متوفر الآن',
  'RestaurantOrder.TableChanged': 'وصل طلب جديد للطاولة، راجع الفاتورة وادفع مرة أخرى',
  'RestaurantOrder.NotModifiable': 'لا يمكن تعديل هذا الطلب الآن',
  'RestaurantOrder.Changed': 'تغيّر الطلب للتو، حدّث الصفحة وحاول مرة أخرى',
  'RestaurantOrder.AlreadyPaid': 'هذا الطلب مدفوع',
  'RestaurantOrder.AlreadyCancelled': 'هذا الطلب ملغى',
  'RestaurantOrder.InsufficientPayment': 'المبلغ المستلم أقل من الإجمالي',
  'RestaurantOrderItem.AlreadyReady': 'الصنف جاهز ولا يمكن حذفه',
  'RestaurantOrderItem.LastItem': 'هذا آخر صنف، ألغِ الطلب بدلاً من حذفه',
  'DiscountCode.NotFound': 'رمز الخصم غير موجود',
}

// Restaurant API failures in the cashier's words; anything else falls back to the shared reader.
export function restaurantErrorMessage(err: unknown, fallback?: string): string {
  if (isAxiosError(err)) {
    const data = err.response?.data as { title?: string; errors?: Record<string, string[]> } | undefined
    const code = [data?.title, ...Object.keys(data?.errors ?? {})].find((c) => c && RESTAURANT_MESSAGES[c])
    if (code) return RESTAURANT_MESSAGES[code]
  }
  return apiErrorMessage(err, fallback)
}
