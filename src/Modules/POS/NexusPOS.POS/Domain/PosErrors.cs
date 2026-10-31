using ErrorOr;

namespace NexusPOS.POS.Domain;

public static class PosErrors
{
    public static readonly Error OrderNotFound =
        Error.NotFound("POS.OrderNotFound", "الطلب غير موجود");

    public static readonly Error OrderNotOpen =
        Error.Conflict("POS.OrderNotOpen", "الطلب غير مفتوح");

    public static readonly Error OrderLineNotFound =
        Error.NotFound("POS.OrderLineNotFound", "البند غير موجود في الطلب");

    public static readonly Error InvalidQuantity =
        Error.Validation("POS.InvalidQuantity", "الكمية يجب أن تكون أكبر من صفر");

    public static readonly Error InvalidDiscountValue =
        Error.Validation("POS.InvalidDiscountValue", "قيمة الخصم لا يمكن أن تكون سالبة");

    public static readonly Error DiscountPercentageExceedsHundred =
        Error.Validation("POS.DiscountPercentageExceedsHundred", "نسبة الخصم لا يمكن أن تتجاوز 100%");

    public static readonly Error InsufficientPayment =
        Error.Validation("POS.InsufficientPayment", "المبلغ المدفوع أقل من إجمالي الطلب");

    public static readonly Error EmptyOrder =
        Error.Validation("POS.EmptyOrder", "لا يمكن إتمام طلب فارغ");

    public static readonly Error DuplicateVariant =
        Error.Conflict("POS.DuplicateVariant", "هذا الصنف مضاف للطلب مسبقاً");

    public static readonly Error ShiftNotFound =
        Error.NotFound("POS.ShiftNotFound", "الوردية غير موجودة");

    public static readonly Error ShiftNotOpen =
        Error.Conflict("POS.ShiftNotOpen", "الوردية غير مفتوحة");

    public static readonly Error ShiftAlreadyOpen =
        Error.Conflict("POS.ShiftAlreadyOpen", "لديك وردية مفتوحة مسبقاً");

    public static readonly Error LoyaltyRequiresCustomer =
        Error.Validation("POS.LoyaltyRequiresCustomer", "اختر العميل أولاً لاستبدال النقاط.");

    public static readonly Error InvalidLoyaltyPoints =
        Error.Validation("POS.InvalidLoyaltyPoints", "عدد النقاط غير صالح.");

    public static readonly Error LoyaltyExceedsTotal =
        Error.Validation("POS.LoyaltyExceedsTotal", "قيمة النقاط أكبر من إجمالي الفاتورة.");

    public static readonly Error LoyaltyDisabled =
        Error.Validation("POS.LoyaltyDisabled", "برنامج النقاط متوقف في هذا المتجر.");

    public static Error LoyaltyBelowMinimum(int minimum) =>
        Error.Validation("POS.LoyaltyBelowMinimum", $"لا يمكن استبدال أقل من {minimum} نقطة.");

    public static readonly Error InsufficientLoyaltyPoints =
        Error.Validation("POS.InsufficientLoyaltyPoints", "رصيد العميل من النقاط لا يكفي.");
}
