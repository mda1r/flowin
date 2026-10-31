using ErrorOr;

namespace NexusPOS.CRM.Domain;

public static class CrmErrors
{
    public static readonly Error CustomerNotFound =
        Error.NotFound("Customer.NotFound", "العميل غير موجود");

    public static readonly Error CustomerEmailTaken =
        Error.Conflict("Customer.EmailTaken", "يوجد عميل بنفس البريد الإلكتروني");

    public static readonly Error CustomerPhoneTaken =
        Error.Conflict("Customer.PhoneTaken", "يوجد عميل مسجّل بنفس رقم الجوال");

    public static readonly Error InsufficientLoyaltyPoints =
        Error.Validation("Customer.InsufficientLoyaltyPoints", "نقاط العميل لا تكفي");

    public static readonly Error InvalidLoyaltyPoints =
        Error.Validation("Customer.InvalidLoyaltyPoints", "النقاط يجب أن تكون أكبر من صفر");
}
