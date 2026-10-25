namespace NexusPOS.CRM.Domain.Marketing;

// The store's own WhatsApp Business (Cloud) API account. The token is never sent back to the browser.
public sealed class WhatsAppSettings
{
    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public string PhoneNumberId { get; private set; } = string.Empty;
    public string AccessToken { get; private set; } = string.Empty;

    // An approved marketing template: body {{1}} is the offer text (or {{1}} name and {{2}} offer text),
    // with an optional image header.
    public string TemplateName { get; private set; } = string.Empty;
    public string LanguageCode { get; private set; } = "ar";
    public bool HasImageHeader { get; private set; }
    public bool IncludeNameVariable { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    private WhatsAppSettings() { }

    public static WhatsAppSettings Create(Guid tenantId) => new() { Id = Guid.NewGuid(), TenantId = tenantId };

    public void Update(
        string phoneNumberId, string? accessToken, string templateName, string languageCode,
        bool hasImageHeader, bool includeNameVariable)
    {
        PhoneNumberId = phoneNumberId.Trim();
        if (!string.IsNullOrWhiteSpace(accessToken))
        {
            AccessToken = accessToken.Trim();
        }

        TemplateName = templateName.Trim();
        LanguageCode = languageCode.Trim();
        HasImageHeader = hasImageHeader;
        IncludeNameVariable = includeNameVariable;
        UpdatedAt = DateTime.UtcNow;
    }

    public bool IsConfigured =>
        PhoneNumberId.Length > 0 && AccessToken.Length > 0 && TemplateName.Length > 0 && LanguageCode.Length > 0;

    public string? TokenHint => AccessToken.Length >= 4 ? "…" + AccessToken[^4..] : null;
}
