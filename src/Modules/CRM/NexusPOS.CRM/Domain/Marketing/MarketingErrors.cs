using ErrorOr;

namespace NexusPOS.CRM.Domain.Marketing;

public static class MarketingErrors
{
    public static readonly Error EmptyMessage = Error.Validation("Marketing.EmptyMessage", "اكتب نص العرض أو أضف صورة.");
    public static readonly Error MessageTooLong = Error.Validation(
        "Marketing.MessageTooLong", $"نص العرض أطول من {MarketingCampaign.MaxMessageLength} حرف.");
    public static readonly Error NoRecipients = Error.Validation(
        "Marketing.NoRecipients", "لا يوجد عملاء موافقون على العروض ولديهم جوال صحيح ضمن اختيارك.");
    public static readonly Error TooManyRecipients = Error.Validation(
        "Marketing.TooManyRecipients", $"الحد {MarketingCampaign.MaxRecipients} عميل في الحملة الواحدة.");
    public static readonly Error CampaignNotFound = Error.NotFound("Marketing.CampaignNotFound", "الحملة غير موجودة.");
    public static readonly Error RecipientNotFound = Error.NotFound("Marketing.RecipientNotFound", "المستلم غير موجود.");
    public static readonly Error MediaNotFound = Error.NotFound("Marketing.MediaNotFound", "الصورة غير موجودة.");
    public static readonly Error InvalidImage = Error.Validation(
        "Marketing.InvalidImage", "الصورة يجب أن تكون JPG أو PNG أو WEBP وحجمها أقل من 2 ميجا.");
    public static readonly Error ApiNotConfigured = Error.Validation(
        "Marketing.ApiNotConfigured", "أكمل إعدادات واتساب للأعمال أولاً (رقم الهاتف والتوكن والقالب).");
    public static readonly Error ImageRequiredByTemplate = Error.Validation(
        "Marketing.ImageRequiredByTemplate", "قالب واتساب المعتمد يتطلب صورة، أضف صورة للحملة.");
    public static readonly Error SendingElsewhere = Error.Conflict(
        "Marketing.SendingElsewhere", "الحملة تُرسل الآن من جهاز أو نافذة أخرى. إن أُغلقت فستتاح خلال دقيقة ونصف.");
    public static readonly Error InvalidTestPhone = Error.Validation(
        "Marketing.InvalidTestPhone", "اكتب رقم جوال صحيحاً للتجربة، مثل 05XXXXXXXX.");
    public static readonly Error WrongChannel = Error.Validation(
        "Marketing.WrongChannel", "هذا الإجراء لا يناسب طريقة إرسال الحملة.");

    // Something every recipient would hit (token, template, payment, connection): sending stops, nobody is lost.
    public static Error SendStopped(string? reason) =>
        Error.Failure("Marketing.SendStopped", string.IsNullOrWhiteSpace(reason) ? "توقف الإرسال، حاول مرة أخرى." : reason);
}
