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

    public static readonly Error DiscountCodeInvalid =
        Error.Validation("POS.DiscountCodeInvalid", "كود الخصم غير صالح أو منتهي");

    // Reason is the code's own problem (switched off, expired, used up) as the code store words it.
    public static Error DiscountCodeRejected(string? reason) =>
        Error.Validation("POS.DiscountCodeInvalid", string.IsNullOrWhiteSpace(reason) ? "كود الخصم غير صالح أو منتهي" : reason);

    // The owner edited the code after the till applied it; the till checks it again before the customer pays.
    public static readonly Error DiscountCodeChanged =
        Error.Validation("POS.DiscountCodeChanged", "تغيّرت قيمة كود الخصم، أعد تطبيقه");

    public static readonly Error DiscountCodeMinOrder =
        Error.Validation("POS.DiscountCodeMinOrder", "مبلغ الطلب أقل من الحد الأدنى لهذا الكود");

    public static readonly Error InsufficientPayment =
        Error.Validation("POS.InsufficientPayment", "المبلغ المدفوع أقل من إجمالي الطلب");

    public static readonly Error SplitMismatch =
        Error.Validation("POS.SplitMismatch", "مجموع النقد والبطاقة لا يساوي إجمالي الطلب");

    public static readonly Error EmptyOrder =
        Error.Validation("POS.EmptyOrder", "لا يمكن إتمام طلب فارغ");

    public static readonly Error DuplicateVariant =
        Error.Conflict("POS.DuplicateVariant", "هذا الصنف مضاف للطلب مسبقاً");

    public static readonly Error ClientReferenceInUse =
        Error.Conflict("POS.ClientReferenceInUse", "رقم العملية مسجّل لفرع آخر.");

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

    public static Error DiscountNeedsManager(decimal cap) =>
        Error.Forbidden("POS.DiscountNeedsManager", $"الخصم أكبر من حد الكاشير ({cap:0.##}%). اطلب من المدير تنفيذه.");

    public static Error DiscountApprovalRequired(decimal cap) =>
        Error.Forbidden("POS.DiscountApprovalRequired", $"الخصم أكبر من حد الكاشير ({cap:0.##}%). أدخل رمز المدير.");

    public static readonly Error InvalidApprovalPin =
        Error.Forbidden("POS.InvalidApprovalPin", "رمز المدير غير صحيح.");

    public static readonly Error ApprovalPinLocked =
        Error.Forbidden("POS.ApprovalPinLocked", "أُوقف رمز المدير مؤقتاً بعد محاولات خاطئة. حاول بعد ربع ساعة.");

    public static readonly Error ApprovalPinNotSet =
        Error.Forbidden("POS.ApprovalPinNotSet", "لم يُضبط رمز موافقة المدير لهذا الفرع.");

    public static Error UnknownProduct(string name) =>
        Error.Validation("POS.UnknownProduct", $"الصنف «{name}» غير موجود في الكتالوج.");

    public static Error PriceBelowCatalog(string name) =>
        Error.Validation("POS.PriceBelowCatalog", $"سعر «{name}» أقل من سعر الكتالوج. احذفه وأعد إضافته، أو استخدم الخصم.");

    public static Error ModifierUnavailable(string product) =>
        Error.Validation("POS.ModifierUnavailable", $"إحدى إضافات «{product}» لم تعد متاحة. احذفه وأعد إضافته.");

    public static Error ModifierNotForProduct(string product, string option) =>
        Error.Validation("POS.ModifierNotForProduct", $"الإضافة «{option}» لا تخص «{product}».");

    public static Error ModifierRequired(string product, string group) =>
        Error.Validation("POS.ModifierRequired", $"اختر «{group}» لـ«{product}».");

    public static Error ModifierSelection(string product, string group, int min, int max) =>
        Error.Validation(
            "POS.ModifierSelection",
            $"«{group}» في «{product}»: {(min == max ? $"اختر {max}" : min == 0 ? $"حتى {max}" : $"اختر من {min} إلى {max}")}.");
}
