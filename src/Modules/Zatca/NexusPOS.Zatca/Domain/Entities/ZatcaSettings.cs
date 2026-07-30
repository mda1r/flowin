namespace NexusPOS.Zatca.Domain.Entities;

public sealed class ZatcaSettings
{
    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public string SellerName { get; private set; } = null!;
    public string VatRegistrationNumber { get; private set; } = null!;
    public bool IsPhase2Enabled { get; private set; }
    public string? CertificateBase64 { get; private set; }
    public DateTime? CertificateExpiryDate { get; private set; }
    public int InvoiceCounter { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    private ZatcaSettings() { }

    public static ZatcaSettings Create(
        Guid tenantId,
        string sellerName,
        string vatRegistrationNumber)
    {
        return new ZatcaSettings
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            SellerName = sellerName.Trim(),
            VatRegistrationNumber = vatRegistrationNumber.Trim(),
            IsPhase2Enabled = false,
            InvoiceCounter = 0,
            UpdatedAt = DateTime.UtcNow,
        };
    }

    public void Update(string sellerName, string vatRegistrationNumber, bool isPhase2Enabled, string? certificateBase64, DateTime? certificateExpiry)
    {
        SellerName = sellerName.Trim();
        VatRegistrationNumber = vatRegistrationNumber.Trim();
        IsPhase2Enabled = isPhase2Enabled;
        CertificateBase64 = certificateBase64;
        CertificateExpiryDate = certificateExpiry;
        UpdatedAt = DateTime.UtcNow;
    }

    public string IncrementAndGetInvoiceNumber()
    {
        InvoiceCounter++;
        UpdatedAt = DateTime.UtcNow;
        return $"INV-{InvoiceCounter:D6}";
    }
}
