namespace NexusPOS.Zatca.Application.Common;

public sealed record ZatcaSettingsResponse(
    Guid Id,
    string SellerName,
    string VatRegistrationNumber,
    bool IsPhase2Enabled,
    bool HasCertificate,
    DateTime? CertificateExpiryDate,
    int InvoiceCounter,
    DateTime UpdatedAt);
