using ErrorOr;

namespace NexusPOS.Zatca.Domain;

public static class ZatcaErrors
{
    public static Error SettingsNotFound => Error.NotFound(
        "Zatca.SettingsNotFound",
        "ZATCA settings not found. Please configure seller name and VAT number first.");

    public static Error InvoiceNotFound => Error.NotFound(
        "Zatca.InvoiceNotFound",
        "ZATCA invoice not found for the specified order.");
}
