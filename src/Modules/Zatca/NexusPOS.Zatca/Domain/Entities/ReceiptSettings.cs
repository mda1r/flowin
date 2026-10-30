namespace NexusPOS.Zatca.Domain.Entities;

// How the store's printed and shared receipts look: its logo, contact lines, notes above and below,
// and the width of its receipt printer. The legal fields (seller name, VAT number) stay in ZatcaSettings.
public sealed class ReceiptSettings
{
    public static readonly IReadOnlySet<int> PaperWidths = new HashSet<int> { 58, 80 };

    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public string? LogoPath { get; private set; }
    public string? Phone { get; private set; }
    public string? Address { get; private set; }
    public string? HeaderNote { get; private set; }
    public string? FooterNote { get; private set; }
    public int PaperWidthMm { get; private set; } = 80;
    public bool ShowPoweredBy { get; private set; } = true;
    public DateTime UpdatedAt { get; private set; }

    private ReceiptSettings() { }

    public static ReceiptSettings Create(Guid tenantId) => new() { Id = Guid.NewGuid(), TenantId = tenantId };

    public void Update(
        string? logoPath, string? phone, string? address, string? headerNote, string? footerNote,
        int paperWidthMm, bool showPoweredBy)
    {
        LogoPath = Clean(logoPath);
        Phone = Clean(phone);
        Address = Clean(address);
        HeaderNote = Clean(headerNote);
        FooterNote = Clean(footerNote);
        PaperWidthMm = paperWidthMm;
        ShowPoweredBy = showPoweredBy;
        UpdatedAt = DateTime.UtcNow;
    }

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
