namespace NexusPOS.CRM.Domain.Marketing;

// An offer image. Stored in the database because the server's disk does not survive a deploy, and served
// publicly by its random id so WhatsApp and customers' phones can open it.
public sealed class MarketingMedia
{
    public const int MaxBytes = 2 * 1024 * 1024;
    public static readonly IReadOnlySet<string> AllowedTypes = new HashSet<string> { "image/jpeg", "image/png", "image/webp" };

    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public string ContentType { get; private set; } = string.Empty;
    public byte[] Data { get; private set; } = [];
    public DateTime CreatedAt { get; private set; }

    private MarketingMedia() { }

    public static MarketingMedia Create(Guid tenantId, string contentType, byte[] data) => new()
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        ContentType = contentType,
        Data = data,
        CreatedAt = DateTime.UtcNow,
    };
}
