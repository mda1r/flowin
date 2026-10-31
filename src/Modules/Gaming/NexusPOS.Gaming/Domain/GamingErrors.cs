using ErrorOr;

namespace NexusPOS.Gaming.Domain;

public static class GamingErrors
{
    public static readonly Error StationNotFound =
        Error.NotFound("GameStation.NotFound", "الجهاز غير موجود");

    public static readonly Error InvalidHourlyRate =
        Error.Validation("GameStation.InvalidHourlyRate", "سعر الساعة يجب أن يكون أكبر من صفر");

    public static readonly Error StationNotAvailable =
        Error.Conflict("GameStation.NotAvailable", "الجهاز غير متاح لبدء جلسة");

    public static readonly Error StationNotInUse =
        Error.Conflict("GameStation.NotInUse", "الجهاز غير مشغول حالياً");

    public static readonly Error StationInUse =
        Error.Conflict("GameStation.InUse", "أنهِ الجلسة الجارية قبل تحويل الجهاز للصيانة.");

    public static readonly Error StationNotInMaintenance =
        Error.Conflict("GameStation.NotInMaintenance", "الجهاز ليس في الصيانة.");

    public static readonly Error StationHasActiveSession =
        Error.Conflict("GameStation.HasActiveSession", "على هذا الجهاز جلسة جارية بالفعل.");

    public static readonly Error RateOverrideNotAllowed =
        Error.Forbidden("GameSession.RateOverrideNotAllowed", "تغيير سعر الساعة للمالك أو المدير فقط.");

    public static readonly Error SessionNotFound =
        Error.NotFound("GameSession.NotFound", "الجلسة غير موجودة");

    public static readonly Error SessionNotActive =
        Error.Conflict("GameSession.NotActive", "الجلسة غير نشطة");

    public static readonly Error NoActiveSession =
        Error.Conflict("GameSession.NoActive", "لا توجد جلسة نشطة على هذا الجهاز");

    public static readonly Error SessionNotCompleted =
        Error.Conflict("GameSession.NotCompleted", "أنهِ الجلسة قبل الدفع");

    public static readonly Error SessionAlreadyPaid =
        Error.Conflict("GameSession.AlreadyPaid", "هذه الجلسة مدفوعة مسبقاً.");

    public static readonly Error PackageNotFound =
        Error.NotFound("GamingPackage.NotFound", "الباقة غير موجودة.");

    public static readonly Error PackageNotForStation =
        Error.Validation("GamingPackage.NotForStation", "هذه الباقة لا تنطبق على نوع هذا الجهاز.");
}
