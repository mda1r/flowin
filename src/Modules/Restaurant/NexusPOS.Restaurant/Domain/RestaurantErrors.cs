using ErrorOr;

namespace NexusPOS.Restaurant.Domain;

public static class RestaurantErrors
{
    // ── Menu ────────────────────────────────────────────────────────────────
    public static readonly Error MenuItemNotFound =
        Error.NotFound("MenuItem.NotFound", "الصنف غير موجود في القائمة");

    public static readonly Error InvalidPrice =
        Error.Validation("MenuItem.InvalidPrice", "السعر يجب أن يكون أكبر من صفر");

    public static readonly Error MenuItemUnavailable =
        Error.Conflict("MenuItem.Unavailable", "A menu item in this order is not available.");

    // ── Restaurant Orders ────────────────────────────────────────────────────
    public static readonly Error OrderNotFound =
        Error.NotFound("RestaurantOrder.NotFound", "الطلب غير موجود");

    public static readonly Error EmptyOrder =
        Error.Validation("RestaurantOrder.Empty", "أضف صنفاً واحداً على الأقل");

    public static readonly Error InvalidTableNumber =
        Error.Validation("RestaurantOrder.InvalidTableNumber", "رقم الطاولة يجب أن يكون أكبر من صفر");

    public static readonly Error OrderNotPending =
        Error.Conflict("RestaurantOrder.NotPending", "لا يُرسل للمطبخ إلا طلب بالانتظار");

    public static readonly Error OrderNotInKitchen =
        Error.Conflict("RestaurantOrder.NotInKitchen", "لا يُجهّز إلا طلب في المطبخ");

    public static readonly Error OrderNotReady =
        Error.Conflict("RestaurantOrder.NotReady", "لا يُقدّم إلا طلب جاهز");

    public static readonly Error OrderNotModifiable =
        Error.Conflict("RestaurantOrder.NotModifiable", "لا يمكن تعديل الطلب في حالته الحالية");

    public static readonly Error OrderAlreadyPaid =
        Error.Conflict("RestaurantOrder.AlreadyPaid", "الطلب مدفوع مسبقاً");

    public static readonly Error KitchenTicketNotPayable =
        Error.Conflict("RestaurantOrder.KitchenTicketNotPayable", "هذه تذكرة مطبخ لطلب مدفوع من الكاشير، لا تُدفع مرة أخرى.");

    public static readonly Error OrderAlreadyCancelled =
        Error.Conflict("RestaurantOrder.AlreadyCancelled", "الطلب ملغى مسبقاً");

    public static readonly Error InsufficientPayment =
        Error.Validation("RestaurantOrder.InsufficientPayment", "المبلغ المدفوع أقل من إجمالي الطلب");

    public static readonly Error OrderItemNotFound =
        Error.NotFound("RestaurantOrderItem.NotFound", "البند غير موجود في الطلب");

    public static readonly Error OrderItemAlreadyReady =
        Error.Conflict("RestaurantOrderItem.AlreadyReady", "This item is already prepared and cannot be removed.");

    public static readonly Error LastOrderItem =
        Error.Conflict("RestaurantOrderItem.LastItem", "Cancel the order to remove its last item.");

    public static readonly Error CancelReasonRequired =
        Error.Validation("RestaurantOrder.CancelReasonRequired", "A reason is required to cancel an order.");

    public static readonly Error TableChanged =
        Error.Conflict("RestaurantOrder.TableChanged", "The table's open orders changed. Refresh and try again.");

    public static readonly Error OrderChanged =
        Error.Conflict("RestaurantOrder.Changed", "The order changed meanwhile. Refresh and try again.");

    public static readonly Error OrderIdTaken =
        Error.Conflict("RestaurantOrder.IdTaken", "Another order already uses this id.");

    // ── Discount Codes ───────────────────────────────────────────────────────
    public static readonly Error DiscountCodeNotFound =
        Error.NotFound("DiscountCode.NotFound", "كود الخصم غير موجود");

    public static readonly Error InvalidDiscountCode =
        Error.Validation("DiscountCode.InvalidCode", "كود الخصم مطلوب");

    public static readonly Error InvalidDiscountValue =
        Error.Validation("DiscountCode.InvalidValue", "قيمة الخصم يجب أن تكون أكبر من صفر");

    public static readonly Error DiscountPercentageExceedsHundred =
        Error.Validation("DiscountCode.PercentageExceedsHundred", "نسبة الخصم لا يمكن أن تتجاوز 100%");

    public static readonly Error DiscountCodeInactive =
        Error.Validation("DiscountCode.Inactive", "كود الخصم غير مفعّل");

    public static readonly Error DiscountCodeExpired =
        Error.Validation("DiscountCode.Expired", "كود الخصم منتهي الصلاحية");

    public static readonly Error DiscountCodeMaxUsesReached =
        Error.Validation("DiscountCode.MaxUsesReached", "كود الخصم استُخدم الحد الأقصى من المرات");

    public static readonly Error DiscountCodeMinOrderAmountNotMet =
        Error.Validation("DiscountCode.MinOrderAmountNotMet", "مبلغ الطلب أقل من الحد الأدنى لهذا الكود");
}
