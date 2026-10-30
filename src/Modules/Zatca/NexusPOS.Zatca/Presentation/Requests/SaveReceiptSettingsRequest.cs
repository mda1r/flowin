namespace NexusPOS.Zatca.Presentation.Requests;

public sealed record SaveReceiptSettingsRequest(
    string? LogoPath,
    string? Phone,
    string? Address,
    string? HeaderNote,
    string? FooterNote,
    int PaperWidthMm,
    bool ShowPoweredBy);
