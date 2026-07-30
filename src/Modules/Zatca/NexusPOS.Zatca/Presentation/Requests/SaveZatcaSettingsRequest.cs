namespace NexusPOS.Zatca.Presentation.Requests;

public sealed record SaveZatcaSettingsRequest(
    string SellerName,
    string VatRegistrationNumber,
    bool IsPhase2Enabled,
    string? CertificateBase64,
    DateTime? CertificateExpiryDate);
