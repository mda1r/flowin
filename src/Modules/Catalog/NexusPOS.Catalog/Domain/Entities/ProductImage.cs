namespace NexusPOS.Catalog.Domain.Entities;

// A product photo, kept in the database so it survives redeploys. One per product: a new upload replaces it,
// under a new id, so its address can be cached for good.
public sealed class ProductImage
{
    public const int MaxBytes = 1_500_000;

    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public Guid ProductId { get; private set; }
    public string ContentType { get; private set; } = null!;
    public byte[] Data { get; private set; } = [];
    public DateTime CreatedAt { get; private set; }

    private ProductImage() { }

    public static ProductImage Create(Guid tenantId, Guid productId, string contentType, byte[] data) => new()
    {
        Id = Guid.NewGuid(),
        TenantId = tenantId,
        ProductId = productId,
        ContentType = contentType,
        Data = data,
        CreatedAt = DateTime.UtcNow,
    };

    /// <summary>The image's real type from its first bytes (JPEG, PNG or WebP); null for anything else.</summary>
    public static string? SniffContentType(ReadOnlySpan<byte> data)
    {
        if (data.Length >= 3 && data[0] == 0xFF && data[1] == 0xD8 && data[2] == 0xFF)
        {
            return "image/jpeg";
        }

        if (data.Length >= 8 && data[..8].SequenceEqual(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }))
        {
            return "image/png";
        }

        if (data.Length >= 12 && data[..4].SequenceEqual("RIFF"u8) && data[8..12].SequenceEqual("WEBP"u8))
        {
            return "image/webp";
        }

        return null;
    }

    public static string UrlFor(Guid imageId) => $"/api/v1/media/products/{imageId}";
}
