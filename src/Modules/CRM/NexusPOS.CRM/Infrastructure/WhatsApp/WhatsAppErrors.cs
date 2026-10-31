namespace NexusPOS.CRM.Infrastructure.WhatsApp;

// Turns Meta's error codes into a short Arabic reason the owner can act on, and decides whether the problem is
// the store's account (every recipient would fail the same way, so sending stops) or just this one customer.
// Codes: https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes
internal static class WhatsAppErrors
{
    public const string Connection = "تعذّر الاتصال بواتساب، تحقق من الإنترنت ثم تابع الإرسال.";

    private const string TokenExpired = "التوكن منتهي أو غير صحيح، حدّثه من إعدادات واتساب.";
    private const string NoPermission = "التوكن لا يملك صلاحية الإرسال من هذا الرقم، راجع صلاحيات System User في Meta.";
    private const string RateLimited = "وصلت حد الإرسال المسموح من Meta، انتظر قليلاً ثم تابع.";

    private static readonly Dictionary<int, string> _campaignWide = new()
    {
        [0] = TokenExpired,
        [190] = TokenExpired,
        [10] = NoPermission,
        [131005] = NoPermission,
        [100] = "رفض واتساب الطلب، تأكد من معرّف رقم الهاتف وإعدادات القالب.",
        [4] = RateLimited,
        [80007] = RateLimited,
        [130429] = RateLimited,
        [2] = "خدمة Meta غير متاحة الآن، حاول بعد قليل.",
        [131016] = "خدمة واتساب متوقفة مؤقتاً، حاول بعد قليل.",
        [131031] = "حساب واتساب للأعمال موقوف من Meta، راجع WhatsApp Manager.",
        [131042] = "مشكلة في الدفع بحساب Meta، أضف وسيلة دفع صالحة من Business Manager.",
        [131048] = "قيّد واتساب رقمك مؤقتاً بسبب بلاغات، أوقف الإرسال فترة.",
        [131057] = "حساب واتساب للأعمال تحت الصيانة، حاول لاحقاً.",
        [131008] = "القالب يطلب متغيرات ناقصة، راجع شكل القالب في إعدادات واتساب.",
        [132000] = "عدد متغيرات القالب لا يطابق الإعدادات، راجع خيار «اسم العميل» في إعدادات واتساب.",
        [132001] = "القالب غير موجود أو لم يُعتمد بهذه اللغة، راجع اسم القالب ولغته.",
        [132005] = "نص العرض أطول مما يسمح به القالب، اختصره.",
        [132007] = "نص العرض يخالف سياسة قوالب واتساب، عدّله.",
        [132012] = "شكل القالب لا يطابق الإعدادات (الصورة أو المتغيرات).",
        [132015] = "القالب موقوف مؤقتاً من Meta لانخفاض جودته.",
        [132016] = "القالب معطّل من Meta، أنشئ قالباً جديداً.",
        [133010] = "رقم واتساب للأعمال غير مسجّل في Cloud API بعد.",
        [368] = "الحساب محظور مؤقتاً لمخالفة سياسات Meta.",
    };

    private static readonly Dictionary<int, string> _perRecipient = new()
    {
        [131026] = "الرقم غير مسجّل في واتساب أو لا يستقبل الرسائل",
        [131049] = "لم تُسلَّم: Meta تحدّ من العروض لهذا العميل، جرّب بعد أيام",
        [131047] = "مرّ أكثر من ٢٤ ساعة على آخر رسالة من العميل",
        [131050] = "العميل أوقف استلام الرسائل التسويقية",
        [131030] = "الرقم غير مضاف لقائمة الأرقام التجريبية في Meta",
        [131056] = "رسائل كثيرة لنفس العميل في وقت قصير، أعد المحاولة لاحقاً",
        [131021] = "لا يمكن الإرسال لرقم المتجر نفسه",
        [131009] = "رقم العميل أو أحد المتغيرات غير صالح",
        [131000] = "خطأ مؤقت من واتساب، أعد المحاولة",
    };

    public static WhatsAppSendResult Describe(int httpStatus, int? code, int? subcode, string? metaMessage)
    {
        if (code is int c)
        {
            if (c == 100 && subcode == 33)
            {
                return Stop("معرّف رقم الهاتف غير صحيح أو التوكن لا يصل إليه، راجع إعدادات واتساب.", c);
            }

            if (_campaignWide.TryGetValue(c, out string? campaignReason))
            {
                return Stop(campaignReason, c);
            }

            // 200–299 are Graph permission errors.
            if (c is >= 200 and <= 299)
            {
                return Stop(NoPermission, c);
            }

            if (_perRecipient.TryGetValue(c, out string? recipientReason))
            {
                return new WhatsAppSendResult(false, null, $"{recipientReason} ({c})", WhatsAppFailure.Recipient);
            }
        }

        if (httpStatus is 401 or 403)
        {
            return Stop(TokenExpired, code);
        }

        string detail = string.IsNullOrWhiteSpace(metaMessage) ? $"HTTP {httpStatus}" : metaMessage.Trim();
        return new WhatsAppSendResult(
            false, null, code is int known ? $"رفض واتساب الرسالة: {detail} ({known})" : $"رفض واتساب الرسالة: {detail}", WhatsAppFailure.Recipient);
    }

    private static WhatsAppSendResult Stop(string reason, int? code) =>
        new(false, null, code is int c ? $"{reason} ({c})" : reason, WhatsAppFailure.Campaign);
}
