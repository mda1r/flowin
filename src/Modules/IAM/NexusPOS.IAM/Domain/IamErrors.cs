using ErrorOr;

namespace NexusPOS.IAM.Domain;

public static class IamErrors
{
    public static readonly Error UserNotFound =
        Error.NotFound("IAM.UserNotFound", "المستخدم غير موجود");

    public static readonly Error EmailAlreadyExists =
        Error.Conflict("IAM.EmailAlreadyExists", "يوجد مستخدم بنفس البريد الإلكتروني");

    public static readonly Error InvalidCredentials =
        Error.Unauthorized("IAM.InvalidCredentials", "البريد الإلكتروني أو كلمة المرور غير صحيحة");

    public static readonly Error AccountLocked =
        Error.Forbidden("IAM.AccountLocked", "الحساب مقفل مؤقتاً بسبب محاولات دخول فاشلة متكررة");

    public static readonly Error InvalidRefreshToken =
        Error.Unauthorized("IAM.InvalidRefreshToken", "انتهت الجلسة، سجّل الدخول مرة أخرى");

    public static readonly Error RefreshTokenExpired =
        Error.Unauthorized("IAM.RefreshTokenExpired", "انتهت الجلسة، سجّل الدخول مرة أخرى");

    public static readonly Error UserInactive =
        Error.Forbidden("IAM.UserInactive", "هذا الحساب موقوف");

    public static readonly Error TenantSuspended =
        Error.Forbidden("IAM.TenantSuspended", "الحساب موقوف، تواصل مع الدعم");

    public static readonly Error TooManyRequests =
        Error.Custom(429, "IAM.TooManyRequests", "محاولات كثيرة، حاول لاحقاً");
}
