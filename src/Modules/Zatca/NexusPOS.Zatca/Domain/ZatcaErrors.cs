using ErrorOr;

namespace NexusPOS.Zatca.Domain;

public static class ZatcaErrors
{
    public static Error SettingsNotFound => Error.NotFound(
        "Zatca.SettingsNotFound",
        "أكمل إعدادات الفوترة الإلكترونية أولاً: اسم البائع والرقم الضريبي");

    public static Error InvoiceNotFound => Error.NotFound(
        "Zatca.InvoiceNotFound",
        "لا توجد فاتورة إلكترونية لهذا الطلب");
}
